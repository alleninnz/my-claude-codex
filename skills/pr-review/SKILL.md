---
name: pr-review
description: Use when the current PR has AI reviewer comments (CodeRabbit, Cursor, etc.) that need to be reviewed and addressed, or when the user says "pr review", "review comments", "fix review comments".
---

# PR Review

Interactive review of AI reviewer comments on the current PR. Comments are classified by severity — Critical/Major get deep per-comment analysis with interactive review; Medium/Low default to skip with rescue capability.

## Output Discipline

**Steps 1 through 2.9 are silent.** Do NOT output step labels, progress updates, or intermediate results to the terminal. The only visible output should be:

- **Outdated batch summary** (Step 2.5) — if any exist
- **Copilot triage summary** (Step 2.75) — if any Copilot comments exist
- **Critical/Major interactive review** (Step 3A) — per-comment deep analysis
- **Medium/Low overview list** (Step 3B) — classification table with recommendations
- **Review summary** (Step 4) — final counts
- **Thread resolution status** (Step 5) — "All N threads resolved"
- **AskUserQuestion prompts** — interactive decisions

Everything else (fetching threads, fetching comments, filtering, deduplication) happens silently. Do not narrate what you are doing — just do it and present results.

For Bash tool calls during silent steps, use minimal descriptions (e.g., just the API endpoint) and do not echo the output in text.

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

## Step 1.5 — Fetch unresolved thread IDs

Before fetching comments, get the set of **unresolved** review thread comment IDs. Only comments belonging to unresolved threads should be processed — resolved threads are already handled and must be skipped entirely.

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F number={number} -f query='
  query($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 1) { nodes { databaseId } }
          }
        }
      }
    }
  }' --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .comments.nodes[0].databaseId]'
```

Store this as the **unresolved comment ID set**. Only review comments whose `id` appears in this set will be processed in Step 2.

## Step 2 — Fetch AI reviewer comments

Fetch **review comments** (inline on code), top-level only:

```bash
gh api repos/{owner}/{repo}/pulls/{number}/comments \
  --paginate \
  --jq '[.[] | select(.user.type == "Bot") | select(.in_reply_to_id == null) | {id: .id, path: .path, line: .line, body: .body, user: .user.login}]'
```

**Filter review comments to only those whose `id` is in the unresolved comment ID set from Step 1.5.** Discard all resolved comments silently — do not count them, present them, or mention them.

Fetch **issue comments** (PR-level):

```bash
gh api repos/{owner}/{repo}/issues/{number}/comments \
  --paginate \
  --jq '[.[] | select(.user.type == "Bot") | {id: .id, body: .body, user: .user.login, type: "issue_comment"}]'
```

Note: Issue comments do not have review threads, so they cannot be filtered by resolution status. Skip issue comments that are purely summaries with no actionable findings (e.g. CodeRabbit summary tables).

- Only process top-level comments (`in_reply_to_id` is null for review comments)
- If no actionable AI reviewer comments found after filtering, report "No AI review comments found" and stop

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

If all comments are outdated (M=0), display the batch summary, report "No active comments to review", and proceed directly to Step 5.

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

If the Critical/Major queue is empty, skip Step 3A and proceed directly to Step 3B.

## Step 3A — Critical/Major interactive review

For each Critical/Major comment (or deduplicated group), perform deep analysis before presentation.

Read `deep-analysis.md` in this skill directory for the deep analysis methodology, severity re-evaluation rules, presentation templates, and user response handling via `AskUserQuestion`.

## Step 3B — Medium/Low overview + rescue

Present all Medium/Low comments (including any downgraded from Step 3A) as a numbered overview list with analysis and recommendations. Default action is skip; user can rescue specific comments for deep review.

### Overview template

Each entry must include: what the reviewer wants (plain language), your recommendation (fix/skip), and brief reasoning. Do NOT just echo a one-line summary — give the user enough context to decide without reading the original comment.

```text
── Medium/Low (N comments, default skip) ──────
1. [Medium] path/to/file.go:88 (coderabbit)
   Reviewer wants: Add context cancellation check to prevent goroutine leak in long-running handler.
   Recommendation: Fix — real concern, handler runs unbounded without cancellation.

