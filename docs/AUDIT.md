# STILL audit

Stage 0 re-run, 2026-10-04. `docs/planning-chat.md` was read in full (34,749 lines). Her requests are the `## Prompt:` blocks. The design is the `## Response:` blocks. The product loop is the 26 Sep response at line 20403. The hackathon brief is her prompt at line 26855. The agent-role design is the response at line 27031. Where the chat and the code disagree, the code is what exists and the chat is what she intended.

Statuses:

- **REAL** — implemented on the request path. Not live-exercised against Postgres in this pass.
- **PARTIAL** — real code, with a gap that stops a demo from relying on it.
- **UI-ONLY** — screens or copy without the action.
- **MISSING** — not implemented.

Checks from the previous pass, after `npm ci` because `node_modules` was absent:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass |
| `npm run test` | Pass. 13 files, 91 tests |
| `npm run build` | Pass. Next.js 16.3.5 |

Tests cover wording rules, the in-memory loop, guest parsing, retention, and auth helpers. They do not boot Postgres, call a model, hit Telegram, or deliver a push.

## What the chat promised

| Promise | Status | Evidence |
| --- | --- | --- |
| Name STILL, tagline “the things that still matter” | REAL | `README.md`. Earlier names Threads and NOMA are gone. |
| Not a chatbot, todo, calendar, CRM, or dashboard | REAL | Home copy and empty states. No productivity score. |
| Guest paste, evidence shown, nothing stored | REAL (API proven live, Stage 1) | `src/components/guest/guest-workspace.tsx` → `POST /api/extract` returns `persisted: false`. IndexedDB in `src/lib/guest/store.ts`. Live: the Maya sentence returned `persisted: false`. Browser/IndexedDB half not walked. **Stage 2:** with a provider key set in the environment, the same route still returned the heuristic reading in 92ms and `persisted: false`. It does not call a model. |
| Signed-in type / paste / speak, then Remember | REAL (API proven live, Stage 1b) | `src/components/capture-studio.tsx` → `POST /api/detect` then `POST /api/remember`. Live as `abc@gmail.com` through the real sign-in route: detect returned the Maya commitment and wrote 0 rows; remember returned a `threadId`. The API was driven with curl and a real session cookie; the buttons in the browser were not clicked. Speech is browser `SpeechRecognition`. Audio is not stored. |
| AI extraction of what / who / when / evidence | PARTIAL | `src/lib/agents/extract.ts` and `src/lib/sources/detect.ts` are heuristics. A model is optional and off by default. See below. **Stage 1, proven live:** the exact Maya sentence was returned as `is_commitment: false` (confidence 0.12) because `get` was missing from the `ACTION` list, and "Tuesday evening" was stored as 09:00. Both fixed in `extract.ts` and covered by a test; live re-run returns `is_commitment: true`, 0.88, Maya, "tuesday evening", 18:00 IST. **Stage 1b:** the same result was stored: `interpreted_by = heuristic`, confidence 0.88, due 2026-10-06 12:30 UTC. **Stage 3, live:** a new remember of the same sentence stored the title `get revised dataset`. Older threads keep the previous title. **Stage 2:** signed-in detect now calls `readCommitment` (`src/lib/agents/read-commitment.ts`), which asks the configured model for this same JSON shape and falls back to the heuristic. Live, `AI_PROVIDER=openai` against `AI_BASE_URL` (NVIDIA, model `deepseek-ai/deepseek-v4.1-flash`) did not return a completion: the app timed out at 30s and answered `interpretedBy: "heuristic:fallback"`. Direct calls to that model's chat endpoint produced no HTTP response within 150s. With `AI_PROVIDER=none`, the same signed-in route classified "I'll try to get to it" and "maybe someday" as not commitments, and "yep, Tuesday evening" plus context naming Maya as a commitment (person Maya, deadline tuesday evening, `interpretedBy: "heuristic"`). The model itself did not classify a sentence live. |
| User confirms or corrects before memory | REAL | Remember / not-a-commitment in capture. Source candidates: `src/components/candidate-card.tsx`, Telegram buttons in `src/app/api/integrations/telegram/webhook/route.ts`. |
| Store commitment, person, deadline, evidence, source | REAL (proven live, Stage 1b) | `ingestConversation` in `src/lib/threads/ingest.ts`. Source confirm: `createMemoryFromCandidate` in `src/lib/sources/pipeline.ts`. Live rows after Remember: 1 `threads`, 1 `commitments`, 1 `commitment_evidence` (exact text of the pasted line), 1 `conversations`. Thread status `NEEDS_REVIEW`, source `PASTE`. |
| Evidence drawer (“why do you remember this?”) | REAL | `src/components/evidence-drawer.tsx` on `src/app/(still)/app/threads/[id]/page.tsx`. |
| Append-only thread ledger | REAL (proven live, Stage 1b) | `thread_events` via Prisma `ThreadEvent`. Timeline on the thread page. Live: DETECTED, EVIDENCE_STORED, REMINDER_SCHEDULED, then REMINDER_SENT after cron. |
| Status model (open, postponed, likely resolved, dismissed) | REAL | `ThreadStatus` in `prisma/schema.prisma`. Wider than her short list; the extras exist. |
| Let it go without deleting | REAL | Dismiss keeps the thread. Delete is separate. |
| Resolution from later wording | REAL (proposal, then a click, Stage 4) | `proposeThreadResolution` and `decideProposal`. **Live:** "done, sent it" on thread `cmuu9r4e10005w2cmsbloobgs` created `RESOLVE_THREAD` / `PENDING` while status stayed `NEEDS_REVIEW`. Approve then set `RESOLVED`. Auto-resolve at ≥ 0.9 no longer writes `RESOLVED` by itself. |
| Deadline change backs off | REAL on capture (Stage 4) | `applyDeadlineChange` now also runs from `ingestConversation` when the note is a follow-up. **Live:** "actually no rush, Tuesday is fine" moved the same thread from Tuesday 6:00 PM to Tuesday 9:00 PM, status `NEEDS_REVIEW`, reminder `remind_at` from the previous slot to `2026-10-06 13:30:00` (2h before). Source-path behavior was not re-run. |
| Schedule a reminder | REAL (proven live, Stage 1b) | `scheduleRemindAt` in `src/lib/agents/extract.ts`. Row created when `dueAt` exists. Live: one `reminders` row, `SCHEDULED`, `remind_at` 2026-10-06 10:30 UTC (2h before the 12:30 UTC deadline), channel `WEB_PUSH`. |
| Reminder actually fires | REAL (proven live, Stage 1b, with a TEST SHORTCUT) | `processDueReminders` in `src/lib/threads/reminders.ts`, route `src/app/api/cron/reminders/route.ts`. Nothing polls inside the app. Local use is a curl. **Live:** with the real `remind_at` two days away, cron returned `{"due":0,"sent":0}`. After one SQL `UPDATE reminders SET remind_at = now()` on that single row (TEST SHORTCUT, the only manual DB write), cron returned `{"due":1,"sent":1}`; reminder became `SENT`, thread became `APPROACHING`. Stage 5a: `vercel.json` has no Hobby-illegal sub-daily crons (`crons: []`); production must call GET `/api/cron/reminders` with `Authorization: Bearer $CRON_SECRET` from outside Vercel Cron. Not proven: firing at the real time on a schedule, and the timezone of `remind_at` on a non-IST host. |
| In-app notice | REAL (proven live, Stage 1b) | `createNotification` in `src/lib/notifications/dispatch.ts`. Live: an `IN_APP` / `SENT` notification row for the reminder, and a signed-in `GET /api/notifications/live` returned it. The toast in a browser was not watched. |
| Web push | PARTIAL | `src/lib/notifications/push.ts`, `POST /api/push/subscribe`, `public/sw.js`. Needs VAPID, opt-in, and the cron. |
| Email notice | PARTIAL (fails without a provider, seen live) | Resend or log in `src/lib/notifications/email.ts`. SMTP does not send. Live: with no Resend key, every notification also wrote an `EMAIL` row with status `FAILED` (2 of 4 notification rows). |
| Friction after repeated postpone | PARTIAL | `evaluatePostponement` in `src/lib/threads/lifecycle.ts`. Copy only. It does not open a document. **Stage 3:** with no same-day event, the first postpone still does not propose a calendar move. A same-day event changes that first postpone into a move proposal. |
| Intervention agent | REAL (one postpone, local calendar, Stage 3) | `evaluateIntervention` in `src/lib/threads/lifecycle.ts`. Ingest still passes no events. **Live:** postponing thread `cmuu9r4e10005w2cmsbloobgs` with a user-added Catch-up at 4:00 PM proposed moving it to 5:00 PM. The event row did not change until approval. |
| Red team before an external action | REAL for this catch-up; block list unit-tested | `runRedTeamAgent` in `src/lib/agents/governance.ts`. **Live:** the Catch-up proposal was allowed (`allowed: true`). Titles containing interview, meeting, or call, and `priority: high`, are blocked in tests. A blocked proposal was not created against the live database. |
| Human approval, then act | REAL (approve of this move, Stage 3) | `decideProposal` in `src/lib/threads/actions.ts`. UI: `src/components/thread-actions.tsx` (Move it / Use this time / Not now). **Live:** `approve_proposal` ran only after the proposal was `PENDING`. `SEND_MESSAGE` stays hard-blocked. Edit and reject were not clicked in this run. |
| Calendar move after approval | REAL for a local event (Stage 3) | `executeCalendarMove` in `src/lib/connectors/google-calendar-sync.ts`. Google OAuth credentials are empty, so this run updated `calendar_events` (`calendarId` `local`) from 10:30Z to 11:30Z. Google itself was not called. |
| Open or create a Google Doc | UI-ONLY | `OPEN_DOCUMENT` is marked blocked via `docsStatus`. No Docs API. |
| Draft a message | MISSING | Enum and risk level only. No draft tool. |
| One live connected source | PARTIAL | Telegram webhook, link, and confirm are implemented. WhatsApp and Instagram parse payloads and stop at `REQUIRES_ACTION`. |
| Noticed inbox of candidates | REAL | `MemoryCandidate` and `src/app/(still)/app/noticed/page.tsx`. |
| People without a CRM score | REAL | `Person` rows from names in commitments. |
| Future self | PARTIAL | `runFutureSelfAgent` relabels self-talk. Page `src/app/(still)/app/future/page.tsx`. Not a separate motivational product. |
| Search “what did I promise Rahul?” | PARTIAL | Substring search in `src/app/(still)/app/search/page.tsx`. Not semantic. |
| Agent trace a judge can see | REAL on the thread Why panel (Stage 4) | `src/components/why-panel.tsx` on the thread page. **Live** `GET /threads/cmuu9r4e10005w2cmsbloobgs` showed Decision (detected, move proposed, red team allowed, calendar move approved, deadline moved, resolution paused, resolved), the original sentence, evidence count, per-step confidence, risk, and “Nothing is waiting” after approval. Retrieved-record counts are not stored for the heuristic path, and the panel says so. `/app/debug` was not opened. |
| Live agent event stream during capture | MISSING | Landing `src/components/landing/agent-flow.tsx` is a clickable illustration. Capture does not stream backend steps. |
| Realtime across tabs | PARTIAL | `src/components/threads-realtime.tsx` subscribes to Supabase `postgres_changes`. Needs Realtime enabled on the project. |
| Replayable Maya demo | PARTIAL | `src/lib/demo/scenario.ts` and `/demo` run `runStillLoop` on fixed text. It is not her connected-account data. |
| Guest usable without an account | REAL | `/still`. Migrate via `POST /api/guest/migrate`. |
| PWA install | PARTIAL | `public/manifest.webmanifest`, service worker, offline page. Not verified as an installed app. |
| RLS so users cannot read each other | PARTIAL (applied live, Stage 1) | `prisma/sql/rls.sql` applied to the Supabase "Still" database with no errors: 30 of 30 public tables have RLS on, 30 policies. The server uses `DATABASE_URL` and bypasses RLS. Cross-user read isolation through a browser client was not tested. |
| Demo login `abc@gmail.com` / `abc123` | REAL (proven live, Stage 1b) | A real Supabase Auth user, created through the admin path in `scripts/ensure-demo-account.ts` (`email_confirm: true`), verified in `auth.users` with a confirmed email and a matching `users` / `profiles` row. Signing in through `POST /api/auth/sign-in` returned 200 and set the session cookie. No bypass. `npm run demo:account` now loads `.env` and tolerates a missing `.env.local`. |
| Privacy, terms, cookies, no tracking | REAL | `src/app/legal/*`, `docs/TRUST-AUDIT.md`, `docs/data-inventory.json`. No analytics SDK. |
| Do not polish the landing page in this build | REAL | This stage did not touch it. |

