# Deep Analysis — Methodology and Presentation

## Analysis inputs

Before presenting a Critical/Major comment (or a rescued Medium/Low comment), gather:

1. **git diff** — `git diff $(gh pr view --json baseRefName -q .baseRefName)...HEAD -- {path}` focused on the comment's location
2. **Function-level context** — the full function/method containing the flagged line (not the entire file)
3. **Project conventions** — CLAUDE.md, linter config, surrounding code patterns

For PR-level issue comments (no file path): use the PR description and overall diff summary instead.

If a file was deleted/renamed, check `git log --diff-filter=R --find-renames -- {path}`.

## Severity re-evaluation

After deep analysis, Claude may upgrade or downgrade:

- Downgraded below Major → move to Medium/Low overview (Step 4), retain gathered context for reuse if rescued
- Upgraded → reflect in header (e.g., `[Medium → Critical]`)
- If all Critical/Major comments downgrade, skip Step 3 and proceed to Step 4

## Language style

Every **Problem** and **Wants** field **MUST** use natural conversational language — as if explaining to a colleague sitting next to you. This applies to **ALL** severity levels, no exceptions.

**NEVER use these patterns:**
- "Consider adding..." / "It is recommended that..." / "Potential issue with..."
- Any phrasing that echoes the AI reviewer's original wording
- Hedging language: "may", "could potentially", "it might be beneficial to"

**Required style:**
- Problem: "This handler doesn't check context cancellation — if the request times out, the goroutine keeps running and never stops"
- Wants: "Add a ctx.Done() case in the select so it cleans up and returns on timeout"

The rule: pretend you're explaining the problem to the colleague sitting next to you.

**Problem** and **Wants** come from the data-gather subagent output. For Critical/Major, you **MUST** refine them after reading the diff and function context — the subagent's version is a starting point, not final. For Medium/Low (no deep analysis), use the subagent's version directly.

## Presentation template

```text
── 1/N ── [Critical] ── [coderabbit] ──────────
📍 path/to/file.go:42

**Problem:**
<Natural language explanation of what's wrong with the code.
1-2 sentences for Critical/Major. Write as if explaining to a colleague.>

**Wants:**
<What the reviewer wants done about it. 1 sentence, natural language.>

**Diff:**
<git diff snippet, only the change related to this comment, ±3 lines context>

**Analysis:**
<Your independent judgment: agree/disagree, and why.
2-3 sentences for Critical/Major. State disagreement explicitly.>

**Recommendation:** Fix / Skip
<1-sentence rationale>

<details><summary>Original comment</summary>
<raw reviewer text>
</details>
```

For **deduplicated groups**: replace header with `── 1/N ── [Major] ── 2 comments grouped ──`, show `📍 path/to/file.go:42 (coderabbit, copilot)`, merge Problem/Wants noting each reviewer's angle, merge analysis, and wrap originals in `<details><summary>Original comments (2)</summary>`.

Omit `📍` and `**Diff:**` for PR-level issue comments.

## User interaction

This file covers analysis methodology and presentation only. The actual user interaction (auto-queue defaults, override syntax, batch confirmation) is defined in SKILL.md Steps 3 and 4.

**Batch model:** Do not add per-comment prompts. Present all deep-analyzed comments first, then show a single defaults summary. The user responds once per batch. This applies to both Step 3 (Critical/Major) and Step 4 rescue (multiple rescued items are deep-analyzed, then presented as a batch with independent fix/skip defaults per item).
