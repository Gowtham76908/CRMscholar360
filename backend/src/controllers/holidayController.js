const prisma = require("../utils/prisma");
const { ApiError, ERROR_CODES } = require("../utils/apiError");

// Attendance dates are stored as UTC midnight of the IST calendar day.
function toDateOnly(dateStr) {
    const day = String(dateStr).slice(0, 10);
    const d = new Date(`${day}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
}

// The departments a manager (ADMIN) belongs to — they can only manage holidays
// for these. SUPER_ADMIN is unrestricted.
async function managerDepartments(userId) {
    const rows = await prisma.userDepartment.findMany({
        where: { userId },
        select: { department: true },
    });
    return rows.map(r => r.department);
}

// Active staff affected by a holiday. `null` department = company-wide.
async function affectedUserIds(department) {
    if (!department) {
        const users = await prisma.user.findMany({
            where: { isActive: true, role: { in: ["ADMIN", "TEAM_LEADER", "EMPLOYEE"] } },
            select: { id: true },
        });
        return users.map(u => u.id);
    }
    const rows = await prisma.userDepartment.findMany({
        where: { department },
        select: { userId: true },
    });
    const ids = [...new Set(rows.map(r => r.userId))];
    if (ids.length === 0) return [];
    const users = await prisma.user.findMany({
        where: { id: { in: ids }, isActive: true },
        select: { id: true },
    });
    return users.map(u => u.id);
}

// Force every affected user's attendance for `date` to HOLIDAY (works for past,
// present and future dates — a retroactively declared holiday overrides an
// existing ABSENT/PRESENT record).
async function markHolidayAttendance(date, userIds) {
    await prisma.$transaction(
        userIds.map(userId =>
            prisma.attendance.upsert({
                where: { userId_date: { userId, date } },
                update: { status: "HOLIDAY", checkIn: null, checkOut: null },
                create: { userId, date, status: "HOLIDAY" },
            })
        )
    );
}

// POST /attendance/holidays
const createHoliday = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { date, name } = req.body;
        let { department } = req.body;

        const d = toDateOnly(date);
        if (!d) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "A valid date is required");
        if (!name || !String(name).trim()) throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, "Holiday name is required");

        department = department ? String(department).trim() : null;

        if (role !== "SUPER_ADMIN") {
            // Managers cannot declare company-wide holidays and are limited to their
            // own departments.
            const myDepts = await managerDepartments(userId);
            if (!department) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "Only a Super Admin can declare a company-wide holiday");
            }
            if (!myDepts.includes(department)) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You can only declare holidays for your own department");
            }
        }

        const creator = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

        // A compound-unique `where` can't take a null field, so find-then-write.
        const existing = await prisma.holiday.findFirst({ where: { date: d, department } });
        const data = { name: name.trim(), createdById: userId, createdByName: creator?.name || null };
        const holiday = existing
            ? await prisma.holiday.update({ where: { id: existing.id }, data })
            : await prisma.holiday.create({ data: { date: d, department, ...data } });

        const userIds = await affectedUserIds(department);
        await markHolidayAttendance(d, userIds);

        res.status(201).json({ holiday, markedUsers: userIds.length });
    } catch (error) {
        return next(error);
    }
};

// GET /attendance/holidays?from=&to=
const listHolidays = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { from, to } = req.query;

        const where = {};
        if (from || to) {
            where.date = {};
            if (from) where.date.gte = toDateOnly(from);
            if (to) where.date.lte = toDateOnly(to);
        }

        if (role !== "SUPER_ADMIN") {
            // Managers see company-wide holidays plus those for their departments.
            const myDepts = await managerDepartments(userId);
            where.OR = [{ department: null }, { department: { in: myDepts } }];
        }

        const holidays = await prisma.holiday.findMany({ where, orderBy: { date: "asc" } });
        res.json(holidays);
    } catch (error) {
        return next(error);
    }
};

// DELETE /attendance/holidays/:id
const deleteHoliday = async (req, res, next) => {
    try {
        const { userId, role } = req.user;
        const { id } = req.params;

        const holiday = await prisma.holiday.findUnique({ where: { id } });
        if (!holiday) throw new ApiError(404, ERROR_CODES.NOT_FOUND, "Holiday not found");

        if (role !== "SUPER_ADMIN") {
            const myDepts = await managerDepartments(userId);
            if (!holiday.department || !myDepts.includes(holiday.department)) {
                throw new ApiError(403, ERROR_CODES.ACCESS_DENIED, "You cannot remove this holiday");
            }
        }

        // Revert the auto-marked HOLIDAY attendance for that day so it's clean again.
        const userIds = await affectedUserIds(holiday.department);
        if (userIds.length) {
            await prisma.attendance.deleteMany({
                where: { date: holiday.date, status: "HOLIDAY", userId: { in: userIds } },
            });
        }

        await prisma.holiday.delete({ where: { id } });
        res.json({ deleted: true });
    } catch (error) {
        return next(error);
    }
};

module.exports = { createHoliday, listHolidays, deleteHoliday };