## Promised in the chat but not in the code

These are in the 4 Oct design (or the realtime upgrade at line 29898) and have no working path:

- LangGraph-style durable pause and resume. Agents are functions in one request (`src/lib/agents/pipeline.ts`, `src/lib/agents/orchestrator.ts`).
- Embeddings, pgvector, and reranked semantic retrieval. Search is `contains`.
- Zoom transcripts, screenshot capture, and uploaded-audio transcription.
- Google Docs open/create. `OPEN_DOCUMENT` records a block and stops.
- A draft-message tool. Sending is refused, which matches her rule; drafting was still listed as an MVP action.
- WhatsApp, Instagram, Gmail, Slack, and meetings as finished connectors. Webhooks or enums exist. Connect does not map a personal account.
- A live capture stream whose steps are real backend events.
- The full debug graph: records retrieved, red-team checks, “paused for approval.”
- The wow scene against Google Calendar. Stage 3 ran it against a local event the signed-in user added. Google OAuth credentials are empty, so `listCalendarEvents` read `calendar_events` and did not call Google.
- Auto-resolution without a click. Stage 4 removed it. A `RESOLVE_THREAD` proposal waits for approve or reject.
- `token_cipher` is JSON, not encryption (`src/lib/connectors/google-calendar-sync.ts`).

