const { PrismaClient } = require("@prisma/client");
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (
    !url ||
    !new URL(url).pathname.endsWith("_test") ||
    !process.env.PRODUCTION_CLUSTER_ID
  )
    throw new Error("Explicit isolated database required.");
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT system_identifier::text AS id FROM pg_control_system()",
    );
    if (rows[0].id === process.env.PRODUCTION_CLUSTER_ID)
      throw new Error("Production writes forbidden.");
    if (process.env.ISOLATED_TEST_ADMIN_PASSWORD) {
      const passwordHash = await require("bcryptjs").hash(
        process.env.ISOLATED_TEST_ADMIN_PASSWORD,
        12,
      );
      await prisma.user.upsert({
        where: { id: "isolated-browser-admin" },
        update: { passwordHash },
        create: {
          id: "isolated-browser-admin",
          role: "admin",
          status: "active",
          email: "isolated-admin@example.test",
          passwordHash,
        },
      });
    }
    await prisma.user.upsert({
      where: { id: "isolated-test-client" },
      update: {},
      create: {
        id: "isolated-test-client",
        role: "client",
        status: "active",
        email: "isolated-client@example.test",
      },
    });
    await prisma.user.upsert({
      where: { id: "isolated-test-hotel-owner" },
      update: {},
      create: {
        id: "isolated-test-hotel-owner",
        role: "hotel_manager",
        status: "active",
        professionalProfile: {
          create: {
            businessName: "Isolated test fixture",
            professionalType: "hotel",
          },
        },
      },
    });
    await prisma.hotelProperty.upsert({
      where: { id: "isolated-test-hotel" },
      update: {},
      create: {
        id: "isolated-test-hotel",
        ownerUserId: "isolated-test-hotel-owner",
        slug: "isolated-test-hotel",
        name: "Isolated test fixture",
        propertyType: "hotel",
        city: "Dakar",
        status: "draft",
      },
    });
    console.log("ISOLATED_FIXTURES_READY");
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error("Isolated fixture preparation failed.");
  process.exitCode = 1;
});
