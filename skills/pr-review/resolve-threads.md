# Reply and Resolve Threads — API Reference

## Reply rules

**Every thread MUST receive a reply before resolving.** Never resolve silently.

| Category | Reply content |
|----------|---------------|
| Fixed (Step 3 or rescued Step 4) | "Fixed in \<commit\>. \<brief explanation\>" |
| Explicitly skipped (Step 3 or rescued Step 4) | Concise technical reason (e.g., "Follows existing codebase convention") |
| Auto-skipped Medium/Low | One-line reason (e.g., "Style preference — not addressing in this PR") |
| Auto-skipped Copilot noise | One-line reason (e.g., "Not applicable — Go 1.22+ fixed loop variable semantics") |
| Outdated | "Already addressed in \<commit\>" or "No longer applicable after \<change\>" |
| Deduplicated groups | Same reply on each comment, referencing the shared fix |

## Output noise suppression

All `gh api` calls redirect to `/dev/null`. Print only:

```
All replies posted. Now resolving threads.
```
```
All N threads resolved.
```

## Reply API

```bash
# Review comments (inline)
gh api repos/{owner}/{repo}/pulls/{number}/comments/{id}/replies \
  -f body="<reply>" > /dev/null

# Issue comments (PR-level)
gh api repos/{owner}/{repo}/issues/{number}/comments \
  -f body="<reply>" > /dev/null
```

## Resolve threads

Re-fetch unresolved thread IDs (threads may have changed since Step 1):

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
  }' --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | {threadId: .id, commentId: .comments.nodes[0].databaseId}'
```

Match thread comment IDs to those processed in this run. Resolve each:

```bash
gh api graphql -f query='mutation { resolveReviewThread(input: {threadId: "<threadId>"}) { thread { isResolved } } }' > /dev/null
```

## Deduplicated groups

Reply to each comment individually (same reply body), resolve each thread independently.
