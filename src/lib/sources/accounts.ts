import { randomBytes } from "node:crypto";
import type { SourceProvider } from "@/generated/prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { getPrisma } from "@/lib/prisma";
import { providerCatalog } from "@/lib/sources/capabilities";
import { telegramDeepLink } from "@/lib/sources/telegram";

const CONNECTABLE = new Set(["TELEGRAM", "WHATSAPP", "INSTAGRAM", "EMAIL", "CALENDAR"]);

export function randomLinkCode() {
  return randomBytes(16).toString("hex");
}

export async function startProviderConnect(input: {
  userId: string;
  provider: SourceProvider;
  ip?: string;
}) {
  const capability = providerCatalog().find((item) => item.id === input.provider);
  if (!capability?.connectable || !CONNECTABLE.has(input.provider)) {
    return {
      ok: false as const,
      status: "UNAVAILABLE" as const,
      message: capability?.capability ?? "STILL can't access this source yet.",
      alternative: capability?.alternative ?? "Paste or forward the conversation to STILL.",
    };
  }

  const prisma = getPrisma();
  if (input.provider !== "TELEGRAM") {
    const account = await prisma.integrationAccount.upsert({
      where: {
        userId_provider: { userId: input.userId, provider: input.provider },
      },
      update: {
        status: "REQUIRES_ACTION",
        lastError: null,
        metadata: { limited: capability.limited, reason: "official_account_mapping" },
      },
      create: {
        userId: input.userId,
        provider: input.provider,
        status: "REQUIRES_ACTION",
        metadata: { limited: capability.limited, reason: "official_account_mapping" },
      },
    });
    return {
      ok: true as const,
      status: account.status,
      accountId: account.id,
      linkCode: null,
      deepLink: null,
      message: `${capability.capability} STILL cannot silently read a personal inbox. Paste or forward the conversation instead.`,
    };
  }

  const linkCode = randomLinkCode();
  const account = await prisma.integrationAccount.upsert({
    where: {
      userId_provider: { userId: input.userId, provider: "TELEGRAM" },
    },
    update: {
      status: "CONNECTING",
      linkCode,
      lastError: null,
      disconnectedAt: null,
      connectedAt: null,
      scopes: ["bot_messages", "forwarded_messages"],
      metadata: { limited: capability.limited },
    },
    create: {
      userId: input.userId,
      provider: "TELEGRAM",
      status: "CONNECTING",
      linkCode,
      scopes: ["bot_messages", "forwarded_messages"],
      metadata: { limited: capability.limited },
    },
  });

  const deepLink = await telegramDeepLink(linkCode);

  return {
    ok: true as const,
    status: account.status,
    accountId: account.id,
    linkCode,
    deepLink,
    message:
      "Open Telegram and start the official STILL bot. STILL will only see messages you send or forward to it.",
  };
}

export async function completeTelegramLink(input: {
  linkCode: string;
  chatId: string;
  telegramUserId?: string;
}) {
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({
    where: { linkCode: input.linkCode },
  });
  if (!account || account.provider !== "TELEGRAM") return null;
  if (account.status === "DISCONNECTED") return null;

  const updated = await prisma.integrationAccount.update({
    where: { id: account.id },
    data: {
      status: "CONNECTED",
      externalAccountId: input.chatId,
      connectedAt: new Date(),
      disconnectedAt: null,
      lastSyncAt: new Date(),
      lastError: null,
      metadata: {
        telegramUserId: input.telegramUserId ?? null,
      },
    },
  });

  await prisma.sourcePermission.upsert({
    where: { userId_provider: { userId: account.userId, provider: "TELEGRAM" } },
    update: { granted: true, scopes: ["bot_messages", "forwarded_messages"] },
    create: {
      userId: account.userId,
      provider: "TELEGRAM",
      granted: true,
      scopes: ["bot_messages", "forwarded_messages"],
    },
  });

  await writeAuditLog({
    userId: account.userId,
    action: "INTEGRATION_CONNECTED",
    target: "TELEGRAM",
  });

  return updated;
}

export async function disconnectProvider(input: {
  userId: string;
  provider: SourceProvider;
  ip?: string;
}) {
  const prisma = getPrisma();
  const account = await prisma.integrationAccount.findUnique({
    where: { userId_provider: { userId: input.userId, provider: input.provider } },
  });
  if (!account) {
    await prisma.integrationAccount.create({
      data: {
        userId: input.userId,
        provider: input.provider,
        status: "DISCONNECTED",
        disconnectedAt: new Date(),
      },
    });
  } else {
    await prisma.integrationAccount.update({
      where: { id: account.id },
      data: {
        status: "DISCONNECTED",
        disconnectedAt: new Date(),
        linkCode: null,
        tokenCipher: null,
        lastError: null,
      },
    });
  }

  await prisma.sourcePermission.upsert({
    where: { userId_provider: { userId: input.userId, provider: input.provider } },
    update: { granted: false },
    create: {
      userId: input.userId,
      provider: input.provider,
      granted: false,
    },
  });

  await writeAuditLog({
    userId: input.userId,
    action: "INTEGRATION_DISCONNECTED",
    target: input.provider,
    ip: input.ip,
  });
}

export async function findTelegramAccountByChat(chatId: string) {
  const prisma = getPrisma();
  return prisma.integrationAccount.findFirst({
    where: {
      provider: "TELEGRAM",
      externalAccountId: chatId,
    },
  });
}
