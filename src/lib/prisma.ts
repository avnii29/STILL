import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getServerEnv } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function createClient(): PrismaClient {
  const env = getServerEnv();
  if (!env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to connect to Postgres.");
  }

  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    ssl:
      env.DATABASE_URL.includes("supabase.co") || env.DATABASE_URL.includes("sslmode=require")
        ? { rejectUnauthorized: false }
        : undefined,
  });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const prisma = getPrisma();
    await prisma.$queryRaw`select 1`;
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "database unavailable",
    };
  }
}
