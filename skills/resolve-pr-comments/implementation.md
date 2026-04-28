# Implementation and Publish Protocol

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

Skip:
5. model.go - style nit conflicts with local convention
```

## Implementation Order

1. Group fixes by file or behavior area.
2. Apply one group at a time.
3. Run targeted verification for that group when practical.
4. After all groups, run full applicable verification.

Verification must be concrete. Infer commands from `CLAUDE.md`/`AGENTS.md`, `Makefile`, package scripts, `go.mod`, or existing CI config. Print the chosen commands before running them.

If verification fails, stop in Step 5, report the failure, and do not proceed to publish.

## Preview and Publish

Before publishing, show:

- `git diff --stat`
- focused diff summaries for changed files
- verification commands and results
- replies that will be posted
- threads/comments that will be resolved
- deferred follow-up drafts, if any

### Publish lanes

Choose the lane from the recorded decisions:

- **Code-fix lane**: at least one processed comment was fixed with code.
- **No-code lane**: all processed comments are `Reply only`, `Skip`, `Outdated`, `Auto-skipped`, or `Deferred` with no code changes.

#### Code-fix lane

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

#### No-code lane

If there are no code changes, there is no commit/push gate. After decisions are recorded, show the preview. If the user explicitly asked to resolve, fix, or publish PR comments, automatically post replies/resolve processed threads unless a publish blocker appears. If the user only asked to review/analyze comments, ask once before posting replies or resolving threads.

### Publish blockers

Do not ask just to reply and resolve processed threads. Ask only when a concrete publish blocker appears:

- a processed comment does not have a recorded decision (`Fixed`, `Deferred`, `Reply only`, `Skip`, `Outdated`, or `Auto-skipped`);
- in the code-fix lane, the fix commit is not committed, not pushed, unknown, or not included in the PR head;
- the staged diff includes new feature work or unrelated cleanup beyond the processed review-comment decisions;
- required verification failed, or an unaccepted verification limitation remains;
- a planned reply is no longer factual/mechanical after re-fetching PR state;
- a deferred reply would claim a follow-up issue exists when it was not actually created;
- a skip/reply-only decision is controversial, low-confidence, or came from a human reviewer and was not explicitly accepted;
- re-fetching threads shows the target thread changed in a way that makes the planned reply stale;
- GitHub API writes partially fail and retrying could duplicate replies.

If there are no publish blockers, print a short status and proceed:

```text
Publish authorized and no blockers found. Posting replies and resolving processed threads now.
```

Example: a reviewer asks to reword an error string, the code is fixed, tests pass, the local publish checklist passes, the commit is pushed, and the planned reply is "Fixed in <commit> by rephrasing the error while keeping the wrapped error intact." If the pushed commit is visible on the PR and the thread still matches the processed comment, post the reply and resolve the thread without another user confirmation.

When asking, include the reason:

> A publish blocker appeared: <reason>. Post replies and resolve processed threads anyway?

Use `AskUserQuestion` with `["Yes", "No"]` in Claude Code. In Codex, ask and stop.

## Publish

Always read `resolve-threads.md` before GitHub writes. Post replies before resolving threads. Resolve only threads processed in this run. If publish confirmation or publish-blocker approval is required and not granted, do not commit, push, post replies, or resolve threads for the blocked lane.
