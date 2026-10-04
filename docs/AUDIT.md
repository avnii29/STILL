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
| Guest paste, evidence shown, nothing stored | REAL (API proven live, Stage 1) | `src/components/guest/guest-workspace.tsx` → `POST /api/extract` returns `persisted: false`. IndexedDB in `src/lib/guest/store.ts`. Live: the Maya sentence returned `persisted: false`. Browser/IndexedDB half not walked. |
| Signed-in type / paste / speak, then Remember | REAL | `src/components/capture-studio.tsx` → `POST /api/detect` then `POST /api/remember`. Speech is browser `SpeechRecognition`. Audio is not stored. |
| AI extraction of what / who / when / evidence | PARTIAL | `src/lib/agents/extract.ts` and `src/lib/sources/detect.ts` are heuristics. A model is optional and off by default. See below. **Stage 1, proven live:** the exact Maya sentence was returned as `is_commitment: false` (confidence 0.12) because `get` was missing from the `ACTION` list, and "Tuesday evening" was stored as 09:00. Both fixed in `extract.ts` and covered by a test; live re-run returns `is_commitment: true`, 0.88, Maya, "tuesday evening", 18:00 IST. Title is still `Yep, I'll get revised dataset to by`. |
| User confirms or corrects before memory | REAL | Remember / not-a-commitment in capture. Source candidates: `src/components/candidate-card.tsx`, Telegram buttons in `src/app/api/integrations/telegram/webhook/route.ts`. |
| Store commitment, person, deadline, evidence, source | REAL | `ingestConversation` in `src/lib/threads/ingest.ts`. Source confirm: `createMemoryFromCandidate` in `src/lib/sources/pipeline.ts`. |
| Evidence drawer (“why do you remember this?”) | REAL | `src/components/evidence-drawer.tsx` on `src/app/(still)/app/threads/[id]/page.tsx`. |
| Append-only thread ledger | REAL | `thread_events` via Prisma `ThreadEvent`. Timeline on the thread page. |
| Status model (open, postponed, likely resolved, dismissed) | REAL | `ThreadStatus` in `prisma/schema.prisma`. Wider than her short list; the extras exist. |
| Let it go without deleting | REAL | Dismiss keeps the thread. Delete is separate. |
| Resolution from later wording | PARTIAL | `runResolutionAgent` and `maybeResolveFromMessage`. High confidence (≥ 0.9) can mark resolved without a click. |
| Deadline change backs off | PARTIAL | `applyDeadlineChange` in `src/lib/ingestion/signals.ts` on the source path. Capture ingest does not run that story by itself. |
| Schedule a reminder | REAL | `scheduleRemindAt` in `src/lib/agents/extract.ts`. Row created when `dueAt` exists. |
| Reminder actually fires | PARTIAL | `processDueReminders` in `src/lib/threads/reminders.ts`, route `src/app/api/cron/reminders/route.ts`, schedule in `vercel.json`. Nothing polls inside the app. Local use is a curl. **Stage 1, proven live:** `GET /api/cron/reminders` against the Supabase DB returned `{"due":0,"sent":0}` (route, auth rule, and query run). No reminder was delivered because no thread could be created without the demo user. |
| In-app notice | REAL | `createNotification` in `src/lib/notifications/dispatch.ts`. |
| Web push | PARTIAL | `src/lib/notifications/push.ts`, `POST /api/push/subscribe`, `public/sw.js`. Needs VAPID, opt-in, and the cron. |
| Email notice | PARTIAL | Resend or log in `src/lib/notifications/email.ts`. SMTP does not send. |
| Friction after repeated postpone | PARTIAL | `evaluatePostponement` in `src/lib/threads/lifecycle.ts`. Copy only. It does not open a document. |
| Intervention agent | PARTIAL | `evaluateIntervention` in `src/lib/threads/lifecycle.ts`. Stored on ingest and when a reminder fires. Calendar conflict is passed as `hasConflict: false` from ingest. |
| Red team before an external action | PARTIAL | `runRedTeamAgent` in `src/lib/agents/governance.ts`. Blocks “interview” and inactive commitments. It does not read a real calendar priority. |
| Human approval, then act | PARTIAL | `decideProposal` in `src/lib/threads/actions.ts`. UI: `src/components/thread-actions.tsx`. `SEND_MESSAGE` is hard-blocked in `src/lib/actions/gateway.ts`. |
| Calendar move after approval | PARTIAL | `executeCalendarMove` in `src/lib/connectors/google-calendar-sync.ts`. Needs OAuth. Empty credentials stay honest. |
| Open or create a Google Doc | UI-ONLY | `OPEN_DOCUMENT` is marked blocked via `docsStatus`. No Docs API. |
| Draft a message | MISSING | Enum and risk level only. No draft tool. |
| One live connected source | PARTIAL | Telegram webhook, link, and confirm are implemented. WhatsApp and Instagram parse payloads and stop at `REQUIRES_ACTION`. |
| Noticed inbox of candidates | REAL | `MemoryCandidate` and `src/app/(still)/app/noticed/page.tsx`. |
| People without a CRM score | REAL | `Person` rows from names in commitments. |
| Future self | PARTIAL | `runFutureSelfAgent` relabels self-talk. Page `src/app/(still)/app/future/page.tsx`. Not a separate motivational product. |
| Search “what did I promise Rahul?” | PARTIAL | Substring search in `src/app/(still)/app/search/page.tsx`. Not semantic. |
| Agent trace a judge can see | PARTIAL | `/app/debug` and “Agent reasoning” on the thread. Kind, ok, confidence. Not the step graph she specified (retrieved-record counts, waiting-for-approval). |
| Live agent event stream during capture | MISSING | Landing `src/components/landing/agent-flow.tsx` is a clickable illustration. Capture does not stream backend steps. |
| Realtime across tabs | PARTIAL | `src/components/threads-realtime.tsx` subscribes to Supabase `postgres_changes`. Needs Realtime enabled on the project. |
| Replayable Maya demo | PARTIAL | `src/lib/demo/scenario.ts` and `/demo` run `runStillLoop` on fixed text. It is not her connected-account data. |
| Guest usable without an account | REAL | `/still`. Migrate via `POST /api/guest/migrate`. |
| PWA install | PARTIAL | `public/manifest.webmanifest`, service worker, offline page. Not verified as an installed app. |
| RLS so users cannot read each other | PARTIAL (applied live, Stage 1) | `prisma/sql/rls.sql` applied to the Supabase "Still" database with no errors: 30 of 30 public tables have RLS on, 30 policies. The server uses `DATABASE_URL` and bypasses RLS. Cross-user read isolation through a browser client was not tested. |
| Demo login `abc@gmail.com` / `abc123` | PARTIAL (blocked, Stage 1) | Filled from `src/components/auth-form.tsx`. The user does not exist. Supabase public signup rejects it with `email_address_invalid`; the script's admin path needs `SUPABASE_SERVICE_ROLE_KEY`, which is empty. `npm run demo:account` also fails first because it requires a missing `.env.local`. |
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
- The wow scene as one path: postpone does not consult live calendar events (`calendarStatus(false)` in `postponeThread`), so “move the 4 PM catch-up” does not arise from a real calendar unless a separate calendar sync has already written a proposal.
- Auto-resolution without a click at confidence ≥ 0.9, which is stricter than her “ask: did this close something?”
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

`processDueReminders` sends an in-app notification, marks the reminder `SENT`, and may write an intervention. Email and push run only when those preferences are on and quiet hours allow. Production requires `Authorization: Bearer $CRON_SECRET`. `vercel.json` schedules reminders every five minutes and does not schedule `/api/cron/connectors`, so quiet-hour release and calendar reconcile are not on that cron. Native push is unwired (`nativePushReadyLater`).

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
