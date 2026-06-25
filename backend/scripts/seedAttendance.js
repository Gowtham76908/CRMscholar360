require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

// How many days back to seed (including today).
const DAYS_BACK = 30;

// Weighted status distribution for past days (heavily PRESENT, like real life).
const WEIGHTED_PAST = [
    ...Array(11).fill("PRESENT"),
    ...Array(3).fill("WFH"),
    "ABSENT",
    "LEAVE",
    "HALF_DAY",
];

// For TODAY we force a clean spread so the manager view has something of each
// to look at. Anyone beyond this list is left "Not marked" (no record).
const TODAY_PLAN = ["PRESENT", "PRESENT", "PRESENT", "WFH", "WFH", "ABSENT", "LEAVE", "HALF_DAY"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function rand(min, max) { return Math.round(Math.random() * (max - min) + min); }

// Local YYYY-MM-DD — matches the string the frontend sends as ?date=…
function toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Mirror getAllAttendance's date construction so the @db.Date column matches the
// value the manager page queries with (new Date(dateStr) then local midnight).
function dayDate(dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d;
}

// A check-in/out pair on the given calendar day, or nulls for non-working states.
function times(dateStr, status) {
    if (status === "ABSENT" || status === "LEAVE") return { checkIn: null, checkOut: null };
    const checkIn = new Date(dateStr);
    checkIn.setHours(9, rand(0, 45), 0, 0);
    const checkOut = new Date(dateStr);
    if (status === "HALF_DAY") checkOut.setHours(13, rand(0, 30), 0, 0);
    else checkOut.setHours(18, rand(0, 59), 0, 0);
    return { checkIn, checkOut };
}

async function main() {
    const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
    });
    if (users.length === 0) {
        console.log("No active users found — seed users first (e.g. scripts/seedManagers.js).");
        return;
    }
    console.log(`Seeding attendance for ${users.length} users over ${DAYS_BACK} days…`);

    const today = new Date();
    let written = 0;

    for (let offset = 0; offset < DAYS_BACK; offset++) {
        const day = new Date(today);
        day.setDate(today.getDate() - offset);
        // Skip Sundays — treated as a weekly off (no record).
        if (day.getDay() === 0) continue;

        const dateStr = toDateStr(day);
        const date = dayDate(dateStr);
        const isToday = offset === 0;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];

            let status;
            if (isToday) {
                // Cycle through the plan; users past the plan length stay unmarked.
                if (i >= TODAY_PLAN.length && users.length > TODAY_PLAN.length) {
                    // leave ~ a third of remaining people unmarked for realism
                    if (Math.random() < 0.4) continue;
                    status = pick(WEIGHTED_PAST);
                } else {
                    status = TODAY_PLAN[i % TODAY_PLAN.length];
                }
            } else {
                status = pick(WEIGHTED_PAST);
            }

            const { checkIn, checkOut } = times(dateStr, status);

            await prisma.attendance.upsert({
                where: { userId_date: { userId: user.id, date } },
                update: { status, checkIn, checkOut },
                create: { userId: user.id, date, status, checkIn, checkOut },
            });
            written++;
        }
    }

    console.log(`✓ Done. Upserted ${written} attendance records.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
