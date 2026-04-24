---
name: opsx-prompt
description: >
  Use when generating an opsx:new prompt from a Linear issue or short freeform
  request and the goal is to capture the ticket's why/what without expanding
  scope by default.
---

# Opsx Prompt Generator

Generate a ticket-first prompt for `opsx:new`.

## Goal

Answer two questions clearly:

- Why does this issue exist?
- What outcome is it asking for?

The prompt should faithfully represent the ticket's intended change. Code reads are allowed only to correct obvious mistakes or to produce optional follow-up notes.

## Non-goals

This skill does NOT:

- discover extra scope by default
- redesign the ticket
- do full rollout planning or Expand/Migrate/Contract design
- replace proposal, design, or spec work

## Input

- `APP-XXXXX` issue ID
- freeform change description
- no input: ask what change the user wants to describe

If the input is an issue ID, prefer `linear-cli:linear-cli`, then any available Linear MCP tools. If no Linear integration is available, ask the user to paste the issue title, description, and relevant comments.

## Optional Repo Context

Repo context is only needed for Phase 3 or Phase 5.

Workspace root:

- preferred: `~/.caruso/config.yaml` -> `workspace_path`
- fallback: walk up from cwd until `openspec/` is found and use its parent

Infer the target repo from the issue title (`service-name | description`) or ask the user.

If Phase 3 or Phase 5 is needed but repo context cannot be resolved:

1. Ask the user for the repo or service path.
2. If the user cannot provide it and still wants a prompt, skip code-based checks and surface a user note: `Sanity check skipped: repo unavailable`.
3. Do not silently pretend the ticket was grounded against code.

## Phase 1: Read The Request

Issue mode:

1. Fetch the issue title, description, comments, parent or sub-issue summary, and linked PRs.
2. Identify work that already landed.
3. Do not read code yet.

Freeform mode:

1. Read the request as written.
2. If it is mostly implementation detail, ask for the underlying goal.

## Phase 2: Extract Intent

Produce a structured summary:

- `Why`
- `What`
- `Explicit asks`
- `Non-goals`
- `Already done`
- `Unknowns`
- `Raw claims`

`Raw claims` is internal support data, not prompt content. Use it to preserve:

- named symbols or paths mentioned by the ticket
- explicit scope boundaries like "do not change X"
- literal deliverables that must survive prompt generation

Rules:

- stay domain-level
- preserve explicit asks
- separate desired outcomes from implementation ideas
- if the ticket is ambiguous, record that in `Unknowns` instead of guessing
- route non-blocking `Unknowns` into Phase 4's `Open questions`
- if an unknown would make the prompt likely false, stop instead of downgrading it to an open question

## Phase 3: Light Sanity Check

Run this only when needed. Do not expose internal modes to the user.

Use `triage.md` when the ticket includes any of:

- code symbols, file paths, RPC names, schema names, or fields
- explicit scope boundaries
- wording like "rename", "remove", "migration", or "deprecate"
- AI-style implementation detail that may be pointing at the wrong target

The light sanity check may:

- confirm the ticket points at the right thing
- rewrite the intent against the correct target when the ticket named the wrong thing
- stop and ask for clarification when the ticket premise looks wrong

It must NOT:

- sweep callers or consumers broadly
- discover adjacent work
- add scope the ticket did not ask for
- run at all without a resolved repo path; if repo context is unavailable, use the fallback described above

## Phase 4: Generate The Prompt

Read `output-format.md` and generate the prompt from the extracted intent.

Rules:

- `This change` comes from the ticket's stated goal and explicit asks
- `Already in place` comes from linked PRs or other clearly landed work
- `Non-scope` comes from explicit ticket boundaries
- non-blocking `Unknowns` become `Open questions`
- if Phase 3 found a mismatch, use corrected domain-level wording in the prompt and surface the mismatch as a user note
- if a literal ask cannot be paraphrased to domain level without losing load-bearing meaning, keep the main prompt domain-level and surface the exact ask in a `Symbol-sensitive requirements` user note
- if the exact symbol-level detail is the core of the request and cannot be represented safely even with a note, stop and ask for clarification
- for freeform requests, derive the title from the requested outcome; use repo-derived service if clear, otherwise `unknown-service`, and use `no-issue`
- if the ticket is still materially unclear, stop and ask for clarification instead of fabricating certainty

## Phase 5: Optional Deep Review

Deep review is optional, not part of the default path.

Only run `code-exploration.md` when:

- the user asks for extra confidence
- the issue is high-risk and the user wants a deeper pass
- the prompt is fine, but the user wants a second look for missed considerations

Deep review may produce user-facing notes:

- `Possible missing considerations`
- `Possible contract risks`
- `Possible already-completed work`

Do NOT merge deep-review findings into the prompt automatically. This includes `Possible already-completed work`. If the user wants any of these findings reflected in the prompt, revise the prompt explicitly.

## Presentation

Default flow:

1. Read issue
2. Extract intent
3. Run light sanity check only if needed
4. Present the prompt

Optional flow:

1. Present the prompt
2. Offer deep review if the user wants it
3. Keep deep-review findings outside the prompt unless the user asks to revise it

User-facing choices should stay simple:

- `Generate prompt`
- `Generate prompt + deep review`

Do not expose internal modes like `Full`, `Narrow`, or `Skip`.

## When To Stop

Stop instead of generating a prompt if:

- the ticket's core goal is unclear
- the ticket appears to target the wrong thing entirely
- the request is self-contradictory
- the prompt would otherwise encode a likely false premise

## Edge Cases

- No argument: ask for an issue ID or short description
- Ticket already done: show `Already in place` and ask whether the user still wants a prompt
- Multi-repo issue: keep one prompt, but note the affected repos in `Open questions` or the user note
- No repo available: still generate the prompt if Phase 3 and Phase 5 are unnecessary
- No repo available when Phase 3 or Phase 5 would otherwise run: ask for repo path first; if unavailable, proceed only with an explicit `Sanity check skipped` user note
- Freeform request with no clear why: ask for the business goal before generating the prompt
- Freeform request with no clear service name: use `unknown-service`

## Key Principle

This skill is ticket-first:

- the issue defines the intent
- light grounding may correct obvious mistakes
- deep discovery is optional
- the skill should help the user express the requested change clearly, not silently enlarge it
