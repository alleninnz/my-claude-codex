---
name: pr-review
description: Use when the current PR has AI reviewer comments (CodeRabbit, Cursor, etc.) that need to be reviewed and addressed, or when the user says "pr review", "review comments", "fix review comments".
---

# PR Review

Interactive review of AI reviewer comments on the current PR. Comments are classified by severity — Critical/Major get deep per-comment analysis with interactive review; Medium/Low default to skip with rescue capability.

## Prerequisites

- `gh` CLI installed and authenticated
- Current branch has an open PR

## Step 1 — Identify PR and repo

```bash
gh pr view --json number,headRefName,url \
  --jq '{number: .number, branch: .headRefName, url: .url}'
```

Extract `{owner}` and `{repo}` from the URL (e.g. `https://github.com/Org/repo/pull/14` → owner=Org, repo=repo).

If no PR exists for the current branch, report and stop.

## Step 2 — Fetch AI reviewer comments

Fetch **review comments** (inline on code), top-level only:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --paginate \
  --jq '[.[] | select(.user.type == "Bot") | select(.in_reply_to_id == null) | {id: .id, path: .path, line: .line, body: .body, user: .user.login}]'
```

Fetch **issue comments** (PR-level):

```bash
gh api repos/{owner}/{repo}/issues/{number}/comments \
  --paginate \
  --jq '[.[] | select(.user.type == "Bot") | {id: .id, body: .body, user: .user.login, type: "issue_comment"}]'
```

- Only process top-level comments (`in_reply_to_id` is null for review comments)
- Skip issue comments that are purely summaries with no actionable findings (e.g. CodeRabbit summary tables)
- If no actionable AI reviewer comments found, report "No AI review comments found" and stop

## Step 2.5 — Partition outdated comments

Review comments where `line` is `null` are outdated — GitHub marks them this way when the diff context no longer exists after subsequent pushes.

Split review comments into two groups:

- **Outdated:** `line` is `null`
- **Active:** `line` is not `null`

Issue comments (PR-level) are always active — they have no diff position.

If outdated comments exist, present them as a batch before the interactive loop:

```text
── N outdated comment(s) (auto-skipped) ──────────
1. [bot-name] path/to/file.go — <one-line plain-language summary of the concern>
2. [bot-name] path/to/other.go — <one-line plain-language summary>

Proceeding with M remaining comment(s)...
```

The one-line summary is derived from the comment body — translate to plain language, same as the interactive comments, but condensed to one line.

If all comments are outdated (M=0), display the batch summary, report "No active comments to review", and proceed directly to Step 5. In this case, Step 5 will only offer to resolve the outdated threads (without reply).

## Step 2.75 — Triage Copilot comments

Copilot has a high false-positive rate. Instead of presenting its comments interactively, auto-triage them:

1. Separate active comments into **Copilot** (`user` contains "copilot" case-insensitive) and **non-Copilot** groups
2. For each Copilot comment, silently read the referenced code and assess validity:
   - **Noise:** style nitpicks, incorrect claims about bugs that don't exist, suggestions already handled by validation/framework, duplicates of comments from other bots → auto-skip
   - **Legitimate:** real bugs, missing error handling, actual logic issues confirmed by reading the code → promote to interactive queue
3. Present a batch summary:

```text
── N Copilot comment(s) (auto-triaged) ──────────
1. ✗ path/to/file.go:42 — <one-line summary> — <why skipped>
2. ✓ path/to/file.go:88 — <one-line summary> — promoted to interactive review
3. ✗ path/to/other.go:55 — <one-line summary> — <why skipped>

