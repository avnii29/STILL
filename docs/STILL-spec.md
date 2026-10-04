# STILL spec

Stage 0. Intent is from `docs/planning-chat.md` (her requests under `## Prompt:`, the design under `## Response:`). `README.md` and the code win only on what already exists. `AGENTS.md` is a Next.js note, not the product.

She rejected the name Threads (Instagram) and the advisor’s name NOMA. The name that stuck is **STILL**. Tagline: **the things that still matter.**

## Intended product and pitch

STILL is an agentic commitment-recovery system. People promise things inside ordinary conversation. Those promises vanish. STILL detects them, keeps the original sentence, follows the commitment through time, reminds only when it matters, notices when the context changes, and closes the thread when it is done.

Hackathon category she was told to claim: **personal productivity assistants**, with **responsible autonomous workflows** and **multi-agent collaboration** underneath. Pitch line from the 4 Oct response:

> STILL turns conversations into evidence-backed commitments, reasons over context and resolution, and proposes the smallest useful intervention when something starts slipping — while every consequential action stays behind human approval.

The line to present with: **it does not manage your tasks. It protects your promises.**

It is not a chatbot, todo list, calendar, CRM, dashboard, or an agent that controls the person. AI proposes. The person decides. Ambient capture is opt-in, never always-on listening. No relationship scores, no invented emotions, no fake memories.

The loop she defined on 26 Sep, and restated as the “done” test on 4 Oct:

say something → is this actually a commitment? → person confirms or corrects → store what / who / when / source / evidence → thread stays alive → reminder, context, or change → person acts, postpones, or lets go → STILL re-evaluates → resolved, and it stops nagging.

## The wow moment

One story, not a feature tour. From the 4 Oct build prompt, scene around line 27235, with the earlier twist kept:

1. She pastes: “Yep, I’ll get the revised dataset to Maya by Tuesday evening.”
2. STILL shows the commitment, Maya, Tuesday evening, confidence, and the exact quote. It does not invent a clock time for “evening.”
3. She tries to push it. STILL does not blindly snooze. It finds a same-day catch-up and proposes moving that event instead.
4. **It does not move anything.** Approve, edit, or reject. A red-team pass can block the proposal if the event is important.
5. The twist: later evidence moves the deadline. STILL backs off. “You don’t need to rush this anymore.”

Judges should also open **why**: decision, evidence used, confidence, risk. Not chain-of-thought.

## Agent roles she specified

One orchestration layer. Not a LangGraph demo. Roles from the response at line 27031:

| Role | Job |
| --- | --- |
| Router | Pick the workflow: capture, commitment, resolution, deadline, intervention, action, search |
| Commitment | Structured JSON. Explicit promise vs maybe vs not mine vs reminder vs already done |
| Context | Targeted retrieval only, each hit labeled with why |
| Evidence | Source, message, time, original span. No orphan memory |
| Deadline | Timezone-aware. `due_at`, precision, confidence. “Later” is not a time |
| Thread ledger | Append-only history. Detected through resolved, postponed, dismissed |
| Resolution | Done, cancelled, or deadline changed. Know when to stop |
| Intervention | Interrupt only if useful |
| Friction | 1st postpone is normal; 3rd offers a smaller step; never shame |
| Red team | Second pass before any external effect. Can block |
| Action gateway | Remind, snooze, resolve, then calendar / doc / draft. Never send a message |
| Human | The pause. Approve, edit, or reject |

## Essential, nice, and cut

**Essential** (her own “must work” and “done” list): guest paste with no database write; signed-in capture that calls a real extractor; evidence on every memory; Postgres persistence; thread timeline; confirm before a source memory; reminder that actually fires; resolution that can close or move a deadline; intervention plus red team plus approval; one honest external tool (calendar move if credentials exist, otherwise a visible blocked state); agent trace a judge can read; RLS; a replayable demo of the Maya story. Paste, type, and speak must work with every connector off.

**Nice, after that loop is undeniable:** Telegram as the live source she asked for on 4 Oct; voice transcripts; in-app search; people as names on threads; future-self grouping; PWA install; web push and email; Supabase realtime across tabs.

**Cut before the deadline:** landing-page or visual redesign (she liked the first screen, then the build prompt forbade more polish); WhatsApp, Instagram, Gmail, Slack, Zoom, and Google Docs as required demo paths; embeddings / pgvector; screenshot or uploaded-audio capture; a second model provider; auto-remember as the default; sending messages; relationship scores; sample data presented as her life; native push and SMTP.
