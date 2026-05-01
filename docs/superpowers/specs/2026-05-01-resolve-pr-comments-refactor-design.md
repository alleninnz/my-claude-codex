# Resolve-PR-Comments Skill Refactor — Design

- **Date:** 2026-05-01
- **Author:** Allen Wang (with Claude)
- **Skill:** `my-claude-codex/skills/resolve-pr-comments`
- **Status:** Design approved, pending implementation plan

## 1. 背景与动机

`resolve-pr-comments` skill 当前由 7 个 `.md` 文件组成，共 **787 行**，描述同一个 6 步工作流（抓 PR 评论 → 分类 → 深度分析 → 用户决策 → 改代码 → 发布）。在实际使用中暴露了三类问题：

1. **结构混乱**：卡片字段定义分散在 4 个文件（`interaction.md`、`deep-analysis.md`、`data-gather.md`、`data-contract.md`），同一份字段集需要在多处独立维护。
2. **过度工程**：`data-contract.md` 中 60% 的内容与 `data-gather.md` 重复；`implementation.md` 的 9 项 publish blockers 是过度穷举。
3. **Agent 漂移**：实测 Codex 在执行 skill 时自创 `Anchor` / `Author` / `Issue` / `File` 行，并渲染了 `SKILL.md` 已禁止的 "Fetched N review threads" 表格——根因是字段 schema 是开放的（`must include` 是下界而非闭合 schema），且没有显式 anti-field 名单压制 LLM 先验。

## 2. 目标

1. **瘦身**：减少总行数，目标 ~40%。
2. **减负**：消除"修改一处需要在 N 处同步"的冗余，每个概念单一来源。
3. **防漂移**：用闭合 schema + verbatim template + 显式 anti-field 名单，把 agent 自创字段的漏洞堵死。

### 非目标

- 不改变 6 步流程、不改变两条 publish lane、不改变 8 桶分类、不改变 reviewer signal matrix 的内容。
- 不引入新功能、不改变与 `gh` CLI / GitHub API 的契约。
- 不写迁移文档（`MIGRATION.md` / `CHANGELOG.md`）——commit message 已足够。

## 3. 当前状态盘点

| 文件 | 行数 | 实际职责 | 主要问题 |
|---|---:|---|---|
| `SKILL.md` | 120 | 6 步骨架 + glossary + Common Mistakes | Common Mistakes 5 项中 #4/#5 是 sub-doc 内部规则的复述 |
| `data-gather.md` | 142 | 抓数据 + 分类规则 + signal matrix + severity rules + dedup rules + **完整输出 schema** | 输出 schema 与 `data-contract.md` 几乎一字不差 |
| `data-contract.md` | 92 | 脚本返回的 JSON shape | 60% 是 agent 分类输出 schema（与 `data-gather.md` 重复）；包装成 versioned API contract（无消费者） |
| `deep-analysis.md` | 149 | 深度分析规则 | 重复 signal matrix；含 Presentation Template + Language Rules（应在 presenting 层） |
| `interaction.md` | 96 | 卡片展示与交互 | 字段定义只是 bullet list（非闭合 schema） |
| `implementation.md` | 104 | 改代码 + 发布 | 9 项 blockers 穷举 + worked example 占 ~30 行 |
| `resolve-threads.md` | 84 | reply/resolve API ref | 写得最干净，无问题 |

## 4. 设计——文件拓扑

最终结构：**5 个 .md + 1 个 Python 脚本（docstring 增强）**。

| 文件 | 行数（目标） | 角色 |
|---|---:|---|
| `SKILL.md` | ~80 | 流程骨架 + glossary + cheat sheet（agent 唯一保证读到的入口） |
| `presenting.md` | ~110 | 卡片 schema（verbatim template）+ Language Rules + commands 表 |
| `analyzing.md` | ~115 | signal matrix + classification + severity + dedup + analysis taxonomy + the one rule + recommendations |
| `publishing.md` | ~70 | fix plan + implementation order + preview + thread_map + publish lanes + stop conditions |
| `resolve-threads.md` | 84 | reply/resolve API ref（不变） |
| `scripts/fetch-comments.py` | +25 docstring 行 | 顶部 docstring 含 JSON output shape |
| **合计 .md** | **~459** | **当前 787 → -42%** |

