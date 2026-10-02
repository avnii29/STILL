/**
 * Isolated development seed.
 *
 * This file is never run by the production app.
 * Prisma will not seed on migrate. You must opt in:
 *
 *   STILL_ALLOW_SEED=true npm run db:seed
 *
 * Production always starts empty.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV is production.");
  process.exit(1);
}

if (process.env.STILL_ALLOW_SEED !== "true") {
  console.error(
    "Refusing to seed. This script is isolated from production and from `next dev`.",
  );
  console.error("Run it only with STILL_ALLOW_SEED=true in a development database.");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(
      `Database already has ${existing} user(s). Seed will not invent people or conversations.`,
    );
    console.log("Production-like empty state is already violated; aborting.");
    process.exit(0);
  }

  console.log(
    "Development seed is intentionally empty. Still does not fabricate people, threads, or statistics.",
  );
  console.log("Use the app to ingest real authorized conversations.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
