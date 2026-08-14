# Agent skills

Reusable skills for durable, cross-session delegated work.

```bash
npx -y skills add skynight137/agent-skills
```

## Included skills

- `code-simplification` — reduces code complexity while preserving exact
  behavior, with incremental verification and scope control.
- `delegation-mode` — resumable sequential or parallel dispatch driven by an
  executable plan file. Each task writes one validated result plan to
  `.agents/plans/`; resume state is accepted only for known IDs with valid
  durable markers.
- `test-driven-development` — test-first implementation guidance covering
  failing-test proof, minimal green changes, refactoring, and regression
  verification.
- `writing-skills` — creates and verifies reusable skills with a
  RED/GREEN/REFACTOR documentation workflow.
- `writing-plans` — creates detailed implementation plans with status
  frontmatter under `.agents/plans/`, plus a verified
  compile/diff/staged-diff/commit handoff for safe execution.
- `code-review-axes-and-quality` — a ten-axis quality review that composes with
  `delegation-mode`, supports both dispatch modes, validates every axis result,
  and rejects an approval verdict that ignores unresolved critical findings.

## Durable result convention

Delegated work is intentionally saved in the project that owns the work:

```text
.agents/plans/YYYY-MM-DD-<slug>.js
.agents/plans/YYYY-MM-DD-<slug>-<task-id>.md
.agents/plans/YYYY-MM-DD-<slug>-FINAL.md
```

If a Code Execution run is interrupted, inspect the output files and update
`DONE_IDS` with only known task IDs whose output has valid frontmatter and the
final `FILE_WRITTEN` marker. Then rerun the same plan. Completed tasks are
skipped; unresolved tasks continue. Set `FINAL_DONE = true` only after
independently validating the final report.

## Safe delivery contract

Implementation plans require fresh compile/test evidence, a complete diff
review, `git diff --check`, a staged diff review, and a conventional commit
before a task is marked done. The repository's publishable source is under
`skills/`; run `bash init.sh` to compile it into the installed
`.agents/skills/` view before validating the final diff.

