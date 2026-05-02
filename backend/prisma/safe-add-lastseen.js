const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting safe migration to add lastSeen column...');
  try {
    // Check if the column already exists to avoid errors
    const checkColumn = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'User' AND column_name = 'lastSeen';
    `;

    if (checkColumn.length === 0) {
      console.log('Adding lastSeen column to User table...');
      await prisma.$executeRaw`ALTER TABLE "User" ADD COLUMN "lastSeen" TIMESTAMP(3);`;
      console.log('Successfully added lastSeen column.');
    } else {
      console.log('lastSeen column already exists. Skipping.');
    }
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
