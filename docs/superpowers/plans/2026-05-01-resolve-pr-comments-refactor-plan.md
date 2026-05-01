# resolve-pr-comments Skill Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the resolve-pr-comments skill from 7 markdown files (787 lines) into 5 markdown files (~459 lines), enforce closed-schema cards with verbatim templates and explicit anti-field lists, and eliminate field-schema drift observed in Codex output.

**Architecture:** Single atomic refactor. Three new files (`presenting.md`, `analyzing.md`, `publishing.md`) absorb content from five old files (`interaction.md`, `deep-analysis.md`, `data-gather.md`, `data-contract.md`, `implementation.md`). `SKILL.md` is edited (cross-file refs + new prohibitions + trimmed Common Mistakes). `scripts/fetch-comments.py` gains a docstring with the JSON output shape (replacing `data-contract.md`). `resolve-threads.md` is unchanged. All changes ship in one commit; no intermediate commits.

**Tech Stack:** Markdown skill files, Python (fetch script docstring), git, `gh` CLI for end-to-end skill verification.

**Reference:** Design spec at `docs/superpowers/specs/2026-05-01-resolve-pr-comments-refactor-design.md`. Read sections 5-9 before executing — they contain the literal text for new sections that this plan references.

---

## File Structure

**Working directory:** `~/Github/my-claude-codex/skills/resolve-pr-comments/`

| Action | Path | Why |
|---|---|---|
| CREATE | `presenting.md` | Single home for card schema + Language Rules + Commands; closes the 4-place card-definition drift |
| CREATE | `analyzing.md` | Single home for signal matrix + classification + severity + dedup + recommendations; merges `data-gather.md` + analysis half of `deep-analysis.md` |
| CREATE | `publishing.md` | Single home for fix plan + lanes + stop conditions + thread_map; renames + compresses `implementation.md` |
| MODIFY | `SKILL.md` | Cross-file ref updates (5 places); new Step 2 preview-table prohibition; Common Mistakes trim; Glossary tightening |
| MODIFY | `scripts/fetch-comments.py` | New top-of-file docstring containing the JSON output shape |
| DELETE | `data-gather.md` | Content split between `analyzing.md` (most) and `presenting.md` (none of it; it's all analysis) |
| DELETE | `data-contract.md` | JSON shape moves to `fetch-comments.py` docstring; classification schema duplicated in `data-gather.md` is dropped |
| DELETE | `deep-analysis.md` | Presentation Template + Language Rules → `presenting.md`; rest → `analyzing.md` |
| DELETE | `interaction.md` | Renamed conceptually → `presenting.md`; absorbs Presentation Template + Language Rules from `deep-analysis.md` |
| DELETE | `implementation.md` | Renamed conceptually → `publishing.md`; compressed Stop Conditions; thread_map relocated in |
| UNCHANGED | `resolve-threads.md` | Pure API ref; design spec section 4 explains why this stays separate |

---

### Task 1: Create `presenting.md`

**Files:**
- Create: `~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md`
- Source (read-only): `~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md`, `~/Github/my-claude-codex/skills/resolve-pr-comments/interaction.md`

**Target size:** ~110 lines.

- [ ] **Step 1.1: Read source content for Language Rules**

Run:
```bash
sed -n '96,138p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md
```
Expected: ~43 lines starting with `## Language Rules` and including subsections Style / Field Duties / Avoid / Before / After.

Save the output to use in Step 1.3.

- [ ] **Step 1.2: Read source content for Commands table**

Run:
```bash
sed -n '84,96p' ~/Github/my-claude-codex/skills/resolve-pr-comments/interaction.md
```
Expected: ~13 lines containing the `## Commands` heading, the markdown table, and the trailing "Users can combine commands" sentence.

Save the output to use in Step 1.6.

- [ ] **Step 1.3: Write `presenting.md` skeleton + Language Rules**

Use the Write tool to create `~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md` with this initial content (replace `<PASTE LANGUAGE RULES FROM STEP 1.1>` with the literal text captured in Step 1.1):

```markdown
# Review Interaction

Use clear, direct language. Keep sentences short. Lead with the decision-relevant point.

<PASTE LANGUAGE RULES FROM STEP 1.1>
```

Verification:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
grep -c '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
```
Expected: ~46 lines, 1 `## ` heading (Language Rules).

- [ ] **Step 1.4: Append `## Critical/Major Cards` section**

Use the Edit tool to append the Critical/Major Cards section. Add this exact content at the end of the file (use Edit by adding to the end after the last line of Step 1.3 content):

~~~~markdown
## Critical/Major Cards

Render each item verbatim against this template. Do not add, remove, or rename fields. Specifically, do not add Anchor, Author, Issue, or File rows — the header carries reviewer (`[coderabbit]`) and severity (`[Major]`); `Path:` carries file:line.

When multiple reviewers raise the same deduplicated issue, list all of them inside the bracket, alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). Do not pick one reviewer and hide the rest. Synthesize all reviewer angles in `Wants`.

