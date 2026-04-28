# Reply and Resolve Threads — API Reference

## Reply rules

**Every thread MUST receive a reply before resolving.** **NEVER** resolve silently.

| Category | Reply content |
|----------|---------------|
| Fixed (Step 3 or reviewed Step 4) | "Fixed in \<commit\>. \<brief explanation\>" |
| Deferred | "Valid concern; not addressed in this PR. Follow-up: \<tracking issue or draft title\>." Do not claim a real issue exists unless it was created. |
| Reply only | Concise technical answer explaining why no code change is needed. |
| Explicitly skipped (Step 3 or reviewed Step 4) | Concise technical reason (e.g., "Follows existing codebase convention") |
| Skipped Medium/Low | One-line reason (e.g., "Style preference — not addressing in this PR") |
| Auto-skipped Copilot noise | One-line reason (e.g., "Not applicable — Go 1.22+ fixed loop variable semantics") |
| Outdated | "Already addressed in \<commit\>" or "No longer applicable after \<change\>" |
| Deduplicated groups | Same reply on each comment, referencing the shared fix |

## Quiet GitHub Writes

Use `gh api --silent` for reply and resolve mutations. Print only:

```
All replies posted. Now resolving threads.
```
```
All N threads resolved.
```

## Reply API

**PR-level (issue comment) replies MUST end with the marker `<!-- resolve-pr-comments:reply -->`.** The data-gather step filters comments containing this marker on repeat runs so prior skill replies don't re-surface as fresh actionable items. Inline review comment replies don't need it — their thread is resolved, which already hides them.

```bash
# Review threads (inline) — thread resolution handles re-run dedup, no marker needed
gh api graphql --silent \
  -f query='mutation AddThreadReply($threadId: ID!, $body: String!) { addPullRequestReviewThreadReply(input: { pullRequestReviewThreadId: $threadId, body: $body }) { comment { id } } }' \
  -F threadId="$thread_id" \
  -f body="$reply_body"

# Issue comments (PR-level) — **MUST** append the marker; issue comments have no
# resolved state, so the marker is the only way to distinguish prior skill replies
# from fresh review feedback on the next run.
gh api --silent repos/{owner}/{repo}/issues/{number}/comments \
  -f body="<reply>

<!-- resolve-pr-comments:reply -->"
```

## Resolve threads

Re-fetch unresolved thread IDs for processed inline `thread_ids` (threads may have changed since Step 1). Paginate until every processed thread ID has been seen or `hasNextPage` is false:

```bash
gh api graphql --paginate -F owner='{owner}' -F repo='{repo}' -F number={number} -f query='
  query($owner: String!, $repo: String!, $number: Int!, $endCursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        reviewThreads(first: 100, after: $endCursor) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id
            isResolved
          }
        }
      }
    }
  }' \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | .id'
```

Match processed inline `thread_ids` to currently unresolved thread IDs. Resolve each matching thread ID. If a processed thread is no longer unresolved, skip it as already resolved. Do not resolve by comment ID.

```bash
gh api graphql --silent \
  -f query='mutation ResolveThread($threadId: ID!) { resolveReviewThread(input: {threadId: $threadId}) { thread { isResolved } } }' \
  -F threadId="$thread_id"
```

## Deduplicated groups

**MUST** reply to each comment individually (same reply body), resolve each thread independently. **DO NOT** skip any comment in a deduplicated group.

## PR-Level Comments

PR-level comments cannot be resolved like review threads. Post the marked reply and leave no thread-resolution mutation for them. The marker prevents the reply from resurfacing on repeat runs.