### 拓扑选择理由

- **保留 `resolve-threads.md`**：它是 API reference 类文档（按需查阅），与 procedure 类文档（按流程读）思维模式不同。当前文件最干净，重构风险高、收益低。
- **删除 `data-contract.md`**：JSON shape 跟着脚本走更自然（修改时同 diff），分类输出 schema 与 `data-gather.md` 重复，应该消失。
- **合并 `data-gather.md` + `deep-analysis.md` → `analyzing.md`**：两者切分的"读代码前/后"边界是人造的，agent 一次 pass 同时做完两件事。合并后 signal matrix、severity rules、字段定义只剩单一来源。
- **重命名 `interaction.md` → `presenting.md`** 并吸收 `deep-analysis.md` 的 Presentation Template + Language Rules：所有"用户面前看到什么"的规则集中到一处。
- **重命名 `implementation.md` → `publishing.md`** 并吸收 `analyzing.md` 删除的 thread_map 结构：procedure 与 API ref 分离更清晰。

## 5. 设计——`presenting.md`

### 章节布局

```
# Review Interaction

## Language Rules        (from deep-analysis.md:96-138)
   Style / Field Duties / Avoid / Before-After 例子

## Critical/Major Cards
   闭合 schema 声明 + anti-field 名单（3 行）
   verbatim Presentation Template（唯一权威）
   one-at-a-time 流程规则

## Medium/Low Pages
   闭合 schema 声明 + anti-field 名单
   verbatim 5-item 页面模板
   Defaults 行 + ok all 不吃 Review-default 的 anti-silent-skip 规则

## Commands
   ok / ok all / fix / defer / reply / review / why
```

### 防漂移机制（核心）

每个卡片段落顶部用闭合 schema 措辞（外层使用 4 个波浪号 fence 以容纳内嵌的 ```text 模板）：

~~~~markdown
## Critical/Major Cards

Render each item verbatim against this template. Do not add, remove,
or rename fields. Specifically, do not add Anchor, Author, Issue, or
File rows — the header carries reviewer (`[coderabbit]`) and severity
(`[Major]`); `Path:` carries file:line.

When multiple reviewers raise the same deduplicated issue, list all of
them inside the bracket, alphabetically ordered, separated by `/`
(e.g., `[coderabbit/cursor]`). Do not pick one reviewer and hide the
rest. Synthesize all reviewer angles in `Wants`.

```text
── 1/N ── [Major] ── [coderabbit] ──────────
Path: path/to/file.go:42

Problem: <one sentence — what can go wrong if the bot is right>
Wants: <one sentence — what the reviewer asks the author to change>

Code evidence: <one of:
  - "<file:line>: `<quoted code>`" (positive inline claim)
  - "<grep/diff/test result>" (negative or cross-file claim)
  - "no concrete evidence available; bot's claim is about
     <absence | cross-file | ownership | process | PR-level>">

Confidence: High | Medium | Low
Recommendation: Fix | Defer | Reply only | Needs your decision
Reason: <one sentence; must reference Code evidence concretely>

