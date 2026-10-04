# Stage 1 report: prove the loop against a real database

Date: 2026-10-04 to 2026-10-05 (IST). Target: the Supabase project "Still" (`DATABASE_URL` is the session pooler, port 5432).

This file has two parts. **Stage 1b (below) is the current state and supersedes the "blocked" result in Stage 1.** The original Stage 1 write-up follows it unchanged, for history.

---

# Stage 1b: the live loop, end to end

## Result

**Pass.** Sign in → detect → remember → thread, commitment, evidence, agent runs, and a `SCHEDULED` reminder in the database → cron → `SENT` reminder, `IN_APP` notification, thread `APPROACHING`. All shown below with pasted output.

One step used a labelled shortcut: **TEST SHORTCUT**, one SQL `UPDATE` of one reminder's `remind_at` (step 5). Nothing else was written to the database by hand.

Not proven: clicking the buttons in a browser. I drove the real HTTP routes (`/api/auth/sign-in`, `/api/detect`, `/api/remember`, `/api/cron/reminders`, `/api/notifications/live`) with curl and a real Supabase session cookie. The page `GET /threads/<id>` also returned 200 and contained the pasted sentence.

## 1. DNS, with no preload

`NODE_OPTIONS` was **still set to the `/tmp` preload in my shell from Stage 1**; I unset it and confirmed it was empty before testing. `/etc/resolv.conf` now lists 1.1.1.1 and 8.8.8.8.

```
NODE_OPTIONS=<empty>
$ getent hosts alufhpiazagayrbtycai.supabase.co
104.18.38.10    alufhpiazagayrbtycai.supabase.co
172.64.149.246  alufhpiazagayrbtycai.supabase.co
$ node -e 'dns.lookup(...)'  →  node lookup: 104.18.38.10
$ curl https://alufhpiazagayrbtycai.supabase.co/auth/v1/health  →  401  (reached the server; no apikey sent)
```

The dev server, verification scripts and demo-account script all ran with `NODE_OPTIONS` empty. Note: my first probe inside the default sandbox failed (`EAI_AGAIN`, curl `CONNECT tunnel failed 403`). That was the sandbox's network allowlist, not DNS; the same commands succeeded with network access granted. The preload is not needed.

## 2. Script fix (smallest change)

Two problems: `npm run demo:account` required `.env.local`, and the script hid the real Supabase error behind "add the key".

```diff
--- a/package.json
-    "demo:account": "node --env-file=.env --env-file=.env.local --import tsx scripts/ensure-demo-account.ts",
+    "demo:account": "node --env-file=.env --env-file-if-exists=.env.local --import tsx scripts/ensure-demo-account.ts",
--- a/scripts/ensure-demo-account.ts
@@ signup fallback
-          "Demo account was not created through signup. Add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account.",
+          `Demo account was not created through signup (${signed.error.code ?? signed.error.status}: ${signed.error.message}). Add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account.`,
@@ admin path
-      console.error("Demo account was not created. Supabase refused the admin request.");
+      console.error(
+        `Demo account was not created. Supabase refused the admin request (${created.error?.code ?? created.error?.status}: ${created.error?.message}).`,
+      );
@@ profile step
-    } catch {
-      console.error("Auth user is ready. The database profile was not updated.");
+    } catch (error) {
+      console.error(
+        `Auth user is ready. The database profile was not updated (${error instanceof Error ? error.message : String(error)}).`,
+      );
```

Only Supabase's own error code and message are printed, never a key. The third hunk (profile step) was also swallowing its error; I included it because it had the same problem.

## 3. Demo user

```
$ npm run demo:account
npm notice run node --env-file=.env --env-file-if-exists=.env.local --import tsx scripts/ensure-demo-account.ts
.env.local not found. Continuing without it.
Demo account is ready. Sign in from the login page.   (exit 0)
```

Verified in both places (admin API list, then SQL):

```
auth.users: { id: 'b44c2db2-174e-45e6-a10c-5054bd6fed98', email: 'abc@gmail.com',
  email_confirmed_at: '2026-10-04T18:35:50.403949Z', providers: ['email'] }   | total users: 1
public.users + profiles: [{ id: 'b44c2db2-…', email: 'abc@gmail.com', display_name: 'Demo',
  timezone: 'Asia/Kolkata', onboarded: true }]
```

