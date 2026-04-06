---
name: pr
description: Use when creating or updating pull requests — generates accurate titles and descriptions from the diff. Also covers PR state changes (draft, ready, close, reopen, merge).
---

# Pull Request

Smart PR creation and updates with diff-based description generation.

## create — Create a new PR (always draft)

1. Determine base branch: repo default (usually `main`), or user-specified
2. Infer issue ID (check in order, stop at first match):
   - User's arguments (e.g. `/pr create APP-21395`)
   - Branch name (e.g. `feat/app-21395-...` → `APP-21395`)
   - Commit messages (e.g. `APP-21395 | ...` or `(APP-21395)`)
   - Recent conversation context (e.g. a Linear issue just discussed)
   - If no issue ID found, proceed without one (omit issue prefix from title)
3. Get diff: `git diff $(git merge-base HEAD <base>)..HEAD`
4. Generate title: `<ISSUE-ID> | <conventional-commit style>`, imperative mood, under 70 chars
5. Generate body (adaptive):
   - Small diff (<100 changed lines): 1-3 bullet summary
   - Larger diff: `## Summary` (3-5 bullets) + `## Test plan` (checklist)
   - Include `Closes <ISSUE-ID>` before the footer
   - Footer: `Generated with [Claude Code](https://claude.com/claude-code)`
6. Create: `gh pr create --draft --title "<title>" --body "<body>"`

## update — Sync changes and update PR description

1. Check working tree (`git status --porcelain`) and push status (ahead/behind remote)
2. If uncommitted changes:
   a. Stage modified and new files relevant to the PR (not unrelated files or secrets)
   b. Generate a conventional-commit message from the staged diff (match the repo's recent commit style via `git log --oneline -5`)
   c. Commit and push
3. Else if unpushed commits exist: push
4. Get base branch: `gh pr view --json baseRefName -q .baseRefName`
5. Get diff: `git diff $(git merge-base HEAD <base>)..HEAD`
6. If new commits were pushed (step 2 or 3): regenerate body using the same adaptive format as create, then `gh pr edit --body "<body>"`
7. If no new commits (clean tree, up to date with remote): skip description update — inform user the PR is already in sync
8. Title is preserved unless the user explicitly asks to change it

## merge — Squash merge with extended description and clean up branches

1. Get PR metadata: `gh pr view --json title,body,baseRefName`
2. Gather context (run in parallel, using base branch from step 1):
   - `git log --oneline $(git merge-base HEAD <base>)..HEAD`
   - `git diff $(git merge-base HEAD <base>)..HEAD`
3. Generate squash commit message:
   - **Subject**: PR title as-is (preserve issue ID and conventional-commit style)
   - **Body**: Generate an extended description from the diff and commit history:
     - One-sentence summary of the change's purpose (the "why")
     - Bulleted list of notable changes grouped by theme (not file-by-file — describe what changed functionally)
     - Omit trivial changes (import reordering, formatting) — only include what a reviewer would care about in `git log`
     - If the PR body contains a `Closes` line, include it at the end
4. Merge: `gh pr merge --squash --subject "<subject>" --body "<body>"`
5. Switch and update: `git checkout <base> && git pull`
6. Delete local branch: `git branch -d <merged-branch>`
7. Prune stale remote refs: `git fetch --prune`
8. If merge fails (checks, conflicts): report error and stop — do not clean up
9. If branch cleanup fails after successful merge: warn but don't error

## State Changes

- All state changes (`merge`, `close`, `reopen`, `open`, `draft`) proceed without confirmation
- Never use `--delete-branch` with close

## Common Mistakes

- `gh pr diff --stat` does not exist — use `gh pr view --json files` for change stats
- `gh pr create` without `--draft` — always create as draft
