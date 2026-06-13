const prisma = require("../utils/prisma");
const { currentFYStart } = require("../utils/attendance");
const { createNotification } = require("../services/notificationService");
const { getTeamMemberIds } = require("../services/organizationService");

const fmtDate = (d) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });

// Postgres exclusion constraint violation code is 23P01.
// Prisma surfaces it inside the error message string.
const isOverlapViolation = (err) =>
    err?.message?.includes("Leave_no_approved_overlap") ||
    err?.message?.includes("23P01");

// Fetch the conflicting approved leave for a user + date range (for error context).
const findConflict = (userId, from, to, excludeId = null) =>
    prisma.leave.findFirst({
        where: {
            userId,
            status: "APPROVED",
            fromDate: { lte: to },
            toDate:   { gte: from },
            ...(excludeId && { id: { not: excludeId } }),
        },
        select: { fromDate: true, toDate: true },
    });

// Apply for Leave
const applyLeave = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { fromDate, toDate, reason, approverIds, leaveType } = req.body;

        if (!fromDate || !toDate || !reason || !approverIds || approverIds.length === 0) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Accountability: you cannot be your own approver. A manager's leave must
        // be approved by someone above them, never self-approved.
        if (approverIds.includes(userId)) {
            return res.status(400).json({ message: "You cannot select yourself as an approver." });
        }

        // Calculate total days
        const from = new Date(fromDate);
        const to = new Date(toDate);

        if (isNaN(from.getTime()) || isNaN(to.getTime())) {
            return res.status(400).json({ message: "Invalid date format" });
        }
        if (from > to) {
            return res.status(400).json({ message: "Start date cannot be after end date" });
        }

        const totalDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

        const type = ["WFH", "COMP_OFF"].includes(leaveType) ? leaveType : "LEAVE";

        // Create leave inside a transaction so the overlap check, comp off balance check,
        // and insert are all atomic — prevents race conditions on concurrent submissions.
        const leave = await prisma.$transaction(async (tx) => {
            // Comp off balance check must be inside the tx so two concurrent requests
            // for the same user both see the committed state and can't both pass.
            if (leaveType === "COMP_OFF") {
                const since = currentFYStart();
                const now   = new Date();

                const earnedRows = await tx.$queryRaw`
                    SELECT COUNT(*)::int AS earned
                    FROM "Attendance"
                    WHERE "userId" = ${userId}
                      AND status   = 'PRESENT'
                      AND date     >= ${since}
                      AND EXTRACT(DOW FROM date) = 0
                `;
                const earned = earnedRows[0]?.earned ?? 0;

                const usedLeaves = await tx.leave.findMany({
                    where: {
                        userId,
                        leaveType: "COMP_OFF",
                        status:    "APPROVED",
                        fromDate:  { lte: now },
                        toDate:    { gte: since },
                    },
                    select: { fromDate: true, toDate: true },
                });

                const MS_PER_DAY = 86_400_000;
                const used = usedLeaves.reduce((sum, l) => {
                    const overlapStart = l.fromDate > since ? l.fromDate : since;
                    const overlapEnd   = l.toDate   < now   ? l.toDate   : now;
                    const overlapMs    = Math.max(0, overlapEnd - overlapStart);
                    return sum + (overlapMs > 0 ? Math.floor(overlapMs / MS_PER_DAY) + 1 : 0);
                }, 0);

                const balance = Math.max(0, earned - used);
                if (totalDays > balance) {
                    throw Object.assign(
                        new Error(`Insufficient Comp Off balance. You requested ${totalDays} day(s) but only have ${balance} day(s) available.`),
                        { statusCode: 400 }
                    );
                }
            }

            const overlap = await tx.leave.findFirst({
                where: {
                    userId,
                    status: { in: ["PENDING", "APPROVED"] },
                    fromDate: { lte: to },
                    toDate: { gte: from }
                },
                select: { fromDate: true, toDate: true, status: true }
            });

            if (overlap) {
                const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
                throw Object.assign(
                    new Error(`You already have a ${overlap.status.toLowerCase()} leave from ${fmt(overlap.fromDate)} to ${fmt(overlap.toDate)} that overlaps with these dates.`),
                    { statusCode: 409 }
                );
            }

            return tx.leave.create({
                data: {
                    userId,
                    fromDate: from,
                    toDate: to,
                    totalDays,
                    reason,
                    leaveType: type,
                    approvals: {
                        create: approverIds.map(approverId => ({ approverId }))
                    }
                },
                include: {
                    approvals: {
                        include: {
                            approver: { select: { id: true, name: true, email: true } }
                        }
                    }
                }
            });
        });

        res.json({ message: "Leave application submitted", leave });

        // Notify all approvers about the new leave request
        const applicant = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true }
        });
        const fromStr = new Date(fromDate).toLocaleDateString("en-IN", { dateStyle: "medium" });
        const toStr   = new Date(toDate).toLocaleDateString("en-IN", { dateStyle: "medium" });
        for (const approverId of approverIds) {
            createNotification({
                userId:  approverId,
                title:   "📅 New Leave Request",
                message: `${applicant?.name || "An employee"} has applied for leave from ${fromStr} to ${toStr} (${totalDays} day${totalDays > 1 ? "s" : ""}). Reason: ${reason}.`,
                type:    "LEAVE_REQUESTED",
                link:    "/leave"
            }).catch(err => console.error("[Notification] LEAVE_REQUESTED failed:", err));
        }
    } catch (error) {
        if (error.statusCode === 409) {
            return next(error);
        }
        // DB exclusion constraint tripped (race between two simultaneous submissions)
        if (isOverlapViolation(error)) {
            const conflict = await findConflict(userId, from, to).catch(() => null);
            return res.status(409).json({
                message: conflict
                    ? `Leave overlaps with an approved leave from ${fmtDate(conflict.fromDate)} to ${fmtDate(conflict.toDate)}.`
                    : "Leave overlaps with an already approved leave for these dates.",
            });
        }
        console.error("Apply leave error:", error);
        return next(error);
    }
};

