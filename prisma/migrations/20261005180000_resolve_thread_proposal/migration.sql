-- A resolution waits for approval instead of closing the thread on its own.
ALTER TYPE "ActionProposalKind" ADD VALUE IF NOT EXISTS 'RESOLVE_THREAD';
