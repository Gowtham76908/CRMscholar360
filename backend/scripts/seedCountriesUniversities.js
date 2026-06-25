require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SEED_DATA = {
    "USA": [
        "Harvard University",
        "Stanford University",
        "MIT",
        "University of California, Berkeley",
        "Yale University",
        "Princeton University",
        "Columbia University"
    ],
    "United Kingdom": [
        "University of Oxford",
        "University of Cambridge",
        "Imperial College London",
        "UCL",
        "University of Edinburgh",
        "King's College London"
    ],
    "Canada": [
        "University of Toronto",
        "University of British Columbia",
        "McGill University",
        "University of Waterloo",
        "McMaster University",
        "University of Alberta"
    ],
    "Australia": [
        "University of Melbourne",
        "University of Sydney",
        "Australian National University",
        "University of Queensland",
        "UNSW Sydney",
        "Monash University"
    ],
    "Germany": [
        "Technical University of Munich",
        "Ludwig Maximilian University of Munich",
        "Heidelberg University",
        "Humboldt University of Berlin",
        "RWTH Aachen University"
    ],
    "Ireland": [
        "Trinity College Dublin",
        "University College Dublin",
        "National University of Ireland Galway",
        "University College Cork"
    ]
};

async function main() {
    console.log("Seeding Countries and Universities...");
    for (const [countryName, universities] of Object.entries(SEED_DATA)) {
        // Upsert Country
        const country = await prisma.country.upsert({
            where: { name: countryName },
            update: {},
            create: { name: countryName }
        });
        console.log(`Country: ${country.name}`);

        for (const univName of universities) {
            // Upsert University
            await prisma.university.upsert({
                where: {
                    name_countryId: {
                        name: univName,
                        countryId: country.id
                    }
                },
                update: {},
                create: {
                    name: univName,
                    countryId: country.id
                }
            });
            console.log(`  University: ${univName}`);
        }
    }
    console.log("✓ Countries and Universities seeded successfully.");
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
