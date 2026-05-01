---
name: resolve-pr-comments
description: >
  Use when the current PR has AI reviewer comments (CodeRabbit, Cursor, etc.)
  that need to be reviewed and addressed, or when the user says "pr review",
  "review comments", "fix review comments".
---

# PR Review

Work through unresolved PR review feedback with thread-aware data, independent analysis, user-controlled decisions, and low-friction GitHub thread closure.

## Prerequisites

- `gh` CLI installed and authenticated.
- Current branch has an open PR, or the user provides a PR URL/number.

## Platform Rules

- Use `gh` for all GitHub API calls. Do not use GitHub MCP tools for thread-aware review data.
- Claude Code blocking choices: use `AskUserQuestion`.
- Codex or other environments without `AskUserQuestion`: ask the question in plain text and stop until the user replies.
- Keep user-facing output compact: show decisions, blockers, previews, and outcomes; keep raw tool/API output out of assistant responses.
- Treat an explicit resolve/fix/publish request (for example, `resolve PR comments`, `fix review comments`, or `publish the fixes`) as authorization for this skill's publish lane after all required comment decisions are recorded and verification/local review pass. Broad review-only requests such as `pr review` or `review comments` do not authorize commit, push, reply, or resolve writes; ask once before publishing.
- Do not run a fresh CodeRabbit/uncommitted review for follow-up fixes made by this skill; the task is already responding to existing review feedback. Run a local review checklist focused on decision/diff alignment and verification instead.
- If the diff includes new implementation work beyond the processed review comments, stop before commit/push and return to the normal repository Git workflow.
- For comments fixed by code, commit and push before posting "Fixed in <commit>" replies or resolving threads. For no-code comments, post planned replies and resolve processed threads after the preview. Ask before GitHub thread writes only when a publish blocker makes the planned action unsafe or stale.

## Glossary

- **Inline comment**: review-thread comment with `thread_id`, `is_resolved`, and `is_outdated`.
- **PR-level comment**: conversation comment with no resolved state.
- **Review body**: top-level body from a submitted review.
- **Actionable**: a comment for which the agent must produce a `recommendation` and the user must record a `decision`.
- **Recommendation** (agent output, 4 values): `Fix`, `Defer`, `Reply only`, `Needs your decision`. Displayed on the card.
- **Decision** (user choice, 3 values): `Fix`, `Defer`, `Reply only`. The publishable terminal actions. `Needs your decision` is NOT a valid decision.
- **Defer**: valid concern, not fixed in this PR; prepare a follow-up issue draft or tracking note.
- **Reply only**: no code change in this PR; post a reply (concise for noise/style, fuller for substantive concerns) and resolve the thread.
- **Needs your decision**: agent-side recommendation signal — agent cannot verify the bot's claim within this repo (cross-service ownership, PR-description-vs-code conflict, missing-proof concerns spanning systems, or any case where the agent lacks the domain context to judge). The user must convert it into `Fix`, `Defer`, or `Reply only` before the workflow advances.

## Step 1 - Fetch and Classify

Run the deterministic fetch script from this skill directory while keeping the shell working directory at the target repo:

```bash
python3 <resolve-pr-comments-skill-dir>/scripts/fetch-comments.py
```

For explicit PRs, use `--repo OWNER/REPO --pr 123` or `--url <pr-url>`.

The script fetches PR metadata first and fail-fast checks the fetched `head_sha` against local `git rev-parse HEAD` when running inside a git checkout. If it reports a mismatch, stop before analysis and ask the user to checkout or update the PR branch. Do not analyze or fix review comments against a mismatched local checkout.

Read `analyzing.md`, then classify the raw JSON into:

- `outdated[]`
- `copilot_triage[]`
- `nitpick_triage[]`
- `critical_major[]`
- `medium_low[]`
- `reply_only[]`
- `deferred[]`
- `thread_map[]`

Severity controls presentation. Include reviewer-labeled Critical/Major/High/P0/P1 items in `critical_major[]` unless they are resolved, outdated, or pure bot noise. Do not move a Critical/Major item into `reply_only[]`, `deferred[]`, or `medium_low[]` just because its recommendation is `Reply only`, `Defer`, `Needs your decision`, or a downgraded severity; keep it in `critical_major[]` so Step 3 presents it one item at a time.