<details><summary>Original comment</summary>...</details>
```

Present exactly one item, ask for a `Fix` / `Defer` / `Reply only`
decision, and stop. Never batch. `Needs your decision` is a
recommendation signal, not a recordable decision.
~~~~

Medium/Low 用同样档位的 closed schema + anti-field 名单 + verbatim 5-item template。

### 防漂移机制清单

| 机制 | 防什么漂移 |
|---|---|
| `Render each item verbatim against this template` | agent 自己想象渲染样式 |
| `Do not add, remove, or rename fields` | 增减字段 |
| `Specifically, do not add Anchor, Author, Issue, or File rows` | agent 先验填充的 4 个具体字段 |
| Header 行注释（`[coderabbit]` 是 reviewer、`Path:` 是 file:line） | "Author 字段没了我得加一行" 的代偿心理 |
| `Recommendation` 限定 4 个值的 enum | 自创新 recommendation 类型 |
| 多 reviewer dedup 用字母序 `[a/b/c]` | 不可复现的排序 + 隐性证据强度信号 |

### 多 Reviewer Header 格式

- 单 reviewer：`[coderabbit]`
- 多 reviewer（dedup 后）：`[coderabbit/cursor]` / `[coderabbit/codex/cursor]`
- 排序：字母序（可复现、零配置）
- 分隔符：`/`（紧凑、无算术语义）

适用 Critical/Major header 与 Medium/Low compact header 两处。

## 6. 设计——`analyzing.md`

### 章节布局

```
# Analyzing Review Comments

## Required Inputs
   focused diff / surrounding function / repo conventions
   PR-level: PR description + 3 个 PR-level signals 字段

## Reviewer Signal Matrix
   表格：Human / CodeRabbit / Codex / Cursor / Copilot / Unknown bot
   "Signal quality 不等于 correctness"

## Classification Rules
   Drop resolved / Outdated 桶 / Drop prior skill replies (marker 检查)
   / Nitpick → 忽略桶（仅需最小字段集）/ Drop PR-author 状态更新 / 其他归类
   "When in doubt, include."

## Severity
   触发器/反触发器表（初分类）
   Re-evaluation 规则（读完代码后可升降）
   Severity preservation：Critical/Major 项目即使被降级仍留在 critical_major 桶

## Deduplication
   匹配条件 4 项（同文件/话题、邻近位置、相同 action category、2 个关键词重叠）
   多 reviewer dedup 字母序 cross-link → presenting.md

## Analysis Taxonomy
   表格：Valid bug / Missing proof / Needs decision / Convention mismatch
        / Already covered / Stale / Noise → 各自的 default recommendation

## The One Rule
   Fix 必须有 concrete code evidence
   没 evidence 就只能 Defer / Reply only / Needs your decision

## Recommendations
   表格：Fix / Defer / Reply only / Needs your decision — 各自适用条件
```

### 重要决定：删除 Output Schema 段

当前 `data-gather.md:104-142` 与 `data-contract.md:62-92` 各有一份 ~40 行的"输出 schema 目录"（8 个桶清单 + 12-15 个字段名 + 特殊处理规则）。**目录段是冗余的**——所有字段都在它们的真实消费段落里被定义：

| 字段 / 规则 | 真实定义位置 |
|---|---|
| 8 个桶清单 | `SKILL.md` Step 1 + Step 2 count summary + `analyzing.md` Classification Rules |
| 卡片字段（Problem / Wants / Code evidence / 等） | `presenting.md` verbatim template |
| `signal_quality` | `analyzing.md` Reviewer Signal Matrix |
| `severity` | `analyzing.md` Severity 段 |
| `ids` / `location` | `analyzing.md` Deduplication |

只有两件事不在其他段落里——**搬家**：

- `thread_map` 结构（5 字段）→ 搬到 `publishing.md`（消费者是 Step 6 publish）
- PR-level signals 子结构（3 字段）→ 搬到 `analyzing.md` Required Inputs 段
- `nitpick_triage` 最小字段集 → 合并进 `analyzing.md` Classification Rules 段（1 行）

净影响：analyzing.md -29 行。

## 7. 设计——`publishing.md`

### 章节布局

```
# Implementation and Publish

## Fix Plan
   Fix / Defer / Reply only 分组预览模板

## Implementation Order
   按文件/行为分组 → 逐组应用 → 逐组验证 → 末尾全量验证
   验证命令从 CLAUDE.md/Makefile/CI 推断；失败立即停止