M Copilot comment(s) promoted to interactive review.
Proceeding with X comment(s) (Y non-Copilot + M Copilot)...
```

Promoted Copilot comments join the interactive queue and are presented with the same template as other bot comments (with `[copilot]` in the header).

If all Copilot comments are noise, show the batch summary and proceed with non-Copilot comments only.

## Step 2.9 — Lightweight classification + deduplication

This step operates on all active comments in the queue, including Copilot comments promoted in Step 2.75.

### Classification

For each comment, assign a severity level based on:

- Reviewer's own labels/emoji (CodeRabbit: 🔴🟡, text markers like `critical`, `warning`)
- Comment body text content (keywords, described impact)
- No code file reads at this stage

| Severity | Characteristics |
|----------|----------------|
| Critical | Security vulnerabilities, data loss, logic errors, crash/panic |
| Major | Missing error handling, concurrency issues, performance problems (with real impact), API contract violations |
| Medium | Possible edge cases, non-critical code improvements, readability |
| Low/Nitpick | Naming style, comment suggestions, formatting, import order |

Relationship with reviewer labels:

- Reviewer label is the starting point
- Claude can upgrade based on comment text (e.g., reviewer marks medium but describes SQL injection → upgrade to Critical)
- Downgrade floor is Medium in this phase (insufficient info for confident downgrade; deep analysis in Step 3A can lower further)
- Comments without labels → Claude classifies from text content

### Deduplication

After classification, group semantically similar comments:

- Same file / same or adjacent lines (±5 lines)
- Same underlying concern (semantic match, not literal text match)
- Group severity = highest severity in group (conservative)
- All comment IDs preserved for thread resolution in Step 5

Generate a one-line plain-language summary for each comment/group (derived from comment text, no code reads). These summaries are used in the Step 3B overview list.

### Output

Split into two queues:

- **Critical/Major queue** → Step 3A (interactive deep review)
- **Medium/Low queue** → Step 3B (overview + rescue)

## Step 3A — Critical/Major interactive review

For each Critical/Major comment (or deduplicated group), perform deep analysis before presentation.

### Deep analysis (per comment, not batch)

Before presenting each comment, gather three inputs:

1. **git diff** — run `git diff $(gh pr view --json baseRefName -q .baseRefName)...HEAD -- {path}` to get the PR's changes for the file, focused on the comment's location
2. **Function-level context** — read the full function/method containing the flagged line (not the entire file)
3. **Project conventions** — check CLAUDE.md, linter config, and surrounding code patterns for relevant conventions

For PR-level issue comments (no file path): use the PR description and overall diff summary instead of file-specific diff and function context.

If a file was deleted/renamed, check `git log --diff-filter=R --find-renames -- {path}`.

### Severity re-evaluation

After deep analysis, Claude may upgrade or downgrade the comment's severity:

- If downgraded below Major → move to Medium/Low overview list (Step 3B), do not present interactively. Retain the gathered deep analysis context — if the user rescues this comment in Step 3B, reuse it instead of re-reading files
- If upgraded → reflect in display header (e.g., `[Medium → Critical]`)
- If all Critical/Major comments are downgraded during deep analysis, skip Step 3A interaction entirely and proceed to Step 3B with all comments

### Presentation template

For single comments:

```text
── 1/N ── [Critical] ── [coderabbit] ──────────
📍 path/to/file.go:42

**Diff:**
<git diff snippet, only the change related to this comment, ±3 lines context>

