# PR Review Data Gathering

Use deterministic data fetch first, then let the agent classify. Do not hand-roll GitHub API calls unless the script is unavailable.

## Default Fetch

Run from the repository checkout:

```bash
python3 <resolve-pr-comments-skill-dir>/scripts/fetch-comments.py
```

For an explicit PR:

```bash
python3 <resolve-pr-comments-skill-dir>/scripts/fetch-comments.py --repo OWNER/REPO --pr 123
python3 <resolve-pr-comments-skill-dir>/scripts/fetch-comments.py --url https://github.com/OWNER/REPO/pull/123
```

The script fetches PR metadata first, checks local HEAD against the PR head when running inside a git checkout, then fetches PR-level comments, review submissions, and review threads through independent paginated GraphQL queries in parallel. This replaces the old serial REST fetch flow. Do not add ad hoc REST calls unless profiling shows the script is the bottleneck.

See `data-contract.md` for the JSON shape.

## Fallback Fetch

If the script cannot run, use `gh api graphql` directly. Fetch these independent data groups in parallel when the agent environment supports parallel tool calls:

- PR metadata
- review threads with `isResolved`, `isOutdated`, path, line, and thread comments
- PR-level conversation comments
- review submissions

Use `gh` only. Do not use GitHub MCP tools for thread-aware review data.

## Glossary

- **Inline comment**: a comment inside a GitHub review thread. It has `thread_id`, `is_resolved`, and `is_outdated`.
- **PR-level comment**: a conversation comment on the PR. It has no resolved state.
- **Review body**: the top-level body of a submitted review.
- **Actionable comment**: feedback that maps to `Fix`, `Defer`, `Reply only`, or `Skip`.
- **Reply-only**: no code change needed, but a GitHub reply should explain the decision.

## Reviewer Signal Matrix

| Reviewer | Signal quality | Handling |
| --- | --- | --- |
| Human | Highest priority | Never auto-skip. If ambiguous, present it with `Reply only` or `Defer`. |
| CodeRabbit | High signal, non-trivial false positives | Treat as a credible hypothesis; require current-code evidence before `Fix`. |
| Codex | High signal, non-trivial false positives | Treat as a credible hypothesis; verify against diff, surrounding code, tests, and repo conventions before `Fix`. |
| Cursor | Medium signal | Verify carefully; useful but often context-thin. |
| Copilot | Low/variable signal | Triage before presentation; auto-skip only clear noise after code check. |
| Unknown bot | Low signal | Require concrete evidence before queuing any fix. |

Signal quality affects review order and scrutiny, not the final decision. Never recommend `Fix` only because the reviewer has high signal. A `Fix` recommendation requires current-code evidence plus an impact explanation.

## Classification Rules

1. Drop resolved inline threads.
2. Put unresolved `is_outdated: true` inline threads in `outdated[]` unless current code still clearly contains the issue.
3. Drop PR-level comments containing `<!-- resolve-pr-comments:reply -->`; these are prior skill replies.
4. Put automated reviewer comments explicitly labeled `Nitpick` in `nitpick_triage[]`; do not analyze, present, reply, resolve, or include them in `thread_map[]`.
5. Drop PR-author status updates from actionable candidates. Use them only as staleness or discussion signals.
6. Classify remaining PR-level comments and review bodies into bot noise, conversational, or actionable.
7. Classify active inline threads into actionable candidates.

When in doubt, include. Over-including is recoverable in review; dropping substantive human feedback is invisible.

## PR-Level Staleness Signals

For each actionable PR-level comment, attach:

- `acknowledged_by`: positive reactions from the original reviewer or PR author.
- `author_followups`: later PR-author comments that mention the reviewer or quote the original.
- `pr_updated_since_comment`: whether PR `updated_at` is later than the comment timestamp.

Never auto-skip from these signals alone. Show them to the user.

## Severity Rules

Use concrete triggers, then verify against code.

| Severity | Triggers | Anti-triggers |
| --- | --- | --- |
| Critical | security leak, SQL injection, auth bypass, data loss, panic/crash on normal input, race condition corrupting state | style, naming, optional refactor, unclear wording |
| Major | missing error handling that breaks flow, API contract violation, wrong query semantics, real performance regression, migration/deploy risk, goroutine/resource leak | "consider extracting", "might be confusing", cosmetic cleanup |
| Medium | edge case with bounded impact, missing test for changed behavior, readability issue that affects maintenance, non-blocking performance concern | pure preference, local naming nit |
| Low | formatting, naming, comment wording, minor simplification, clearly optional cleanup | human-requested behavior change, correctness risk |

Human comments default to at least Medium unless they are clearly style-only. Bot comments can be Low. Copilot comments can be skipped only after checking the referenced code.

Reviewer-labeled Critical/Major/High/P0/P1 comments start in `critical_major[]` unless they are resolved, outdated, or pure bot noise. If current-code analysis later downgrades the severity, keep the item in the Critical/Major presentation flow and show the downgraded severity in the card.

## Deduplication Rules

Only merge comments when all are true:

- Same file or same PR-level topic.
- Locations are adjacent enough to be part of the same code path, or the comments mention the same function/type/API.
- The requested action category matches: add, remove, rename, refactor, test, validate, document, or reply.
- At least two meaningful keywords overlap in Problem/Wants, ignoring stop words and generic words like "code", "issue", "change".

Do not merge comments just because they are close together. If reviewers point at adjacent lines but ask for different actions, keep them separate.

## Output

Return structured data with:

- `pr`
- `outdated[]`
- `copilot_triage[]`
- `nitpick_triage[]`
- `critical_major[]`
- `medium_low[]`
- `reply_only[]`
- `deferred[]`
- `thread_map[]`

Each actionable item must include:

- `ids`: all comment IDs in the group
- `thread_ids`: inline items only; all review thread IDs represented by the group
- `source_type`: inline, pr_level, or review_body
- `reviewer`: login and human/bot label
- `signal_quality`: from the matrix
- `severity`
- `location`
- `summary`
- `problem`
- `wants`
- `evidence`
- `confidence`: High, Medium, or Low
- `recommendation`: Fix, Defer, Reply only, or Skip
- `reason`: short rationale for the recommendation
- `risk_if_skipped`: required for Medium/Low compact cards and any `Skip` or `Defer` recommendation
- `original`: raw reviewer text
- `signals`: PR-level staleness signals when applicable

`nitpick_triage[]` items need only `ids`, `reviewer`, `location`, `summary`, and `original`. They are ignored, not processed; do not add them to `thread_map[]`.

`thread_map[]` should map inline items to `thread_ids`, `comment_ids`, category, and planned reply intent so Step 6 can post replies and resolve only processed threads.

Presentation buckets are severity-first. A Critical/Major item with a `Reply only`, `Defer`, `Skip`, or downgraded-severity recommendation must remain in `critical_major[]`; the recommendation does not move it to `reply_only[]`, `deferred[]`, or `medium_low[]`.
