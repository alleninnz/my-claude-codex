# Review Interaction

Use clear, direct language. Keep sentences short. Lead with the decision-relevant point.

## Language Rules

Write like an engineer explaining a PR review decision, not like a reviewer, marketer, or policy document.

### Style

- Use short, direct sentences.
- Put the conclusion first.
- One sentence should carry one idea.
- Prefer concrete nouns and verbs over abstractions.
- Name the exact function, field, query, branch, test, or config.
- Use "This breaks because...", "This is safe because...", or "I would skip this because..." when helpful.
- If disagreeing, say so directly and explain the code evidence.

### Field Duties

- **Problem:** what can go wrong in the current code if the bot is right. One sentence.
- **Wants:** what the reviewer is asking to change. One sentence.
- **Code evidence:** the concrete artifact in current code that confirms or refutes the bot's claim. For positive inline claims, a `file:line` plus quoted excerpt. For negative or cross-file claims (missing tests, schema compatibility, migration ordering, ownership), a grep/diff/test result that proves or disproves the concern. For ownership/process questions that cannot be answered within this repo, write `"no concrete evidence available; bot's claim is about <category>"`. Not a paraphrase of reviewer text. Not a summary.
- **Reason:** one sentence. Must reference the Code evidence concretely.

### Avoid

- Reviewer echo: "Consider adding...", "It is recommended that...", "Potential issue with..."
- Empty hedging: "may", "could potentially", "might be beneficial"
- Vague nouns: "thing", "logic", "handling", "issue", "scenario" without naming the concrete code
- Soft filler: "It is important to note", "Worth mentioning", "In this case"
- Fake balance: "While X is true, Y is also important" unless there is a real tradeoff
- Long chained sentences with multiple claims

### Before / After

Bad:
> This could potentially cause issues in certain scenarios, so it might be beneficial to consider adding cancellation handling.

Good:
> This worker ignores `ctx.Done()`. If the request times out, the goroutine can keep waiting after the handler returns.

Bad:
> The reviewer suggests improving error handling around the database operation.

Good:
> `CreateInvestor` drops the `Insert` error. The API can return success even when the row was not written.

## Critical/Major Cards

Render each item verbatim against this template. Do not add, remove, or rename fields. Specifically, do not add Anchor, Author, Issue, or File rows — the header carries reviewer (`[coderabbit]`) and severity (`[Major]`); `Path:` carries file:line.

When multiple reviewers raise the same deduplicated issue, list all of them inside the bracket, alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). Do not pick one reviewer and hide the rest. Synthesize all reviewer angles in `Wants`.

```text
── 1/N ── [Major] ── [coderabbit] ──────────
Path: path/to/file.go:42

Problem: <one sentence — what can go wrong if the bot is right>
Wants: <one sentence — what the reviewer asks the author to change>

Code evidence: <one of:
  - "<file:line>: `<quoted code>`" (positive inline claim)
  - "<grep/diff/test result>" (negative or cross-file claim)
  - "no concrete evidence available; bot's claim is about
     <absence | cross-file | ownership | process | PR-level>">

Confidence: High | Medium | Low
Recommendation: Fix | Defer | Reply only | Needs your decision
Reason: <one sentence; must reference Code evidence concretely>

<details><summary>Original comment</summary>...</details>
```

Present exactly one item, ask for a `Fix` / `Defer` / `Reply only` decision, and stop. Never batch. `Needs your decision` is a recommendation signal, not a recordable decision — the user must convert it into one of the three terminal actions before the next item.

For PR-level comments, include a `Signals:` block before `Problem` listing `acknowledged_by`, `author_followups`, and `pr_updated_since_comment`.

For grouped comments (multiple reviewers raising the same issue), synthesize all reviewer angles in `Wants`. Fill `Code evidence` once for the group. Do not pick one comment and hide the rest.

## Medium/Low Pages

Use compact cards by default, 5 items per page with global numbering. Render each item verbatim against this template. Do not add, remove, or rename fields. Specifically, do not add Anchor, Author, Issue, or File rows — the header line carries reviewer and severity; the `file:line` is part of the header.

When multiple reviewers raise the same deduplicated issue, list all of them inside the bracket, alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). Do not pick one reviewer and hide the rest.

Medium/Low cards still require `Code evidence` for any `Fix` recommendation. Promote via `review N` to trigger the full Critical/Major presentation flow and one-at-a-time decision.

```text
── Medium/Low (13 comments) - Page 1/3 ──────────

#1 [Medium] [coderabbit] path/to/file.go:88 - Fix
Problem: handler ignores request cancellation.
Wants: stop the worker when the request context is cancelled.
Code evidence: file.go:88 — `select { case w := <-work: ... case r := <-results: ... }` has no `ctx.Done()` branch.
Recommendation: Fix.
Risk if skipped: timed-out requests can leave work running.

#2 [Low] [coderabbit] path/to/model.go:33 - Reply only
Problem: reviewer wants an unused option removed.
Wants: delete the option from this handler.
Code evidence: model.go:33 — option declared, never referenced in this file. Adjacent handlers keep the same unused option for interface symmetry (peer files: model_a.go:41, model_b.go:55).
Recommendation: Reply only.
Risk if skipped: low; preserves repo convention.

#4 [Medium] [coderabbit] path/to/migration.sql:None - Review
Problem: reviewer asks whether this migration is safe under concurrent writes.
Wants: confirmation or a plan.
Code evidence: no concrete evidence available; bot's claim is about cross-system process (production traffic + lock timing).
Recommendation: Review.
Risk if skipped: unknown; cannot verify within this repo.

Defaults:
Fix: #1
Reply only: #2, #3 (concrete code evidence shows mismatch)
Review: #4, #5 (no concrete evidence; NOT accepted by `ok all`)

Reply with: ok, ok all, fix 2, defer 3, reply 4, review 5, why 2
```

The agent picks the default `Recommendation` per the rule in `analyzing.md`:

- `Fix` — Code evidence has a concrete `file:line` + quote (or grep/diff/test artifact) that confirms a real bug.
- `Reply only` — Code evidence shows the bot's specific claim does not match current code (stale inline, line moved, already fixed).
- `Review` — Code evidence is `"no concrete evidence available; bot's claim is about <category>"`. The item cannot be confirmed or denied within this repo. **`Review`-default items are NOT accepted by `ok all`** — the user must explicitly run `review N` to promote into Critical/Major flow, or directly type `fix N` / `defer N` / `reply N`.

This guards against silent skip: medium/low items the agent could not actually verify cannot be batch-resolved by a hurried `ok all`.

## Commands

| Input | Behavior |
| --- | --- |
| `ok` or `done` | Confirm current page `Fix` and `Reply only` defaults. `Review`-default items are NOT confirmed; user must address them explicitly. |
| `ok all` | Same as `ok` but applies to current and all remaining Medium/Low pages. `Review`-default items are still NOT confirmed and stop the page until handled. |
| `fix N`, `fix 1,3`, `fix 1-4` | Queue fixes. |
| `defer N` | Queue follow-up/tracking reply. |
| `reply N`, `reply 1,3`, `reply 1-4` | Queue reply-only (no code change). |
| `review N`, `review all` | Promote to deep analysis one at a time using Critical/Major choices. |
| `why N` | Explain the recommendation without changing the decision. |

Users can combine commands, e.g. `fix 1, defer 2, review 4`.