**问题分析:**
<2-3 sentences: what the reviewer flagged, why it matters (or doesn't),
impact on current code. If Claude disagrees with reviewer, state the
disagreement and reasoning explicitly.>

**建议:** Fix / Skip
<1-sentence rationale>

<details><summary>原始 comment</summary>
<raw reviewer text>
</details>

[1] Fix  [2] Skip  [3] Discuss(请说明)
```

For deduplicated groups:

```text
── 1/N ── [Major] ── 2 comments grouped ──────
📍 path/to/file.go:42 (coderabbit, copilot)

**Diff:**
<shared diff snippet>

**问题分析:**
<merged analysis, noting each reviewer's angle if different>

**建议:** Fix / Skip
<rationale>

<details><summary>原始 comments (2)</summary>
[coderabbit] ...
[copilot] ...
</details>

[1] Fix  [2] Skip  [3] Discuss(请说明)
```

Omit `📍` and `**Diff:**` for PR-level issue comments.

### User responses

- `1` (Fix) — Queue for fixing. Record what to change. Next comment.
- `2` (Skip) — Next comment.
- `3` (Discuss) — User provides additional context or custom fix instructions. After discussion resolves, re-present `[1] Fix  [2] Skip` for final decision (no more Discuss option).

## Step 3B — Medium/Low overview + rescue

Present all Medium/Low comments (including any downgraded from Step 3A) as a numbered overview list. Default action is skip; user can rescue specific comments for deep review.

### Overview template

```text
── Medium/Low (N comments, default skip) ──────
1. [Medium] path/to/file.go:88 — missing context cancellation check (coderabbit)
2. [Medium] path/to/handler.go:55 — suggest using constants instead of magic number (coderabbit, copilot × 2)
3. [Low]    path/to/util.go:12 — variable naming: prefer camelCase (copilot)
4. [Low]    path/to/model.go:33 — unused parameter in function signature (coderabbit)

输入编号 rescue (如 1,3), 或直接回车全部 skip:
```

One-line summaries were generated in Step 2.9 from comment text (no code reads).

For deduplicated groups, show sources and count in the summary line (e.g., `(coderabbit, copilot × 2)`).

### Interaction rules

| User input | Behavior |
|------------|----------|
| Enter (empty) | All skip, proceed to Step 4 |
| `1,3` | Deep-analyze #1 and #3 using Step 3A process, present with Step 3A template, rest skip |
| `all` | Rescue all, present each using Step 3A template in order |

### Rescue flow

1. Perform deep analysis for selected comment (same as Step 3A: diff + function context + project conventions)
2. Present using Step 3A template
3. If severity upgraded during deep analysis, show the change in header (e.g., `[Medium → Major]`)
4. User responds with `[1] Fix  [2] Skip  [3] Discuss` as in Step 3A
5. After all rescued comments processed, proceed to Step 4

## Step 4 — Apply queued fixes

After all comments processed (Step 3A + Step 3B), show the review summary:

```text
── Review Summary ──────────────────────────
Critical/Major: 3 comments (2 fix, 1 skip)
Medium/Low:     5 comments (1 rescued → fix, 4 skipped)
Outdated:       2 comments (auto-skipped)
Copilot:        4 comments (1 promoted → fix, 3 auto-skipped)
Duplicates:     3 comments merged into 2 groups
────────────────────────────────────────────
Total: 17 comments → 4 fixes queued
```

If no fixes queued: report "No fixes to apply" and proceed to Step 5.

If fixes queued: apply all fixes, run build/lint/test to verify, show summary of changes. If build breaks, investigate and adjust.

**Stop here.** Do NOT commit, push, or modify git state. The user handles git workflow.

## Step 5 — Optional reply and resolve threads

Ask: **"Want to reply and resolve threads on GitHub? (yes / no)"**

If **no**: done.

If **yes**: read `resolve-threads.md` in this skill directory for the API commands to reply to comments and resolve review threads via GraphQL.

Thread resolution rules:

- **Fixed comments** (from Step 3A or rescued in Step 3B): reply explaining the fix, then resolve
- **Explicitly skipped comments** (from Step 3A or rescued in Step 3B): reply explaining why skipped, then resolve
- **Auto-skipped Medium/Low comments** (not rescued): resolve without reply, similar to outdated comments
- **Outdated comments**: resolve without reply (existing behavior)
- **Deduplicated groups**: each comment in the group gets its own reply (referencing the same fix) and is resolved independently

## Common mistakes

- **Echoing the AI text verbatim** — The whole point is to translate into plain language. The `问题分析` section should contain YOUR independent analysis, not a rephrasing of the reviewer's text.
- **Shallow analysis without reading diff/context** — For Critical/Major comments (Step 3A), you MUST read the git diff, function-level context, and project conventions before presenting. This is what makes the analysis valuable.
- **Agreeing with the reviewer by default** — Form your own judgment. If the reviewer's concern doesn't apply given the code context, say so explicitly and recommend Skip.
- **Committing or pushing** — Never. The user handles git workflow after fixes are applied.
- **Processing human comments** — Only bot reviewers. Filter is in the jq query.
- **Presenting Copilot comments interactively** — Copilot has high false-positive rate. Auto-triage in Step 2.75, only promote legitimate findings.
- **Fixing without queuing first** — Go through ALL comments (Step 3A + Step 3B) before applying any fixes in Step 4.
- **Presenting outdated comments interactively** — Comments with `line: null` are outdated. Batch them in Step 2.5.
- **Presenting Medium/Low comments one-by-one** — These go to the overview list in Step 3B with default skip. Only deep-analyze if the user rescues them.
- **Skipping deduplication** — Group similar comments before interaction. One fix per group, not per comment.