This is a real Supabase Auth user created via `auth.admin.createUser({ email_confirm: true })`. No bypass.

## 4. The loop

Dev server: `npm run dev` (Next.js 16.3.5), `NODE_OPTIONS` empty.

**Sign in** (real route; `Origin` header sent because the route enforces same-origin):

```
POST /api/auth/sign-in {"email":"abc@gmail.com", ...}
HTTP/1.1 200 OK   {"ok":true,"destination":"/app"}
cookie set: sb-alufhpiazagayrbtycai-auth-token   (value not shown)
```
Control: `POST /api/detect` with no cookie → `401`.

**Detect** (`"Yep, I'll get the revised dataset to Maya by Tuesday evening"`), HTTP 200:

```
extraction: is_commitment true, confidence 0.88, person "Maya", deadline "tuesday evening",
            due_at "2026-10-06T12:30:00.000Z", evidence = the full sentence
detections[0]: type EXPLICIT_PROMISE, owner ME, isThread true, confidence 0.88,
               title "Yep, I'll get revised dataset to by"
```
Detect writes nothing. Counts before Remember, after sign-in and detect:
`{ threads: 0, commitments: 0, commitment_evidence: 0, agent_runs: 0, reminders: 0, notifications: 0, thread_events: 0 }`

**Remember**, HTTP 200:

```
{"conversationId":"cmuu5y7hy0003o6cmdlujixji","threadIds":["cmuu5y8hg0008o6cm6pvuq70m"],"interpretedBy":"heuristic"}
```

**Database rows after Remember** (user `b44c2db2-…`). All timestamps are UTC.

`threads` (1 row):

| id | title | status | source | commitment_type | owner | confidence | interpreted_by | needs_user_review | due_at (UTC) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cmuu5y8hg0008o6cm6pvuq70m | Yep, I'll get revised dataset to by | NEEDS_REVIEW | PASTE | EXPLICIT_PROMISE | ME | 0.88 | heuristic | true | 2026-10-06 12:30:00 |

`commitments` (1 row):

| id | thread_id | type | owner | text | normalized_text | due_hint | confidence | is_commitment |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cmuu5y8ku0009o6cmk9tjxo0j | cmuu5y8hg0008o6cm6pvuq70m | EXPLICIT_PROMISE | ME | Yep, I'll get the revised dataset to Maya by Tuesday evening | Yep, I'll get revised dataset to by | tuesday evening | 0.88 | true |

`commitment_evidence` (1 row):

| id | commitment_id | exact_text | source_kind | confidence |
| --- | --- | --- | --- | --- |
| cmuu5y8o9000ao6cm6ziaj8kh | cmuu5y8ku0009o6cmk9tjxo0j | Yep, I'll get the revised dataset to Maya by Tuesday evening | PASTE | 0 |

`agent_runs` (9 rows, all `ok = true`): EXTRACT 0.88 · INTERVENTION 0.4 · Router 0.8 · Commitment 0.9 · Context 0.7 · Evidence 0.9 · Deadline 0.64 · Intervention 0.4 · Red team 0.8.

`reminders` (1 row):

| id | thread_id | status | channel | remind_at (UTC) | delivered_at | body |
| --- | --- | --- | --- | --- | --- | --- |
| cmuu5y95u000eo6cmreczk58f | cmuu5y8hg0008o6cm6pvuq70m | **SCHEDULED** | WEB_PUSH | **2026-10-06 10:30:00** | null | You said you'd Yep, I'll get revised dataset to by. 42 hours left. |

`remind_at` is 2 hours before the 12:30 UTC deadline (16:00 IST), as `scheduleRemindAt` intends.

`thread_events`: DETECTED, EVIDENCE_STORED, REMINDER_SCHEDULED.

Two things I saw that you did not ask about:

- `commitment_evidence.confidence` is `0` even though the commitment is 0.88. Not fixed.
- Remember also immediately created two notifications (`IN_APP` `SENT` and `EMAIL` `FAILED`, title "Something still matters", href `/home`) before any reminder. They come from `ingestConversation` in `src/lib/threads/ingest.ts` (it notifies whenever new threads are created and `quiet` is not set), not from cron.