// Get My Leaves
const getMyLeaves = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        const leaves = await prisma.leave.findMany({
            where: { userId },
            include: {
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(leaves);
    } catch (error) {

        return next(error);
    }
};

// Get Pending Leaves (Admin)
const getPendingLeaves = async (req, res, next) => {
    try {
        const userId = req.user.userId;

        // Get leaves where current user is an approver and hasn't approved yet
        const leaves = await prisma.leave.findMany({
            where: {
                approvals: {
                    some: {
                        approverId: userId,
                        status: 'PENDING'
                    }
                }
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: true
                    }
                },
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(leaves);
    } catch (error) {

        return next(error);
    }
};

// Get All Leaves (Admin) — managers see only their own team's leaves
const getAllLeaves = async (req, res, next) => {
    try {
        const where = {};
        if (req.user.role === "ADMIN") {
            const teamIds = await getTeamMemberIds(req.user.userId);
            where.userId = { in: [...teamIds, req.user.userId] };
        }
        const leaves = await prisma.leave.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: true
                    }
                },
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        res.json(leaves);
    } catch (error) {

        return next(error);
    }
};

// Approve Leave
const approveLeave = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { comments } = req.body;

        const leave = await prisma.leave.findUnique({
            where: { id },
            include: { approvals: true }
        });

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        // Accountability guard: no one approves their own leave, even if somehow
        // listed as an approver. Their leave must be signed off higher up the chain.
        if (leave.userId === userId) {
            return res.status(403).json({ message: "You cannot approve your own leave request." });
        }

        const approval = leave.approvals.find(a => a.approverId === userId);

        if (!approval) {
            return res.status(403).json({ message: "You are not an approver for this leave" });
        }

        // Atomic: update approval + check all approved + overlap guard + status update in one tx.
        // Without a transaction, two concurrent approvers could both pass the overlap check and
        // both set the leave to APPROVED before either sees the other's write.
        let allApproved = false;
        await prisma.$transaction(async (tx) => {
            await tx.leaveApproval.update({
                where: { id: approval.id },
                data: { status: 'APPROVED', comments }
            });

            const allApprovals = await tx.leaveApproval.findMany({
                where: { leaveId: id }
            });

            allApproved = allApprovals.every(a => a.status === 'APPROVED');

            if (!allApproved) return;

            const overlap = await tx.leave.findFirst({
                where: {
                    userId: leave.userId,
                    status: "APPROVED",
                    id: { not: id },
                    fromDate: { lte: leave.toDate },
                    toDate: { gte: leave.fromDate }
                },
                select: { fromDate: true, toDate: true }
            });

            if (overlap) {
                const fmt = (d) => new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium" });
                throw Object.assign(
                    new Error(`Cannot approve: an overlapping leave (${fmt(overlap.fromDate)} – ${fmt(overlap.toDate)}) is already approved for this employee.`),
                    { statusCode: 409 }
                );
            }

            await tx.leave.update({
                where: { id },
                data: { status: 'APPROVED' }
            });

            // Inside the transaction: if attendance creation fails, the whole tx rolls back —
            // leave stays PENDING and no partial state is committed.
            await createAttendanceForLeave(leave, tx);
        });

        res.json({ message: "Leave approved successfully" });

        // Notify the leave applicant
        if (allApproved) {
            createNotification({
                userId:  leave.userId,
                title:   "✅ Leave Approved",
                message: `Your leave request has been approved.`,
                type:    "LEAVE_APPROVED",
                link:    "/leave"
            }).catch(err => console.error("[Notification] LEAVE_APPROVED failed:", err));
        }
    } catch (error) {
        // Overlap thrown inside the transaction (application-level guard)
        if (error.statusCode === 409) {
            return next(error);
        }
        // DB exclusion constraint tripped (belt-and-suspenders)
        if (isOverlapViolation(error)) {
            const conflict = leave
                ? await findConflict(leave.userId, leave.fromDate, leave.toDate, leave.id).catch(() => null)
                : null;
            return res.status(409).json({
                message: conflict
                    ? `Cannot approve: an overlapping leave (${fmtDate(conflict.fromDate)} – ${fmtDate(conflict.toDate)}) was already approved for this employee.`
                    : "Cannot approve: an overlapping leave is already approved for this employee.",
            });
        }
        console.error("Approve leave error:", error);
        return next(error);
    }
};

