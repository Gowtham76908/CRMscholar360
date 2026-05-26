const prisma = require("../utils/prisma");
const { calculateCompOffBalance, calculateCompOffBalanceBulk } = require("../utils/attendance");
const { nowIST, todayIST } = require("../utils/istTime");

// Check In
const checkIn = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { latitude, longitude } = req.body;

        // Deadline check in IST — server runs UTC, business is IST (UTC+5:30)
        const ist = nowIST();
        const isSunday = ist.getUTCDay() === 0;
        const currentTimeInMinutes = ist.getUTCHours() * 60 + ist.getUTCMinutes();

        const DEADLINE_WEEKDAY = 11 * 60 + 50; // 11:50 AM IST
        const DEADLINE_SUNDAY  = 12 * 60 + 30; // 12:30 PM IST
        const currentDeadline  = isSunday ? DEADLINE_SUNDAY : DEADLINE_WEEKDAY;

        if (currentTimeInMinutes > currentDeadline) {
            return res.status(400).json({
                message: `Check-in deadline has passed. You must check in before ${isSunday ? "12:30 PM" : "11:50 AM"} IST`,
                code: "LATE_CHECK_IN",
                deadline: isSunday ? "12:30 PM" : "11:50 AM"
            });
        }

        // IST calendar date — avoids wrong-day storage after midnight IST (still previous UTC day)
        const todayDateOnly = todayIST();

        // Check if already checked in today
        const existing = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: todayDateOnly
                }
            }
        });

        if (existing) {
            return res.status(400).json({ message: "Already checked in today" });
        }

        const locationData = (latitude && longitude)
            ? { latitude, longitude }
            : null;

        const attendance = await prisma.attendance.create({
            data: {
                userId,
                date: todayDateOnly,
                checkIn: new Date(),
                status: "PRESENT",
                location: locationData
            }
        });

        // Auto-set user to ONLINE on check-in
        await prisma.user.update({
            where: { id: userId },
            data: { onlineStatus: "ONLINE", breakStartedAt: null }
        });
        await prisma.userStatusLog.create({
            data: { userId, status: "ONLINE", note: "Checked in" }
        });

        res.json({ message: "Checked in successfully", attendance });
    } catch (error) {

        return next(error);
    }
};

// Check Out
const checkOut = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const todayDateOnly = todayIST();

        const attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId,
                    date: todayDateOnly
                }
            }
        });

        if (!attendance) {
            return res.status(404).json({ message: "No check-in found for today" });
        }

        if (attendance.checkOut) {
            return res.status(400).json({ message: "Already checked out" });
        }

        const updated = await prisma.attendance.update({
            where: { id: attendance.id },
            data: { checkOut: new Date() }
        });

        // Auto-set user to OFFLINE on check-out
        await prisma.user.update({
            where: { id: userId },
            data: { onlineStatus: "OFFLINE", breakStartedAt: null }
        });
        await prisma.userStatusLog.create({
            data: { userId, status: "OFFLINE", note: "Checked out" }
        });

        res.json({ message: "Checked out successfully", attendance: updated });
    } catch (error) {

        return next(error);
    }
};

// Get My Attendance
const getMyAttendance = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { month, year } = req.query;

        let where = { userId };

        if (month && year) {
            const startDate = new Date(Date.UTC(parseInt(year), parseInt(month) - 1, 1));
            const endDate = new Date(Date.UTC(parseInt(year), parseInt(month), 0));
            where.date = { gte: startDate, lte: endDate };
        }

        const attendance = await prisma.attendance.findMany({
            where,
            orderBy: { date: 'desc' },
            take: 200
        });

        res.json(attendance);
    } catch (error) {

        return next(error);
    }
};

// Get All Attendance (Admin)
const getAllAttendance = async (req, res, next) => {
    try {
        const { date, userId } = req.query;

        let where = {};
        if (userId) where.userId = userId;
        if (date) {
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);
            where.date = targetDate;
        }

        const attendance = await prisma.attendance.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, email: true, department: true }
                }
            },
            orderBy: { date: 'desc' },
            take: 200
        });

        res.json(attendance);
    } catch (error) {

        return next(error);
    }
};

// Get Attendance Stats
const getAttendanceStats = async (req, res, next) => {
    try {
        const userId = req.user.userId;
        const { month, year } = req.query;

        const currentDate = new Date();
        const targetMonth = parseInt(month) || (currentDate.getMonth() + 1);
        const targetYear = parseInt(year) || currentDate.getFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0));

        const attendance = await prisma.attendance.findMany({
            where: { userId, date: { gte: startDate, lte: endDate } }
        });

        const stats = {
            total: attendance.length,
            present: attendance.filter(a => a.status === 'PRESENT').length,
            absent: attendance.filter(a => a.status === 'ABSENT').length,
            leave: attendance.filter(a => a.status === 'LEAVE').length,
            wfh: attendance.filter(a => a.status === 'WFH').length,
            halfDay: attendance.filter(a => a.status === 'HALF_DAY').length,
            compOffBalance: await calculateCompOffBalance(userId)
        };

        res.json(stats);
    } catch (error) {

        return next(error);
    }
};

