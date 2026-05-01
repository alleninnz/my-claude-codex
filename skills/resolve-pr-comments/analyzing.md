# Analyzing Review Comments

Single source for how the agent reads PR data, classifies it, decides severity, deduplicates, and recommends an action. Read this in conjunction with `presenting.md` (which owns rendering) and `publishing.md` (which owns commit/push/reply).

## Required Inputs

Before presenting, gather:

1. Focused diff for the file:
   ```bash
   git diff $(gh pr view --json baseRefName -q .baseRefName)...HEAD -- path/to/file
   ```
2. Function or method containing the flagged line.
3. Surrounding repo conventions: nearby code, tests, `CLAUDE.md`/`AGENTS.md`, linter config.
4. For PR-level comments or review bodies: PR description, changed-file summary, and related diff hunks.

If a file moved or disappeared, check rename history before deciding the comment is stale.

For PR-level comments and review bodies, also gather PR-level signals to attach to the actionable item:

- `acknowledged_by`: positive reactions from the original reviewer or PR author.
- `author_followups`: later PR-author comments that mention the reviewer or quote the original.
- `pr_updated_since_comment`: whether PR `updated_at` is later than the comment timestamp.

Never auto-skip from these signals alone. Show them to the user.

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

`nitpick_triage[]` items need only `ids`, `reviewer`, `location`, `summary`, and `original` fields. They are ignored, not processed; do not include them in `thread_map[]`; do not reply to or resolve their threads.

## Severity

Use concrete triggers, then verify against code.

| Severity | Triggers | Anti-triggers |
| --- | --- | --- |
| Critical | security leak, SQL injection, auth bypass, data loss, panic/crash on normal input, race condition corrupting state | style, naming, optional refactor, unclear wording |
| Major | missing error handling that breaks flow, API contract violation, wrong query semantics, real performance regression, migration/deploy risk, goroutine/resource leak | "consider extracting", "might be confusing", cosmetic cleanup |
| Medium | edge case with bounded impact, missing test for changed behavior, readability issue that affects maintenance, non-blocking performance concern | pure preference, local naming nit |
| Low | formatting, naming, comment wording, minor simplification, clearly optional cleanup | human-requested behavior change, correctness risk |

Human comments default to at least Medium unless they are clearly style-only. Bot comments can be Low. Copilot comments can be skipped only after checking the referenced code.

Reviewer-labeled Critical/Major/High/P0/P1 comments start in `critical_major[]` unless they are resolved, outdated, or pure bot noise. If current-code analysis later downgrades the severity, keep the item in the Critical/Major presentation flow and show the downgraded severity in the card.

After reading code, upgrade or downgrade severity per these definitions:

- Critical: security, data loss, normal-input panic/crash, state-corrupting race.
- Major: real correctness bug, missing error handling, API contract break, deploy/migration risk, resource leak.
- Medium: bounded edge case, missing test for changed behavior, maintenance readability concern.
- Low: naming, formatting, comment wording, optional simplification.

If a Critical/Major item downgrades below Major during deep analysis, still present it in the current Critical/Major flow. Show the downgraded severity in the card and ask for the user decision before moving on. Do not silently move it to Medium/Low after Critical/Major review has started.

A Critical/Major item with a `Reply only`, `Defer`, `Needs your decision`, or downgraded-severity recommendation must remain in `critical_major[]`; the recommendation does not move it to `reply_only[]`, `deferred[]`, or `medium_low[]`.

## Deduplication Rules

Only merge comments when all are true:

- Same file or same PR-level topic.
- Locations are adjacent enough to be part of the same code path, or the comments mention the same function/type/API.
- The requested action category matches: add, remove, rename, refactor, test, validate, document, or reply.
- At least two meaningful keywords overlap in Problem/Wants, ignoring stop words and generic words like "code", "issue", "change".

Do not merge comments just because they are close together. If reviewers point at adjacent lines but ask for different actions, keep them separate.

When dedup merges multiple reviewers into one item, render the header in `presenting.md` with all reviewers alphabetically ordered, separated by `/` (e.g., `[coderabbit/cursor]`). See `presenting.md` for the full header rule.

## Analysis Taxonomy

Classify the reviewer's concern before recommending:

| Type | Meaning | Usual recommendation |
| --- | --- | --- |
| Valid bug | Current behavior can break, corrupt data, leak, panic, or violate a contract. | Fix |
| Missing proof | Code may be fine, but tests or verification are missing for changed behavior. | Fix or Defer |
| Needs decision | Product/API/backward-compatibility tradeoff, or refutation cannot be confirmed within this repo. | Defer, Reply only, or Needs your decision |
| Convention mismatch | Reviewer asks for something that conflicts with repo patterns. | Reply only |
| Already covered | Existing guard/test/implementation handles the concern. | Reply only |
| Stale | Diff moved or current code no longer has the issue. | Reply only |
| Noise | Style nit or incorrect bot claim with no practical value. | Reply only (concise) |

## The One Rule

`Fix` requires concrete code evidence: a `file:line` quote, a grep/diff result, or a test artifact that confirms the bot's claim in current code. Without that, `Fix` is not allowed — pick `Defer`, `Reply only`, or `Needs your decision` based on your judgment of the case:

- `Defer` — the concern is real but tracked separately (must actually create the follow-up issue / draft).
- `Reply only` — the bot's specific claim does not match current code (stale inline claim that's been fixed/moved) AND the reply will explain that.
- `Needs your decision` — you cannot verify the claim within this repo, the case is ambiguous, or it's a cross-service/ownership/process question that the user must resolve.

Do not invent code evidence to justify `Fix`. If you echoed reviewer text without checking current code, the `Code evidence` field will be empty or paraphrased — that is a signal to pick something other than `Fix`.

For Medium/Low compact cards, the same rule applies: `Fix` requires `Code evidence` with a concrete artifact. The user can promote any Medium/Low item via `review N` to trigger the full Critical/Major presentation flow and one-at-a-time decision.

## Recommendations

| Recommendation | Use when |
| --- | --- |
| Fix | A code/test/docs change belongs in this PR. Requires concrete `Code evidence` (file:line + quote, or grep/diff/test artifact). |
| Defer | The concern is valid but should be tracked separately. Requires `Code evidence` that demonstrates the concern is real. Prepare a follow-up issue draft; do not claim it exists unless created. |
| Reply only | The bot's specific claim does not match current code — typically a stale inline claim where the line moved or was already fixed. The reply explains the mismatch. Requires `Code evidence` that shows the mismatch (e.g., the current state of the line the bot referenced). |
| Needs your decision | Cannot verify the bot's claim within this repo. Triggered by: cross-service ownership questions, PR-description-vs-code conflicts, missing-proof concerns that span systems, or any case where domain context the agent lacks would change the answer. `Code evidence` is `"no concrete evidence available; bot's claim is about <category>"`. |

`Fix` requires concrete code evidence. If you have not located that evidence, do not pick `Fix` — pick `Defer`, `Reply only`, or `Needs your decision` based on the case. Echoing reviewer text without verifying current code is the failure mode this skill exists to prevent.
