# STILL trust audit

Date of inspection: 2026-09-25  
Inspected from the repository as it exists in this working tree.  
Items that cannot be proven from code or committed configuration are marked **REQUIRES CONFIRMATION**.

This document does not invent operator identity, hosting region, or contracts.

## DATA COLLECTED

From Prisma models, Auth, and browser code:

- Account email (`users.email`, Supabase Auth)
- Optional display name and timezone (`profiles`)
- Commitments, evidence snippets, deadlines, people names
- Optional pasted conversation text (subject to retention)
- Optional voice *transcripts* after Remember — not audio files
- Integration account identifiers, scopes, encrypted-looking `token_cipher`
- Source message / conversation rows when a connected source is used
- Memory candidates (noticed, not yet confirmed)
- Reminders, in-app / email / web-push notifications
- Push subscription keys
- Agent run input/output JSON
- Interventions and action proposals
- Audit logs and consent events (consent events added in the trust-layer migration)
- Preference and memory-policy flags
- IP address on some audit writes (`clientIp`)

Not collected by application code:

- Analytics events, advertising identifiers, session replay
- Payment or card data (no paid product in the repo)
- Relationship scores or emotional analysis

## WHY IT IS COLLECTED

- Email / session: sign the user in and reach them if they asked for notices
- Commitments + evidence: remember what they said they would do, and show why
- People / deadlines / reminders: group and time those memories
- Connected-source identifiers: receive messages the user sent or forwarded to STILL
- Agent outputs: keep an inspectable record of interpretation
- Audit / consent: permission receipts and security
- Push keys: deliver reminders the user enabled

## WHERE IT IS STORED

- Application database via `DATABASE_URL` (PostgreSQL; README assumes Supabase Postgres)
- Supabase Auth user records
- Browser: Supabase session cookies; Cache API for the PWA shell (`still-shell-v1`); guest workspace IndexedDB (`still-guest`); one-time migration from legacy `localStorage` `still-guest-v1`
- Host process logs via `logger`

Exact disk region of the Supabase project and Vercel deployment: **REQUIRES CONFIRMATION**.

## WHO RECEIVES IT

| Recipient | When | What |
|-----------|------|------|
| This application server | Always when a feature runs | User-owned rows; never trusts client `user_id` |
| Supabase Auth | Auth configured | Email, password hash (Supabase-side), session |
| OpenAI or Anthropic | `AI_PROVIDER` is `openai` or `anthropic` | Candidate snippets / conversation excerpts sent by agent code |
| Resend or SMTP | `EMAIL_PROVIDER` configured and email notices on | Reminder / account email content |
| Browser push service | User enabled web push | Notification title/body |
| Telegram / Meta official APIs | Webhooks and tokens configured | Messages the user sent or forwarded to the official bot/app |
| Google | Only if Calendar/Docs/OAuth env is set *and* a real OAuth flow is completed | **Not implemented as a finished OAuth read in the current connect UI** |

No analytics vendor is installed.