## Preview
   git diff --stat / focused diffs / verification 结果
   / planned replies / threads to resolve / deferred drafts

## Thread Map (NEW，搬自 analyzing.md)
   thread_map[] 每条目: item_id / thread_ids / comment_ids / category / reply_intent
   Step 6 据此决定回复哪些 thread + 关哪些 thread

## Publish Lanes
   Code-fix lane:  preview → checklist → commit → push → re-fetch → reply → resolve
   No-code lane:   preview → reply → resolve
   Authorization: 用户显式说 fix/resolve/publish → 自动跑；只说 review → ask once

## Stop Conditions (compressed)
   1 段原则 + 3 个最常见例子（替代当前 9 条穷举 + worked example）
```

### Stop Conditions 压缩

```markdown
## Stop Conditions

Stop before any GitHub write (commit, push, reply, resolve) if any of:
the local diff includes work outside the recorded review-comment decisions;
a processed comment is missing a recorded decision (Fix / Defer / Reply only);
the fix commit is not yet visible on PR head; verification failed and the user
did not explicitly accept the limitation; a planned reply has gone stale after
re-fetching PR state.

Examples:

- Diff has unrelated cleanup → stop, ask before commit
- Re-fetch shows the target thread was edited since Step 1 → stop, ask before reply
- A reply would claim "Follow-up filed in <issue>" but the issue was never created → stop
```

砍掉的 2 条边缘条件：

- "Reply-only 决策有争议时 ask"——太主观，应该在每条 reply-only 决策时单独判断而非全局规则
- "GitHub API 部分失败"——这是 retry/idempotency 问题，应进 `resolve-threads.md` API 段

## 8. 设计——`SKILL.md`

### 章节布局

```
# PR Review

(intro 1 句话)

## Prerequisites              (不变)
## Platform Rules             (不变)
## Glossary                   (单一 glossary，9 项保留)

## Step 1 - Fetch and Classify
   Read `analyzing.md`. Run script. HEAD mismatch → stop.

## Step 2 - Triage Summary
   只显示 count box 模板。
   ★ 新增禁令：Do not render a per-thread preview table or per-item
   one-liners for any bucket. Per-item presentation lives in Step 3 / Step 4.

## Step 3 - Critical/Major Review
   Read `analyzing.md` and `presenting.md`. One at a time.

## Step 4 - Medium/Low Review
   Read `presenting.md`. Compact, 5/page.

## Step 5 - Fix Plan and Implementation
   Read `publishing.md`.

## Step 6 - Preview, Publish, Resolve
   Read `publishing.md` and `resolve-threads.md`.

## Common Mistakes (cheat sheet, top 3)
   1. `Fix` requires concrete `Code evidence`. Without it: Defer / Reply only / Needs your decision.
   2. Critical/Major: one item at a time, decision before next. Never batch.
   3. Render cards verbatim against the template in `presenting.md`. Do not add Anchor / Author / Issue / File rows or any other field beyond the template.
