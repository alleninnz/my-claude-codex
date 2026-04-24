# Light Sanity Check

Run this internal pass only when the ticket names concrete symbols, declares a hard boundary, or looks likely to be pointing at the wrong target.

Precondition: only dispatch this check when a real `{REPO_PATH}` is available. If repo context cannot be resolved, do not dispatch this pass; return to the caller and surface a `Sanity check skipped: repo unavailable` note instead.

Goal:

- catch obvious wrong-target references
- catch obvious contradictions
- keep the generated prompt from encoding a false premise

This is not a discovery pass. Do not hunt for missed functionality, adjacent work, or broad rollout concerns.

## When To Use

Use this check only when the ticket includes any of:

- file paths, symbols, RPC names, proto fields, or schema references
- scope boundaries like "do not change X"
- contract-like wording such as "rename", "remove", "migration", or "deprecate"
- AI-style implementation detail that may have guessed at the wrong code target

If the ticket is already clean and domain-level, skip this pass.

## Prompt Template

Fill in `{REPO_PATH}`, `{INTENT_SUMMARY}`, and `{RAW_CLAIMS}` before dispatching.

```
You are running a light sanity check against the codebase at {REPO_PATH}.

Your job is NOT to discover extra scope. Your job is to confirm that the ticket still points at the right thing.

## Change intent

{INTENT_SUMMARY}

## Raw claims

{RAW_CLAIMS}

Check only for:
- obvious wrong-target symbol references
- obvious scope contradictions
- cases where the ticket premise appears materially false

Do NOT:
- sweep callers or consumers
- suggest adjacent cleanup
- add missing requirements the ticket never asked for
- do rollout or phasing analysis

## Output

Return exactly this structure:

Status:
  <ok | corrected | clarification-required>

Refined intent:
  <domain-level rewrite of the intent; if no correction is needed, restate the original intent cleanly>

Notes:
  - [claim] <confirmed symbol or wrong-target correction>
  - [scope] <confirmed boundary or contradicted boundary>
  - [clarification] <only when the ticket premise appears materially wrong>

Rules:
- Keep `Refined intent` domain-level.
- `Notes` may mention real symbols or paths.
- Use `clarification-required` only when the ticket would otherwise produce a likely false prompt.
- If you are unsure, prefer `ok` or `corrected` over inventing a contradiction.
```

## Hard Limits

- Max 10 file reads
- No caller or consumer sweep
- No deep contract analysis
- No openspec or recent-PR sweep

## Parsing

- If `{REPO_PATH}` is unavailable, do not dispatch this prompt.
- `Status: ok` -> use `Refined intent` and continue
- `Status: corrected` -> use `Refined intent` and show `Notes` as a user-facing mismatch note
- `Status: clarification-required` -> do not generate a prompt; surface the note and ask the user to clarify the ticket
