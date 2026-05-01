# Implementation and Publish

Single source for how the agent moves from "user has decided every actionable comment" to "code is committed, replies are posted, and threads are resolved on GitHub". Read this in conjunction with `resolve-threads.md` (the `gh` API reference for reply/resolve mutations).

## Fix Plan

Before editing, show the plan:

```text
── Fix Plan ───────────────────────────────
Fix:
1. path/to/file.go - add ctx cancellation to worker loop
2. store.go - handle nil category before packing proto

Defer:
3. PR-level comment - draft follow-up issue for pagination refactor

Reply only:
4. config.go - explain why existing default matches production config
5. model.go - style nit conflicts with local convention; concise reply
```

## Implementation Order

1. Group fixes by file or behavior area.
2. Apply one group at a time.
3. Run targeted verification for that group when practical.
4. After all groups, run full applicable verification.

Verification must be concrete. Infer commands from `CLAUDE.md`/`AGENTS.md`, `Makefile`, package scripts, `go.mod`, or existing CI config. Print the chosen commands before running them.

If verification fails, stop in Step 5, report the failure, and do not proceed to publish.

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

## Publish Lanes

Choose the lane from the recorded decisions:

- **Code-fix lane**: at least one processed comment was fixed with code.
- **No-code lane**: all processed comments are `Reply only`, `Outdated`, `Auto-skipped`, or `Deferred` with no code changes.

### Code-fix lane

For code fixes, reply/resolve happens after commit and push, because fixed replies must reference a pushed commit visible on the PR. An explicit resolve/fix/publish request, plus recorded decisions for every actionable comment, authorizes the full publish lane: local review, commit, push, then close the processed threads whose replies were previewed. Broad review-only requests such as `pr review` or `review comments` require one publish confirmation before commit, push, reply, or resolve writes.

1. Show the preview.
2. Determine publish authorization:
   - If the user explicitly asked to resolve, fix, or publish PR comments, continue to the local publish checklist.
   - If the user only asked to review/analyze comments, ask once: `Commit and push fixes? This also authorizes posting the planned replies and resolving processed threads after the pushed commit is visible on the PR.` Use `AskUserQuestion` with `["Yes", "No"]` in Claude Code; in Codex, ask and stop. Continue only if confirmed.
3. Run a local publish checklist:
   - PR head still matches the local branch before committing.
   - Every processed comment has a recorded decision.
   - The staged diff is limited to implementing those decisions.
   - Relevant verification passed, or the user explicitly accepted a verification limitation earlier in the flow.
   - Only intended files are staged.
   - No new CodeRabbit review is run; this skill is already resolving existing review.
4. If the checklist passes, stage only intended files, create a descriptive commit, and push.
5. Re-fetch the PR head and processed thread IDs.
6. If there are no publish blockers, post replies and resolve processed threads automatically.
7. If a publish blocker appears, stop before reply/resolve and ask with the specific reason.

### No-code lane

If there are no code changes, there is no commit/push gate. After decisions are recorded, show the preview. If the user explicitly asked to resolve, fix, or publish PR comments, automatically post replies/resolve processed threads unless a publish blocker appears. If the user only asked to review/analyze comments, ask once before posting replies or resolving threads.

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
