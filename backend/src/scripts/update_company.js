const prisma = require("../utils/prisma");

async function main() {
  const settings = await prisma.companySettings.findMany();
  console.log("Current company settings:", settings);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
