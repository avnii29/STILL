-- Ambient sources, candidates, and memory policy.

ALTER TYPE "ConversationSourceKind" ADD VALUE IF NOT EXISTS 'TELEGRAM';
ALTER TYPE "ConversationSourceKind" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "ConversationSourceKind" ADD VALUE IF NOT EXISTS 'INSTAGRAM';

ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'TELEGRAM';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'INSTAGRAM';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'EMAIL';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'MEETINGS';

ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'NOT_CONNECTED';
ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'CONNECTING';
ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'REQUIRES_ACTION';
ALTER TYPE "IntegrationStatus" ADD VALUE IF NOT EXISTS 'UNAVAILABLE';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SOURCE_INGESTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMITMENT_DETECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMORY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMORY_CORRECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'MEMORY_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_CREATED';

CREATE TYPE "MemoryCandidateStatus" AS ENUM ('PENDING', 'REMEMBERED', 'IGNORED', 'AUTO_STORED');
CREATE TYPE "SourceProvider" AS ENUM ('TELEGRAM', 'WHATSAPP', 'INSTAGRAM', 'EMAIL', 'CALENDAR', 'MEETINGS', 'MANUAL', 'VOICE', 'PASTE');

ALTER TABLE "user_preferences"
  ADD COLUMN IF NOT EXISTS "remember_reminders" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remember_commitments" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remember_possible" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "remember_deadlines" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remember_resolution" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "remember_context" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "auto_remember_clear" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "conversation_retention" TEXT NOT NULL DEFAULT 'EVIDENCE_ONLY';

ALTER TABLE "commitment_evidence"
  ADD COLUMN IF NOT EXISTS "source_provider" TEXT,
  ADD COLUMN IF NOT EXISTS "evidence_start" INTEGER,
  ADD COLUMN IF NOT EXISTS "evidence_end" INTEGER,
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "integration_accounts" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SourceProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'NOT_CONNECTED',
    "external_account_id" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "token_cipher" TEXT,
    "connected_at" TIMESTAMP(3),
    "last_sync_at" TIMESTAMP(3),
    "disconnected_at" TIMESTAMP(3),
    "link_code" TEXT,
    "metadata" JSONB,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_permissions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "provider" "SourceProvider" NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_conversations" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT,
    "provider" "SourceProvider" NOT NULL,
    "external_id" TEXT NOT NULL,
    "title" TEXT,
    "retained" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "source_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "source_messages" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT,
    "conversation_id" TEXT,
    "provider" "SourceProvider" NOT NULL,
    "external_message_id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT,
    "sent_at" TIMESTAMP(3),
    "content" TEXT NOT NULL,
    "attachments_metadata" JSONB,
    "source_url" TEXT,
    "permissions_context" TEXT,
    "is_from_user" BOOLEAN NOT NULL DEFAULT true,
    "retained" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "source_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "memory_candidates" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "account_id" TEXT,
    "source_message_id" TEXT,
    "thread_id" TEXT,
    "provider" "SourceProvider" NOT NULL,
    "classification" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "commitment_text" TEXT NOT NULL,
    "normalized_commitment" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "target_person" TEXT,
    "deadline" TEXT,
    "due_at" TIMESTAMP(3),
    "deadline_precision" TEXT,
    "evidence_span" TEXT NOT NULL,
    "reasoning_summary" TEXT NOT NULL,
    "status" "MemoryCandidateStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "memory_candidates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "provider_events" (
    "id" TEXT NOT NULL,
    "user_id" UUID,
    "account_id" TEXT,
    "provider" "SourceProvider" NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "provider_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "integration_accounts_user_id_provider_key" ON "integration_accounts"("user_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "integration_accounts_link_code_key" ON "integration_accounts"("link_code");
CREATE INDEX IF NOT EXISTS "integration_accounts_user_id_status_idx" ON "integration_accounts"("user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "source_permissions_user_id_provider_key" ON "source_permissions"("user_id", "provider");
CREATE UNIQUE INDEX IF NOT EXISTS "source_conversations_user_id_provider_external_id_key" ON "source_conversations"("user_id", "provider", "external_id");
CREATE UNIQUE INDEX IF NOT EXISTS "source_messages_user_id_provider_external_message_id_key" ON "source_messages"("user_id", "provider", "external_message_id");
CREATE INDEX IF NOT EXISTS "source_messages_user_id_sent_at_idx" ON "source_messages"("user_id", "sent_at");
CREATE INDEX IF NOT EXISTS "memory_candidates_user_id_status_idx" ON "memory_candidates"("user_id", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "provider_events_provider_external_event_id_key" ON "provider_events"("provider", "external_event_id");

ALTER TABLE "integration_accounts" ADD CONSTRAINT "integration_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_permissions" ADD CONSTRAINT "source_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_conversations" ADD CONSTRAINT "source_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_conversations" ADD CONSTRAINT "source_conversations_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_messages" ADD CONSTRAINT "source_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_messages" ADD CONSTRAINT "source_messages_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "source_messages" ADD CONSTRAINT "source_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "source_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memory_candidates" ADD CONSTRAINT "memory_candidates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_candidates" ADD CONSTRAINT "memory_candidates_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memory_candidates" ADD CONSTRAINT "memory_candidates_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "source_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "provider_events" ADD CONSTRAINT "provider_events_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "integration_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
