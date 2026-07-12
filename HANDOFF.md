# Big Book Pacer — build handoff

Built against your real library: 27 tests, 162 sections, 2,930 questions, 4,367 crops.
Everything below has been tested against that actual data, not mock data.

**Status as of this handoff: all 49 answer-key gaps are closed. Zero nulls remain in the app.**
`library/answers.json` is fully patched — this zip is the current source of truth.

## What's live

**Core loop (verified end-to-end with real questions):**
- Landing → track (Verbal/Quant/CR) → test grid (27) → section select → timing picker → player → review
- Timer: countdown pill, show/hide toggle, hard lock + auto-submit at time-up (tested for real —
  waited out a live 1-minute clock and it locked and routed to review on its own)
- Question palette: answered/current/marked/unanswered states, click to jump
- A–E keyboard shortcuts, click-again-to-eliminate (strikethrough), QC gets A–D only + the
  "QUANTITATIVE COMPARISON" pill, "No calculator" banner on all quant sections
- Passage context splits left/right; graph/DI and directions contexts stack above the question
  (confirmed against a real Test 1 DI graph triplet)
- Mark for Review, per-question tutor notes with tags, silent per-question time logging
- Resume banner for an interrupted session; discard option
- Section retry, and a zoomable question view from the review screen

**Mistakes engine** — auto-populated from wrong/blank answers, filterable by test, section,
question type (SC/RC/QC/PS/CR), P+ range, DI-only, and note tags. Redrill launches an untimed
set of exactly those questions. Clear-on-correct is real: I answered a section wrong on purpose,
confirmed 14 open mistakes, redrilled, answered correctly, and the count dropped to 0.

**Custom set builder** — any mix of tests/section/type/P+ range/tags, sizes 12–50, 1 min/question,
optional "exclude already-attempted" toggle.

**Analytics** — accuracy by question type, score by section, easy-vs-hard (P+ buckets), time-per-
question for the most recent session, and a pacing trend line across recent timed sessions.

**Notes, export/import, 3-day reminder** — all in localStorage, JSON export/import (merge or
replace), a name prompt on first visit, and a reminder banner if it's been 3+ days since your last
export.

## A real bug I caught and fixed

While testing the Critical Reasoning sections (some are as short as 3 questions), I found the
"Finish Section" button was showing on *every* question, not just the last one — a copy-paste typo
in the visibility toggle. If it had shipped, finishing early would have silently dropped whatever
questions came after the one you were on from being answerable. Fixed and re-verified with a full
CR section, a full 18-question Verbal section, and the mistakes/redrill loop — all now record every
answer correctly.

## Answer key — closed out

