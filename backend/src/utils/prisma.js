const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient({
    datasources: {
        db: { url: process.env.DATABASE_URL },
    },
    log: ["error"],
});

// Reconnect on lost connection (common with Render free-tier Postgres)
prisma.$connect().catch(() => {});

module.exports = prisma;
