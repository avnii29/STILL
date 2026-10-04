# Stage 2 report: a model as the reader

Date: 2026-10-05 (IST). The provider was already in `.env` before this stage. No secret values are written here.

## Result

**The model half of the pass test did not run.** The configured chat endpoint never returned a response, so signed-in detect fell back to the heuristic and labelled that fallback.

**The key-removed half passed.** With `AI_PROVIDER=none`, the three lines classified as specified, and the trace recorded `heuristic`.

Guest `POST /api/extract` stayed heuristic and keyless.

## What was already configured

Checked names only, then the non-secret values:

| Name | Present |
| --- | --- |
| `AI_PROVIDER` | `openai` |
| `AI_MODEL` | `deepseek-ai/deepseek-v4.1-flash` |
| `AI_BASE_URL` | `https://integrate.api.nvidia.com/v1` |
| `OPENAI_API_KEY` | set (not printed) |
| `ANTHROPIC_API_KEY` | empty |

No second provider client was added. `AI_BASE_URL` is an optional base for the existing OpenAI-compatible client. Empty means `https://api.openai.com/v1`.

## What the code does

Signed-in `POST /api/detect` and Remember call `readCommitment` in `src/lib/agents/read-commitment.ts`.

- A Zod-valid model result is returned with `interpretedBy: "model:<provider>"` and trace provider `"<provider>:<model id>"` (for this setup that would be `model:openai` and `openai:deepseek-ai/deepseek-v4.1-flash`).
- The note is kept as the evidence. A person the model names who is not in the note, the context, or the person hint is dropped.
- If the model is not configured, `interpretedBy` and `provider` are `heuristic`.
- If the key is missing, the call times out (30s), or the JSON fails validation, the heuristic result is returned with `interpretedBy: "heuristic:fallback"` and `provider: "heuristic:fallback"`.
- Guest `POST /api/extract` still calls `extractCommitment` only.

`agent_runs.provider` is a new column, default `heuristic`. The EXTRACT row stores who decided. The other capture rows stay `heuristic`, because those steps do not call the model.

The OpenAI client posts to `${AI_BASE_URL}/chat/completions`. A 400 from JSON mode is retried once without `response_format`.

## Pass test

### Model configured

Health: `{"ok":true,"database":true,"auth":true,"ai":"openai",...}`

Signed-in detect of the Maya sentence, after a 30s wait:

```
interpretedBy: "heuristic:fallback"
provider: "heuristic:fallback"
is_commitment: true
confidence: 0.88
person: "Maya"
deadline: "tuesday evening"
due_at: "2026-10-06T12:30:00.000Z"
```

That body is the heuristic result, not a model result. The server log:

```
commitment.read.fallback  provider=openai  model=deepseek-ai/deepseek-v4.1-flash
error: The operation was aborted due to timeout
```

Direct calls to `POST /v1/chat/completions` for that model, on that host, with the key already in `.env`:

| Attempt | Result |
| --- | --- |
| 40s, 75s, 90s, 150s | no HTTP response, then timeout |
| `GET /v1/models` | 200 in about 5s; the model id is in the list (81 models) |
| other model ids on the same host | HTTP 404 or 410 within a few seconds |

The host answers. This model's completion call does not. The three-line model classification was not run, because each line would have waited out the same timeout and then shown the fallback. I did not change `AI_MODEL`.

### `AI_PROVIDER=none`

The dev server was restarted with `AI_PROVIDER=none` in the process environment. `.env` was not edited. Health reported `"ai":"none"`.

Signed-in `POST /api/detect`:

```
try      is_commitment false  confidence 0.22  person null   deadline null              interpretedBy heuristic  provider heuristic  uncertain false
yep      is_commitment true   confidence 0.74  person Maya   deadline tuesday evening   interpretedBy heuristic  provider heuristic  uncertain false
someday  is_commitment false  confidence 0.18  person null   deadline null              interpretedBy heuristic  provider heuristic  uncertain false
maya     is_commitment true   confidence 0.88  person Maya   deadline tuesday evening   interpretedBy heuristic  provider heuristic  uncertain false
```

`yep` was sent with context `I'll get the revised dataset to Maya`. Its detection was `isThread: true`, person Maya. `due_at` for both dated lines was `2026-10-06T12:30:00.000Z` (18:00 IST).

Remember of the Maya sentence:

```
200 {"conversationId":"cmuu7fiv00001wucmlhofeneb","threadIds":["cmuu7fjrb0005wucmcdu5ijno"],"interpretedBy":"heuristic"}
```