## Is an LLM actually called?

`AI_PROVIDER=none` is the default (`src/lib/env.ts`, `.env.example`).

`getLanguageModel` (`src/lib/agents/provider.ts`) returns null for `none`, or when `openai` / `anthropic` has no key. Otherwise it POSTs to OpenAI or Anthropic (`src/lib/agents/providers/openai.ts`, `src/lib/agents/providers/anthropic.ts`).

Call sites, and only on signed-in detect/ingest:

- `runContextAgent` — `src/lib/agents/context-agent.ts`
- `runSocialContextAgent` — `src/lib/agents/social-context-agent.ts`
- `runResolutionAgent` — `src/lib/agents/resolution-agent.ts`

`extractCommitment`, `detectCommitment`, the deadline agent, red team, intervention, and `runStillLoop` stay heuristic. `withExtraction` keeps a thread only when the heuristic also agrees. Guest `POST /api/extract` never loads a model. Telegram sets `interpretedBy: "heuristic"`. No live model call was made in this audit.

She asked for a real AI endpoint on capture. The code can do that only after a provider and key are set. With the default env, the wow story runs on wording rules.

## Capture → extract → confirm → store → remind

1. `CaptureStudio.look` → `POST /api/detect`. Nothing is written.
2. Remember → `POST /api/remember` → `ingestConversation`.
3. That writes `Thread`, `Commitment`, `CommitmentEvidence`, `ThreadEvent`, and `AgentRun`.
4. A `dueAt` creates a `SCHEDULED` reminder.
5. Delivery waits for `/api/cron/reminders`.