```text
── 1/N ── [Major] ── [coderabbit] ──────────
Path: path/to/file.go:42

Problem: <one sentence — what can go wrong if the bot is right>
Wants: <one sentence — what the reviewer asks the author to change>

Code evidence: <one of:
  - "<file:line>: `<quoted code>`" (positive inline claim)
  - "<grep/diff/test result>" (negative or cross-file claim)
  - "no concrete evidence available; bot's claim is about
     <absence | cross-file | ownership | process | PR-level>">

Confidence: High | Medium | Low
Recommendation: Fix | Defer | Reply only | Needs your decision
Reason: <one sentence; must reference Code evidence concretely>

<details><summary>Original comment</summary>...</details>
```

Present exactly one item, ask for a `Fix` / `Defer` / `Reply only` decision, and stop. Never batch. `Needs your decision` is a recommendation signal, not a recordable decision — the user must convert it into one of the three terminal actions before the next item.

For PR-level comments, include a `Signals:` block before `Problem` listing `acknowledged_by`, `author_followups`, and `pr_updated_since_comment`.

For grouped comments (multiple reviewers raising the same issue), synthesize all reviewer angles in `Wants`. Fill `Code evidence` once for the group. Do not pick one comment and hide the rest.
~~~~

Verification:
```bash
grep -c '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
grep -F 'Anchor, Author, Issue, or File' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
```
Expected: 2 `## ` headings; 1 hit on the anti-field name list.

- [ ] **Step 1.5: Append `## Medium/Low Pages` section**

Use Edit to append:

~~~~markdown
## Medium/Low Pages

Use compact cards by default, 5 items per page with global numbering. Render each item verbatim against this template. Do not add, remove, or rename fields. Specifically, do not add Anchor, Author, Issue, or File rows — the header line carries reviewer and severity; the `file:line` is part of the header.

When multiple reviewers raise the same deduplicated issue, list all of them inside the bracket, alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). Do not pick one reviewer and hide the rest.

Medium/Low cards still require `Code evidence` for any `Fix` recommendation. Promote via `review N` to trigger the full Critical/Major presentation flow and one-at-a-time decision.

```text
── Medium/Low (13 comments) - Page 1/3 ──────────

#1 [Medium] [coderabbit] path/to/file.go:88 - Fix
Problem: handler ignores request cancellation.
Wants: stop the worker when the request context is cancelled.
Code evidence: file.go:88 — `select { case w := <-work: ... case r := <-results: ... }` has no `ctx.Done()` branch.
Recommendation: Fix.
Risk if skipped: timed-out requests can leave work running.

#2 [Low] [coderabbit] path/to/model.go:33 - Reply only
Problem: reviewer wants an unused option removed.
Wants: delete the option from this handler.
Code evidence: model.go:33 — option declared, never referenced in this file. Adjacent handlers keep the same unused option for interface symmetry (peer files: model_a.go:41, model_b.go:55).
Recommendation: Reply only.
Risk if skipped: low; preserves repo convention.

#4 [Medium] [coderabbit] path/to/migration.sql:None - Review
Problem: reviewer asks whether this migration is safe under concurrent writes.
Wants: confirmation or a plan.
Code evidence: no concrete evidence available; bot's claim is about cross-system process (production traffic + lock timing).
Recommendation: Review.
Risk if skipped: unknown; cannot verify within this repo.

Defaults:
Fix: #1
Reply only: #2, #3 (concrete code evidence shows mismatch)
Review: #4, #5 (no concrete evidence; NOT accepted by `ok all`)

Reply with: ok, ok all, fix 2, defer 3, reply 4, review 5, why 2
```

The agent picks the default `Recommendation` per the rule in `analyzing.md`:

- `Fix` — Code evidence has a concrete `file:line` + quote (or grep/diff/test artifact) that confirms a real bug.
- `Reply only` — Code evidence shows the bot's specific claim does not match current code (stale inline, line moved, already fixed).
- `Review` — Code evidence is `"no concrete evidence available; bot's claim is about <category>"`. The item cannot be confirmed or denied within this repo. **`Review`-default items are NOT accepted by `ok all`** — the user must explicitly run `review N` to promote into Critical/Major flow, or directly type `fix N` / `defer N` / `reply N`.

This guards against silent skip: medium/low items the agent could not actually verify cannot be batch-resolved by a hurried `ok all`.
~~~~

Verification:
```bash
grep -c '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
grep -F 'NOT accepted by `ok all`' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
```
Expected: 3 `## ` headings; 1 hit on the anti-silent-skip rule.

- [ ] **Step 1.6: Append `## Commands` section**

Use Edit to append the content captured in Step 1.2. The content begins with `## Commands` and includes the markdown table plus the closing sentence "Users can combine commands, e.g. `fix 1, defer 2, review 4`."

Verification:
```bash
grep -c '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
grep -F '| `ok` or `done` |' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
```
Expected: 4 `## ` headings (Language Rules, Critical/Major Cards, Medium/Low Pages, Commands); 1 hit on the commands table row.

- [ ] **Step 1.7: Final file verification**

Run:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
grep -E '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md
```
Expected: ~110 lines (give or take 10); 4 sections in this exact order:
```
## Language Rules
## Critical/Major Cards
## Medium/Low Pages
## Commands
```

Do NOT commit. Move to Task 2.

---

### Task 2: Create `analyzing.md`

**Files:**
- Create: `~/Github/my-claude-codex/skills/resolve-pr-comments/analyzing.md`
- Source (read-only): `~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md`, `~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md`

**Target size:** ~115 lines.

- [ ] **Step 2.1: Read source content for Required Inputs**

Run:
```bash
sed -n '5,17p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md
```
Expected: ~13 lines starting with `## Required Inputs` and listing the 4 input categories.

