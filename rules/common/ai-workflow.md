# Performance Optimization

## Model Selection

Follow the model routing configured in your global CLAUDE.md or orchestration plugin. When in doubt, use the most capable model available.

General principles:

- Use the highest-capability model for architecture decisions and complex analysis
- Use standard-tier models for routine implementation tasks
- Delegate lightweight read-only operations to the fastest available model

## Context Window Management

Avoid last 20% of context window for:

- Large-scale refactoring
- Feature implementation spanning multiple files
- Debugging complex interactions

Lower context sensitivity tasks:

- Single-file edits
- Independent utility creation
- Documentation updates
- Simple bug fixes

## Extended Thinking + Plan Mode

Extended thinking is enabled by default, reserving up to 31,999 tokens for internal reasoning.

Control extended thinking via:

- **Toggle**: Option+T (macOS) / Alt+T (Windows/Linux)
- **Config**: Set `alwaysThinkingEnabled` in `~/.claude/settings.json`
- **Budget cap**: `export MAX_THINKING_TOKENS=10000`
- **Verbose mode**: Ctrl+O to see thinking output

For complex tasks requiring deep reasoning:

1. Ensure extended thinking is enabled (on by default)
2. Enable **Plan Mode** for structured approach
3. Use multiple critique rounds for thorough analysis
4. Use split role sub-agents for diverse perspectives

## Build Troubleshooting

If build fails:

1. Use **go-build-resolver** agent
2. Analyze error messages
3. Fix incrementally
4. Verify after each fix