Not run against a database here. **PARTIAL** as a live demo until Postgres, a signed-in user, and one cron hit are shown.

## Reminder cron and web push

`processDueReminders` sends an in-app notification, marks the reminder `SENT`, and may write an intervention. Email and push run only when those preferences are on and quiet hours allow. Production requires `Authorization: Bearer $CRON_SECRET`. Stage 5a emptied `vercel.json` crons for Vercel Hobby (sub-daily schedules rejected); `/api/cron/connectors` was never scheduled there either. Quiet-hour release and calendar reconcile need an external caller. Native push is unwired (`nativePushReadyLater`).

## Multi-agent pipeline, approval, trace

The named roles exist as functions. Router, evidence, priority, thread, intervention, friction, action proposal, and red team do not call a model. Ingest stores one `agent_runs` row per `runStillLoop` step. Approval is real for Remember / Ignore and for `MOVE_CALENDAR_EVENT`. Reminder requests auto-store. Commitments auto-store only if `autoRememberClear` is on and confidence ≥ 0.8. That flag defaults off.

## Telegram

`src/lib/sources/telegram.ts`, `src/lib/sources/accounts.ts`, `src/app/api/integrations/telegram/webhook/route.ts`.

Needs `DATABASE_URL`, migrations, RLS SQL, Supabase auth, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, and a public HTTPS webhook with header `x-telegram-bot-api-secret-token`. The user opens `https://t.me/<bot>?start=<code>`, then sends or forwards a private message. Groups are refused. Remember / Ignore calls `createMemoryFromCandidate`. Without the token, the UI says the source is unavailable and offers paste.

