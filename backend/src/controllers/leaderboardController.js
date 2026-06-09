const prisma = require("../utils/prisma");
const { toIST, istDateKey } = require("../utils/istTime");

// A task is "on time" if completed on or before its due date (IST calendar day).
const isTaskOnTime = (task) =>
    task.completedAt && task.dueDate && istDateKey(task.completedAt) <= istDateKey(task.dueDate);

const getLeaderboard = async (req, res, next) => {
    try {
        const { month, year } = req.query;
        const now = new Date();
        const targetMonth = parseInt(month, 10) || (now.getMonth() + 1);
        const targetYear = parseInt(year, 10) || now.getFullYear();

        const startDate = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
        const endDate = new Date(Date.UTC(targetYear, targetMonth, 0, 23, 59, 59, 999));

        // Rank all active staff (employees + managers) — super admins are excluded.
        const employees = await prisma.user.findMany({
            where: {
                role: { in: ['EMPLOYEE', 'MANAGER'] },
                isActive: true
            },
            select: { id: true, name: true, email: true, department: true, jobTitle: true, profilePhoto: true }
        });

        // Get all attendance for the month
        const allAttendance = await prisma.attendance.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });

        // Get all completed tasks for the month
        const allTasks = await prisma.task.findMany({
            where: {
                status: 'COMPLETED',
                completedAt: { gte: startDate, lte: endDate }
            }
        });

        const leaderboard = employees.map(emp => {
            const empAtt = allAttendance.filter(a => a.userId === emp.id);
            const empTasks = allTasks.filter(t => t.assignedToId === emp.id);

            let attendancePoints = 0;
            let punctualityBonus = 0;
            let taskPoints = 0;
            let timingBonus = 0;

            // Calculate Attendance Points
            empAtt.forEach(att => {
                if (att.status === 'PRESENT') {
                    attendancePoints += 10;
                    
                    // Punctuality Bonus: Check-in before 10:00 AM IST (server runs UTC)
                    if (att.checkIn) {
                        const ci = toIST(att.checkIn);
                        const ciMinutes = ci.getUTCHours() * 60 + ci.getUTCMinutes();
                        if (ciMinutes <= 10 * 60) {
                            punctualityBonus += 5;
                        }
                    }
                }
            });

            // Calculate Task Points
            empTasks.forEach(task => {
                taskPoints += 20;

                // Timing Bonus: Completed on or before due date
                if (isTaskOnTime(task)) {
                    timingBonus += 10;
                }
            });

            const totalScore = attendancePoints + punctualityBonus + taskPoints + timingBonus;

            return {
                user: emp,
                stats: {
                    presentDays: empAtt.filter(a => a.status === 'PRESENT').length,
                    tasksCompleted: empTasks.length,
                    onTimeTasks: empTasks.filter(isTaskOnTime).length
                },
                points: {
                    attendance: attendancePoints,
                    punctuality: punctualityBonus,
                    tasks: taskPoints,
                    timing: timingBonus
                },
                totalScore
            };
        });

        // Sort by total score descending
        leaderboard.sort((a, b) => b.totalScore - a.totalScore);

        res.json(leaderboard);
    } catch (error) {

        return next(error);
    }
};

module.exports = { getLeaderboard };