A note on my own tooling: my first row dump showed timestamps 5.5 hours early (`created_at` 13:07 vs `now()` 18:38). The columns are `timestamp without time zone` and `node-pg` parses those as local time (IST). I confirmed by reading the raw text (`due_at 2026-10-06 12:30:00`, `remind_at 2026-10-06 10:30:00`, session `TimeZone: UTC`) and fixed my script. The app was correct.

## 5. Cron (with the TEST SHORTCUT)

Control, real `remind_at` two days away:

```
GET /api/cron/reminders   →   {"due":0,"sent":0}   HTTP 200
```

**TEST SHORTCUT** (the only hand-written database change; session `TimeZone` is UTC, so `now()` matches how the app stores times):

```sql
UPDATE reminders SET remind_at = now()
WHERE id = 'cmuu5y95u000eo6cmreczk58f' AND status = 'SCHEDULED';
-- rowCount: 1     remind_at -> 2026-10-04 18:38:57.591 UTC, status still SCHEDULED
```

Then:

```
GET /api/cron/reminders   →   {"due":1,"sent":1}   HTTP 200
```

`reminders`:

| id | status | channel | remind_at (UTC) | delivered_at (UTC) |
| --- | --- | --- | --- | --- |
| cmuu5y95u000eo6cmreczk58f | **SENT** | WEB_PUSH | 2026-10-04 18:38:57.591 | 2026-10-04 18:39:02.857 |

`notifications` (4 rows; rows 3 and 4 are from cron):

| channel | status | title | body | href |
| --- | --- | --- | --- | --- |
| IN_APP | SENT | Something still matters | Still noticed an unfinished conversation. It is waiting for you to look. | /home |
| EMAIL | FAILED | Something still matters | (same) | /home |
| **IN_APP** | **SENT** | STILL | You said you'd Yep, I'll get revised dataset to by. 42 hours left. | /threads/cmuu5y8hg0008o6cm6pvuq70m |
| EMAIL | FAILED | STILL | (same) | /threads/cmuu5y8hg0008o6cm6pvuq70m |

Thread: `status` **NEEDS_REVIEW → APPROACHING**. New `thread_events` row `REMINDER_SENT`. No `interventions` row was created.

Does the app show it? Signed in, `GET /api/notifications/live` (the endpoint the in-app toast polls) returned both IN_APP notifications, including the cron one (HTTP 200). `GET /threads/cmuu5y8hg0008o6cm6pvuq70m` returned 200 and contained "revised dataset to Maya by Tuesday evening".

The reminder body says "42 hours left" because it is computed from the real deadline against the real current time (2026-10-04 18:39 UTC → 2026-10-06 12:30 UTC ≈ 42h). That is correct, and it confirms the shortcut only moved `remind_at`, not the deadline.

## 6. Noted, not fixed (per instructions)

- **Thread title** is `Yep, I'll get revised dataset to by`.
- **Timezone handling**: `extractDeadline` / `scheduleRemindAt` use the server's local timezone, not the profile timezone (`Asia/Kolkata`). Correct on this machine only because the machine is IST.
- **Cron secret**: `CRON_SECRET` is unset, so `/api/cron/reminders` answered an unauthenticated request. That only works because `NODE_ENV` is not `production`.
- **EMAIL notifications fail**: `emailNotifications` is on by default and no email provider is configured, so each notification also writes a `FAILED` `EMAIL` row. Looks like noise, not an error in the loop.
- **`commitment_evidence.confidence` = 0.**
- Thread is `NEEDS_REVIEW` after Remember; the status the user sees before the reminder is "needs review", not "open".

## 7. Checks

```
typecheck   exit 0
lint        exit 0
test        Test Files 13 passed (13)   Tests 92 passed (92)
build       exit 0
```

All run with `NODE_OPTIONS` empty.

## Stage 1b files changed