## Credentials by feature

| Feature | Required | Notes |
| --- | --- | --- |
| App origin | `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_SITE_URL` | Defaults to `http://localhost:3000`. |
| Database | `DATABASE_URL` | Postgres. Migrate, then `prisma/sql/rls.sql`. |
| Sign-in, `/app`, capture store | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Google login also needs the provider in Supabase and `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`. |
| Delete the Auth user | `SUPABASE_SERVICE_ROLE_KEY` | Without it, Prisma rows can go and the Auth user remains. |
| Guest extract | none beyond the running app | `GUEST_EXTRACT_DAILY_LIMIT` (default 24). No model, no database write. |
| Heuristic AI | `AI_PROVIDER=none` | Default. This is the path the wow story runs on today. |
| Model help on signed-in detect/ingest | `AI_PROVIDER=openai` plus `OPENAI_API_KEY`, or `anthropic` plus `ANTHROPIC_API_KEY` | Optional `AI_MODEL`. Guest extract ignores this. |
| Reminder cron, local | database | Open in non-production without `CRON_SECRET`. |
| Reminder cron, production | `CRON_SECRET` | `Authorization: Bearer`. |
| Web push | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | User opt-in from Settings. |
| Email | `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM` | `log` needs no key. `smtp` does not send. |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Plus database, auth, public HTTPS. |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | UI can show available. Connect does not complete a user mapping. |
| Instagram | `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_APP_SECRET` | Same limitation. |
| Google Calendar | `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Redirect `{APP_URL}/connectors/google-calendar/callback`. Push watch needs public HTTPS. Reconcile via `/api/cron/connectors`. |
| Google Docs | `GOOGLE_DOCS_CLIENT_ID`, `GOOGLE_DOCS_CLIENT_SECRET` | Status copy only. |
| Captcha | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Production refuses account actions until both are set. |
| Dev seed | `STILL_ALLOW_SEED=true` | Must stay off in production. |
| Demo account | Supabase plus `scripts/ensure-demo-account.ts` | Email `abc@gmail.com`, password `abc123`, only after that script runs. |

Operator identity (`STILL_OPERATOR_LEGAL_NAME`, contact, address, jurisdiction) is empty on purpose (`src/config/operator.ts`). Do not invent it. The chat’s `ZOOM_*`, `EMBEDDING_MODEL`, and generic `AI_API_KEY` were not added; the repo uses `AI_PROVIDER` plus provider keys instead.
