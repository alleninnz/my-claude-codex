# Git Workflow

## Commit Message Format

[Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

<optional body>
```

- **Types**: `feat`, `fix`, `docs`, `chore`, `refactor`, `perf`, `test`, `ci`, `build`, `style`
- **Scope**: optional but encouraged (e.g., `feat(auth): add token refresh`)
- **Breaking changes**: `feat!: description` or `BREAKING CHANGE:` in body
- Lowercase imperative mood (e.g., "add feature" not "Added feature")

## Pull Request Workflow

When creating PRs:
1. Analyze full commit history (not just latest commit)
2. Use `git diff [base-branch]...HEAD` to see all changes
3. Draft comprehensive PR summary
4. Include test plan with TODOs
5. Push with `-u` flag if new branch

> For the full development process (planning, TDD, code review) before git operations,
> see [development-workflow.md](./development-workflow.md).
