# Opsx Prompt Test Spec

This skill now has a lightweight contract harness.

The harness does not try to snapshot exact wording. It checks invariants that should stay true across model phrasing changes.

## Run The Built-In Samples

```bash
npm run test:opsx-prompt
```

This validates the checked-in sample responses under `skills/opsx-prompt/testdata/responses/` against their scenario fixtures.

## Validate A Real Skill Run

1. Run the skill manually on one scenario input.
2. Save the output to a markdown file.
3. Validate it:

```bash
node scripts/test-opsx-prompt.js --scenario wrong-symbol --response /tmp/opsx-output.md
```

## Scenario Coverage

- `clean-issue`: basic issue -> prompt flow
- `wrong-symbol`: mismatch note after lightweight grounding
- `repo-unavailable`: repo-dependent check skipped explicitly
- `symbol-sensitive`: literal symbol-level ask preserved in a user note
- `ambiguous-open-questions`: non-blocking ambiguity routed to `Open questions`
- `freeform-unknown-service`: deterministic freeform header behavior
- `deep-review-follow-up`: deep review stays outside the prompt
- `clarification-stop`: materially false premise stops prompt generation

## What The Harness Checks

- prompt present or absent as expected
- header shape
- required prompt sections
- required or forbidden user-note headings
- forbidden code-like content inside the main prompt
- required stop or fallback text for risky cases

## What It Does Not Check

- exact wording quality
- whether the model chose the best possible paraphrase
- whether a real Linear fetch or repo lookup succeeded

Use this harness for regression safety, then layer manual review on top for prompt quality.
