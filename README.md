# Still

the things that still matter.

Still remembers meaningful commitments hidden in conversations, voice notes, and pasted text. It is not a chatbot, todo list, calendar, CRM, or dashboard. It never silently performs consequential actions.

## Run

```bash
cp .env.example .env
# fill in at least DATABASE_URL and Supabase Auth keys
docker compose up -d
npx prisma migrate deploy
psql "$DATABASE_URL" -f prisma/sql/rls.sql
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). **Enter STILL** opens a real guest workspace at `/still`. Temporary threads stay in IndexedDB on the device until someone chooses which ones to bring into an account.

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

The isolated development seed never runs in production and never invents people:

```bash
STILL_ALLOW_SEED=true npm run db:seed
```

## Authentication

Create a Supabase project. Copy the URL and anon/publishable key into `.env`.

In Supabase Auth:

1. Enable Email. Confirm whether email verification is required.
2. Add redirect URLs: `http://localhost:3000/auth/callback` and your production `/auth/callback`.
3. Optional Google OAuth: enable the Google provider, then set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`.
4. Password reset uses `/forgot-password` and the same callback.

Still persists sessions with `@supabase/ssr` cookies. `/app` routes are protected. `/signup`, `/login`, and `/forgot-password` are public.

## Database

Prisma migrations live in `prisma/migrations`. After migrate, apply `prisma/sql/rls.sql` so users cannot read another user's rows. The app server uses `DATABASE_URL` (service connection) and bypasses RLS; the browser never receives the service role key.

## AI

`AI_PROVIDER=none` uses deterministic extraction (recommended until keys exist). Set `openai` or `anthropic` plus the matching API key to let a model help interpret wording. All model output is validated with Zod. Extraction endpoints are rate-limited.

## Reminders and web push

Reminders are stored with `remind_at` and processed on the server.

- Local: `curl http://localhost:3000/api/cron/reminders`
- Production: set `CRON_SECRET` and use Vercel Cron (`vercel.json`, every 5 minutes) with `Authorization: Bearer $CRON_SECRET`
- Web push: `npx web-push generate-vapid-keys`, then set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT`. Users opt in from Settings.

The browser tab does not need to stay open. Clicking a notification opens `/app/threads/[id]`.

## Calendar and Docs

Leave Google Calendar and Docs credentials empty unless you have real OAuth clients. Still will explain:

> Connect Google Calendar to let STILL reason about schedule conflicts.

It will not invent events or documents.

## Connected sources

STILL looks for things you said you'd do. It does not read inboxes unless you explicitly connect a supported source.

- Telegram uses the official STILL bot. Users send or forward messages to the bot. Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, and `TELEGRAM_WEBHOOK_SECRET`, then point Telegram's webhook at `/api/integrations/telegram/webhook` with that secret.
- WhatsApp and Instagram use official Meta APIs only. If those credentials are missing, the UI says the source is unavailable and offers paste or forward instead.
- Email and meetings stay unavailable until a permitted provider is configured.
- Paste, type, and speak work with every connector disconnected.

Permanent memory stores the commitment, deadline, person, evidence snippet, and source — not the rest of the conversation. Retention defaults to evidence only.

Privacy lives at `/settings/privacy`. The public policy is `/legal/privacy`. Terms are `/legal/terms`. Memory policy lives at `/settings/memory`.

```bash
npm run trust:check
```

`trust:check` warns while operator details and landscape licenses are unfinished, and fails those checks in production.

## Deploy

The app is Vercel-ready (`npm run build` runs `prisma generate && next build`). Set every used environment variable in the host. Point `NEXT_PUBLIC_APP_URL` at the production origin. Enable Supabase Realtime on `threads`, `notifications`, `reminders`, `interventions`, and `action_proposals`.

Signup, login, and Google OAuth require a real Supabase project (or `supabase start` locally). Still will not invent those credentials.