Whether an AI provider trains on API traffic: **REQUIRES CONFIRMATION** (depends on the operator's contract with that provider). Application copy must not claim “not used for training” as a completed fact.

## RETENTION

Default preference: `conversation_retention = EVIDENCE_ONLY`.

Intended default: keep the commitment, deadline, person, evidence sentence, and source — not an unused 40-message remainder.

Integration pipeline (`persistSourceMinimum`) already respects NONE / EVIDENCE_ONLY / RETAIN_SOURCE.

Manual remember/ingest is updated to use the same preference. Account deletion removes Prisma user-owned rows (cascade) and audit rows; Supabase Auth user is removed only if `SUPABASE_SERVICE_ROLE_KEY` is set.

Host log retention: **REQUIRES CONFIRMATION**.

## USER CONTROL

Implemented or completed in this pass:

- Inspect memories (`/memory`, thread evidence drawer)
- Forget / resolve / delete a thread
- Correct via thread actions
- Memory policy (`/settings/memory`)
- Retention (`/settings/privacy`)
- Connect / disconnect sources
- Export JSON (`GET /api/account`)
- Delete source excerpts
- Delete account (`DELETE /api/account`)
- Notification category and quiet-hour preferences
- Consent receipts (`consent_events`)

Public `/api/extract` still classifies text without an account and does not persist it.

## COOKIES / STORAGE

See `/legal/cookies` and `docs/data-inventory.json`.

- Strictly necessary: Supabase SSR session cookies
- Functional: Cache API PWA shell; Web Push subscription after opt-in
- Analytics: none
- Marketing: none

No cookie banner is shown because no optional tracking cookies exist.

Exact Supabase cookie names and TTLs depend on the project URL and Auth settings: **REQUIRES CONFIRMATION**.

## TRACKING

Searched the repository for Google Analytics, GTM, Meta Pixel, PostHog, Hotjar, Microsoft Clarity, Mixpanel, Amplitude, Segment, Sentry session replay, FullStory, TikTok Pixel, and advertising SDKs.

**NO OPTIONAL ANALYTICS CURRENTLY INSTALLED.**

`next/font/google` is used for Figtree and Fraunces. Next.js downloads those files at build time and self-hosts them. That is not an analytics tag.

## THIRD PARTIES

- `@supabase/ssr`, `@supabase/supabase-js`
- Optional OpenAI / Anthropic HTTP APIs
- Optional Resend / SMTP
- Optional `web-push`
- Optional Telegram Bot API, WhatsApp/Instagram Cloud API
- Optional Google OAuth env vars (login via Supabase; calendar/docs stubs)
- Lucide icons (bundled)
- GSAP, Lenis, Framer Motion (bundled, no third-party runtime embed)
- Hosting: README says Vercel-ready. Production host: **REQUIRES CONFIRMATION**

## ACCESSIBILITY

Target: WCAG 2.2 AA.

Found at audit time:

- Real labels on auth fields; some other forms lacked `id` / `autocomplete`
- `:focus-visible` ring present; no `outline: none`
- `--ink-faint` (#9a9389) failed 4.5:1 on `--bg` (fixed toward a darker mute)
- Evidence drawer had no Escape handler
- Capture mode buttons lacked `aria-pressed`
- Reduced motion skipped GSAP/Lenis; landscape parallax skipped; sky opacity still ran
- Decorative landscapes use `alt=""`
- Keyboard traps: none found
- Skip link: added on the signed-in shell

Screen-reader and zoom QA after changes: see the implementation notes in this pass; full AT lab testing **REQUIRES CONFIRMATION**.

## CONTENT CLAIMS

Absolute or strong claims found:

| Claim | Verdict |
|-------|---------|
| STILL never writes to / sends a message to another person | Accurate for this codebase (no outbound social send). Qualified in UI copy. |
| Never silently performs consequential actions | Matches approval / red-team gates. Calendar execute is not implemented. |
| Only processes what you authorize | True for connected sources. Public `/api/extract` processes anonymous pasted text without an account. |
| Audio is not stored | Accurate for Speak capture. |
| Not training data for STILL | Accurate that STILL does not train a foundation model. Provider training **REQUIRES CONFIRMATION**. |
| Guaranteed reminders / perfect memory / 100% secure / never leaves your device | Not claimed as product guarantees in the current marketing. Reminders require cron + optional push/email. |

Landing examples are labeled illustrative. Live `/api/extract` is labeled not the user's memory.

## ASSET LICENSING

See `docs/ASSET-LICENSES.md`.

Landscape sky artwork and the STILL mark have no committed license file. **DO NOT SHIP** those images for public commercial deployment until provenance is confirmed.

## SECURITY RISKS

- Server uses `DATABASE_URL` and bypasses RLS (documented). RLS exists for browser/Supabase clients and must be applied (`prisma/sql/rls.sql`) after migrate. Whether production applied it: **REQUIRES CONFIRMATION**.
- Account delete without service role leaves the Auth user.
- `token_cipher` column exists; cipher implementation strength: **REQUIRES CONFIRMATION**.
- Public extract endpoint is rate-limited by IP; still accepts arbitrary text.
- Secrets in `.env` are gitignored; `.env.example` has no live keys. Scan source for committed secrets in `trust:check`.
- Cron `/api/cron/reminders` is public unless `CRON_SECRET` is set.

## OPEN LEGAL QUESTIONS

- Operator legal name, address, contact, governing law: unset (`src/config/operator.ts`)
- Age / children's policy jurisdiction (COPPA, GDPR age, etc.)
- Data processing agreements with Supabase, AI, email, push, and Meta/Telegram
- Whether any subprocessors train on content
- Data residency
- Whether STILL is a consumer product, B2B, or both
- Paid plan / refunds: no payment code exists
- Trademark ownership of STILL mark
- License to ship the landscape illustrations commercially
