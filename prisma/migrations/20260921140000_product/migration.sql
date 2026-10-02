-- Product tables, statuses, and evidence-backed memory fields.

ALTER TYPE "ThreadStatus" ADD VALUE IF NOT EXISTS 'APPROACHING';
ALTER TYPE "ThreadStatus" ADD VALUE IF NOT EXISTS 'POSTPONED';
ALTER TYPE "ThreadStatus" ADD VALUE IF NOT EXISTS 'CHANGED';

ALTER TYPE "ConversationSourceKind" ADD VALUE IF NOT EXISTS 'VOICE';
ALTER TYPE "ConversationSourceKind" ADD VALUE IF NOT EXISTS 'TEXT';

ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'GOOGLE_CALENDAR';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'GOOGLE_DOCS';
ALTER TYPE "IntegrationKind" ADD VALUE IF NOT EXISTS 'VOICE';

ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'REMINDER_SENT';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'INTERVENTION_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACTION_PROPOSED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACTION_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACTION_APPROVED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACTION_REJECTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'COMMITMENT_POSTPONED';

CREATE TYPE "ActionProposalKind" AS ENUM ('MOVE_CALENDAR_EVENT', 'OPEN_DOCUMENT', 'MOVE_DEADLINE', 'MICRO_ACTION', 'NONE');
CREATE TYPE "ActionProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'BLOCKED', 'EXECUTED');

ALTER TABLE "threads"
  ADD COLUMN IF NOT EXISTS "postponement_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3);

ALTER TABLE "commitments"
  ADD COLUMN IF NOT EXISTS "normalized_text" TEXT,
  ADD COLUMN IF NOT EXISTS "due_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deadline_confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "is_commitment" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "reminders"
  ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "commitment_evidence" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "commitment_id" TEXT NOT NULL,
    "message_id" TEXT,
    "exact_text" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "commitment_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "agent_runs" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" TEXT,
    "kind" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "interventions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "suggested_action" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "action_proposals" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "thread_id" TEXT NOT NULL,
    "intervention_id" TEXT,
    "kind" "ActionProposalKind" NOT NULL,
    "target" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "risk" TEXT NOT NULL,
    "status" "ActionProposalStatus" NOT NULL DEFAULT 'PENDING',
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "blocked_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "action_proposals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "action_approvals" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "proposal_id" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "action_approvals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "threads_user_id_due_at_idx" ON "threads"("user_id", "due_at");
CREATE INDEX IF NOT EXISTS "commitment_evidence_user_id_commitment_id_idx" ON "commitment_evidence"("user_id", "commitment_id");
CREATE INDEX IF NOT EXISTS "agent_runs_user_id_created_at_idx" ON "agent_runs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "agent_runs_thread_id_idx" ON "agent_runs"("thread_id");
CREATE INDEX IF NOT EXISTS "interventions_user_id_thread_id_idx" ON "interventions"("user_id", "thread_id");
CREATE INDEX IF NOT EXISTS "action_proposals_user_id_thread_id_status_idx" ON "action_proposals"("user_id", "thread_id", "status");
CREATE INDEX IF NOT EXISTS "action_approvals_user_id_proposal_id_idx" ON "action_approvals"("user_id", "proposal_id");
CREATE INDEX IF NOT EXISTS "reminders_status_remind_at_idx" ON "reminders"("status", "remind_at");

ALTER TABLE "commitment_evidence" ADD CONSTRAINT "commitment_evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commitment_evidence" ADD CONSTRAINT "commitment_evidence_commitment_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commitment_evidence" ADD CONSTRAINT "commitment_evidence_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "agent_runs" ADD CONSTRAINT "agent_runs_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "interventions" ADD CONSTRAINT "interventions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "action_proposals" ADD CONSTRAINT "action_proposals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_proposals" ADD CONSTRAINT "action_proposals_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_proposals" ADD CONSTRAINT "action_proposals_intervention_id_fkey" FOREIGN KEY ("intervention_id") REFERENCES "interventions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "action_approvals" ADD CONSTRAINT "action_approvals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "action_approvals" ADD CONSTRAINT "action_approvals_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "action_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
