const prisma = require("../utils/prisma");

/**
 * Creates a single in-app notification for a user.
 */
const createNotification = async ({ userId, title, message, type, link = null }) => {
    return prisma.notification.create({
        data: { userId, title, message, type, link }
    });
};

/**
 * Shared helper: calculates previous month's leaderboard and returns the #1 winner.
 */
const getPrevMonthWinner = async () => {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endDate = new Date(currentMonthStart.getTime() - 1);
    const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));

    const employees = await prisma.user.findMany({
        where: { role: { in: ["EMPLOYEE", "MANAGER"] }, isActive: true },
        select: { id: true, name: true }
    });
    if (employees.length === 0) return null;

    const allAttendance = await prisma.attendance.findMany({
        where: { date: { gte: startDate, lte: endDate } }
    });
    const allTasks = await prisma.task.findMany({
        where: { status: "COMPLETED", completedAt: { gte: startDate, lte: endDate } }
    });

    const scored = employees.map(emp => {
        const empAtt   = allAttendance.filter(a => a.userId === emp.id);
        const empTasks = allTasks.filter(t => t.assignedToId === emp.id);

        let attendancePoints = 0, punctualityBonus = 0, taskPoints = 0, timingBonus = 0;

        empAtt.forEach(att => {
            if (att.status === "PRESENT") {
                attendancePoints += 10;
                if (att.checkIn) {
                    const ci = new Date(att.checkIn);
                    if (ci.getHours() * 60 + ci.getMinutes() <= 10 * 60) punctualityBonus += 5;
                }
            }
        });

        empTasks.forEach(task => {
            taskPoints += 20;
            if (task.completedAt && task.dueDate) {
                const comp = new Date(task.completedAt).toISOString().split("T")[0];
                const due  = new Date(task.dueDate).toISOString().split("T")[0];
                if (comp <= due) timingBonus += 10;
            }
        });

        return { id: emp.id, name: emp.name, totalScore: attendancePoints + punctualityBonus + taskPoints + timingBonus };
    });

    scored.sort((a, b) => b.totalScore - a.totalScore);
    return scored[0].totalScore > 0 ? scored[0] : null;
};

/**
 * Called at login time.
 * Runs only on the 1st of every month.
 * If the logged-in user is last month's #1, sends them a winner notification (once per month).
 */
const notifyIfLeaderboardWinner = async (userId) => {
    // Robustly check if it's the 1st of the month in IST
    const now = new Date();
    const istDay = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        day: "numeric"
    }).format(now);

    if (istDay !== "1") return;

    // For the duplicate guard and labeling, we need the year and month in IST
    const istYear = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", year: "numeric" }).format(now);
    const istMonth = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", month: "numeric" }).format(now);
    
    // Month is 1-indexed from Intl, Date.UTC expects 0-indexed
    const thisMonthStart = new Date(Date.UTC(Number(istYear), Number(istMonth) - 1, 1));
    const alreadySent = await prisma.notification.findFirst({
        where: { userId, type: "LEADERBOARD_WINNER", createdAt: { gte: thisMonthStart } }
    });
    if (alreadySent) return;

    const winner = await getPrevMonthWinner();
    if (!winner || winner.id !== userId) return;

    // Use UTC for labeling to match getPrevMonthWinner's logic
    const currentMonthStartUTC = thisMonthStart;
    const prevMonthEnd = new Date(currentMonthStartUTC.getTime() - 1);
    const monthLabel = prevMonthEnd.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

    await createNotification({
        userId:  winner.id,
        title:   "🏆 Leaderboard Champion!",
        message: `Congratulations ${winner.name}! You finished #1 on the leaderboard for ${monthLabel} with ${winner.totalScore} points. Keep up the amazing work!`,
        type:    "LEADERBOARD_WINNER",
        link:    "/leaderboard"
    });

    console.log(`[Notifications] Winner notification delivered to ${winner.name} on login (${monthLabel}, ${winner.totalScore} pts).`);
};

/**
 * Called by cron on the 2nd of every month at 9 AM IST.
 * Sends the winner notification to the #1 scorer of last month.
 */
