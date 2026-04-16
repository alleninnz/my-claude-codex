# Code Exploration — Discovery Subagent

Dispatch as an Explore subagent (model: `opus`) to discover functionality the issue didn't mention. Fill in `{REPO_PATH}` and `{INTENT_SUMMARY}` before dispatching.

## Prompt template

```
Explore the codebase at {REPO_PATH} to discover functionality that this change description missed.

## Change intent

{INTENT_SUMMARY}

## Your job

Find things the description MISSED — related functionality, existing infrastructure, breaking changes. Do NOT plan the implementation. Do NOT list things the description already covers.

## Exploration strategy

1. Find the entry points (RPCs, mutations, handlers, store methods) most relevant to the intent
2. Trace shared dependencies (max 2 hops from entry points) — if function A is changing, what else calls A? What helper functions does A use that would also need updating?
3. Inspect request/response types, ent schemas, and proto messages for fields that exist but aren't populated or packed in the relevant code path
4. Check for existing infrastructure (store methods, DB columns, ent fields, feature flags, email templates) already in place that this change should build on rather than recreate
5. Identify upstream/downstream consumers — who calls this RPC or mutation? What GraphQL resolvers or other services wrap it?
6. Check for related openspec changes (in openspec/changes/) or recently merged PRs that represent prerequisite work already landed

## Output format

Return a flat list of discoveries. Each entry has a tag, a one-sentence description, and a brief reason:

- [existing] description — reason: why this is relevant to the change
- [missing] description — reason: what code evidence led to this discovery
- [breaking] description — reason: what specifically changes

The reason field helps the parent agent filter irrelevant discoveries. It will NOT appear in the final prompt.

Only report discoveries that are DIRECTLY CAUSED BY or REQUIRED FOR this change. Do not report:
- Pre-existing bugs or code quality issues unrelated to the change
- General improvement suggestions
- Architectural differences between code paths that aren't affected by the change

If you find nothing new, say so.
```

## Dispatch instructions

```python
Agent(
    name="code-explorer",
    description="Discover missed functionality",
    subagent_type="Explore",
    prompt=<filled template above>,
    model="opus"
)
```

Parse the returned discoveries for Phase 3 prompt generation. Filter each: "Is this directly caused by or required for the described change?" Discard if not.
