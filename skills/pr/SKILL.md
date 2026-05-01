---
name: pr
description: >
  Use when the user asks to create, update, synchronize, merge, close, reopen,
  mark draft, or mark ready a pull request, or when PR title, body, merge, or
  publish authorization conventions matter. Not for PR review comments; use
  resolve-pr-comments.
---

# PR Conventions

This skill defines PR workflow conventions, authorization boundaries, and non-obvious gotchas. Assume normal git/gh mechanics are known.

## Authorization

A user request to create, update, synchronize, or merge a PR is explicit confirmation for the necessary scoped commit, push, PR edit, or PR merge action in that request.

A user request to close, reopen, mark draft, or mark ready a PR is explicit confirmation for that requested PR state change.

Still ask before:

- Force push.
- Pushing directly to `main` / `master`.
- Pushing to protected branches outside the PR branch.
- Staging unrelated files.

## Conventions

- Title: `<ISSUE-ID> | <conventional commit subject>`, imperative, under 70 chars; omit issue prefix if none.
- Issue ID inference: args -> branch -> commit messages -> current session's explicit issue context. Do not infer from stale memory.
- Create: draft by default; only create ready when user passes `ready`.
- Update: regenerate and update both PR title and body from the current branch diff, even when an existing title is present.
- Body: 1-3 reviewer-focused bullets for small changes; otherwise `## Summary` + `## Test plan`.
- Merge: squash only; subject is PR title as-is; body is one why sentence + themed bullets, not file-by-file.
- Merge body: include existing `Closes` line; if absent and title has issue ID, add `Closes <ID>`.

## Gotchas

- Worktree merge cleanup: if CWD is inside a worktree, use `git worktree remove`; do not checkout base inside the worktree.
- `gh pr diff --stat` does not exist; use `gh pr view --json files`.
- `git branch -d` can fail after squash merge; use `-D` only when PR is confirmed merged.
- Repeating PR creation on an existing PR should report the existing PR and treat further work as PR update/synchronization, not create another PR.
- Never use `--delete-branch` when closing a PR.