Also run (for the PR-level signals subblock to merge in):
```bash
sed -n '68,76p' ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md
```
Expected: ~9 lines describing `acknowledged_by`, `author_followups`, `pr_updated_since_comment`.

- [ ] **Step 2.2: Read source content for Reviewer Signal Matrix**

Run:
```bash
sed -n '43,54p' ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md
```
Expected: ~12 lines containing `## Reviewer Signal Matrix` heading + 6-row table + the "Signal quality is not correctness" trailing line.

NOTE: There is a duplicate signal matrix in `deep-analysis.md:19-30` — DO NOT use that one. Always use `data-gather.md` as the single source of truth.

- [ ] **Step 2.3: Read source content for Classification Rules**

Run:
```bash
sed -n '56,66p' ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md
```
Expected: ~11 lines starting with `## Classification Rules` containing the 7-rule numbered list and the "When in doubt, include" trailing line.

- [ ] **Step 2.4: Read source content for Severity rules**

Run:
```bash
sed -n '78,91p' ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md
sed -n '46,55p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md
```
First range: triggers/anti-triggers table (initial classification).
Second range: re-evaluation rule + severity preservation rule.

- [ ] **Step 2.5: Read source content for Deduplication, Analysis Taxonomy, The One Rule, Recommendations**

Run:
```bash
sed -n '93,102p' ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md   # Deduplication (4-bullet conditions + warning)
sed -n '32,44p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md  # Analysis Taxonomy (table)
sed -n '84,94p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md  # The One Rule (Fix requires evidence)
sed -n '140,149p' ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md # Recommendations (4-row table)
```

- [ ] **Step 2.6: Write `analyzing.md` with all sections**

Use the Write tool to create `~/Github/my-claude-codex/skills/resolve-pr-comments/analyzing.md` with the following structure. Replace `<PASTE FROM STEP X.Y>` markers with the literal text captured in the corresponding read steps.

```markdown
# Analyzing Review Comments

Single source for how the agent reads PR data, classifies it, decides severity, deduplicates, and recommends an action. Read this in conjunction with `presenting.md` (which owns rendering) and `publishing.md` (which owns commit/push/reply).

<PASTE FROM STEP 2.1: Required Inputs heading and 4 input categories>

For PR-level comments and review bodies, also gather PR-level signals to attach to the actionable item:

- `acknowledged_by`: positive reactions from the original reviewer or PR author.
- `author_followups`: later PR-author comments that mention the reviewer or quote the original.
- `pr_updated_since_comment`: whether PR `updated_at` is later than the comment timestamp.

Never auto-skip from these signals alone. Show them to the user.

<PASTE FROM STEP 2.2: Reviewer Signal Matrix heading + 6-row table + trailing rule>

<PASTE FROM STEP 2.3: Classification Rules heading + 7-rule numbered list + "When in doubt, include">

`nitpick_triage[]` items need only `ids`, `reviewer`, `location`, `summary`, and `original` fields. They are ignored, not processed; do not include them in `thread_map[]`; do not reply to or resolve their threads.

## Severity

Use concrete triggers, then verify against code.

<PASTE FROM STEP 2.4: data-gather.md:78-91 triggers/anti-triggers table — start the paste at the markdown table itself, NOT the `## Severity Rules` heading (which is replaced by the heading above)>

After reading code, upgrade or downgrade severity per these definitions:

- Critical: security, data loss, normal-input panic/crash, state-corrupting race.
- Major: real correctness bug, missing error handling, API contract break, deploy/migration risk, resource leak.
- Medium: bounded edge case, missing test for changed behavior, maintenance readability concern.
- Low: naming, formatting, comment wording, optional simplification.

If a Critical/Major item downgrades below Major during deep analysis, still present it in the current Critical/Major flow. Show the downgraded severity in the card and ask for the user decision before moving on. Do not silently move it to Medium/Low after Critical/Major review has started.

A Critical/Major item with a `Reply only`, `Defer`, `Needs your decision`, or downgraded-severity recommendation must remain in `critical_major[]`; the recommendation does not move it to `reply_only[]`, `deferred[]`, or `medium_low[]`.

<PASTE FROM STEP 2.5 first range: Deduplication heading + 4 conditions + warning>

When dedup merges multiple reviewers into one item, render the header in `presenting.md` with all reviewers alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). See `presenting.md` for the full header rule.

<PASTE FROM STEP 2.5 second range: Analysis Taxonomy heading + table>

<PASTE FROM STEP 2.5 third range: The One Rule heading + body>

<PASTE FROM STEP 2.5 fourth range: Recommendations heading + table>

`Fix` requires concrete code evidence. If you have not located that evidence, do not pick `Fix` — pick `Defer`, `Reply only`, or `Needs your decision` based on the case. Echoing reviewer text without verifying current code is the failure mode this skill exists to prevent.
```

Verification:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/analyzing.md
grep -E '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/analyzing.md
```
Expected: ~115 lines (give or take 15); these 8 sections in order:
```
## Required Inputs
## Reviewer Signal Matrix
## Classification Rules
## Severity
## Deduplication
## Analysis Taxonomy
## The One Rule
## Recommendations
```