```

### 关键改动

| 改动 | 原因 |
|---|---|
| Step 2 加 preview-table 禁令 | 解决用户最初观察到的 Goal 1（"已抓取的 N 条 review thread"表格） |
| Common Mistakes 5 项 → 3 项 | 后 2 项是 sub-doc 内部规则的复述；前 3 项是会立即在卡片显形的核心规则 |
| 6 个 Step 引用更新 | 旧文件名 → 新文件名 |
| Glossary 微调 | 保留全部 9 项；收紧措辞；不删除任何 entry。`data-gather.md` 的 5 项 mini-glossary 随文件删除自然消失（其内容本就与 SKILL.md glossary 重复） |

## 9. 设计——`data-contract.md` 删除 + JSON shape 搬到 `fetch-comments.py`

JSON output shape 嵌入脚本 docstring：

```python
"""fetch-comments.py — deterministic GitHub PR review data fetch.

Fetches PR metadata, review threads, PR-level comments, and review
submissions through paginated GraphQL queries in parallel. Used by
the resolve-pr-comments skill as the data source for analysis.

Output JSON shape:
{
  "schema_version": 1,
  "source": "resolve-pr-comments/scripts/fetch-comments.py",
  "pull_request": {
    "owner", "repo", "number", "url", "title", "state",
    "author", "base_ref", "head_sha", "updated_at"
  },
  "conversation_comments": [...],   # PR-level comments
  "reviews": [...],                  # review submissions
  "review_threads": [...]            # inline review threads
}

PR-level comments containing `<!-- resolve-pr-comments:reply -->`
are prior skill replies; the agent must drop them before
classification. Only unresolved threads are actionable by default.

Run with --repo OWNER/REPO --pr 123 or --url <pr-url> for explicit PRs.
"""
```

约 25 行 docstring 取代 92 行 `data-contract.md`。好处：

1. schema 与生产者共置——脚本变更时 schema 自然在同一 diff 里更新
2. `help(fetch_comments)` 直接打印 shape——agent 不需要打开 .md
3. 删掉一个语义模糊的 "data contract" 概念——本就是脚本的输出格式

## 10. 跨文件 Link 更新表

| 出现位置 | 当前引用 | 改后引用 |
|---|---|---|
| `SKILL.md:53` Step 1 | `Read data-gather.md and data-contract.md` | `Read analyzing.md` |
| `SKILL.md:92` Step 3 | `Read deep-analysis.md and interaction.md` | `Read analyzing.md and presenting.md` |
| `SKILL.md:102` Step 4 | `Read interaction.md` | `Read presenting.md` |
| `SKILL.md:106` Step 5 | `Read implementation.md` | `Read publishing.md` |
| `SKILL.md:112` Step 6 | `Read implementation.md and resolve-threads.md` | `Read publishing.md and resolve-threads.md` |
| `presenting.md` 内 | "see Recommendations table in deep-analysis.md" | "see Recommendations table in analyzing.md" |
| `analyzing.md` 内 | "Presentation Template" 引用 | 删除——template 已在 presenting.md |
| `publishing.md` 内 | "see fallback fetch rules in data-gather.md" | "see fallback fetch rules in analyzing.md" |
| `scripts/fetch-comments.py` docstring | 当前指向 `data-contract.md` | 嵌入 JSON shape；删外链 |

**全局校验**：迁移后跑

```bash
grep -rn 'data-gather\|data-contract\|deep-analysis\|interaction\.md\|implementation\.md' \
  ~/Github/my-claude-codex/skills/resolve-pr-comments/
```

应返回 0 行。

## 11. 迁移计划

### 单 commit 原子重构

**理由**：

- 整个重构是一个逻辑变更，diff 在一处看完整
- 中间状态无价值——sub-doc 之间没有接口契约，全部由 SKILL.md 的 cross-file ref 串联，任何中间 commit 都会让引用与文件存在性不一致
- 回滚一行命令：`git revert <commit>`

### 执行顺序（一个 commit 内）

1. **Write new files (3 个)**
   - `skills/resolve-pr-comments/analyzing.md`
   - `skills/resolve-pr-comments/presenting.md`
   - `skills/resolve-pr-comments/publishing.md`

2. **Edit existing files (2 个)**
   - `SKILL.md`（5 处 cross-file ref + Step 2 preview-table 禁令 + Common Mistakes 削减 + Glossary 微调）
   - `scripts/fetch-comments.py`（顶部 docstring 加 JSON shape）

3. **Delete old files (5 个)**
   - `data-gather.md`
   - `data-contract.md`
   - `deep-analysis.md`
   - `interaction.md`
   - `implementation.md`

4. **Commit**：

```
refactor(resolve-pr-comments): consolidate 7 files → 5, enforce closed-schema cards

