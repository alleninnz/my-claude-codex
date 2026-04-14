---
paths:
  - "**/*.go"
---

# TDD Discipline

**CRITICAL — You MUST follow these rules during any TDD work. Violations break the review loop and waste cycles.**

**If AVAILABLE**, Invoke `superpowers:test-driven-development` at session start for the full workflow. This rule adds checkpoint pauses — it takes priority over the skill.

**ONE test at a time.** No batching tests or table rows. **NO EXCEPTION**.

**Checkpoint:** After completing a logical group of cycles, you **MUST** summarize what was added and **wait for user response** before continuing. A group boundary is:
- A task group from the plan (e.g., `## 3. Handler — Per-Method Validation`)
- A category shift: happy-path → error cases, switching target function, unit → integration tests
- Whichever comes first

Within a group, keep going — do **NOT** pause at a fixed cycle count. **NEVER** skip or continue past a checkpoint without user input.