- [ ] **Step 2.7: Confirm no Output Schema section was carried over**

Run:
```bash
grep -i 'output schema\|`outdated\[\]`\|`copilot_triage\[\]`\|`thread_map\[\]`' ~/Github/my-claude-codex/skills/resolve-pr-comments/analyzing.md
```
Expected: 0 hits. If any hits appear, those are leftover from the old `Output Schema` section in `data-gather.md:104-142` — the design (spec section 6) explicitly removes it. Edit out any leakage.

The 8 buckets are still NAMED in the Classification Rules section (rules 1-7 reference `outdated[]`, `nitpick_triage[]`, etc.) — that's expected and is the only place they appear in `analyzing.md`. The dedicated catalog list is gone.

Do NOT commit. Move to Task 3.

---

### Task 3: Create `publishing.md`

**Files:**
- Create: `~/Github/my-claude-codex/skills/resolve-pr-comments/publishing.md`
- Source (read-only): `~/Github/my-claude-codex/skills/resolve-pr-comments/implementation.md`

**Target size:** ~70 lines.

- [ ] **Step 3.1: Read source content for Fix Plan, Implementation Order, Preview**

Run:
```bash
sed -n '1,41p' ~/Github/my-claude-codex/skills/resolve-pr-comments/implementation.md
```
Expected: file header + `## Fix Plan` (with template) + `## Implementation Order` + `## Preview and Publish` heading + the 5-bullet preview list.

NOTE: The current `## Preview and Publish` heading wraps both the preview list (lines 32-41) and the publish lanes (lines 43-72). In the new file, split: keep `## Preview` for just the preview list, then start a separate `## Publish Lanes` section.

- [ ] **Step 3.2: Read source content for Publish Lanes**

Run:
```bash
sed -n '43,72p' ~/Github/my-claude-codex/skills/resolve-pr-comments/implementation.md
```
Expected: `### Publish lanes` heading + `#### Code-fix lane` (numbered 7-step procedure) + `#### No-code lane`.

NOTE: In the new file, change `### Publish lanes` to `## Publish Lanes` (one less `#`) and change `#### Code-fix lane` / `#### No-code lane` to `### Code-fix lane` / `### No-code lane`.

- [ ] **Step 3.3: Write `publishing.md` with all sections**

Use the Write tool to create `~/Github/my-claude-codex/skills/resolve-pr-comments/publishing.md`:

```markdown
# Implementation and Publish

Single source for how the agent moves from "user has decided every actionable comment" to "code is committed, replies are posted, and threads are resolved on GitHub". Read this in conjunction with `resolve-threads.md` (the `gh` API reference for reply/resolve mutations).

<PASTE FROM STEP 3.1: Fix Plan section verbatim — heading + opening sentence + the fenced-block preview template>

<PASTE FROM STEP 3.1: Implementation Order section verbatim — heading + 4 numbered steps + verification paragraph + "If verification fails" paragraph>

## Preview

Before publishing, show:

- `git diff --stat`
- focused diff summaries for changed files
- verification commands and results
- replies that will be posted
- threads/comments that will be resolved
- deferred follow-up drafts, if any

## Thread Map

`thread_map[]` tracks inline items that need replies or resolution. Each entry contains:

- `item_id`: the actionable item this thread belongs to.
- `thread_ids`: every review thread ID represented by the item or its deduplicated group.
- `comment_ids`: the comment IDs inside those threads.
- `category`: `Fixed` / `Deferred` / `Reply only` / `Outdated` / `Auto-skipped`.
- `reply_intent`: short text of the planned reply, populated after user decisions are recorded.

Step 6 reads `thread_map[]` to know which threads to reply to and which to resolve. Resolution uses `thread_ids` directly; do not resolve inline comments by matching comment IDs.

<PASTE FROM STEP 3.2: Publish Lanes section — promote `### Publish lanes` to `## Publish Lanes`; promote `#### Code-fix lane` / `#### No-code lane` to `### Code-fix lane` / `### No-code lane`>

## Stop Conditions

Stop before any GitHub write (commit, push, reply, resolve) if any of: the local diff includes work outside the recorded review-comment decisions; a processed comment is missing a recorded decision (`Fix` / `Defer` / `Reply only`); the fix commit is not yet visible on PR head; verification failed and the user did not explicitly accept the limitation; a planned reply has gone stale after re-fetching PR state.

Examples:

- Diff has unrelated cleanup → stop, ask before commit.
- Re-fetch shows the target thread was edited since Step 1 → stop, ask before reply.
- A reply would claim "Follow-up filed in <issue>" but the issue was never created → stop.

If there are no stop conditions, print a short status and proceed:

```text
Publish authorized and no blockers found. Posting replies and resolving processed threads now.
```

When asking, include the reason:

> A publish blocker appeared: <reason>. Post replies and resolve processed threads anyway?

Always read `resolve-threads.md` before GitHub writes. Post replies before resolving threads. Resolve only threads processed in this run.
```

- [ ] **Step 3.4: Final file verification**

Run:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/publishing.md
grep -E '^## ' ~/Github/my-claude-codex/skills/resolve-pr-comments/publishing.md
```
Expected: ~70 lines (give or take 10); these 6 sections in order:
```
## Fix Plan
## Implementation Order
## Preview
## Thread Map
## Publish Lanes
## Stop Conditions
```

