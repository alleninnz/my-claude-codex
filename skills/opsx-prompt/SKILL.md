---
name: opsx-prompt
description: >
  Use when generating an opsx:new prompt from a Linear issue or free description.
  Triggers: "generate opsx prompt", "opsx prompt for APP-XXXXX", or when the user
  needs help writing an opsx:new change description.
  Do NOT use for generating design, tasks, or specs (those are openspec's job).
---

# OpenSpec Prompt Generator

Generate intent-focused prompts for `opsx:new` by combining Linear issue context with code exploration to discover functionality the issue author missed.

**Core value:** The code exploration discovers related functionality the issue author didn't think of — shared functions used by multiple RPCs, response fields that exist but aren't populated, store queries that need expanding, existing infrastructure the change should build on.

## Input

- **Issue ID** — matches `APP-\d+` (e.g., `APP-21594`). Read via `linear-cli:linear-cli` skill (preferred) → Linear MCP tools (fallback). If neither is available, tell the user and exit.
- **Free description** — anything else. Accept as-is.
- **No argument** — ask what the user wants to build.

## Workspace Resolution

Workspace root: `~/.caruso/config.yaml` → `workspace_path`. Fallback: walk up from cwd to find `openspec/`; use its parent.

Target repo: parse service name from issue title (`service-name | description` convention). If unclear, infer from issue body or ask.

---

## Phase 1: Extract Intent

Produce an intent summary (WHAT + WHY, no HOW).

**Issue ID mode:**

1. Fetch the issue: try `linear-cli:linear-cli` skill first, fall back to Linear MCP tools (`get_issue` with `includeRelations: true` + `list_comments`). If neither is available, tell the user "Linear integration not found — please paste the issue description" and exit.
2. Fetch related issues (1 level deep only, including parent/sub-issues) for context
3. **Check attachments for linked PRs** — identify already-completed work (e.g., schema PR merged). This becomes the "Already in place" section.
4. Extract WHY (business problem) and WHAT (desired outcome, distinguishing done vs remaining)
5. **Discard implementation details** — function names, file paths, proto field numbers, code blocks. openspec will derive these from the codebase.

**AI-generated issue detection:** If the description contains code blocks, file paths, function signatures, or step-by-step instructions, extract the goal behind the detail, not the detail itself.

**Free description mode:** Accept as-is. If it contains implementation detail, ask for the high-level goal.

---

## Phase 2: Code Exploration

Dispatch an Explore subagent (model: `opus`) with the intent summary and target repo path. Job: **discover what the issue didn't mention.**

Read `code-exploration.md` for the full prompt template and dispatch instructions. Fill in `{REPO_PATH}` and `{INTENT_SUMMARY}`.

**Filter results:** Before merging into the prompt, filter each discovery: "Is this directly caused by or required for the described change?" Discard pre-existing bugs, general improvements, and unrelated concerns.

If the subagent finds nothing new, proceed with just the intent summary.

---

## Phase 3: Generate Prompt

Merge intent + discoveries. Read `output-format.md` for the prompt template.

**Rules for functionality points:**

- One sentence each, WHAT not HOW
- **Domain-level facts allowed** ("DB columns for calculation method exist from admin path") — **code-level references not allowed** ("column at `ent/schema/redemption_order.go:45`")
- Issue points first, then discovered points marked `(discovered)`
- No limit on number of points — constrain detail level, not quantity

---

## Phase 4: Present & Act

1. Display the prompt in a fenced code block
2. `AskUserQuestion` — Header: `Next step`, Choices:
   - `Run opsx:new — Create the openspec change and start the proposal`
   - `Edit prompt — Modify before proceeding`
   - `Just copy — I'll use it manually`
3. **Run opsx:new**: derive kebab-case name from title → `opsx:new <name>` → `opsx:continue` with prompt as context
4. **Edit prompt**: let user modify, re-present, ask again
5. **Just copy**: done

---

## Edge Cases

- **No argument provided**: Ask "What change do you want to generate a prompt for? Provide a Linear issue ID (e.g., APP-21594) or describe the change."
- **Issue has sub-issues**: Read parent + sub-issues as part of "related issues (1 level deep)" to understand full scope, but generate one prompt for the specific issue given
- **Issue is already done** (status = Done/Merged): Note this to the user, ask if they still want a prompt (useful for generating openspec retroactively for documentation)
- **Issue spans multiple repos**: Note the repos and deployment order in the prompt; generate one prompt (openspec handles per-repo change creation)
- **No code to explore** (pure frontend, infra, or docs change): Skip Phase 2 entirely. Note in the output that no code exploration was done.
- **Target repo not found** in workspace: Ask the user for the correct repo path
