---
description: Use when you want to execute multiple independent tasks in parallel
  using subagents. Analyzes the request, decomposes into subtasks, routes to
  appropriate model tiers, and dispatches simultaneously.
---

# Ultrawork

Parallel execution engine. Decompose tasks, route to model tiers, dispatch simultaneously.

## DEPENDENCY-GATE — STOP HERE FIRST

**You MUST invoke each skill listed below via the Skill tool BEFORE reading any further instructions in this file.**

1. Invoke each skill below via the Skill tool:
   - `superpowers:dispatching-parallel-agents` — judgment framework for when NOT to parallelize
2. Create a TodoWrite checklist to track loading status:
   - [ ] superpowers:dispatching-parallel-agents
3. After invoking each skill, mark it complete in the checklist
4. If a skill fails to load, mark it as [SKIP] and continue
5. Only after ALL items have a terminal state (complete or skipped)
   may you proceed past this gate

**Do NOT skip this gate. Do NOT proceed to the steps below.**

## Workflow

### Step 1 -- Analyze and decompose

Read the user's request. Break it into discrete subtasks. For each subtask, determine:

- **What**: specific, atomic goal
- **Independence**: can it run without results from other subtasks?
- **Model**: opus (complex analysis, architecture, multi-file changes) or sonnet (straightforward implementation, simple fixes, lookups)
- **Background**: should it use `run_in_background`? (yes for builds, tests, installs >30 seconds)
- **File scope**: which files will this subtask modify? Two subagents must NOT modify the same file.

If only one task with no parallelism opportunity, execute directly without subagents.

### Step 2 -- Classify and plan

Group subtasks into:

- **Parallel batch**: independent tasks with no shared state or file overlap
- **Sequential chain**: tasks where B depends on A's output
- **Background**: long-running operations that don't block other work

Present the execution plan before dispatching:

```text
Ultrawork plan (N tasks):

PARALLEL:
1. [opus] Implement user authentication endpoint
2. [sonnet] Add input validation tests
3. [sonnet] Update API documentation

SEQUENTIAL (after parallel completes):
4. [opus] Integration test covering all new endpoints

Run this plan? (yes / adjust in natural language):
```

If the user says "adjust", they can request changes in natural language (e.g., "move task 3 to sequential", "use opus for task 2"). Revise the plan and re-present.

### Step 3 -- Dispatch

Fire all parallel tasks simultaneously in a single message using the Agent tool.

Agent tool parameters:

- `subagent_type`: agent type (`"executor"` for implementation, `"general-purpose"` for research)
- `model`: `"opus"` or `"sonnet"` -- always set explicitly
- `prompt`: detailed task description (see prompt structure below)
- `description`: short 3-5 word summary
- `run_in_background`: `true` for long operations (>30s)

Each subagent prompt must include:

- **TASK**: Atomic, specific goal
- **CONTEXT**: Relevant file paths, existing patterns, constraints
- **MUST DO**: Exhaustive requirements -- leave nothing implicit
- **MUST NOT DO**: Boundaries (don't modify files outside scope, don't commit, don't refactor unrelated code)

After parallel batch completes, run sequential tasks in order.

### Step 4 -- Collect and verify

When all subagents return:

1. Summarize what each subagent accomplished
2. Run lightweight verification appropriate to the project:
   - Go: `go build ./...` and `go test ./...`
   - Node: `npm run build` and `npm test`
   - Other: whatever build/test commands the project uses
   - Skip if no build/test system exists
3. Report results to user

If any subagent failed, report the failure and suggest next steps. Do not retry indefinitely.

## Routing Rules

| Condition | Dispatch mode |
|-----------|--------------|
| 2+ independent tasks, no shared state, no file overlap | Parallel |
| Task B needs output from Task A | Sequential |
| Single task, no parallelism opportunity | Execute directly (no subagents) |
| Build, test suite, package install (>30s) | Background (`run_in_background: true`) |

## Model Routing

| Complexity | Model | Examples |
|------------|-------|----------|
| Complex | opus | Architecture decisions, multi-file refactors, deep analysis, code review |
| Straightforward | sonnet | Simple implementations, single-file changes, documentation, lookups |
| Never | haiku | Never use -- produces unreliable results |

## Good and Bad Examples

**Good**: Three independent tasks fired simultaneously

```text
Agent(subagent_type="executor", model="opus", description="Implement auth endpoint", prompt="...")
Agent(subagent_type="executor", model="sonnet", description="Add validation tests", prompt="...")
Agent(subagent_type="executor", model="sonnet", description="Update API docs", prompt="...")
```

**Good**: Background execution for long operations

```text
Agent(subagent_type="executor", model="sonnet", description="Run test suite", prompt="...", run_in_background=true)
Agent(subagent_type="executor", model="sonnet", description="Update changelog", prompt="...")
```

**Bad**: Sequential execution of independent work

```text
result1 = Agent(executor, "Implement endpoint")  # wait...
result2 = Agent(executor, "Add tests")            # wait...
result3 = Agent(executor, "Update docs")           # wait...
```

**Bad**: Using opus for trivial work

```text
Agent(subagent_type="executor", model="opus", prompt="Fix a typo in README")
```

## Does NOT

- Create persistent execution mode
- Force parallelism when tasks have dependencies
- Auto-commit changes
- Retry failed subagents indefinitely
