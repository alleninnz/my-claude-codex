---
name: implementation-discipline
description: Use when executing or supervising implementation from a spec, plan, ticket, or agent-written code; when checking for spec drift, scope creep, missing verification, weak edge-case coverage, poor fit with best practices, or review-worthy checkpoints during development.
---

# Implementation Discipline

Keep implementation aligned with the approved spec while preserving flow. Keep moving inside an approved behavior slice; stop before crossing a requirement, contract, risk, or direction boundary.

## When to Use

- Executing a spec, plan, ticket, or behavior slice
- Reviewing AI-agent-written code before continuing
- Checking for spec drift, scope creep, missing verification, or weak edge-case coverage
- Deciding whether to continue, pause for user input, or revise the plan
- Running TDD or choosing whether TDD fits the current change

## Pre-Slice Alignment

Before editing a behavior slice, identify:

- Source: spec, plan, ticket, or user request being implemented
- Slice: current behavior slice and its boundary
- Acceptance: exact criteria this slice must satisfy
- TDD decision: use or skip, with reason
- Edge-case inventory: relevant cases to cover or verify
- Guidance: relevant repo pattern or skill to check against
- Verification: command or manual check that proves the slice

## Modes

### Supervision Mode

Use by default during implementation. After each meaningful slice, inspect the diff and verify alignment before moving on:

- Spec: which requirement or acceptance criterion does this satisfy?
- Scope: did the diff stay inside the approved task?
- Behavior: did existing behavior change intentionally and with evidence?
- Quality: which repo pattern or skill applies, and does the diff follow it?
- Verification: which command proves this slice works?
- Risk: what remains unknown, untested, or dependent on user choice?
- Next: is the next step still within approved scope?

Do not trust agent summaries alone. Inspect the diff and run relevant verification before claiming a slice is complete. If verification cannot run, state why and list the remaining risk.

### TDD-Preferred Mode

Prefer TDD whenever the work has observable behavior that can be tested before implementation. Use TDD first for features, bug fixes, behavior changes, error handling, parsers/formatters, business logic, API contracts, and regression fixes.

TDD is not mandatory for every task. It may be skipped for pure documentation, mechanical rename/format changes, generated code, configuration-only edits, exploratory spikes, or when creating the test harness would clearly exceed the approved scope.

When skipping TDD, state why, choose the next-best verification method, map relevant edge cases to that method, and list remaining verification risk.

When using TDD:

- List the behavior and edge-case inventory before implementation.
- If a local TDD workflow skill is available, load it for the detailed RED -> GREEN -> REFACTOR mechanics.
- Drive new behavior one test at a time.
- Watch each test fail for the expected reason before writing production code.
- Keep adding edge-case tests until the meaningful risks for the slice are covered.
- Do not hide multiple new behaviors in one large table test.

Edge cases to consider when relevant:

- Empty, nil, zero-value, missing, or default inputs
- Invalid input and validation messages
- Boundary values, ordering, duplicates, and idempotency
- Permission, ownership, tenant, or auth boundaries
- Error wrapping, classification, and transport mapping
- Retry, timeout, cancellation, concurrency, and race behavior
- Backward compatibility and existing behavior preservation

## Flow Rules

Continue without waiting when work remains inside the same approved behavior slice:

- Happy path to error cases for the same behavior
- Fixing failures uncovered by the current verification command
- Local refactor needed to keep the same slice clean
- Adding adjacent edge cases under the same contract
- Formatting, import cleanup, naming, or narrow test cleanup
- Running more verification

Pause and wait for user input before:

- Changing or expanding requirements
- Altering public API, schema, migration, proto, permission, data ownership, concurrency, or deployment behavior
- Choosing between materially different implementation strategies
- Accepting a verification failure that is not a local fix
- Continuing after discovering the plan or spec is wrong
- Completing an independently reviewable behavior slice when the user can make a meaningful direction decision

## Output Contract

For non-blocking progress, be brief and evidence-based:

```text
Progress: <slice>
Evidence: <diff inspected and verification result>
Next: <next in-scope step>
```

At a blocking checkpoint, use this shape:

```text
Checkpoint: <slice name>
Spec coverage: <requirement or acceptance criterion>
Changed: <files and behavior>
TDD decision: used / skipped
Reason: <why>
Edge cases covered: <list>
Verification: <commands and results>
Risks: <none or list>
Decision needed: <specific question>
```

If no decision is needed, use non-blocking progress instead of this checkpoint format, then continue.

## Common Mistakes

- Treating progress summaries as review
- Trusting an agent's claim without inspecting the diff
- Forcing TDD onto tasks where it adds no signal
- Skipping TDD for testable behavior without explaining why
- Covering only the happy path and calling the slice verified
- Stopping for tiny internal changes that do not affect direction
- Continuing past a contract, data, permission, or scope boundary