If the script cannot run, use the fallback fetch rules in `analyzing.md`.

If all buckets are empty (`outdated[]`, `copilot_triage[]`, `nitpick_triage[]`, `critical_major[]`, `medium_low[]`, `reply_only[]`, `deferred[]`), output "No review comments found" and stop.

## Step 2 - Triage Summary

Show only a short count summary. Do not recommend decisions, synthesize the "main blocker", or present a global fix plan here.

```text
── Review Comment Triage ──────────────────
PR: OWNER/REPO#123
Outdated: 2
Copilot auto-skipped: 3
Nitpick ignored: 4
Critical/Major: 1
Medium/Low: 7
Reply only: 1
Deferred: 0
```

For outdated and Copilot auto-triage, show one-line summaries. For nitpick auto-triage, show the count only. Do not spend user attention on full templates for already-triaged noise.

Do not render a per-thread preview table or per-item one-liners for any actionable bucket (no "Fetched N review threads" table with bot / file:line / severity / summary columns; no per-thread one-liners for Critical/Major or Medium/Low). Per-item presentation lives in Step 3 / Step 4 with the full required fields.

After the count summary, immediately proceed to Step 3 if there are Critical/Major items. If there are no Critical/Major items, proceed to Step 4. Do not stop after the summary unless there are no actionable comments. If only `outdated[]`, `copilot_triage[]`, or `nitpick_triage[]` items remain, stop after the summary.

## Step 3 - Critical/Major Review

Read `analyzing.md` and `presenting.md`. Present exactly one deduplicated Critical/Major item at a time using the detailed card and choices from `presenting.md`.

Hard rule: every Critical/Major item requires an explicit user decision before moving on. Even when the recommendation is clearly `Reply only` or `Needs your decision`, present the card, state the recommendation, ask for a decision, and stop. Do not batch Critical/Major items, ask for decisions on multiple Critical/Major items at once, or advance to the next Critical/Major item without a recorded decision for the current one.

Critical/Major items must go through deep analysis per `analyzing.md`: read the focused diff, the surrounding function/method, repo conventions (`CLAUDE.md`/`AGENTS.md`/lints/peer code), and PR description for PR-level items. The presentation card must include concrete `Code evidence` — a `file:line` quote, a grep/diff/test artifact, or an explicit `"no concrete evidence available; bot's claim is about <category>"` note. The one rule: `Fix` requires concrete code evidence; without it, pick `Defer`, `Reply only`, or `Needs your decision` based on the case. Do not invent or paraphrase evidence to justify `Fix`.

If deep analysis downgrades a Critical/Major item below Major, keep it in the current Step 3 flow, show the downgraded severity in the card, and still ask for the user decision before moving on. Do not silently move it to Step 4 after it has entered Critical/Major review.

## Step 4 - Medium/Low Review

Read `presenting.md`. Use compact cards by default, 5 items per page with global numbering. Full deep analysis is available through `review N`; promoted items use Step 3 choices.

## Step 5 - Fix Plan and Implementation

Read `publishing.md`. Show the fix plan before editing, apply queued fixes by file or behavior area, and run targeted verification when practical.

Do not start fixing until every actionable comment has a recorded decision. Do not present a global fix plan until all Critical/Major items have explicit recorded decisions and all Medium/Low items have either recorded decisions or explicitly accepted defaults such as `ok all`.

## Step 6 - Preview, Publish, Resolve

Read `publishing.md` and `resolve-threads.md`. Follow the publish lanes there: code-fix comments are committed and pushed before reply/resolve. Skip the extra confirmation only when the user explicitly asked to resolve, fix, or publish; review-only invocations require one publish confirmation before commit, push, reply, or resolve writes. Ask again only if a publish blocker appears.

## Common Mistakes

1. `Fix` requires concrete `Code evidence` (file:line + quote, grep/diff/test artifact). Without it, pick `Defer` / `Reply only` / `Needs your decision` based on the case.
2. Critical/Major: present one deduplicated item, ask for one decision, stop. Never batch.
3. Render cards verbatim against the template in `presenting.md`. Do not add Anchor / Author / Issue / File rows or any other field beyond the template.
