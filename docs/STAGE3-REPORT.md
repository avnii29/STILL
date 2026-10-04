# Stage 3 report: the Maya postpone path

Date: 2026-10-05 (IST). Google Calendar OAuth is not configured (`GOOGLE_CALENDAR_CLIENT_ID` and `GOOGLE_CALENDAR_CLIENT_SECRET` are empty). The scene used a calendar event added by the signed-in demo user through `POST /api/calendar/events`. That row is real data for `abc@gmail.com`, not a scripted demo fixture.

The dev server ran with `AI_PROVIDER=none` so capture did not wait on the NVIDIA model from Stage 2. `.env` was not edited.

## Result

**Pass.** One postpone of a fresh Maya thread found the same-day 4:00 PM catch-up, proposed moving it to 5:00 PM, left the event where it was, and moved it only after approval. The thread status became `CHANGED`. The title stored for this remember is `get revised dataset`.

## Walk

Health: `{"ok":true,"database":true,"auth":true,"ai":"none","googleAuth":false}`

Signed in as `abc@gmail.com` through `POST /api/auth/sign-in`.

Detect of `Yep, I'll get the revised dataset to Maya by Tuesday evening`:

```
title: "get revised dataset"
person: Maya
deadline: tuesday evening
is_commitment: true
interpretedBy: heuristic
```

Remember:

```
200 {"conversationId":"cmuu9r3ib0001w2cm51do7x3x","threadIds":["cmuu9r4e10005w2cmsbloobgs"],"interpretedBy":"heuristic"}
```

Thread before the postpone: title `get revised dataset`, status `NEEDS_REVIEW`, `due_at` `2026-10-06 12:30:00` (18:00 IST), `postponement_count` 0.

The signed-in user added the event:

```
POST /api/calendar/events
200 {"event":{"id":"cmuu9rtuh000pw2cm5gvc2g2y","title":"Catch-up",
     "startsAt":"2026-10-06T10:30:00.000Z","endsAt":"2026-10-06T11:00:00.000Z",
     "calendarId":"local","source":"local"}}
```

10:30Z is 4:00 PM IST, on the same local day as the 6:00 PM deadline.

Postpone:

```
200
postponementCount: 1
proposalId: cmuu9s2sa000rw2cmqm75wqm2
blocked: false
calendar: "Not yet configured. Google Calendar OAuth credentials are missing."
message: "Catch-up is on the same day. Move it from 4:00 pm to 5:00 pm instead of pushing the commitment. Nothing has moved."
```

Immediately after that, before approval:

| Thing | Value |
| --- | --- |
| `calendar_events` Catch-up | still `10:30:00`–`11:00:00` |
| thread `due_at` | still `2026-10-06 12:30:00` |
| thread status | still `NEEDS_REVIEW` |
| proposal | `MOVE_CALENDAR_EVENT`, `PENDING`, target Catch-up, proposed start `2026-10-06T11:30:00.000Z` (5:00 PM IST) |
| red team | `allowed: true` |
| timeline | `INTERVENTION_PROPOSED` |

Approve:

```
200 {"ok":true,"message":"The calendar event was updated."}
```

After approval:

| Thing | Value |
| --- | --- |
| Catch-up | `11:30:00`–`12:00:00` |
| proposal | `APPROVED` |
| thread status | `CHANGED` |
| thread `due_at` | still `2026-10-06 12:30:00` |
| timeline | `CALENDAR_UPDATED` — "The calendar event was updated." |

Trace rows for the postpone: POSTPONE 0.8, INTERVENTION 0.74, RED_TEAM 0.62, all `ok`, provider `heuristic`.

`GET /threads/cmuu9r4e10005w2cmsbloobgs` with the session cookie returned 200 and contained `get revised dataset`, `changed`, `Catch-up`, `Move it from 4:00 pm to 5:00 pm`, and the original sentence. The approve and edit buttons were not clicked in a browser; approve went through `POST /api/threads/:id` with `approve_proposal`, which is what those buttons call. Edit (`edit_proposal`) and reject were not exercised live. A blocked red-team case (meeting, call, interview, `priority: high`) is covered by tests, not by a second live event.

## How the postpone decides

`postponeThread` calls `listCalendarEvents` for the commitment's day.

- Google credentials and a connected token: list that day's events from Google.
- Otherwise: read `calendar_events` for that user and day. This run took that branch.

A same-day event on the first postpone becomes a `MOVE_CALENDAR_EVENT` proposal one hour later (or the next free hour). The commitment deadline is not pushed, and the event is not updated. The proposal stays `PENDING` until approve, or `BLOCKED` if the red team refuses the title or `priority: high`.

With no same-day event, the first postpone is still a normal snooze. A later postpone (`count >= 2`) with no event keeps the existing smaller-step copy and does not invent an event.

Approve of a `local` proposal updates that `calendar_events` row and sets the thread to `CHANGED`. Approve of a Google proposal still calls the Google PATCH, and only if Calendar OAuth and a token exist.

## Title

`normalizeCommitment` now drops a leading "Yep, " / "I'll " / "I will " and leftover "to" / "by". The new thread's title is `get revised dataset`. Threads remembered before this change keep the old title.

## Checks

```
typecheck   exit 0
lint        exit 0
test        14 files, 105 tests passed
build       exit 0
```

## Files changed

- `src/lib/threads/lifecycle.ts`
- `src/lib/threads/actions.ts`
- `src/lib/agents/governance.ts`
- `src/lib/agents/extract.ts`
- `src/lib/agents/extract.test.ts`
- `src/lib/connectors/google-calendar-sync.ts`
- `src/app/api/calendar/events/route.ts` (new; signed-in create of a local event)
- `src/components/thread-actions.tsx` (edit-the-time on a pending calendar proposal)
- `src/app/(still)/app/threads/[id]/page.tsx` (status line uses the existing status words, so `CHANGED` reads "changed")
- `src/lib/validation/schemas.ts` (`edit_proposal`)
- `docs/AUDIT.md`
- `docs/STAGE3-REPORT.md`

Nothing was committed. `.env` was not edited.

## AUDIT rows changed

Friction after repeated postpone, intervention agent, red team, human approval, calendar move, the AI-extraction title note, and the "wow scene" gap (it now says Google itself was not called).

## Risks

- Google Calendar was not called. A connected account is untested.
- `priority: high` is stored in `calendar_events.status` because that table has no priority column. Google events are judged on the title only.
- The first postpone proposes a move whenever any same-day event exists, including one that does not overlap the commitment. The pass test wanted that for the 4:00 PM catch-up. A day with several events moves the earliest one that starts before the deadline.
- Edit and reject were not clicked. A blocked live proposal was not created.
- This thread and the Catch-up event remain on `abc@gmail.com`.
- The NVIDIA model from Stage 2 still does not complete. This walk did not use it.

I will not start the next stage until you say so.