2. [Medium] path/to/handler.go:55 (coderabbit, copilot × 2)
   Reviewer wants: Replace magic number 30 with a named constant for the retry timeout.
   Recommendation: Skip — value is only used once, a constant adds indirection without clarity.

3. [Low] path/to/util.go:12 (copilot)
   Reviewer wants: Rename `tID` to `tenantID` for readability.
   Recommendation: Skip — matches existing codebase convention, all surrounding code uses `tID`.

4. [Low] path/to/model.go:33 (coderabbit)
   Reviewer wants: Remove unused `opts` parameter from function signature.
   Recommendation: Fix — dead parameter, removing it is a clean improvement.

Enter numbers to rescue for deep review (e.g. 1,4), or press Enter to skip all:
```

For deduplicated groups, show sources and count (e.g., `(coderabbit, copilot × 2)`).

### Interaction rules

| User input | Behavior |
|------------|----------|
| Enter (empty) | All skip, proceed to Step 4 |
| `1,3` | Deep-analyze #1 and #3 using Step 3A process, present with Step 3A template, rest skip |
| `all` | Rescue all, present each using Step 3A template in order |

### Rescue flow

1. Perform deep analysis for selected comment (same methodology as Step 3A — see `deep-analysis.md`)
2. Present using the Step 3A presentation template
3. If severity upgraded during deep analysis, show the change in header (e.g., `[Medium → Major]`)
4. User responds via `AskUserQuestion` with `["Fix", "Skip", "Discuss"]` as in Step 3A
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

## Step 4.5 — Commit and push

Use `AskUserQuestion` to ask whether the user wants to commit and push the fixes:

Options: `["Commit and push (Recommended)", "Skip"]`

If **Commit and push**: stage the changed files, create a commit with a descriptive message, and push to the current branch.

If **Skip**: do NOT commit or push. The user handles git workflow.

## Step 5 — Optional reply and resolve threads

Use `AskUserQuestion` to ask whether the user wants to reply and resolve threads on GitHub:

Options: `["Yes (Recommended)", "No"]`

If **No**: done.

If **Yes**: read `resolve-threads.md` in this skill directory for the API commands, reply rules per category, and dedup group handling. **Every thread MUST receive a reply before being resolved** — never resolve silently, even for auto-skipped, outdated, or Copilot noise threads.

## Common mistakes

- **Echoing the AI text verbatim** — The whole point is to translate into plain language. The **Analysis** section should contain YOUR independent analysis, not a rephrasing of the reviewer's text.
- **Shallow analysis without reading diff/context** — For Critical/Major comments (Step 3A), you MUST read the git diff, function-level context, and project conventions before presenting. This is what makes the analysis valuable.
- **Agreeing with the reviewer by default** — Form your own judgment. If the reviewer's concern doesn't apply given the code context, say so explicitly and recommend Skip.
- **Committing or pushing without asking** — Always use `AskUserQuestion` in Step 4.5 before touching git state.
- **Processing human comments** — Only bot reviewers. Filter is in the jq query.
- **Presenting Copilot comments interactively** — Copilot has high false-positive rate. Auto-triage in Step 2.75, only promote legitimate findings.
- **Fixing without queuing first** — Go through ALL comments (Step 3A + Step 3B) before applying any fixes in Step 4.
- **Presenting outdated comments interactively** — Comments with `line: null` are outdated. Batch them in Step 2.5.
- **Presenting Medium/Low comments one-by-one** — These go to the overview list in Step 3B with default skip. Only deep-analyze if the user rescues them.
- **Skipping deduplication** — Group similar comments before interaction. One fix per group, not per comment.
- **Resolving threads without replying** — Every thread must get a reply explaining why it was resolved (fixed, skipped with reason, not applicable, etc.). Silent resolves leave reviewers and readers without context.