All 49 gaps (141 raw nulls, minus the intentionally-dropped antonym slots, minus true duplicates)
are filled. 21 came from clean printed-key screenshots across tests 2, 4, 5, 9, 10, 11, 12, 13, 20,
22, 26. The remaining 28 were all on Test 27, whose printed key had a block of question numbers
struck through by hand before printing (not an ETS void mark, per Glory) — those were read via
high-resolution Tesseract OCR, two independent crops/passes per cell, only accepted where both
passes agreed. Letters are high-confidence; a couple of P+ percentages may be off by a digit
(cosmetic only, doesn't affect scoring).

If a student or you ever spot a wrong key going forward, use Tutor Tools (see below) — no need to
route through a fresh build.

## Next steps (queued, not yet built)

**1. Auto-tag RC/CR sub-types + passage length, with manual override.**
Plan: vision pass over each crop to assign a default tag (RC: inference/main idea/detail/
vocab-in-context/tone/structure; CR: weaken/strengthen/assumption/inference/paradox/evaluate/
bold-face/parallel), written to a `tags.json`. The existing manual note-tag system becomes the
override layer — correcting a tag through Notes wins over the auto-tag. Needs scoping for API
cost/time across ~2,930 questions before starting.

**2. Supabase-backed answer key overrides**, replacing/supplementing the current localStorage +
patch-file approach in Tutor Tools. Rough shape: a small `answer_overrides` table (test, sid, q,
answer, p_plus, updated_by, updated_at), Tutor Tools editor reads/writes it live instead of (or
alongside) localStorage — same pattern as ATH and Tutor Hub. Open question to settle before
building: should this replace local-first edits entirely, or sit alongside them (local for fast
solo tweaks, Supabase for anything meant to sync across devices/students)? PIN gate can stay as
friction, or get upgraded to real Supabase auth if tighter security is wanted.

**3. Real student testing** — pacing defaults, timer UX, and anything else that only surfaces
under actual timed pressure from someone who isn't me.

**4. Real Big Book cover art** — landing page currently uses an original illustration (a paper
stack + clock, see `hero_illustration.svg` if you want to look at it standalone). Swap in the real
scan whenever you send it.

## Tutor Tools — answer key editor, now with permanent GitHub sync

"Tutor Tools" in the header, PIN-gated (default **1234**, client-side friction only — change
`TUTOR_PIN` in `js/main.js` for a different one). Two layers:

**Local (instant):** edit any question's answer/P+, it applies to scoring in this browser
immediately — same as before.

**GitHub (permanent):** first visit shows a connect form. You'll need a fine-grained GitHub
Personal Access Token scoped to just this repo with Contents: Read and write (instructions are
inline in the app — `github.com/settings/personal-access-tokens/new`, pick this repo only, set
Contents to Read/write, set an expiration). Once connected, corrections you save locally show a
"pending push" badge; hitting "Push N pending corrections" bundles all of them into **one commit**
straight to `library/answers.json` in your repo. GitHub Pages rebuilds automatically — usually
live for every student within a minute, no redeploy from me, no file-passing.

Tested against a mocked GitHub API end-to-end: connect → edit → push → verified the "remote" file
actually received the correct value, verified a bad token fails cleanly with GitHub's real error
message instead of silently pretending to succeed, verified a 401 doesn't leave a broken
"connected" state behind.

Two honest tradeoffs, both minor for how you'll actually use this:
- **Not instant** — a push is a real git commit + Pages rebuild, so there's a delay of roughly
  30 seconds to a couple of minutes before it's live, not milliseconds like a database write.
- **Token lives in this browser's localStorage.** Scoped to Contents-only on one repo, so the
  blast radius if it ever leaked is "someone could commit to this one repo," not your account —
  but it's still worth setting a real expiration and rotating it occasionally rather than treating
  it as permanent.

Also added: `answers.json` and `master.json` now fetch with cache-busting (`?v=timestamp`,
`cache:'no-store'`), so a correction can't get stuck behind a stale cached copy in someone's
browser.

Why GitHub instead of Supabase: you're already at or near the 2-active-project cap on Supabase's
free tier (ATH + Tutor Hub + possibly the Verbal Mastery Trainer), so a new project there likely
means paying. This needed no new service, no new account, and no new cost — and as a bonus, every
correction is now a real, reviewable, revertible git commit instead of a database row.

## Is this data-loss-proof? Honest answer: not entirely.

**Protected:** the app code and the answer key. Once pushed to GitHub, both are versioned,
redundant, and recoverable — the GitHub-commit editor above makes answer-key fixes durable the
same way.

**Not protected:** every student's session history, notes, and progress. That still lives only in
that browser's localStorage — no server, no automatic backup. Clearing the cache, switching
devices, running low on storage, or using a private window loses it, with only the manual
"export your data" reminder as a safety net, and that only helps if someone actually clicks it.
For you using this solo, that's a low-stakes gap. If students start relying on this long-term, it's
the next durability problem worth solving — same GitHub-or-Supabase pattern could extend to
progress data, just a bigger scope than the answer key was.

## File structure (already laid out exactly for GitHub Pages)

```
index.html
styles.css
js/  (data.js, state.js, main.js, view_*.js — one file per view, per your ath-core.js pattern)
library/
  master.json
  answers.json
t01/ ... t27/   (crops, unchanged from your upload)
```

Push this whole folder to a repo, enable Pages on the root, done. No build step.
