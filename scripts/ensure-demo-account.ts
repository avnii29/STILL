import { createClient } from "@supabase/supabase-js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const email = "abc@gmail.com";
const password = "abc123";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (!url || !anon) {
      console.error(
        "Demo account was not created. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then run npm run demo:account.",
      );
      process.exitCode = 1;
      return;
    }
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const signed = await client.auth.signUp({ email, password });
    if (signed.error) {
      const text = signed.error.message.toLowerCase();
      if (text.includes("already") || text.includes("registered")) {
        console.error(
          "That demo inbox already exists in Supabase. Sign in from the login page. If email confirmation is still pending, add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account.",
        );
      } else {
        console.error(
          "Demo account was not created through signup. Add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account.",
        );
      }
      process.exitCode = 1;
      return;
    }
    if (!signed.data.session) {
      console.error(
        "Supabase is waiting for email confirmation. Add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account so the demo account can be confirmed.",
      );
      process.exitCode = 1;
      return;
    }
    console.log("Demo account is ready. Sign in from the login page.");
    return;
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (created.data.user) {
    userId = created.data.user.id;
  } else {
    const text = created.error?.message.toLowerCase() ?? "";
    if (!text.includes("already") && !text.includes("registered") && !text.includes("exists")) {
      console.error("Demo account was not created. Supabase refused the admin request.");
      process.exitCode = 1;
      return;
    }
    for (let page = 1; page <= 20 && !userId; page += 1) {
      const listed = await admin.auth.admin.listUsers({ page, perPage: 200 });
      userId = listed.data.users.find((user) => user.email?.toLowerCase() === email)?.id;
      if ((listed.data.users.length ?? 0) < 200) break;
    }
    if (!userId) {
      console.error("Demo account already exists, but it could not be found to confirm the email.");
      process.exitCode = 1;
      return;
    }
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      console.error("Demo account exists, but the password could not be set through the admin API.");
      process.exitCode = 1;
      return;
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && userId) {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined,
      }),
    });
    try {
      await prisma.user.upsert({
        where: { id: userId },
        update: { email },
        create: {
          id: userId,
          email,
          profile: { create: { displayName: "Demo", timezone: "Asia/Kolkata", onboardingCompletedAt: new Date() } },
          preference: { create: {} },
        },
      });
      await prisma.profile.update({
        where: { userId },
        data: { onboardingCompletedAt: new Date() },
      });
    } catch {
      console.error("Auth user is ready. The database profile was not updated.");
    } finally {
      await prisma.$disconnect();
    }
  }

  console.log("Demo account is ready. Sign in from the login page.");
}

void main();
