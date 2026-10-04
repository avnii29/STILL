# Stage 4 report: Why, back-off, and a resolution you confirm

Date: 2026-10-05 (IST). The walk used the Maya thread from Stage 3, `cmuu9r4e10005w2cmsbloobgs`, on the real demo user. The server ran with `AI_PROVIDER=none`. `.env` was not edited.

## Result

**Pass.** The Why panel shows the postpone trace. A follow-up moved the deadline and the reminder. "done, sent it" opened a `RESOLVE_THREAD` proposal and left the thread open until approve.

## Why panel, before the follow-ups

`GET /threads/cmuu9r4e10005w2cmsbloobgs` returned 200 and contained:

- Why, Decision, Detected
- Move proposed
- Red team allowed
- Calendar move approved
- Evidence used
- Paused for approval / Nothing is waiting
- Overall confidence and the title `get revised dataset`

No chain-of-thought and no prompts. Context retrieval is stated as none, because this thread was read by the heuristic.

## Back-off

```
POST /api/remember
{"note":"actually no rush, Tuesday is fine","threadId":"cmuu9r4e10005w2cmsbloobgs"}
200 {"threadIds":[],"interpretedBy":"heuristic"}
```

No second thread was created.

| Field | Before | After |
| --- | --- | --- |
| status | `CHANGED` | `NEEDS_REVIEW` |
| due_at | `2026-10-06 12:30:00` (Tuesday 6:00 PM IST) | `2026-10-06 15:30:00` (Tuesday 9:00 PM IST) |
| current_state | the calendar sentence | You don't need to rush this anymore. |
| reminder | `SCHEDULED` at 10:30 UTC (2h before 6:00 PM) | same row, `remind_at` `2026-10-06 13:30:00` (2h before 9:00 PM) |

Timeline event:

```
DEADLINE_CHANGED
Tuesday 6:00 PM → Tuesday 9:00 PM
"actually no rush, Tuesday is fine"
```

"no rush" on a named day is treated as 9:00 PM that day, later than the 6:00 PM commitment, instead of the usual 9:00 AM weekday default.

## Resolution waits

```
POST /api/remember
{"note":"done, sent it","threadId":"cmuu9r4e10005w2cmsbloobgs"}
200 {"threadIds":[],"interpretedBy":"heuristic"}
```

Before approve: status still `NEEDS_REVIEW`, `resolved_at` null.

```
RESOLVE_THREAD  PENDING
This may be done. "done, sent it" Confirm before it closes.
id cmuua27di000dpzcm161qn1jf
```

```
POST /api/threads/cmuu9r4e10005w2cmsbloobgs
{"action":"approve_proposal","proposalId":"cmuua27di000dpzcm161qn1jf"}
200 {"ok":true,"message":"Resolved. It will stop nagging."}
```

After approve: status `RESOLVED`, proposal `APPROVED`, reminder `CANCELLED`. The page contains "actually no rush, Tuesday is fine", "Tuesday 6:00 PM", "Tuesday 9:00 PM", "Resolution paused for approval", "Resolved with your approval", and "Nothing is waiting".

## Checks

```
typecheck   exit 0
lint        exit 0
test        14 files, 105 tests passed
build       exit 0
```

`ActionProposalKind` gained `RESOLVE_THREAD`. `prisma migrate deploy` was not used. The value was added with `pg` and recorded in `_prisma_migrations` (`20261005180000_resolve_thread_proposal`), same as the provider column in Stage 2, because the Prisma CLI still cannot reach the pooler (`P1001`) while `pg` can.

## Files changed

- `src/components/why-panel.tsx` (new)
- `src/app/(still)/app/threads/[id]/page.tsx`
- `src/components/thread-actions.tsx` (resolve proposals say "Yes, it's done")
- `src/lib/threads/ingest.ts`
- `src/lib/threads/actions.ts`
- `src/lib/ingestion/signals.ts`
- `src/lib/sources/pipeline.ts`
- `src/app/api/remember/route.ts`
- `src/lib/validation/schemas.ts` (optional `threadId`)
- `prisma/schema.prisma`
- `prisma/migrations/20261005180000_resolve_thread_proposal/migration.sql`
- generated Prisma client
- `docs/AUDIT.md`
- `docs/STAGE4-REPORT.md`

Nothing was committed.

## AUDIT rows changed

Resolution from later wording, deadline change backs off, agent trace, and the auto-resolve gap line.

## Risks

- A follow-up is applied to a thread when `threadId` is sent, or when the note says "no rush", "actually", or "instead". A vague note without `threadId` can still miss the thread if several are open.
- "no rush" plus a weekday becomes 9:00 PM that day. A message that also names a clock time keeps that clock.
- The source path no longer auto-resolves at ≥ 0.9 either. That path was not walked live.
- Retrieved-record counts are still not stored when a model runs. The panel says the count was not stored instead of inventing one.
- Reject of a resolution proposal was not clicked.
- The NVIDIA model from Stage 2 still does not complete. This walk did not use it.

I will not start the next stage until you say so.
