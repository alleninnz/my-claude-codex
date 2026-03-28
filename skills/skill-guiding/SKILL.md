---
name: skill-guiding
description: Use when browsing, discovering, or understanding installed skills — lists available skills from user directory and marketplace plugins, explains what each does and when to use it.
---

# Skill Guiding

Browse and understand the installed skill library interactively.

## Overview

Helps users discover and understand skills installed on their machine. Scans user skills by default; supports keyword search to browse marketplace plugin skills. Presents a structured skill card for the selected skill.

## Quick Reference

| Mode | Source | Command |
|------|--------|---------|
| Default | `$HOME/.claude/skills/` | Just invoke the skill |
| Marketplace | `$HOME/.claude/plugins/cache/` | Type a plugin name (e.g., `superpowers`, `slack`) |

## When NOT to use

- Do not use as a task router — this skill does not take a task description and recommend skills automatically. It's a browse-and-select interface.
- Do not use to create or modify skills.

## Flow

1. Scan for skills (user skills by default, marketplace via keyword)
2. Present numbered list
3. User selects a skill (number) or searches marketplace (keyword)
4. Read the skill's content
5. Present structured skill card

## Step 1: Scan for skills

### Default — user skills

Run this command to find all skill directories in `$HOME/.claude/skills/` that contain a SKILL.md:

```bash
find "$HOME/.claude/skills" -maxdepth 2 -name "SKILL.md" | sed 's|/SKILL.md$||' | xargs -I{} basename {} | sort
```

Store the resulting list. Exclude `skill-guiding` (this skill) from the list.

If the list is empty, tell the user: "No user skills found in $HOME/.claude/skills/." but continue to Step 2 — the user can still search marketplace skills.

### Marketplace — keyword search

When the user types a plugin name (e.g., `superpowers`, `slack`, `claude-mem`) instead of selecting a number, search the marketplace plugin cache:

- **Find the plugin directory** across all orgs:

```bash
find "$HOME/.claude/plugins/cache" -maxdepth 2 -mindepth 2 -type d -name "$KEYWORD" ! -path "*/temp_git*"
```

- **Resolve the latest version** within the matched directory:

```bash
ls -d "$MATCHED_DIR"/*/ 2>/dev/null | sort -V | tail -1
```

- **List skills** in the latest version:

```bash
find "$LATEST_VERSION_DIR/skills" -maxdepth 2 -name "SKILL.md" 2>/dev/null | sed 's|/SKILL.md$||' | xargs -I{} basename {} | sort
```

If no plugin matches the keyword, tell the user: "No marketplace plugin matching '$KEYWORD' found." and re-prompt.

## Step 2: Present numbered list

Present the skills as a numbered list.

- If showing user skills (default), add a hint: "Type a plugin name (e.g., `superpowers`, `slack`) to browse marketplace skills instead."
- If showing marketplace skills from a keyword search, show which plugin was matched and its version.

Ask the user to type a number to select a skill, or type a plugin name to search marketplace.

**Disambiguation rule:** If input is numeric, treat as a selection. Otherwise treat as a marketplace keyword.

If the user does not select anything (empty response), stop.

## Step 3: Read the skill's content

Determine the base path of the selected skill:

- **User skills**: `$HOME/.claude/skills/$SELECTED/`
- **Marketplace skills**: `$LATEST_VERSION_DIR/skills/$SELECTED/`

Read all `.md` files in the skill directory recursively:

```bash
find "$SKILL_BASE_PATH" -name "*.md" -type f
```

Read each `.md` file found using the Read tool. Note any non-markdown files briefly (e.g., "This skill also includes shell scripts in `scripts/`.") but do NOT read them.

## Step 4: Present structured skill card

Using the content read in Step 3, present the following template. Every section must be filled in — do not leave any section blank or with placeholder text.

### Template

```markdown
## [Skill Name]

> One-line summary of what this skill does.

| | |
|---|---|
| **Invoke** | `/<skill-name>` |
| **Source** | user \| marketplace (<plugin-name> v<version>) |
| **Mode** | Interactive (asks questions) \| Autonomous (runs to completion) |
| **Prereqs** | None \| list required tools, MCP servers, credentials |

### Purpose
What problem does this skill solve? What happens without it — what friction, mistakes, or inconsistency does it prevent?

### Triggers
- Bullet list of situations and phrases that should activate this skill

### Don't use when
- Bullet list of situations where this skill is NOT the right choice

### Workflow
`skill-a` → `skill-b` → `skill-c`
(Only include if the skill explicitly references other skills in a chain. Omit this section entirely if none.)
```

### Field extraction rules

- **Summary**: Synthesize a single sentence from the SKILL.md overview/description.
- **Mode**: Determine from the skill's flow — does it ask the user questions (interactive) or run to completion (autonomous)? Does it produce files?
- **Purpose**: Infer from the problem the skill solves — what manual steps or mistakes it prevents.
- **Triggers**: Pull from the `description` frontmatter field and any "When to Use" sections in the skill.
- **Don't use when**: Pull from any "When NOT to Use" sections. If none exist, write "No explicit restrictions documented."
- **Workflow**: Extract only skills that the selected skill's content explicitly references as a sequence. Omit the section if no chain exists.