const notifyLeaderboardWinner = async () => {
    const now = new Date();
    const currentMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const endDate = new Date(currentMonthStart.getTime() - 1);
    const startDate = new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1));
    const monthLabel = startDate.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

    console.log(`[Notifications] Cron: calculating leaderboard winner for ${monthLabel}...`);

    const winner = await getPrevMonthWinner();
    if (!winner) {
        console.log("[Notifications] No winner found. Skipping.");
        return;
    }

    // Duplicate guard: skip if already notified this month (e.g. winner logged in on the 1st)
    const thisMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
    const alreadySent = await prisma.notification.findFirst({
        where: { userId: winner.id, type: "LEADERBOARD_WINNER", createdAt: { gte: thisMonthStart } }
    });
    if (alreadySent) {
        console.log(`[Notifications] ${winner.name} already notified this month. Skipping.`);
        return;
    }

    await createNotification({
        userId:  winner.id,
        title:   "🏆 Leaderboard Champion!",
        message: `Congratulations ${winner.name}! You finished #1 on the leaderboard for ${monthLabel} with ${winner.totalScore} points. Keep up the amazing work!`,
        type:    "LEADERBOARD_WINNER",
        link:    "/leaderboard"
    });

    console.log(`[Notifications] Cron: winner notification sent to ${winner.name} (${winner.totalScore} pts).`);
};

/**
 * Cron job: runs daily at 9 AM IST.
 * Finds tasks due within the next 24 hours (still PENDING) and notifies assignees.
 * Skips if a TASK_DUE_SOON notification was already sent for that task today.
 */
const notifyTasksDueSoon = async () => {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const tasks = await prisma.task.findMany({
        where: {
            status: "PENDING",
            dueDate: { gte: now, lte: in24h },
            assignedToId: { not: null }
        },
        select: { id: true, title: true, dueDate: true, assignedToId: true }
    });

    for (const task of tasks) {
        const alreadySent = await prisma.notification.findFirst({
            where: {
                userId: task.assignedToId,
                type: "TASK_DUE_SOON",
                link: `/tasks/${task.id}`,
                createdAt: { gte: todayStart }
            }
        });
        if (alreadySent) continue;

        const due = new Date(task.dueDate).toLocaleString("en-IN", {
            dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata"
        });

        await createNotification({
            userId:  task.assignedToId,
            title:   "⏰ Task Due Soon",
            message: `Your task "${task.title}" is due on ${due}. Please complete it on time.`,
            type:    "TASK_DUE_SOON",
            link:    `/tasks/${task.id}`
        });
    }

    if (tasks.length > 0) console.log(`[Notifications] Due-soon alerts sent for ${tasks.length} task(s).`);
};

/**
 * Cron job: runs daily at 9 AM IST.
 * Finds tasks that are overdue (due date passed, still PENDING) and notifies assignees.
 * Skips if an OVERDUE notification was already sent today for that task.
 */
const notifyOverdueTasks = async () => {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const tasks = await prisma.task.findMany({
        where: {
            status: "PENDING",
            dueDate: { lt: now },
            assignedToId: { not: null }
        },
        select: { id: true, title: true, dueDate: true, assignedToId: true }
    });

    for (const task of tasks) {
        const alreadySent = await prisma.notification.findFirst({
            where: {
                userId: task.assignedToId,
                type: "TASK_OVERDUE",
                link: `/tasks/${task.id}`,
                createdAt: { gte: todayStart }
            }
        });
        if (alreadySent) continue;

        const due = new Date(task.dueDate).toLocaleString("en-IN", {
            dateStyle: "medium", timeZone: "Asia/Kolkata"
        });

        await createNotification({
            userId:  task.assignedToId,
            title:   "🚨 Task Overdue",
            message: `Your task "${task.title}" was due on ${due} and is still pending. Please update it immediately.`,
            type:    "TASK_OVERDUE",
            link:    `/tasks/${task.id}`
        });
    }

    if (tasks.length > 0) console.log(`[Notifications] Overdue alerts sent for ${tasks.length} task(s).`);
};

module.exports = { createNotification, notifyIfLeaderboardWinner, notifyLeaderboardWinner, notifyTasksDueSoon, notifyOverdueTasks };
