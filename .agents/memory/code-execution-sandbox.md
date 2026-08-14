---
name: Code Execution sandbox boundary
description: Environment-specific limits encountered when running durable workspace dispatchers.
---

The Code Execution callback sandbox may reject arbitrary Node imports such as `node:fs/promises` and may not load workspace files through dynamic module imports. Registered callbacks such as `subagent` remain available directly.

**Why:** A durable dispatcher that imports its plan module can fail before any worker runs, even when the same plan is syntactically valid and executable in the repository's Node environment.

**How to apply:** Use CodeExecution for direct registered callback calls, and use shell tools for workspace reads, validation, compilation, and git operations. If a plan's filesystem-backed dispatcher cannot be imported, preserve its task prompts and durable output contract while dispatching the remaining tasks directly and validating their files independently.