Thread `cmuu7fjrb0005wucmcdu5ijno`: `interpreted_by = heuristic`, confidence 0.88, status `NEEDS_REVIEW`.

`agent_runs` for that thread:

| kind | ok | confidence | provider |
| --- | --- | --- | --- |
| EXTRACT | true | 0.88 | heuristic |
| INTERVENTION | true | 0.4 | heuristic |
| Router | true | 0.8 | heuristic |
| Commitment | true | 0.9 | heuristic |
| Context | true | 0.7 | heuristic |
| Evidence | true | 0.9 | heuristic |
| Deadline | true | 0.64 | heuristic |
| Intervention | true | 0.4 | heuristic |
| Red team | true | 0.8 | heuristic |

### Guest

With the model still configured, before the `AI_PROVIDER=none` restart:

```
POST /api/extract  Maya sentence
92ms
is_commitment true, confidence 0.88, person Maya, deadline tuesday evening
persisted false
```

## Checks

```
typecheck   exit 0
lint        exit 0
test        14 files, 102 tests passed
build       exit 0
```

## Database

`npx prisma migrate deploy` failed with `P1001` (cannot reach the pooler) even though a `pg` connection to the same `DATABASE_URL` succeeded. The migration SQL was applied with that `pg` connection, and a row was inserted into `_prisma_migrations` for `20261005120000_agent_run_provider`. Checksum is the sha256 of the migration file, same algorithm as the five migrations already recorded. Column `agent_runs.provider` is `text not null default 'heuristic'`.

## Files changed in this stage

- `.env.example` (`AI_BASE_URL`)
- `src/lib/env.ts`
- `src/lib/agents/provider.ts`
- `src/lib/agents/providers/openai.ts`
- `src/lib/agents/providers/anthropic.ts` (30s timeout only)
- `src/lib/agents/read-commitment.ts` (new)
- `src/lib/agents/read-commitment.test.ts` (new)
- `src/lib/agents/extract.ts`
- `src/lib/agents/extract.test.ts`
- `src/lib/agents/context-agent.ts`
- `src/lib/agents/pipeline.ts`
- `src/lib/agents/types.ts`
- `src/app/api/detect/route.ts`
- `src/lib/threads/ingest.ts`
- `src/lib/validation/schemas.ts` (optional `context` on the signed-in payload)
- `src/components/evidence-drawer.tsx` (a `heuristic:fallback` reading keeps the existing wording-patterns sentence)
- `prisma/schema.prisma`
- `prisma/migrations/20261005120000_agent_run_provider/migration.sql`
- generated Prisma client (`AgentRun` and the three internal files that embed the schema)
- `docs/AUDIT.md`
- `docs/STAGE2-REPORT.md`

Still uncommitted from Stage 1b, not part of this stage's behavior: `package.json`, `scripts/ensure-demo-account.ts`, `docs/STAGE1-REPORT.md`. Nothing was staged or committed. `.env` was not edited.

## AUDIT rows changed

- Guest paste: still heuristic when a key is set (92ms, `persisted: false`).
- AI extraction: model path added; live call timed out into `heuristic:fallback`; `AI_PROVIDER=none` classifications recorded. Not marked REAL for the model.
- Agent trace: `provider` column, live value `heuristic` on the new Maya thread. A model provider string was not seen.

## Heuristic changes, because the key-removed lines have to classify

- `I'll try` is not a commitment (confidence 0.22). This narrows the old matcher, which treated "I'll try to get to it" as a promise.
- A short yes (`yep`, `yes`, `sure`, `ok`) plus a deadline is a commitment when the context already names the person. "yep, Tuesday evening" alone, with no context, is still not a commitment.

## Risks

- The model you set does not complete. Until `AI_MODEL` is one this host will answer, signed-in capture will wait 30s and then store a heuristic reading labelled `heuristic:fallback`.
- A commitment also calls the existing context and social model requests. That is two more calls after the extractor, on top of the 30s budget.
- `prisma migrate deploy` could not reach the pooler from this machine. A future migration has the same problem; `pg` could.
- The new Maya thread (`cmuu7fjrb0005wucmcdu5ijno`) is test data on `abc@gmail.com`. The title is still `Yep, I'll get revised dataset to by`.
- Deadline hours still use the server timezone. The cron route is still open when `CRON_SECRET` is empty outside production. Neither was changed.

## Unblock

Set `AI_MODEL` (and `AI_BASE_URL` if the host changes) to an OpenAI-compatible model that returns a chat completion, then say so. I will rerun the Maya sentence and the three lines through that model without printing the key. I will not start the next stage until you say so.
