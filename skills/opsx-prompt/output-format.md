# Output Format

The default output has two layers:

1. The main prompt inside a fenced code block
2. Optional user notes outside the fenced block

Only the fenced prompt is intended for `opsx:new`.

## Main Prompt

Use this template:

```text
<service or unknown-service> | <issue-id or no-issue> | <short title from issue or request>

Why:
<1-2 sentences describing the business problem or desired outcome>

This change:
- <explicit requested outcome 1>
- <explicit requested outcome 2>
- <explicit requested outcome 3>

Already in place:
- <already landed work this change should build on>

Non-scope:
- <explicit non-goals or boundaries>

Open questions:
- <only if clarification is still needed>
```

Rules:

- `Why` and `This change` are required
- `Already in place`, `Non-scope`, and `Open questions` are optional
- keep all prompt content domain-level
- do not include file paths, function names, field names, or code snippets in the main prompt
- map non-blocking ambiguity from `Unknowns` into `Open questions`
- for freeform requests, use `no-issue`; derive `short title` from the requested outcome; use `unknown-service` when no service can be inferred safely
- if a core ask cannot be represented safely without exact symbol names, do not fake precision in the prompt; use a user note or stop for clarification
- if the ticket is still materially unclear, do not generate the prompt

## User Notes

Render these outside the code block only when present:

```text
### Sanity check skipped
- <repo-based check was needed but repo context was unavailable>

### Ticket-vs-code mismatch
- <light sanity check note with code-level detail if needed>

### Symbol-sensitive requirements
- <exact literal ask that could not be safely preserved in the domain-level prompt>

### Possible missing considerations
- <deep review note>

### Possible contract risks
- <deep review note>

### Possible already-completed work
- <deep review note>
```

Rules:

- user notes may contain code-level identifiers
- user notes are not sent to `opsx:new`
- deep-review notes do not enter the prompt automatically
- `Possible already-completed work` stays a note until the user asks to revise `Already in place`
- if `Symbol-sensitive requirements` contains a load-bearing detail, the user should review the prompt before treating it as complete
- if the user wants a note reflected in the prompt, revise the prompt explicitly
