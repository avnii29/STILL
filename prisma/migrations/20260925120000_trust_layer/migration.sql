ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_GRANTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'CONSENT_WITHDRAWN';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DATA_EXPORTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SOURCE_DATA_DELETED';

CREATE TABLE IF NOT EXISTS "consent_events" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "policy_version" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "consent_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "consent_events_user_id_granted_at_idx" ON "consent_events"("user_id", "granted_at");

ALTER TABLE "consent_events"
  ADD CONSTRAINT "consent_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
