const prisma = require("../utils/prisma");
const { calculateCompOffBalance } = require("../utils/attendance");
const { createNotification } = require("../services/notificationService");

// Apply for Leave
const applyLeave = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { fromDate, toDate, reason, approverIds, leaveType } = req.body;

        if (!fromDate || !toDate || !reason || !approverIds || approverIds.length === 0) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Calculate total days
        const from = new Date(fromDate);
        const to = new Date(toDate);
        const totalDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;

        if (totalDays <= 0) {
            return res.status(400).json({ message: "Invalid date range" });
        }

        if (leaveType === "COMP_OFF") {
            const balance = await calculateCompOffBalance(userId);
            if (totalDays > balance) {
                return res.status(400).json({ 
                    message: `Insufficient Comp Off balance. You requested ${totalDays} day(s) but only have ${balance} day(s) available.` 
                });
            }
        }

        const type = ["WFH", "COMP_OFF"].includes(leaveType) ? leaveType : "LEAVE";

        // Create leave with approvals
        const leave = await prisma.leave.create({
            data: {
                userId,
                fromDate: from,
                toDate: to,
                totalDays,
                reason,
                leaveType: type,
                approvals: {
                    create: approverIds.map(approverId => ({
                        approverId
                    }))
                }
            },
            include: {
                approvals: {
                    include: {
                        approver: {
                            select: { id: true, name: true, email: true }
                        }
                    }
                }
            }
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
        console.error("Apply leave error:", error);
        res.status(500).json({ message: "Failed to apply for leave" });
    }
};

// Get My Leaves
const getMyLeaves = async (req, res) => {
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
        console.error("Get my leaves error:", error);
        res.status(500).json({ message: "Failed to fetch leaves" });
    }
};

// Get Pending Leaves (Admin)
const getPendingLeaves = async (req, res) => {
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
        console.error("Get pending leaves error:", error);
        res.status(500).json({ message: "Failed to fetch pending leaves" });
    }
};

// Get All Leaves (Admin)
const getAllLeaves = async (req, res) => {
    try {
        const leaves = await prisma.leave.findMany({
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
        console.error("Get all leaves error:", error);
        res.status(500).json({ message: "Failed to fetch leaves" });
    }
};

// Approve Leave
const approveLeave = async (req, res) => {
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
            data: { status: 'APPROVED', comments }
        });

        // Check if all approvals are done
        const allApprovals = await prisma.leaveApproval.findMany({
            where: { leaveId: id }
        });

        const allApproved = allApprovals.every(a => a.status === 'APPROVED');

        if (allApproved) {
            await prisma.leave.update({
                where: { id },
                data: { status: 'APPROVED' }
            });

            // Create attendance records (LEAVE or WFH) for the period
            await createAttendanceForLeave(leave);
        }

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
        console.error("Approve leave error:", error);
        res.status(500).json({ message: "Failed to approve leave" });
    }
};

// Reject Leave
const rejectLeave = async (req, res) => {
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
        console.error("Reject leave error:", error);
        res.status(500).json({ message: "Failed to reject leave" });
    }
};

// Helper: Create attendance records for approved leave
const createAttendanceForLeave = async (leave) => {
    const { userId, fromDate, toDate, leaveType } = leave;
    const current = new Date(fromDate);
    const end = new Date(toDate);
    
    // Default to LEAVE if not WFH or COMP_OFF
    const attendanceStatus = (leaveType === "WFH" || leaveType === "COMP_OFF") ? leaveType : "LEAVE";

    while (current <= end) {
        try {
            const dateOnly = new Date(current.getFullYear(), current.getMonth(), current.getDate());

            await prisma.attendance.upsert({
                where: { userId_date: { userId, date: dateOnly } },
                update: { status: attendanceStatus },
                create: { userId, date: dateOnly, status: attendanceStatus }
            });
        } catch (error) {
            console.error("Error creating attendance for", current, error);
        }
        current.setDate(current.getDate() + 1);
    }
};

// Get Leave Stats
const getLeaveStats = async (req, res) => {
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
        console.error("Get leave stats error:", error);
        res.status(500).json({ message: "Failed to fetch leave stats" });
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