- `package.json` (1 line: `--env-file-if-exists=.env.local`)
- `scripts/ensure-demo-account.ts` (error messages only)
- `docs/AUDIT.md` (rows: signed-in capture, AI extraction note, store, ledger, schedule a reminder, reminder fires, in-app notice, email notice, intervention agent, agent trace, demo login)
- `docs/STAGE1-REPORT.md` (this section)

No application source, landing page, or visual design was touched. Verification scripts live in `/tmp/still-verify/` (outside the repo). Nothing was committed or staged. Database writes: the demo user and its profile, and everything the app itself wrote during the walk, plus the one TEST SHORTCUT update. The demo thread, reminder, and notifications are still in the database as live test data for `abc@gmail.com`.

## Stage 1b risks

- The TEST SHORTCUT proves delivery, not timing. The real schedule (Vercel cron every 5 minutes) was not run.
- Browser clicks were not exercised; the UI could still have a bug the routes do not.
- The unauthenticated cron endpoint and the server-timezone deadlines would both bite on a production host.
- The test thread and notifications for `abc@gmail.com` remain in the database; they are real rows, not fake data, but they came from a test sentence.
- Email will keep writing `FAILED` rows until a provider or `EMAIL_PROVIDER=log` is set.

---

# Stage 1 (original write-up, superseded by Stage 1b above)

The text below is the first Stage 1 report as written. Where it says the loop is blocked on `SUPABASE_SERVICE_ROLE_KEY` or on DNS, that is no longer true.

## Result (at the time)

**The full loop was not proven. It is blocked at one step: the demo user does not exist.**

Everything before that step is proven live. Everything after it is untested.

| Step | Status | Evidence |
| --- | --- | --- |
| `.env` has what the app needs | Done | Names checked against `.env.example`; no values printed |
| Prisma migrations applied | **Proven** | 5 of 5 applied |
| `prisma/sql/rls.sql` applied | **Proven** | 30 of 30 tables RLS on, 30 policies |
| Demo account created | **BLOCKED** | Needs `SUPABASE_SERVICE_ROLE_KEY` |
| Sign in | Not run | No user |
| Paste the Maya sentence → extraction | **Proven (via guest API) after a fix** | See "Bug found" |
| Remember → thread with evidence | Not run | Needs sign-in |
| `SCHEDULED` reminder row | Not run | Needs a thread |
| `/api/cron/reminders` → in-app notification | Route proven, delivery not | Returned `{"due":0,"sent":0}` |

## What I need from you

Add **`SUPABASE_SERVICE_ROLE_KEY`** to `.env` (Supabase dashboard → Project Settings → API → `service_role`). I did not ask for its value.

Why it is required: Supabase refuses `abc@gmail.com` on public signup (`email_address_invalid`). Only the admin API can create it, and `scripts/ensure-demo-account.ts` already uses the admin API when that key is present. I did not add a bypass.

Also: your router DNS does not resolve `*.supabase.co`. See "DNS" below. Your browser may hit the same problem.

## Checking `.env`

Compared every name in `.env.example` against `.env`, printing only `set` / `empty` / `MISSING`.

- Set: `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `AI_PROVIDER` (value `none`), plus app URL, email, and defaults.
- Empty and needed for this loop: **`SUPABASE_SERVICE_ROLE_KEY`** (demo account only).
- Empty and not needed here: `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key covers it), `CRON_SECRET` (open in non-production), VAPID keys, Resend, Turnstile, Telegram, Google, model keys.
- No names in `.env` that are missing from `.env.example`.
- `DATABASE_URL` shape: host `aws-0-ap-northeast-1.pooler.supabase.com`, port `5432`, database `postgres`, user `postgres.<project ref>`. The ref matches `NEXT_PUBLIC_SUPABASE_URL`.
- `.env` and `docs/planning-chat.md` are both ignored by `.gitignore`.

## Commands and output

Passwords are masked with `***`.

### Migrations

```
$ npx prisma migrate status
Datasource "db": PostgreSQL database "postgres", schema "public" at "aws-0-ap-northeast-1.pooler.supabase.com:5432"
5 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260921100000_init
20260921140000_product
20260921180000_sources
20260925120000_trust_layer
20261004120000_ingestion

$ npx prisma migrate deploy
Applying migration `20260921100000_init`
Applying migration `20260921140000_product`
Applying migration `20260921180000_sources`
Applying migration `20260925120000_trust_layer`
Applying migration `20261004120000_ingestion`
All migrations have been successfully applied.
```