Confirm the dropped blockers are gone:
```bash
grep -i 'reply-only.*controversial\|API writes partially fail' ~/Github/my-claude-codex/skills/resolve-pr-comments/publishing.md
```
Expected: 0 hits.

Do NOT commit. Move to Task 4.

---

### Task 4: Update `SKILL.md`

**Files:**
- Modify: `~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md`

This task makes 4 categories of edits. Apply each as a separate Edit. Do them in order — later edits assume earlier ones have landed.

- [ ] **Step 4.1: Update Step 1 cross-file ref**

Use Edit:

```
old_string: Read `data-gather.md` and `data-contract.md`, then classify the raw JSON into:
new_string: Read `analyzing.md`, then classify the raw JSON into:
```

Verification:
```bash
grep -n 'data-gather\|data-contract' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 0 hits in SKILL.md after this edit.

- [ ] **Step 4.2: Update Step 3 cross-file ref**

Use Edit:

```
old_string: Read `deep-analysis.md` and `interaction.md`. Present exactly one deduplicated Critical/Major item at a time using the detailed card and choices from `interaction.md`.
new_string: Read `analyzing.md` and `presenting.md`. Present exactly one deduplicated Critical/Major item at a time using the detailed card and choices from `presenting.md`.
```

Also update the line in Step 3 that says `per `deep-analysis.md`:`. Use Edit:

```
old_string: Critical/Major items must go through deep analysis per `deep-analysis.md`:
new_string: Critical/Major items must go through deep analysis per `analyzing.md`:
```

Verification:
```bash
grep -n 'deep-analysis' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 0 hits.

- [ ] **Step 4.3: Update Step 4 cross-file ref**

Use Edit:

```
old_string: ## Step 4 - Medium/Low Review

Read `interaction.md`. Use compact cards by default, 5 items per page with global numbering. Full deep analysis is available through `review N`; promoted items use Step 3 choices.
new_string: ## Step 4 - Medium/Low Review

Read `presenting.md`. Use compact cards by default, 5 items per page with global numbering. Full deep analysis is available through `review N`; promoted items use Step 3 choices.
```

Verification:
```bash
grep -n 'Read `interaction\.md`' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 0 hits.

- [ ] **Step 4.4: Update Step 5 cross-file ref**

Use Edit:

```
old_string: Read `implementation.md`. Show the fix plan before editing, apply queued fixes by file or behavior area, and run targeted verification when practical.
new_string: Read `publishing.md`. Show the fix plan before editing, apply queued fixes by file or behavior area, and run targeted verification when practical.
```

- [ ] **Step 4.5: Update Step 6 cross-file ref**

Use Edit:

```
old_string: Read `implementation.md` and `resolve-threads.md`. Follow the publish lanes there:
new_string: Read `publishing.md` and `resolve-threads.md`. Follow the publish lanes there:
```

Verification (after all 5 cross-file ref edits):
```bash
grep -nE 'data-gather|data-contract|deep-analysis|interaction\.md|implementation\.md' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 0 hits.

- [ ] **Step 4.6: Add Step 2 preview-table prohibition**

Use Edit to inject one paragraph at the end of the existing Step 2 section. Find the line "After the count summary, immediately proceed to Step 3 if there are Critical/Major items." (currently SKILL.md:88 in HEAD) and add the prohibition before it:

```
old_string: For outdated and Copilot auto-triage, show one-line summaries. For nitpick auto-triage, show the count only. Do not spend user attention on full templates for already-triaged noise.

After the count summary, immediately proceed to Step 3
new_string: For outdated and Copilot auto-triage, show one-line summaries. For nitpick auto-triage, show the count only. Do not spend user attention on full templates for already-triaged noise.

Do not render a per-thread preview table or per-item one-liners for any actionable bucket (no "Fetched N review threads" table with bot / file:line / severity / summary columns; no per-thread one-liners for Critical/Major or Medium/Low). Per-item presentation lives in Step 3 / Step 4 with the full required fields.

After the count summary, immediately proceed to Step 3
```

Verification:
```bash
grep -F 'per-thread preview table' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 1 hit.

- [ ] **Step 4.7: Trim Common Mistakes from 5 items to 3**

The current Common Mistakes section (SKILL.md:114-120) has 5 bullet points. Replace the entire section with the 3-item cheat sheet from spec section 8.

Use Edit:

```
old_string: ## Common Mistakes

- Before presenting each Critical/Major comment: include Code evidence, Confidence, Recommendation, Reason; do not echo reviewer text as analysis. `Fix` requires concrete `Code evidence`; without it, pick `Defer`/`Reply only`/`Needs your decision` based on the case.
- Before presenting each Medium/Low comment: include Code evidence (file:line + quote, grep/diff/test artifact, or explicit `"no concrete evidence available"` note); do not paraphrase reviewer text as evidence.
- For Critical/Major items: never summarize the whole review into one decision request; show one deduplicated item, ask for that item only, and stop.
- Before fixing: every actionable comment must have a recorded decision or an explicitly accepted Medium/Low default; do not merge comments with different requested actions.
- Before publishing: show diff preview and verification results; post replies before resolving threads; do not run another CodeRabbit review or ask for another publish confirmation inside this skill; never claim a deferred follow-up exists unless it was created.
new_string: ## Common Mistakes