- Merge data-gather.md + deep-analysis.md → analyzing.md (-176 lines)
- Rename interaction.md → presenting.md, absorb Presentation Template
  and Language Rules; close card schema with verbatim template +
  anti-field list (Anchor/Author/Issue/File)
- Rename implementation.md → publishing.md, compress publish blockers
  and absorb thread_map structure
- Delete data-contract.md; move JSON shape to fetch-comments.py docstring
- SKILL.md: add Step 2 preview-table prohibition; trim Common Mistakes
  to top 3; update cross-file refs; -40 lines

Net: 787 lines → ~459 lines (-42%); single source of truth per concept;
eliminates field-schema drift observed in Codex output.
```

## 12. 验证 + 回滚

### 验证清单（commit 后跑一遍）

| 检查 | 命令 | 预期 |
|---|---|---|
| 新文件存在 | `ls skills/resolve-pr-comments/*.md` | 5 个 .md（SKILL / analyzing / presenting / publishing / resolve-threads） |
| 旧文件已删 | 上面 ls | 不应出现 data-gather / data-contract / deep-analysis / interaction / implementation |
| 全仓库无旧引用 | `grep -rn 'data-gather\|data-contract\|deep-analysis\|interaction\.md\|implementation\.md'` 在 skills/resolve-pr-comments/ 下 | 0 hits |
| skill 可运行 | 拉一个 PR 跑 `/resolve-pr-comments` | Step 2 显示 count box（无 preview table）；Step 3 卡片用 verbatim template（无 Anchor/Author/Issue/File） |
| 多 reviewer dedup 渲染 | 找一个 PR 有 CodeRabbit + Cursor 同意见 | header 显示 `[coderabbit/cursor]` |

### 回滚

```bash
git revert <commit-sha>
```

旧文件结构完全恢复。新结构是独立的 skill 内部重组，不影响任何外部消费者。

## 13. 行数变化总览

| 文件 | 当前 | 重构后 | 变化 |
|---|---:|---:|---|
| `SKILL.md` | 120 | ~80 | -33% |
| `presenting.md` | 0 | ~110 | NEW |
| `analyzing.md` | 0 | ~115 | NEW |
| `publishing.md` | 0 | ~70 | NEW |
| `resolve-threads.md` | 84 | 84 | 不变 |
| `data-gather.md` | 142 | — | DELETED |
| `data-contract.md` | 92 | — | DELETED |
| `deep-analysis.md` | 149 | — | DELETED |
| `interaction.md` | 96 | — | RENAMED → presenting.md |
| `implementation.md` | 104 | — | RENAMED → publishing.md |
| `scripts/fetch-comments.py` | (脚本) | +25 docstring 行 | 加 JSON shape |
| **合计 .md 行数** | **787** | **~459** | **-42%** |

## 14. 风险与权衡

| 风险 | 缓解 |
|---|---|
| Agent 已学到旧文件名（在 prior 里） | SKILL.md 是入口，agent 读了 SKILL.md 就会看到新引用；旧文件不再存在意味着错误引用会 fail loudly |
| 单大 commit 难以 review | commit message 用结构化 bullets；diff 可按文件分块看；reviewer 主要核对 SKILL.md cross-file refs 正确即可 |
| `analyzing.md` 合并后两步边界模糊 | 用章节标题做时序锚点（Classification → Severity → Re-evaluation → Taxonomy → The One Rule） |
| 多 reviewer dedup 字母序在边缘情况下不直观 | 文档说明排序规则；用户可在 review 阶段反馈 |

## 15. 下一步

实施计划由 `writing-plans` skill 生成，覆盖：

1. 创建 3 个新文件的逐节内容映射（每节从哪些旧文件 lines 抽取）
2. SKILL.md 的逐处编辑指令
3. fetch-comments.py 的 docstring patch
4. 删除 5 个旧文件的命令
5. 验证脚本（grep + ls）
6. commit 文案模板
