import { z } from "zod";

export const commitmentTypeSchema = z.enum([
  "EXPLICIT_PROMISE",
  "REQUEST",
  "FUTURE_INTENTION",
  "RECIPROCAL_PLAN",
  "REMINDER_REQUEST",
  "WAITING_STATE",
  "SELF_COMMITMENT",
]);

export const threadOwnerSchema = z.enum(["ME", "THEM", "SHARED", "SELF"]);

export const threadStatusSchema = z.enum([
  "DETECTED",
  "NEEDS_REVIEW",
  "OPEN",
  "APPROACHING",
  "POSTPONED",
  "WAITING_ON_ME",
  "WAITING_ON_THEM",
  "CHANGED",
  "LIKELY_RESOLVED",
  "RESOLVED",
  "EXPIRED",
  "DISMISSED",
]);

export const resolutionKindSchema = z.enum([
  "FULFILLED",
  "SUPERSEDED",
  "CANCELLED",
  "IRRELEVANT",
  "EXPIRED",
  "USER_DISMISSED",
]);

export const threadDetectionSchema = z.object({
  is_thread: z.boolean(),
  confidence: z.number().min(0).max(1),
  type: commitmentTypeSchema,
  evidence: z.string().min(1),
  context: z.string().min(1),
  current_state: z.string().min(1),
  suggested_action: z.string().min(1),
  needs_user_review: z.boolean(),
});

export type ThreadDetection = z.infer<typeof threadDetectionSchema>;

export const ingestPayloadSchema = z.object({
  personName: z.string().trim().max(80).optional(),
  conversationText: z.string().trim().min(8).max(20000),
  title: z.string().trim().max(120).optional(),
});

export const rememberPayloadSchema = z.object({
  personName: z.string().trim().max(80).optional(),
  note: z.string().trim().min(8).max(4000),
  isSelf: z.boolean().optional(),
  sourceKind: z.enum(["TEXT", "VOICE", "PASTE", "MANUAL"]).optional(),
});

export const extractPayloadSchema = z.object({
  note: z.string().trim().min(8).max(4000),
  personName: z.string().trim().max(80).optional(),
});

export const guestMigrateThreadSchema = z.object({
  note: z.string().trim().min(8).max(4000),
  personName: z.string().trim().max(80).optional(),
  sourceKind: z.enum(["TEXT", "VOICE", "PASTE"]).optional(),
});

export const guestMigrateSchema = z.object({
  threads: z.array(guestMigrateThreadSchema).min(1).max(12),
  timezone: z.string().trim().min(1).max(80).optional(),
});

export const extractionSchema = z.object({
  is_commitment: z.boolean(),
  confidence: z.number().min(0).max(1),
  commitment_text: z.string(),
  normalized_commitment: z.string(),
  person: z.string().nullable(),
  deadline: z.string().nullable(),
  deadline_confidence: z.number().min(0).max(1),
  due_at: z.string().nullable(),
  evidence: z.string(),
  uncertain: z.boolean(),
});

export const threadActionSchema = z.object({
  action: z.enum([
    "open",
    "wait_on_me",
    "wait_on_them",
    "resolve",
    "dismiss",
    "expire",
    "approve_suggestion",
    "postpone",
    "approve_proposal",
    "reject_proposal",
    "delete",
  ]),
  resolutionKind: resolutionKindSchema.optional(),
  note: z.string().trim().max(2000).optional(),
  proposalId: z.string().optional(),
  remindAt: z.string().datetime().optional(),
  when: z.string().datetime().optional(),
});

export const profileUpdateSchema = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
});

export const preferenceUpdateSchema = z.object({
  emailNotifications: z.boolean(),
  webPushEnabled: z.boolean(),
  followUpDays: z.number().int().min(1).max(30),
});

export const memoryPolicySchema = z.object({
  rememberReminders: z.boolean(),
  rememberCommitments: z.boolean(),
  rememberPossible: z.boolean(),
  rememberDeadlines: z.boolean(),
  rememberResolution: z.boolean(),
  rememberContext: z.boolean(),
  autoRememberClear: z.boolean(),
});

export const retentionPolicySchema = z.object({
  conversationRetention: z.enum(["NONE", "EVIDENCE_ONLY", "RETAIN_SOURCE"]),
});

export const personCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  howYouKnowThem: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});
