const prisma = require("../../utils/prisma");
const { istDateKey } = require("../../utils/istTime");

// Build a UTC-midnight Date (matching the @db.Date column) from a YYYY-MM-DD key.
const dateFromKey = (key) => {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d));
};

const get_attendance_summary = {
    name:        "get_attendance_summary",
    description:
        "Attendance for a single day across all active employees. Use this for questions like " +
        "'who is absent', 'who was on leave yesterday', 'attendance today', 'who did not check in'. " +
        "Returns per-status name lists (absent, present, leave, halfDay, wfh) plus 'notMarked' " +
        "(employees with no attendance record for that day). Dates are interpreted in IST. " +
        "Defaults to yesterday if no date is given.",
    parameters: {
        type: "object",
        properties: {
            date: {
                type:        "string",
                description: "The day to look up, as YYYY-MM-DD (IST). Omit for yesterday.",
            },
        },
        required: [],
    },
    execute: async ({ date }, _ctx) => {
        // Default to yesterday in IST.
        const key = (date && /^\d{4}-\d{2}-\d{2}$/.test(date))
            ? date
            : istDateKey(Date.now() - 24 * 60 * 60 * 1000);
        const day = dateFromKey(key);

        const [employees, records] = await Promise.all([
            prisma.user.findMany({
                where:  { isActive: true },
                select: { id: true, name: true },
            }),
            prisma.attendance.findMany({
                where:  { date: day },
                select: { userId: true, status: true },
            }),
        ]);

        const statusByUser = new Map(records.map(r => [r.userId, r.status]));

        const buckets = { present: [], absent: [], leave: [], halfDay: [], wfh: [], holiday: [], notMarked: [] };
        const bucketFor = {
            PRESENT: "present", ABSENT: "absent", LEAVE: "leave",
            HALF_DAY: "halfDay", WFH: "wfh", HOLIDAY: "holiday",
        };

        for (const emp of employees) {
            const status = statusByUser.get(emp.id);
            const bucket = status ? (bucketFor[status] ?? "notMarked") : "notMarked";
            buckets[bucket].push({ id: emp.id, name: emp.name });
        }

        return {
            date: key,
            totalEmployees: employees.length,
            counts: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
            ...buckets,
        };
    },
};

module.exports = { get_attendance_summary };
