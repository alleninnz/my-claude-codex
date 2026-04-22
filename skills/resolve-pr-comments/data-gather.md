# PR Review — Data Gathering Subagent

Dispatch this as an Agent with `model: sonnet` (mechanical data fetching, no judgment needed beyond Copilot triage). The subagent **MUST** use `gh` CLI (via Bash tool) for all GitHub API calls — **NEVER** use GitHub MCP tools.

## Prompt template

```
You are gathering and classifying AI reviewer comments for PR #{number} on {owner}/{repo}.

Working directory: {cwd}

## Step 0: Fetch PR metadata

Fetch the PR author login and current head — needed to attribute staleness signals correctly:

gh api repos/{owner}/{repo}/pulls/{number} \
  --jq '{author: .user.login, head_sha: .head.sha, updated_at: .updated_at}'

Store as `pr_meta`. Referenced below as `pr_meta.author` and `pr_meta.updated_at`.

## Step 1: Fetch unresolved thread IDs

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

Store as the unresolved comment ID set.

## Step 2: Fetch all comments (bot + human)

Review comments (inline, top-level only):

gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate \
  --jq '[.[] | select(.in_reply_to_id == null) | {id: .id, path: .path, line: .line, body: .body, user: .user.login, user_type: .user.type}]'

**MUST** filter to only those whose id is in the unresolved set. **DO NOT** include resolved comments.

Issue comments (PR-level) — **MUST** fetch both human and bot comments. **DO NOT** filter by user type at this step; filtering happens in classification below.

gh api repos/{owner}/{repo}/issues/{number}/comments --paginate \
  --jq '[.[] | {id: .id, body: .body, user: .user.login, user_type: .user.type, created_at: .created_at, type: "issue_comment"}]'

Classify each issue comment into one of three buckets:

1. **Skip (bot noise)** — auto-generated summaries and CI reports with no actionable content:
   - CodeRabbit walkthrough tables and paused-review banners
   - Datadog / CI pipeline reports
   - Linear linkback comments
   - Bot status notifications

2. **Skip (conversational)** — chatter without substantive review content, from humans or bots:
   - Bot invocations (`@codex review`, `@coderabbitai help`, `/review`)
   - Simple acknowledgements (`LGTM`, `thanks`, `nice`)
   - Teammate discussion that doesn't ask for code changes
   - Merge/status notes (`ready to merge`, `blocked by X`)

3. **Include (actionable)** — substantive review feedback that maps to a Fix/Skip decision:
   - Design concerns or API contract questions
   - Explicit asks to change, add, or remove code
   - Flagged bugs, risks, or missing cases
   - Human reviewers giving feedback at PR level instead of inline (common for cross-cutting concerns)
   - Bot comments with concrete inline feedback outside the CodeRabbit walkthrough (e.g., separate `coderabbitai` actionable blocks)

**MUST exclude from the actionable bucket (use as staleness signals only):**
- Comments where `user == pr_meta.author` — these are the author's own status updates, replies, or prior skill-generated Step 6 resolutions. They are not review items. Surface them as `author_followups` signals against the reviewer comments they respond to, never as fresh Fix/Skip candidates.
- Comments authored by the session's GitHub login (same reasoning) — these are typically the skill's own prior Step 6 replies.

**When in doubt, include it.** Over-including a conversational comment is recoverable (easy Skip in Step 5); dropping a substantive human review at fetch time is silent and invisible to the user. The skill has already been bitten by this — **NEVER** reintroduce a blanket `user.type == "Bot"` filter here.

### Staleness signals (PR-level actionable comments only)

PR-level issue comments **have no resolved/unresolved state** — they persist even after the author addresses them inline, in a reply, or via a push. Without extra signals, repeat runs re-queue already-handled feedback.

For **each issue comment classified as actionable** (bucket 3 above), fetch these signals and attach them to the comment record. **DO NOT auto-skip based on signals** — the main skill presents them to the user, who makes the final Fix/Skip call.

1. **Reactions on the comment** (acknowledgement hint):
   ```
   gh api repos/{owner}/{repo}/issues/comments/{comment_id}/reactions \
     --jq '[.[] | {user: .user.login, content: .content}]'
   ```
   Flag if the original reviewer or `pr_meta.author` left `+1` / `rocket` / `hooray`.

2. **Subsequent author replies** (discussion hint): from the issue-comments list already fetched, include any issue comment where `created_at > target.created_at` AND (`user == pr_meta.author` OR body mentions the reviewer by `@handle` OR body quotes the original). Use `pr_meta.author` — **DO NOT** guess who the author is.

3. **PR activity after the comment** (coarse work-done hint): compare `pr_meta.updated_at > target.created_at`. **MUST NOT** use commit timestamps (`committer.date` / `author.date`) — they are preserved through rebase/cherry-pick and will under-report post-comment work. The PR-level `updated_at` is coarse (bumps on every comment too) but robust.

Attach to the comment record as `staleness_signals`:
- `acknowledged_by: [list of users who reacted positively]` (empty if none)
- `author_followups: [{id, body_preview, created_at}]` (empty if none)
- `pr_updated_since_comment: true|false` (coarse signal — treat as "activity happened" not "work done")

If no actionable comments found (inline + issue-level combined), return: "No review comments found."

## Step 3: Partition outdated

**Inline review comments only.** Review comments where `line` is `null` are outdated. Split into outdated and active groups.

**MUST NOT** apply this rule to PR-level issue comments — they structurally have no `line` field and would all be misclassified as outdated.

For each outdated comment, generate a one-line plain-language summary.

## Step 4: Triage Copilot comments

From the **bot inline review comments** only, separate into Copilot (user contains "copilot" case-insensitive) and non-Copilot. This step targets Copilot specifically — **DO NOT** apply it to human comments or to issue-level comments.

For each Copilot comment, read the referenced code and assess:
- Noise: style nitpicks, incorrect claims, suggestions already handled, duplicates → skip
- Legitimate: real bugs, missing error handling, actual logic issues → promote

**MUST NOT** auto-triage or auto-skip human comments (`user_type == "User"`) at any step. Every actionable human comment from Step 2 and Step 3 goes to classification in Step 5.

## Step 5: Classify and deduplicate

For all active comments: human comments + non-Copilot bot comments + promoted Copilot comments:

Classify severity:
- Critical: Security vulnerabilities, data loss, logic errors, crash/panic
- Major: Missing error handling, concurrency issues, performance problems, API contract violations
- Medium: Possible edge cases, non-critical improvements, readability
- Low/Nitpick: Naming style, comment suggestions, formatting

Use reviewer labels as starting point, upgrade based on text content. Downgrade floor is Medium — **NEVER** downgrade below Medium.

Deduplicate: group by same file / adjacent lines (±5) / same concern. Group severity = highest.

For each comment/group, you MUST generate all three fields — DO NOT skip any:
- **Problem**: MUST be natural language explaining what's wrong with the code. Write as if explaining to a colleague sitting next to you. DO NOT echo AI reviewer phrasing ("Consider adding...", "It is recommended that...", "Potential issue with..."). DO NOT use hedging language ("may", "could potentially", "it might be beneficial to").
- **Wants**: MUST be natural language explaining what the reviewer wants done. Write as if explaining to a colleague sitting next to you. DO NOT copy the reviewer's suggestion verbatim.
- **Summary**: One-line plain-language summary (used for defaults summary display).

## Step 6: Build thread map

For each comment processed, record: {commentId, threadId (from Step 1 data), category (fixed/skipped/outdated/copilot/etc)}

## Return format

**MUST** return ALL of the following sections — **DO NOT** omit any section, even if empty (use N=0). Use exact headers:

### PR
owner: {owner}
repo: {repo}
number: {number}

### Outdated (N)
For each: [bot] path — one-line summary (include comment ID)

### Copilot Triage (N)
For each: ✗/✓ path:line — summary — reason (include comment ID)

### Critical/Major (N)
For each: [severity] {location} (reviewer) — summary (include comment ID, all IDs for dedup groups, mark human reviewers)
Problem: <natural language>
Wants: <natural language>
Staleness signals: <only for PR-level issue comments; omit for inline>

### Medium/Low (N)
For each: [severity] {location} (reviewer) — summary (include comment ID, all IDs for dedup groups, mark human reviewers)
Problem: <natural language>
Wants: <natural language>
Staleness signals: <only for PR-level issue comments; omit for inline>

`{location}` is `path:line` for inline review comments and `PR-level (issue comment)` for PR-level issue comments. **MUST** also mark human reviewers explicitly (e.g., `(paul-freeman, human)`) — humans and bots need visibly different labels so the main skill can apply stricter no-auto-skip rules to human feedback.

`Staleness signals` format (PR-level only):
- `Acknowledged: @user1 (rocket), @user2 (+1)` or `Acknowledged: none`
- `Author followups: 2 comment(s) from @{author} after this one` or `Author followups: none`
- `PR activity since comment: yes (coarse — bumps on any comment/push)` or `PR activity since comment: no`

### Thread Map
For each: commentId → threadId
```

## Dispatch instructions

```python
Agent(
    name="pr-comments-gatherer",
    description="Gather PR review comments",
    prompt=<filled template above>,
    model="sonnet",
    mode="bypassPermissions"
)
```

Parse the returned text to extract the structured data for Steps 2-6 of the main skill.