// Reject Leave
const rejectLeave = async (req, res, next) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const { comments } = req.body;

        const leave = await prisma.leave.findUnique({
            where: { id },
            include: { approvals: true }
        });

        if (!leave) {
            return res.status(404).json({ message: "Leave not found" });
        }

        const approval = leave.approvals.find(a => a.approverId === userId);

        if (!approval) {
            return res.status(403).json({ message: "You are not an approver for this leave" });
        }

        // Update approval
        await prisma.leaveApproval.update({
            where: { id: approval.id },
            data: {
                status: 'REJECTED',
                comments
            }
        });

        // Update leave status to rejected
        await prisma.leave.update({
            where: { id },
            data: { status: 'REJECTED' }
        });

        res.json({ message: "Leave rejected" });

        // Notify the leave applicant
        createNotification({
            userId:  leave.userId,
            title:   "❌ Leave Rejected",
            message: `Your leave request has been rejected.${comments ? ` Reason: ${comments}` : ""}`,
            type:    "LEAVE_REJECTED",
            link:    "/leave"
        }).catch(err => console.error("[Notification] LEAVE_REJECTED failed:", err));
    } catch (error) {

        return next(error);
    }
};

// Helper: Create attendance records for approved leave.
// Must be called with the transaction client (tx) so failures roll back the approval too.
const createAttendanceForLeave = async (leave, tx) => {
    const { userId, fromDate, toDate, leaveType } = leave;
    const current = new Date(fromDate);
    const end = new Date(toDate);

    // AttendanceStatus enum only has WFH and LEAVE (not COMP_OFF)
    const attendanceStatus = leaveType === "WFH" ? "WFH" : "LEAVE";

    while (current <= end) {
        const dateOnly = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));

        await tx.attendance.upsert({
            where: { userId_date: { userId, date: dateOnly } },
            update: { status: attendanceStatus },
            create: { userId, date: dateOnly, status: attendanceStatus },
        });

        current.setUTCDate(current.getUTCDate() + 1);
    }
};

// Get Leave Stats
const getLeaveStats = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const currentYear = new Date().getFullYear();

        const leaves = await prisma.leave.findMany({
            where: {
                userId,
                fromDate: {
                    gte: new Date(currentYear, 0, 1)
                }
            }
        });

        const stats = {
            totalApplied: leaves.length,
            approved: leaves.filter(l => l.status === 'APPROVED').length,
            pending: leaves.filter(l => l.status === 'PENDING').length,
            rejected: leaves.filter(l => l.status === 'REJECTED').length,
            totalDaysTaken: leaves
                .filter(l => l.status === 'APPROVED')
                .reduce((sum, l) => sum + l.totalDays, 0)
        };

        res.json(stats);
    } catch (error) {

        return next(error);
    }
};

module.exports = {
    applyLeave,
    getMyLeaves,
    getPendingLeaves,
    getAllLeaves,
    approveLeave,
    rejectLeave,
    getLeaveStats
};
