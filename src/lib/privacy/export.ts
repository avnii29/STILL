import "server-only";

import { getPrisma } from "@/lib/prisma";

export async function exportUserStill(userId: string) {
  const prisma = getPrisma();
  const [
    user,
    profile,
    preference,
    people,
    threads,
    sources,
    integrations,
    accounts,
    permissions,
    candidates,
    notifications,
    consentEvents,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true } }),
    prisma.profile.findUnique({
      where: { userId },
      select: { displayName: true, timezone: true, onboardingCompletedAt: true },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.person.findMany({
      where: { userId },
      select: { id: true, name: true, aliases: true, notes: true, howYouKnowThem: true },
    }),
    prisma.thread.findMany({
      where: { userId },
      include: {
        commitments: { include: { evidenceItems: true } },
        events: true,
        resolution: true,
        reminders: true,
      },
    }),
    prisma.conversationSource.findMany({
      where: { userId },
      select: { id: true, kind: true, label: true, lastSyncedAt: true },
    }),
    prisma.integration.findMany({
      where: { userId },
      select: { kind: true, status: true, label: true, connectedAt: true },
    }),
    prisma.integrationAccount.findMany({
      where: { userId },
      select: {
        provider: true,
        status: true,
        externalAccountId: true,
        scopes: true,
        connectedAt: true,
        disconnectedAt: true,
      },
    }),
    prisma.sourcePermission.findMany({
      where: { userId },
      select: { provider: true, granted: true, scopes: true },
    }),
    prisma.memoryCandidate.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        classification: true,
        normalizedCommitment: true,
        evidenceSpan: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId },
      select: { channel: true, title: true, body: true, status: true, createdAt: true },
    }),
    prisma.consentEvent.findMany({
      where: { userId },
      select: {
        purpose: true,
        source: true,
        policyVersion: true,
        grantedAt: true,
        withdrawnAt: true,
      },
    }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    account: { email: user?.email, createdAt: user?.createdAt, ...profile },
    settings: preference,
    people,
    threads: threads.map((thread) => ({
      id: thread.id,
      title: thread.title,
      status: thread.status,
      evidence: thread.evidence,
      source: thread.source,
      dueAt: thread.dueAt,
      personId: thread.personId,
      commitments: thread.commitments.map((item) => ({
        text: item.normalizedText ?? item.text,
        dueHint: item.dueHint,
        evidence: item.evidenceItems.map((row) => ({
          exactText: row.exactText,
          sourceKind: row.sourceKind,
        })),
      })),
      history: thread.events.map((event) => ({
        kind: event.kind,
        body: event.body,
        createdAt: event.createdAt,
      })),
      resolution: thread.resolution,
      reminders: thread.reminders.map((reminder) => ({
        remindAt: reminder.remindAt,
        status: reminder.status,
        body: reminder.body,
      })),
    })),
    sources,
    integrations,
    connectedAccounts: accounts,
    permissions,
    noticed: candidates,
    notifications,
    consent: consentEvents,
  };
}