// Admin: Monthly Report - all employees summary
const getAdminMonthlyReport = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const targetMonth = parseInt(month) || (new Date().getMonth() + 1);
        const targetYear = parseInt(year) || new Date().getFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0));

        // Count sundays in the month
        let sundayCount = 0;
        const curr = new Date(startDate);
        while (curr <= endDate) {
            if (curr.getUTCDay() === 0) sundayCount++;
            curr.setUTCDate(curr.getUTCDate() + 1);
        }

        const totalDaysInMonth = endDate.getUTCDate();
        const workingDays = totalDaysInMonth - sundayCount;

        // 1. Employees
        const employees = await prisma.user.findMany({
            where: { role: 'EMPLOYEE', isActive: true },
            select: { id: true, name: true, email: true, department: true, jobTitle: true, createdAt: true }
        });
        const employeeIds = employees.map(e => e.id);

        // 2. Attendance counts by userId + status — DB does the counting, no raw rows in Node
        const attGroups = await prisma.attendance.groupBy({
            by: ["userId", "status"],
            where: { userId: { in: employeeIds }, date: { gte: startDate, lte: endDate } },
            _count: { _all: true }
        });

        // 3. Approved leave days by userId + leaveType — one query for all employees
        const leaveGroups = await prisma.leave.groupBy({
            by: ["userId", "leaveType"],
            where: {
                userId: { in: employeeIds },
                status: 'APPROVED',
                OR: [
                    { fromDate: { gte: startDate, lte: endDate } },
                    { toDate:   { gte: startDate, lte: endDate } },
                    { fromDate: { lte: startDate }, toDate: { gte: endDate } }
                ]
            },
            _sum: { totalDays: true }
        });

        // 4+5. Comp off balances — 2 queries total inside (Sunday earned + COMP_OFF used)
        const compOffMap = await calculateCompOffBalanceBulk(employeeIds);

        // Build O(1) lookup maps — one pass each, then O(1) per employee below
        // attMap:   userId → { status → count }
        const attMap = new Map();
        for (const row of attGroups) {
            if (!attMap.has(row.userId)) attMap.set(row.userId, {});
            attMap.get(row.userId)[row.status] = row._count._all;
        }

        // leaveMap: userId → { leaveType → totalDays }
        const leaveMap = new Map();
        for (const row of leaveGroups) {
            if (!leaveMap.has(row.userId)) leaveMap.set(row.userId, {});
            leaveMap.get(row.userId)[row.leaveType] = row._sum.totalDays ?? 0;
        }

        // Final assembly — pure O(N), no filtering loops
        const report = employees.map(emp => {
            const att   = attMap.get(emp.id)   ?? {};
            const leave = leaveMap.get(emp.id) ?? {};
            return {
                user:           emp,
                present:        att.PRESENT   ?? 0,
                absent:         att.ABSENT    ?? 0,
                leave:          att.LEAVE     ?? 0,
                wfh:            att.WFH       ?? 0,
                halfDay:        att.HALF_DAY  ?? 0,
                pendingLeaves:  leave.LEAVE   ?? 0,
                pendingWfh:     leave.WFH     ?? 0,
                compOffBalance: compOffMap.get(emp.id) ?? 0,
            };
        });

        res.json({ report, meta: { month: targetMonth, year: targetYear, workingDays, sundayCount, totalDaysInMonth } });
    } catch (error) {

        return next(error);
    }
};

// Admin: Get specific employee's monthly attendance
const getEmployeeMonthlyAttendance = async (req, res, next) => {
    try {
        const { employeeId } = req.params;
        const { month, year } = req.query;

        const targetMonth = parseInt(month) || (new Date().getMonth() + 1);
        const targetYear = parseInt(year) || new Date().getFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0));

        const employee = await prisma.user.findUnique({
            where: { id: employeeId },
            select: { id: true, name: true, email: true, department: true, jobTitle: true, createdAt: true }
        });

        if (!employee) return res.status(404).json({ message: "Employee not found" });

        const attendance = await prisma.attendance.findMany({
            where: { userId: employeeId, date: { gte: startDate, lte: endDate } },
            orderBy: { date: 'asc' }
        });

        const leaves = await prisma.leave.findMany({
            where: {
                userId: employeeId,
                OR: [
                    { fromDate: { gte: startDate, lte: endDate } },
                    { toDate: { gte: startDate, lte: endDate } },
                    { fromDate: { lte: startDate }, toDate: { gte: endDate } }
                ]
            },
            select: { id: true, fromDate: true, toDate: true, totalDays: true, leaveType: true, status: true, reason: true }
        });

        res.json({ employee, attendance, leaves, compOffBalance: await calculateCompOffBalance(employeeId) });
    } catch (error) {

        return next(error);
    }
};

// Admin: Update attendance status
const updateAttendanceStatus = async (req, res, next) => {
    try {
        const { userId, date, status } = req.body;

        if (!userId || !date || !status) {
            return res.status(400).json({ message: "userId, date, and status are required" });
        }

        const targetDate = new Date(date);
        targetDate.setUTCHours(0, 0, 0, 0);

        // Standardize check-in time for "PRESENT" if not exists
        let updateData = { status };
        if (status === 'PRESENT') {
            const existing = await prisma.attendance.findUnique({
                where: { userId_date: { userId, date: targetDate } }
            });
            if (!existing || !existing.checkIn) {
                const defaultCheckIn = new Date(targetDate);
                defaultCheckIn.setUTCHours(3, 30, 0, 0); // 9:00 AM IST approx
                updateData.checkIn = defaultCheckIn;
            }
        }

        const attendance = await prisma.attendance.upsert({
            where: {
                userId_date: { userId, date: targetDate }
            },
            update: updateData,
            create: {
                userId,
                date: targetDate,
                ...updateData
            }
        });

        res.json({ message: "Attendance status updated successfully", attendance });
    } catch (error) {

        return next(error);
    }
};

module.exports = {
    checkIn,
    checkOut,
    getMyAttendance,
    getAllAttendance,
    getAttendanceStats,
    getAdminMonthlyReport,
    getEmployeeMonthlyAttendance,
    updateAttendanceStatus
};