1. `Fix` requires concrete `Code evidence` (file:line + quote, grep/diff/test artifact). Without it, pick `Defer` / `Reply only` / `Needs your decision` based on the case.
2. Critical/Major: present one deduplicated item, ask for one decision, stop. Never batch.
3. Render cards verbatim against the template in `presenting.md`. Do not add Anchor / Author / Issue / File rows or any other field beyond the template.
```

Verification:
```bash
grep -c '^[0-9]\.' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: at least 3 (the new numbered cheat sheet items).

- [ ] **Step 4.8: Confirm SKILL.md final state**

Run:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
grep -E '^## Step' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: ~80 lines (give or take 10); 6 step headings (Step 1 through Step 6).

Glossary tightening: spec section 8 says "保留全部 9 项；收紧措辞；不删除任何 entry". Read SKILL.md:29-39 and check that all 9 glossary entries are still present (Inline comment, PR-level comment, Review body, Actionable, Recommendation, Decision, Defer, Reply only, Needs your decision). If any wording duplicates content now in `analyzing.md` or `presenting.md`, tighten to 1 line per entry; do not remove entries. This is a low-stakes pass — if all 9 are already concise, leave them.

Do NOT commit. Move to Task 5.

---

### Task 5: Update `fetch-comments.py` docstring

**Files:**
- Modify: `~/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py`

- [ ] **Step 5.1: Read current script header**

Run:
```bash
head -30 ~/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py
```
Note whether the file currently has a docstring. If yes, the new docstring REPLACES it. If no, the new docstring is INSERTED at the top (after the shebang line, if any).

- [ ] **Step 5.2: Add or replace top-of-file docstring**

The new docstring (paste at the top of the file, after any shebang line, before any imports):

```python
"""fetch-comments.py — deterministic GitHub PR review data fetch.

Fetches PR metadata, review threads, PR-level comments, and review
submissions through paginated GraphQL queries in parallel. Used by
the resolve-pr-comments skill as the data source for analysis.

Output JSON shape:
{
  "schema_version": 1,
  "source": "resolve-pr-comments/scripts/fetch-comments.py",
  "pull_request": {
    "owner", "repo", "number", "url", "title", "state",
    "author", "base_ref", "head_sha", "updated_at"
  },
  "conversation_comments": [...],   # PR-level comments
  "reviews": [...],                  # review submissions
  "review_threads": [...]            # inline review threads
}

PR-level comments containing `<!-- resolve-pr-comments:reply -->`
are prior skill replies; the agent must drop them before
classification. Only unresolved threads are actionable by default.

Run with --repo OWNER/REPO --pr 123 or --url <pr-url> for explicit PRs.
"""
```

Verification:
```bash
python3 -c "import ast; ast.parse(open('$HOME/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py').read())"
echo "exit: $?"
```
Expected: `exit: 0` (script parses).

```bash
grep -F 'Output JSON shape:' ~/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py
```
Expected: 1 hit.

```bash
python3 -c "import importlib.util; spec = importlib.util.spec_from_file_location('f', '$HOME/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); print(repr(m.__doc__)[:80])"
```
Expected: prints `'fetch-comments.py — deterministic GitHub PR review data fetch.\n\n…'` or similar — confirms `__doc__` is the new docstring.

- [ ] **Step 5.3: Confirm no orphan reference to `data-contract.md` remains**

Run:
```bash
grep -nF 'data-contract' ~/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py
```
Expected: 0 hits.

Do NOT commit. Move to Task 6.

---

### Task 6: Delete the 5 old files

**Files:**
- Delete: `~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md`
- Delete: `~/Github/my-claude-codex/skills/resolve-pr-comments/data-contract.md`
- Delete: `~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md`
- Delete: `~/Github/my-claude-codex/skills/resolve-pr-comments/interaction.md`
- Delete: `~/Github/my-claude-codex/skills/resolve-pr-comments/implementation.md`

- [ ] **Step 6.1: Confirm new files exist before deleting old**

Run:
```bash
ls ~/Github/my-claude-codex/skills/resolve-pr-comments/{presenting,analyzing,publishing}.md
```
Expected: 3 files listed, no errors.

If any file is missing, STOP and revisit Tasks 1-3. Do not delete old files until all 3 new files exist.

- [ ] **Step 6.2: Delete the 5 old markdown files**

Run:
```bash
rm ~/Github/my-claude-codex/skills/resolve-pr-comments/data-gather.md
rm ~/Github/my-claude-codex/skills/resolve-pr-comments/data-contract.md
rm ~/Github/my-claude-codex/skills/resolve-pr-comments/deep-analysis.md
rm ~/Github/my-claude-codex/skills/resolve-pr-comments/interaction.md
rm ~/Github/my-claude-codex/skills/resolve-pr-comments/implementation.md
```

Verification:
```bash
ls ~/Github/my-claude-codex/skills/resolve-pr-comments/*.md
```
Expected: exactly 5 files — `SKILL.md`, `presenting.md`, `analyzing.md`, `publishing.md`, `resolve-threads.md`. No `data-gather.md`, `data-contract.md`, `deep-analysis.md`, `interaction.md`, or `implementation.md`.

Do NOT commit. Move to Task 7.

---

### Task 7: Final verification

