# Stage 5a report — Vercel Hobby deployability

No landing-page or visual changes. No features. Secrets not printed or committed.

## 1. `vercel.json` crons

**Before:** one cron, `*/5 * * * *` → `/api/cron/reminders` (Hobby rejects sub-daily schedules; deploy fails silently).

**After:**

```json
{
  "crons": []
}
```

No replacement schedule was added in `vercel.json`. Reminder processing must be invoked from outside Vercel Cron (manual curl, external scheduler, or a later paid plan).

`/api/cron/connectors` was never scheduled in `vercel.json`.

## 2. Cron auth code path (`/api/cron/reminders`)

File: `src/app/api/cron/reminders/route.ts`

```ts
function authorized(request: Request) {
  const env = getServerEnv();
  const secret = env.CRON_SECRET;
  if (!secret) return env.NODE_ENV !== "production";
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return jsonError(401, ...);
  // → processDueReminders()
}

export async function POST(request: Request) {
  return GET(request);
}
```

| Environment | `CRON_SECRET` unset | `CRON_SECRET` set |
| --- | --- | --- |
| non-production | open (authorized) | requires `Authorization: Bearer <secret>` |
| production | **401** | requires `Authorization: Bearer <secret>` |

Production on Vercel: set `CRON_SECRET`, then call:

`GET /api/cron/reminders` with header `Authorization: Bearer $CRON_SECRET`.

Same `authorized()` pattern exists on `/api/cron/connectors`.

## 3. `NODE_ENV=production` behavior

| Area | Effect |
| --- | --- |
| Turnstile / captcha | `captchaMode()` → `"unavailable"` unless both `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are set (`"active"`). Account actions refuse when unavailable (`verifyTurnstile` / auth form). Dev without Turnstile stays `"development"` (skipped). |
| Seed | `prisma/seed.ts` refuses when `NODE_ENV === "production"`. Also requires `STILL_ALLOW_SEED=true` (must stay off on Vercel). |
| Cron auth | Without `CRON_SECRET`, both cron routes return 401. With secret, Bearer must match. |
| Prisma logging | Errors only (not warn+error). |

### Env vars for Vercel

**Required for a working signed-in app**

| Var | Why |
| --- | --- |
| `DATABASE_URL` | Postgres (Supabase pooler URI is fine for the app runtime; migrate offline). |
| `NEXT_PUBLIC_APP_URL` | Canonical app origin (OAuth redirects, links). Set to the Vercel HTTPS URL. |
| `NEXT_PUBLIC_SITE_URL` | Preferred by `getAppUrl()` when set; set to the same public URL. |
| `NEXT_PUBLIC_SUPABASE_URL` | Auth + client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Auth client key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Account delete / admin Auth ops. Server only. |
| `CRON_SECRET` | Production cron Bearer auth. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production signup/login/forgot/reset. |
| `TURNSTILE_SECRET_KEY` | Server Turnstile verify. |

**Strongly recommended for the wow path**

| Var | Why |
| --- | --- |
| `AI_PROVIDER` | `openai` or `anthropic` for model extract; default `none` = heuristic. |
| `AI_MODEL` | Optional model id. |
| `AI_BASE_URL` | Optional OpenAI-compatible base (e.g. NVIDIA). |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Matching provider key. |

**Optional**

| Var | Why |
| --- | --- |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | `true` only if Google provider is enabled in Supabase. |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | Reminder email (`log` needs no key; `smtp` does not send). |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web push. |
| `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET` | Real Google Calendar OAuth; empty → local `calendar_events` path. |
| `GOOGLE_DOCS_*`, Telegram, WhatsApp, Instagram vars | Leave empty unless wired. |
| `GUEST_EXTRACT_DAILY_LIMIT` | Default 24. |
| `STILL_ALLOW_SEED` | Must be unset / false. |
| Operator legal vars (`STILL_OPERATOR_*`, contacts) | Leave empty until real. |

`NODE_ENV` is set by Vercel to `production` at runtime; do not rely on setting it manually in the dashboard.

## 4. Build does not run migrate

```json
"build": "prisma generate && next build",
"postinstall": "prisma generate"
```

No `prisma migrate`, `db push`, or seed in the Vercel build. Migrations stay offline against a direct DB URL; the Hobby build only generates the client.

## 5. Checks

| Command | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass |
| `npm run test` | 14 files / 105 tests pass |
| `npm run build` | pass (`prisma generate && next build`; no migrate) |

## Deploy note (operator)

After Vercel deploy: set env vars above, confirm Turnstile domains include the production host, point Supabase Auth redirect URLs at `NEXT_PUBLIC_APP_URL`, and schedule an external GET to `/api/cron/reminders` with Bearer `CRON_SECRET` (Hobby has no sub-daily Vercel Cron).