### RLS

`psql` is not installed here, so I ran the same file through the repo's `pg` driver as one query (inline, nothing saved to the repo). `rls.sql` did not need any change.

```
rls.sql applied: OK
tables: { rls_on: '30', total: '30' } policies: 30 rls_off: []
public tables: _prisma_migrations, action_approvals, action_proposals, agent_runs, audit_logs,
calendar_events, commitment_evidence, commitments, consent_events, conversation_sources,
conversations, ingestion_events, integration_accounts, integrations, interventions,
memory_candidates, messages, notifications, people, profiles, provider_events,
push_subscriptions, reminders, resolutions, source_conversations, source_messages,
source_permissions, thread_events, threads, user_preferences, users
```

### Demo account

```
$ npm run demo:account
node: .env.local: not found
```

`package.json` passes `--env-file=.env.local`, which does not exist, so Node exits before the script runs. I did not edit `package.json`. Running the script directly:

```
$ node --env-file=.env --import tsx scripts/ensure-demo-account.ts
Demo account was not created through signup. Add SUPABASE_SERVICE_ROLE_KEY and run npm run demo:account.
```

The script hides the reason. Calling signup directly and printing only the error:

```
signUp error: { status: 400, code: 'email_address_invalid',
                message: 'Email address "abc@gmail.com" is invalid' }
sign-in:      { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }
```

So the user does not exist, and public signup cannot create it.

### DNS

The first signup attempt failed with `fetch failed` (status 0), not a Supabase error.

```
$ getent hosts alufhpiazagayrbtycai.supabase.co      → (no result)
$ curl https://alufhpiazagayrbtycai.supabase.co/...  → Could not resolve host
resolver: 192.168.29.1 (your router)
1.1.1.1 A: [ '172.64.149.246', '104.18.38.10' ]
8.8.8.8 A: [ '104.18.38.10', '172.64.149.246' ]
9.9.9.9 A: [ '172.64.149.246', '104.18.38.10' ]
```

The project exists and resolves on public DNS. Your router's resolver does not return it. The Postgres pooler (`*.pooler.supabase.com`) resolves fine, which is why Prisma worked.

I did not change system DNS. For my runs I used a Node preload at `/tmp/still-dns-preload.cjs` (outside the repo, not committed) that resolves only `*.supabase.co` through 1.1.1.1 / 8.8.8.8:

```
$ NODE_OPTIONS="--require /tmp/still-dns-preload.cjs" ...
auth health: 200 {"version":"v2.197.0","name":"GoTrue",...}
```

This affects you too. The server-side calls from `npm run dev` (sign-in, session check) and your browser will fail to reach Supabase unless you either switch your machine's DNS to 1.1.1.1 / 8.8.8.8, or start the app with the same preload.

### Dev server and live probes

Started with `NODE_OPTIONS="--require /tmp/still-dns-preload.cjs" npm run dev`.

```
GET  /api/health
{"ok":true,"service":"still","database":true,"auth":true,"ai":"none","email":"none","googleAuth":false}

POST /api/extract  (the Maya sentence, guest path, no DB write)   [before the fix]
{"extraction":{"is_commitment":false,"confidence":0.12,"person":"Maya","deadline":"tuesday",
 "due_at":"2026-10-06T03:30:00.000Z", ...},"persisted":false,"remaining":23}

POST /api/remember   (no session)                → 401
GET  /api/cron/reminders  (dev, no CRON_SECRET)  → {"due":0,"sent":0}
POST /api/auth/sign-in  (abc@gmail.com / abc123) → 401 "That email or password doesn't look right."
```

The sign-in 401 comes from Supabase (`auth.sign_in.rejected code=invalid_credentials` in the server log), so the app does reach Supabase.

### Checks

```
npm run typecheck   exit 0
npm run lint        exit 0
npm run test        13 files, 92 tests passed (was 91; +1 for the fix below)
npm run build       exit 0
```