This task confirms the new structure is internally consistent before committing.

- [ ] **Step 7.1: Confirm file inventory**

Run:
```bash
ls -1 ~/Github/my-claude-codex/skills/resolve-pr-comments/*.md | sed 's|.*/||'
```
Expected output (in any order):
```
SKILL.md
analyzing.md
presenting.md
publishing.md
resolve-threads.md
```

- [ ] **Step 7.2: Confirm zero references to old filenames**

Run:
```bash
grep -rnE 'data-gather|data-contract|deep-analysis|interaction\.md|implementation\.md' ~/Github/my-claude-codex/skills/resolve-pr-comments/ \
  | grep -v 'docs/superpowers/specs\|docs/superpowers/plans'
```
Expected: 0 hits. If any hits appear:
- Inside `SKILL.md`: a Task 4 cross-file ref edit was missed; revisit Step 4.1-4.5.
- Inside `analyzing.md` / `presenting.md` / `publishing.md`: a stale cross-link from the source files; edit it out.
- Inside `scripts/fetch-comments.py`: revisit Step 5.3.

The `grep -v 'docs/'` filter excludes the spec and plan files themselves (they legitimately reference old filenames in their migration notes).

- [ ] **Step 7.3: Confirm anti-field list is present in `presenting.md`**

Run:
```bash
grep -F 'Anchor, Author, Issue, or File' ~/Github/my-claude-codex/skills/resolve-pr-comments/presenting.md | wc -l
```
Expected: 2 (one in Critical/Major Cards section, one in Medium/Low Pages section).

- [ ] **Step 7.4: Confirm `SKILL.md` Step 2 has the preview-table prohibition**

Run:
```bash
grep -F 'per-thread preview table' ~/Github/my-claude-codex/skills/resolve-pr-comments/SKILL.md
```
Expected: 1 hit.

- [ ] **Step 7.5: Confirm total line count is in expected range**

Run:
```bash
wc -l ~/Github/my-claude-codex/skills/resolve-pr-comments/*.md
```
Expected total: ~459 lines ± 30. Per-file targets:
- `SKILL.md`: ~80
- `analyzing.md`: ~115
- `presenting.md`: ~110
- `publishing.md`: ~70
- `resolve-threads.md`: 84 (unchanged)

If total exceeds ~520 lines, content was likely duplicated during the merges. Re-read sections that are most likely to have leaked content (Reviewer Signal Matrix, severity preservation rule, "Fix requires evidence" — these were the 6+-place repeats in the old structure).

- [ ] **Step 7.6: Confirm `fetch-comments.py` parses**

Run:
```bash
python3 -c "import ast; ast.parse(open('$HOME/Github/my-claude-codex/skills/resolve-pr-comments/scripts/fetch-comments.py').read())"
echo "exit: $?"
```
Expected: `exit: 0`.

If the verification commands all pass, move to Task 8 (commit). If any fail, fix before committing — recovery is much harder after a commit.

---

### Task 8: Single atomic commit

This is the only commit in the entire refactor. The plan above intentionally avoids intermediate commits because the spec selected single-commit atomic refactor.

**Files:** all changes in `~/Github/my-claude-codex/skills/resolve-pr-comments/` and `~/Github/my-claude-codex/docs/superpowers/`.

- [ ] **Step 8.1: Show the staging-ready state**

Run:
```bash
cd ~/Github/my-claude-codex && git status
```
Expected: 5 deletions (`data-gather.md`, `data-contract.md`, `deep-analysis.md`, `interaction.md`, `implementation.md`), 3 new files (`presenting.md`, `analyzing.md`, `publishing.md`), 2 modified files (`SKILL.md`, `scripts/fetch-comments.py`), and the spec/plan documents under `docs/superpowers/`.

If any unrelated changes appear (other skills, root files), pause and investigate before staging.

- [ ] **Step 8.2: Stage only intended files**

Run:
```bash
cd ~/Github/my-claude-codex && \
git add \
  skills/resolve-pr-comments/SKILL.md \
  skills/resolve-pr-comments/presenting.md \
  skills/resolve-pr-comments/analyzing.md \
  skills/resolve-pr-comments/publishing.md \
  skills/resolve-pr-comments/scripts/fetch-comments.py \
  skills/resolve-pr-comments/data-gather.md \
  skills/resolve-pr-comments/data-contract.md \
  skills/resolve-pr-comments/deep-analysis.md \
  skills/resolve-pr-comments/interaction.md \
  skills/resolve-pr-comments/implementation.md \
  docs/superpowers/specs/2026-05-01-resolve-pr-comments-refactor-design.md \
  docs/superpowers/plans/2026-05-01-resolve-pr-comments-refactor-plan.md
```

The `git add` includes the deleted files explicitly so the deletions are staged; `git add -A` is intentionally avoided (per repo policy on unsafe wildcard staging).

Verification:
```bash
cd ~/Github/my-claude-codex && git status --short
```
Expected staged status:
```
A  docs/superpowers/specs/2026-05-01-resolve-pr-comments-refactor-design.md
A  docs/superpowers/plans/2026-05-01-resolve-pr-comments-refactor-plan.md
M  skills/resolve-pr-comments/SKILL.md
A  skills/resolve-pr-comments/analyzing.md
A  skills/resolve-pr-comments/presenting.md
A  skills/resolve-pr-comments/publishing.md
M  skills/resolve-pr-comments/scripts/fetch-comments.py
D  skills/resolve-pr-comments/data-contract.md
D  skills/resolve-pr-comments/data-gather.md
D  skills/resolve-pr-comments/deep-analysis.md
D  skills/resolve-pr-comments/implementation.md
D  skills/resolve-pr-comments/interaction.md
```

