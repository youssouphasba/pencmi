const { PrismaClient } = require("@prisma/client");
const { fingerprint } = require("./database-fingerprint.cjs");
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (
    !url ||
    !new URL(url).pathname.endsWith("_test") ||
    process.env.DATABASE_URL !== url ||
    !process.env.PRODUCTION_CLUSTER_ID ||
    !process.env.EXPECTED_DATA_FINGERPRINT
  )
    throw new Error("Explicit isolated copy required.");
  const prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
  try {
    const rows = await prisma.$queryRawUnsafe(
      "SELECT system_identifier::text AS id FROM pg_control_system()",
    );
    if (rows[0].id === process.env.PRODUCTION_CLUSTER_ID)
      throw new Error("Production forbidden.");
  } finally {
    await prisma.$disconnect();
  }
  const result = await fingerprint(url);
  if (result.sha256 !== process.env.EXPECTED_DATA_FINGERPRINT)
    throw new Error("Restored historical data differ.");
  console.log("ISOLATED_HISTORICAL_DATA_PRESERVED");
}
main().catch(() => {
  console.error("Isolated copy verification failed.");
  process.exitCode = 1;
});
