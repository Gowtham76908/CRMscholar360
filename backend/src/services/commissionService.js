const prisma = require("../utils/prisma");

const COMMISSION_PER_CONVERSION = 500.0;

const createCommission = async (leadId, userId) => {
    try {
        // Check if commission already exists for this lead
        const existing = await prisma.commission.findFirst({
            where: { leadId }
        });

        if (existing) return;

        await prisma.commission.create({
            data: {
                userId,
                leadId,
                amount: COMMISSION_PER_CONVERSION
            }
        });
        console.log(`[Commission] Created commission of ₹${COMMISSION_PER_CONVERSION} for user ${userId}`);
    } catch (error) {
        console.error("Error creating commission:", error);
    }
};

module.exports = { createCommission };