If any file shows as both staged and unstaged, run `git status` (without `--short`) to investigate.

- [ ] **Step 8.3: Commit using the spec-provided message template**

Run:
```bash
cd ~/Github/my-claude-codex && git commit -m "$(cat <<'EOF'
refactor(resolve-pr-comments): consolidate 7 files → 5, enforce closed-schema cards

- Merge data-gather.md + deep-analysis.md → analyzing.md (-176 lines)
- Rename interaction.md → presenting.md, absorb Presentation Template
  and Language Rules; close card schema with verbatim template +
  anti-field list (Anchor/Author/Issue/File)
- Rename implementation.md → publishing.md, compress publish blockers
  and absorb thread_map structure
- Delete data-contract.md; move JSON shape to fetch-comments.py docstring
- SKILL.md: add Step 2 preview-table prohibition; trim Common Mistakes
  to top 3; update cross-file refs; -40 lines

Net: 787 lines → ~459 lines (-42%); single source of truth per concept;
eliminates field-schema drift observed in Codex output.

Spec: docs/superpowers/specs/2026-05-01-resolve-pr-comments-refactor-design.md
Plan: docs/superpowers/plans/2026-05-01-resolve-pr-comments-refactor-plan.md

Assisted-By: Claude:claude-opus-4-7
EOF
)"
```

Verification:
```bash
cd ~/Github/my-claude-codex && git log -1 --stat
```
Expected:
- Commit subject: `refactor(resolve-pr-comments): consolidate 7 files → 5, enforce closed-schema cards`
- Stat shows 5 files deleted, 3 new files, 2 modified files in `skills/resolve-pr-comments/`, plus 2 new files in `docs/superpowers/`.

- [ ] **Step 8.4: Final integration check (optional, if a real PR is available)**

If you have an open PR with AI reviewer comments (CodeRabbit, Cursor, etc.), invoke the skill end-to-end:

```bash
# From inside the PR repo checkout (NOT from inside ~/Github/my-claude-codex):
# /resolve-pr-comments
```

Confirm:
- Step 2 prints the count box only — no "Fetched N review threads" table.
- Step 3 cards use the verbatim template — no Anchor / Author / Issue / File rows.
- If the PR has dedup-eligible comments from multiple reviewers, the header shows `[reviewer1/reviewer2]` alphabetically.

If any of these fails, the change is reversible via `git revert HEAD` while still on the same machine.

---

## Self-Review

After writing this plan, I checked it against the spec.

**Spec coverage:**

| Spec section | Covered by |
|---|---|
| §4 file topology | File Structure table at top of plan |
| §5 presenting.md | Task 1 (full content for all 4 sections) |
| §6 analyzing.md | Task 2 (full content for all 8 sections); Step 2.7 confirms Output Schema is gone |
| §7 publishing.md | Task 3 (full content for all 6 sections, including new Thread Map and compressed Stop Conditions) |
| §8 SKILL.md | Task 4 (5 sub-steps for the 5 cross-file refs + Step 2 prohibition + Common Mistakes trim + Glossary) |
| §9 data-contract.md deletion + JSON shape relocation | Task 5 (docstring) + Task 6 (file deletion) |
| §10 cross-file link updates | Task 4 covers all 5 SKILL.md refs; Tasks 1-3 incorporate cross-links into new files; Step 7.2 verifies global zero hits |
| §11 single-commit migration | Tasks 1-7 explicitly say "Do NOT commit"; Task 8 is the only commit |
| §12 verification + rollback | Task 7 verification steps + Step 8.4 end-to-end + the revert note in Step 8.4 |
| §13 line counts | Task 7 Step 7.5 explicitly checks |

No spec section is uncovered.

**Placeholder scan:**

- "TBD" / "TODO" / "implement later": grep'd; 0 hits.
- "Add appropriate error handling" / "handle edge cases": none — verification commands are explicit.
- "Similar to Task N" without repeating: none — each task is self-contained, source content is fetched via `sed -n` rather than referenced.
- The placeholders `<PASTE FROM STEP X.Y>` ARE intentional within Tasks 1-3 — they tell the engineer exactly which earlier step's output to substitute. They are NOT the prohibited kind of placeholder ("TBD" with no path to resolution).

**Type consistency:**

- Function/file names used in steps match: `presenting.md`, `analyzing.md`, `publishing.md` are spelled identically everywhere; `fetch-comments.py` matches the actual script name; section headings (`## Critical/Major Cards`, `## Stop Conditions`, etc.) match the spec.
- Cross-file ref strings used in Edit operations match the verbatim text in current SKILL.md (verified by reading SKILL.md during plan writing).

No issues found.

---

## Plan complete and saved to `docs/superpowers/plans/2026-05-01-resolve-pr-comments-refactor-plan.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Each task above runs in its own clean context, with the plan as input. Best for catching subtle drift.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints for review. Best if you want to watch each step in this conversation.

**Which approach?**
