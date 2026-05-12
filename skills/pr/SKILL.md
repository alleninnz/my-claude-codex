---
name: pr
description: >
  Use when the user asks to create, update, synchronize, merge, close, reopen,
  mark draft, or mark ready a pull request, or when PR title, body, branch,
  label, merge, or publish authorization conventions matter. Caruso/JasperLabs
  scoped. Not for PR review comments; use resolve-pr-comments.
---

# PR Conventions

This skill defines PR workflow conventions for Caruso/JasperLabs repos: authorization boundaries, conventions per lifecycle stage, and non-obvious gotchas. Assume normal git/gh mechanics are known.

## Authorization

A user request to create, update, synchronize, or merge a PR is explicit confirmation for the necessary scoped commit, push, PR edit, or PR merge action in that request.

A user request to close, reopen, mark draft, or mark ready a PR is explicit confirmation for that requested PR state change.

Still ask before:

- Force push.
- Pushing directly to `main` / `master`.
- Pushing to protected branches outside the PR branch.
- Staging unrelated files.
- Enabling auto-merge (off by default per Merge convention; toggle only on explicit user request).

## Conventions

### Branch

- Format: `app-XXXXX-short-description` (lowercase `app`, kebab-case). The `app-XXXXX` prefix auto-links the branch to the Linear issue.
- On PR create, if the branch doesn't match: proceed but warn once that Linear auto-link won't fire.
- Issue ID inference: args -> branch -> commit messages -> current session's explicit issue context. Do not infer from stale memory.

### Title & Body

- Title: `<ISSUE-ID> | <conventional commit subject>`, imperative, under 70 chars; omit issue prefix if no issue. `<ISSUE-ID>` is uppercase (e.g. `APP-21005`), even though the branch prefix is lowercase.
- Body: intent-focused, not detail-focused.
  - State the problem the PR solves, in 1-3 logical points.
  - Do NOT list files changed, manual test steps, or version numbers.
  - Add `Closes <ISSUE-ID>` at the bottom when an issue is known.
- Keep the body flat unless a `## Summary` heading aids reading for a multi-point change. No `## Test plan` section — change details belong in commits and automated tooling, not in a body that drifts on follow-up pushes.

### Labels

- On create, attach `agentic-dev PR` by default. Skip only when the user states the change is human-led and the agent only shaped the PR.

### Create

- Draft by default; create as ready (non-draft) only when the user explicitly says so (e.g. passes `ready` or asks for a non-draft PR).
- If a PR already exists for the current branch: report it and treat further work as update/sync, not a new PR.
- After creating a draft PR, post two separate review-trigger comments on it via `gh pr comment <pr> --body '<text>'` — one comment with body `@codex review`, another comment with body `BugBot run`. Two distinct comments, not a single combined one (each handle listens for its own standalone comment). Skip when the PR is created as ready.

### Update / Sync

- Regenerate and replace both PR title and body from the current branch state, even when an existing title is present. PR descriptions drift; treat each update as a fresh write. The regenerated title and body still follow the Title & Body conventions above — do not paste the diff.

### Merge

- Squash merge only.
- Subject: PR title as-is.
- Body: one why sentence + themed bullets (intent, not file-by-file).
- Include any existing `Closes` line; if absent and the title carries an issue ID, add `Closes <ID>`.
- Preconditions: all CI checks pass, including non-required ones. Do not skip a non-required check without human-reviewer justification.
- Auto-merge is off by default; only enable when the user explicitly asks (and confirm per Authorization).

### Close

- Never use `--delete-branch` when closing a PR.

## Gotchas

- Worktree merge cleanup: if CWD is inside a worktree, use `git worktree remove`; do not checkout base inside the worktree.
- `gh pr diff --stat` does not exist; use `gh pr view --json files`.
- `git branch -d` can fail after squash merge; use `-D` only when the PR is confirmed merged.
- CODEOWNERS auto-assigns reviewers — do NOT manually `--reviewer` on create unless the user names a specific reviewer. Manual assignment can break round-robin distribution within the owning team.