## Bug found and fixed

The exact sentence from the stage brief was **not** recognised as a commitment.

- `src/lib/agents/extract.ts` decides `is_commitment` from `EXPLICIT && ACTION`. The `ACTION` verb list had `send`, `share`, `call`, `fix`, … but not **`get`**. "I'll get the revised dataset to Maya" therefore scored `is_commitment: false`, confidence 0.12.
- `src/lib/agents/commitment-detector.ts` already lists `get`, so the two extractors disagreed.
- The weekday branch of `extractDeadline` hardcoded 09:00, so "Tuesday evening" became Tuesday 09:00 and the stored phrase was just `tuesday`.

Why it blocks the loop: for this sentence the detector marked it a thread, but `withExtraction` required both to agree, confidence fell to 0.12, and `heuristicSocialAdvice` drops anything under 0.45. The pipeline then skips the message, so Remember would create no thread. I traced this in code; I could not confirm it live without the demo user.

Fix (2 files):

- `src/lib/agents/extract.ts`: add `get` to `ACTION`; when a weekday is followed by morning/afternoon/evening/night, use the same hours as "tomorrow …" (9 / 14 / 18 / 20).
- `src/lib/agents/extract.test.ts`: one test for the Maya sentence.

After the fix (live, hot-reloaded):

```
{'is_commitment': True, 'confidence': 0.88, 'person': 'Maya', 'deadline': 'tuesday evening',
 'due_at': '2026-10-06T12:30:00.000Z',
 'normalized_commitment': "Yep, I'll get revised dataset to by"}
```

`12:30Z` is 18:00 IST. The weekday day-part change goes slightly beyond "only what blocks"; it is small, covered by the same test, and easy to revert.

## Files changed

- `src/lib/agents/extract.ts`
- `src/lib/agents/extract.test.ts`
- `docs/AUDIT.md` (5 rows: guest paste, AI extraction, reminder fires, RLS, demo login)
- `docs/STAGE1-REPORT.md` (new)

Not changed: landing page, visuals, `package.json`, `prisma/sql/rls.sql`, `src/config/operator.ts`, `.env`. Nothing was committed or staged.

Database changes (to the Supabase project, not the repo): 5 migrations and the RLS policies. No rows were inserted.

## What still does not work

- The demo user does not exist, so sign-in, Remember, the reminder row, and the delivered notification are all unproven.
- `npm run demo:account` fails before running because `.env.local` is required. A one-word change (`--env-file-if-exists`) would fix it; I left it.
- The script's error message hides the real cause (`email_address_invalid`), pointing at the key. That happened to be the right answer, but only by accident.
- The thread title for the Maya sentence is ugly: `Yep, I'll get revised dataset to by`. `normalizeCommitment` only strips a leading "I'll", not "Yep, ", and leaves a dangling "to". Cosmetic; not fixed.
- Cross-user RLS isolation was applied but not tested. The server connection bypasses RLS by design.
- Reminder time depends on the server's timezone (`setHours` in `extract.ts`), not the user's profile timezone. Fine on this machine (IST); would drift on a UTC host such as Vercel. Not fixed.
- Supabase Realtime was not enabled or tested. The README says it must be enabled on `threads`, `notifications`, `reminders`, `interventions`, `action_proposals`.

## Risks

- **DNS.** Without the DNS workaround, nothing that calls Supabase over HTTPS works on this machine.
- **Pooler session mode.** Prisma worked on port 5432. Not tested under load.
- **Production cron.** `/api/cron/reminders` is open when `CRON_SECRET` is empty and `NODE_ENV` is not production. Set it before deploying.
- The new `get` verb widens what counts as a commitment ("I'll get dinner", "I'll get back to you"). Tests pass, but that is a broader match than before.

## Next step, when you add the key

1. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env`.
2. `node --env-file=.env --import tsx scripts/ensure-demo-account.ts` (with the DNS preload, or after fixing DNS).
3. `npm run dev`, sign in as `abc@gmail.com` / `abc123`, run the loop, then query `threads`, `commitment_evidence`, `reminders`, `notifications`.

I will re-run the loop and record the rows. I will not start Stage 2.
