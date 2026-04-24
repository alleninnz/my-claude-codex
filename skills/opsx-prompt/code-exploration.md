# Deep Review

Run this only as an optional follow-up after the main prompt already exists.

Precondition: only dispatch this review when a real `{REPO_PATH}` is available.

Goal:

- look for important considerations the ticket may have omitted
- highlight possible contract risk
- point out work that may already be done

This pass is user-facing only by default. It does not redefine the prompt automatically.

## When To Use

Use deep review only when:

- the user asks for extra confidence
- the change looks broad or risky
- the ticket is thin and the user wants a second look before running `opsx:new`

Do not use deep review as the default path.

## Prompt Template

Fill in `{REPO_PATH}`, `{INTENT_SUMMARY}`, and `{RAW_CLAIMS}` before dispatching.

```
Review the codebase at {REPO_PATH} for considerations related to this change.

## Current intent

{INTENT_SUMMARY}

## Raw claims

{RAW_CLAIMS}

This is a follow-up review, not the main prompt-generation step.

Do:
- look for likely missing considerations that materially affect the requested outcome
- flag likely contract or rollout risk
- identify prerequisite work that appears already landed

Do NOT:
- rewrite the main intent unless it is obviously false
- expand scope by default
- produce implementation plans
- report nice-to-have cleanup

## Output

Return exactly this structure:

Summary:
  <1-2 sentences on whether the current prompt still looks aligned>

Possible missing considerations:
  - <domain-level note> -- Evidence: <file:line or brief code reference>

Possible contract risks:
  - <domain-level note> -- Evidence: <file:line or brief code reference>

Possible already-completed work:
  - <domain-level note> -- Evidence: <PR, file:line, or brief reference>

Clarification needed:
  - <only if the ticket premise appears materially false after review>

If a section has no items, write `(none)`.
```

## Parsing

- `Summary` helps the user judge whether the prompt is already good enough
- `Possible missing considerations` stay outside the prompt unless the user asks to revise it
- `Possible contract risks` are warnings, not automatic prompt content
- `Possible already-completed work` is a candidate for `Already in place`, but do not merge it into the prompt automatically; revise the prompt only if the user asks to incorporate it
- `Clarification needed` means stop and ask the user before folding anything into the prompt
