const prisma = require("../utils/prisma");
const { calculateCompOffBalance } = require("../utils/attendance");

// Check In
const checkIn = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { latitude, longitude } = req.body;

        // Check-in deadline validation
        // Weekdays: 11:50 AM
        // Sundays: 12:30 PM
        const now = new Date();
        const isSunday = now.getDay() === 0;
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const currentTimeInMinutes = hours * 60 + minutes;
        
        const DEADLINE_WEEKDAY = 11 * 60 + 50; // 11:50 AM
        const DEADLINE_SUNDAY = 12 * 60 + 30;  // 12:30 PM
        const currentDeadline = isSunday ? DEADLINE_SUNDAY : DEADLINE_WEEKDAY;

        if (currentTimeInMinutes > currentDeadline) {
            return res.status(400).json({
                message: `Check-in deadline has passed. You must check in before ${isSunday ? '12:30 PM' : '11:50 AM'}`,
                code: "LATE_CHECK_IN",
                deadline: isSunday ? "12:30 PM" : "11:50 AM"
            });
        }

        // Get today's date in UTC to avoid timezone issues
        const today = new Date();
        const todayDateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

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
        console.error("CHECK-IN ERROR:", error.message);
        res.status(500).json({ message: "Failed to check in", error: error.message });
    }
};

// Check Out
const checkOut = async (req, res) => {
    try {
        const userId = req.user.userId;
        const today = new Date();
        const todayDateOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));

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
        console.error("Check-out error:", error);
        res.status(500).json({ message: "Failed to check out" });
    }
};

// Get My Attendance
const getMyAttendance = async (req, res) => {
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
        console.error("Get attendance error:", error);
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
};

// Get All Attendance (Admin)
const getAllAttendance = async (req, res) => {
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
        console.error("Get all attendance error:", error);
        res.status(500).json({ message: "Failed to fetch attendance" });
    }
};

// Get Attendance Stats
const getAttendanceStats = async (req, res) => {
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
        console.error("Get stats error:", error);
        res.status(500).json({ message: "Failed to fetch stats" });
    }
};

// Admin: Monthly Report - all employees summary
const getAdminMonthlyReport = async (req, res) => {
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

        // Get all active employees
        const employees = await prisma.user.findMany({
            where: { role: 'EMPLOYEE', isActive: true },
            select: { id: true, name: true, email: true, department: true, jobTitle: true, createdAt: true }
        });

        // Get all attendance for the month
        const allAttendance = await prisma.attendance.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });

        // Get all approved leaves for the month
        const allLeaves = await prisma.leave.findMany({
            where: {
                status: 'APPROVED',
                OR: [
                    { fromDate: { gte: startDate, lte: endDate } },
                    { toDate: { gte: startDate, lte: endDate } },
                    { fromDate: { lte: startDate }, toDate: { gte: endDate } }
                ]
            },
            select: { userId: true, leaveType: true, totalDays: true }
        });

        const report = await Promise.all(employees.map(async emp => {
            const empAtt = allAttendance.filter(a => a.userId === emp.id);
            const empLeaves = allLeaves.filter(l => l.userId === emp.id);
            return {
                user: emp,
                present: empAtt.filter(a => a.status === 'PRESENT').length,
                absent: empAtt.filter(a => a.status === 'ABSENT').length,
                leave: empAtt.filter(a => a.status === 'LEAVE').length,
                wfh: empAtt.filter(a => a.status === 'WFH').length,
                halfDay: empAtt.filter(a => a.status === 'HALF_DAY').length,
                pendingLeaves: empLeaves.filter(l => l.leaveType === 'LEAVE').reduce((s, l) => s + l.totalDays, 0),
                pendingWfh: empLeaves.filter(l => l.leaveType === 'WFH').reduce((s, l) => s + l.totalDays, 0),
                compOffBalance: await calculateCompOffBalance(emp.id)
            };
        }));

        res.json({ report, meta: { month: targetMonth, year: targetYear, workingDays, sundayCount, totalDaysInMonth } });
    } catch (error) {
        console.error("Admin monthly report error:", error);
        res.status(500).json({ message: "Failed to fetch monthly report" });
    }
};

// Admin: Get specific employee's monthly attendance
const getEmployeeMonthlyAttendance = async (req, res) => {
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
        console.error("Employee monthly attendance error:", error);
        res.status(500).json({ message: "Failed to fetch employee attendance" });
    }
};

// Admin: Update attendance status
const updateAttendanceStatus = async (req, res) => {
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
        console.error("Update attendance status error:", error);
        res.status(500).json({ message: "Failed to update attendance status" });
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
