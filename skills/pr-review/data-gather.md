# PR Review — Data Gathering Subagent

Dispatch this as an Agent with `model: sonnet` (mechanical data fetching, no judgment needed beyond Copilot triage).

## Prompt template

```
You are gathering and classifying AI reviewer comments for PR #{number} on {owner}/{repo}.

Working directory: {cwd}

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

## Step 2: Fetch bot comments

Review comments (inline, top-level only):

gh api repos/{owner}/{repo}/pulls/{number}/comments --paginate \
  --jq '[.[] | select(.user.type == "Bot") | select(.in_reply_to_id == null) | {id: .id, path: .path, line: .line, body: .body, user: .user.login}]'

Filter to only those whose id is in the unresolved set. Discard resolved.

Issue comments (PR-level):

gh api repos/{owner}/{repo}/issues/{number}/comments --paginate \
  --jq '[.[] | select(.user.type == "Bot") | {id: .id, body: .body, user: .user.login, type: "issue_comment"}]'

Skip issue comments that are purely summaries (CodeRabbit walkthrough tables, Datadog CI reports, etc.).

If no actionable comments found, return: "No AI review comments found."

## Step 3: Partition outdated

Review comments where `line` is `null` are outdated. Split into outdated and active groups.

For each outdated comment, generate a one-line plain-language summary.

## Step 4: Triage Copilot comments

Separate active comments into Copilot (user contains "copilot" case-insensitive) and non-Copilot.

For each Copilot comment, read the referenced code and assess:
- Noise: style nitpicks, incorrect claims, suggestions already handled, duplicates → skip
- Legitimate: real bugs, missing error handling, actual logic issues → promote

## Step 5: Classify and deduplicate

For all active non-Copilot + promoted Copilot comments:

Classify severity:
- Critical: Security vulnerabilities, data loss, logic errors, crash/panic
- Major: Missing error handling, concurrency issues, performance problems, API contract violations
- Medium: Possible edge cases, non-critical improvements, readability
- Low/Nitpick: Naming style, comment suggestions, formatting

Use reviewer labels as starting point, upgrade based on text content. Downgrade floor is Medium.

Deduplicate: group by same file / adjacent lines (±5) / same concern. Group severity = highest.

Generate a one-line plain-language summary for each comment/group.

## Step 6: Build thread map

For each comment processed, record: {commentId, threadId (from Step 1 data), category (fixed/skipped/outdated/copilot/etc)}

## Return format

Return ALL of the following sections. Use exact headers:

### PR
owner: {owner}
repo: {repo}
number: {number}

### Outdated (N)
For each: [bot] path — one-line summary (include comment ID)

### Copilot Triage (N)
For each: ✗/✓ path:line — summary — reason (include comment ID)

### Critical/Major (N)
For each: [severity] path:line (bot) — summary (include comment ID, all IDs for dedup groups)

### Medium/Low (N)
For each: [severity] path:line (bot) — summary (include comment ID, all IDs for dedup groups)

### Thread Map
For each: commentId → threadId
```

## Dispatch instructions

```python
Agent(
    description="Gather PR review comments",
    prompt=<filled template above>,
    model="sonnet",
    mode="bypassPermissions"
)
```

Parse the returned text to extract the structured data for Steps 2-7 of the main skill.
