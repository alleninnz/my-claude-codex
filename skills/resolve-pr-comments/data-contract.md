# Review Data Contract

`scripts/fetch-comments.py` returns raw, thread-aware GitHub PR data. The main skill classifies this data; the script does not decide what to fix.

## Top-Level Shape

```json
{
  "schema_version": 1,
  "source": "resolve-pr-comments/scripts/fetch-comments.py",
  "pull_request": {},
  "conversation_comments": [],
  "reviews": [],
  "review_threads": []
}
```

## Pull Request

- `owner`, `repo`, `number`, `url`, `title`, `state`
- `author`: PR author login
- `base_ref`: base branch name
- `head_sha`: current PR head SHA
- `updated_at`: PR update timestamp

## Conversation Comments

These are PR-level comments. They have no GitHub resolved state.

- `id`: REST database ID
- `node_id`: GraphQL node ID
- `type`: `pr_level`
- `body`, `created_at`, `updated_at`
- `author`, `author_association`
- `positive_reactions`: users who left `THUMBS_UP`, `HOORAY`, or `ROCKET`

Treat PR-level comments containing `<!-- resolve-pr-comments:reply -->` as prior skill replies and drop them before classification.

## Review Threads

These are inline review threads.

- `thread_id`: GraphQL review thread ID
- `is_resolved`: GitHub thread resolved state
- `is_outdated`: GitHub thread outdated state
- `path`, `line`, `start_line`, `original_line`, `original_start_line`
- `comments[]`: thread comments fetched by the script, each with `id`, `node_id`, `body`, `author`, timestamps, and `author_association`

Only unresolved threads are actionable by default. Outdated unresolved threads should be shown in the triage summary, not queued as fresh fixes unless the current code still has the issue.

## Reviews

Review submissions can contain top-level requested-change text.

- `state`: `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, etc.
- `body`, `submitted_at`, `author`

Use review bodies as context. If a review body contains a concrete change request that is not represented by a thread or PR-level comment, include it as a PR-level actionable item.

## Classification Output

After reading this raw data, produce:

- `outdated[]`
- `copilot_triage[]`
- `nitpick_triage[]`
- `critical_major[]`
- `medium_low[]`
- `reply_only[]`
- `deferred[]`
- `thread_map[]`

Each actionable item must include: `ids`, `source_type`, `reviewer`, `signal_quality`, `severity`, `location`, `summary`, `problem`, `wants`, `evidence`, `confidence`, `recommendation`, `reason`, `original`, and PR-level `signals` when applicable.

`nitpick_triage[]` is for automated reviewer comments explicitly labeled `Nitpick`. These comments are ignored and not processed. Do not include them in `thread_map[]`; do not reply to or resolve their threads.

Inline actionable items must also include `thread_ids`: every review thread ID represented by the item or deduplicated group. Thread resolution uses these IDs directly; do not resolve inline comments by matching comment IDs.

Medium/Low compact cards and any `Skip` or `Defer` recommendation must include `risk_if_skipped`.

`thread_map[]` tracks inline items that may need replies or resolution. Each entry should include `item_id`, `thread_ids`, `comment_ids`, `category`, and planned reply intent after user decisions are recorded.

Presentation buckets are severity-first. A Critical/Major item with a `Reply only`, `Defer`, `Skip`, or downgraded-severity recommendation must remain in `critical_major[]`; the recommendation does not move it to `reply_only[]`, `deferred[]`, or `medium_low[]`.
