# Delegation modes

The reusable plan runner supports two dispatch modes. Both modes write durable
task results to `.agents/plans/` and can be resumed by rerunning the same
JavaScript plan with explicit `DONE_IDS`. The runner validates each result
file's frontmatter, path, and final completion marker before confirmation.

## Sequential: safe default

```js
const MODE = "sequential";
```

The runner awaits each pending task before starting the next:

```text
task 1 → await → task 2 → await → ... → task N → aggregate
```

Choose sequential when tasks have dependencies, workers may edit overlapping
source files, the repository or tool budget is shared, or a clear failure
boundary is more valuable than speed.

## Parallel: independent tasks

```js
const MODE = "parallel";
```

The runner starts all pending tasks together with `Promise.allSettled` and
checks every result file:

```text
task 1 ┐
task 2 ├─ await all results → aggregate only if all confirm
...    │
task N ┘
```

Choose parallel only when every task is independent, every worker writes a
unique output path, no worker depends on another worker's result, and the
workers do not mutate shared source files.

## Required completion contract

Each worker must use `config: { $kind: "general" }` for file-writing work and
must:

1. read complete relevant files;
2. write the exact output file from its prompt;
3. include valid plan frontmatter, the requested result, and the exact
   `FILE_WRITTEN: <exact-path>` line as the final non-empty line in the file;
4. end with `FILE_WRITTEN: <exact-path>` in its response only after writing it.

The runner treats a missing, misplaced, duplicated, or file-only response
marker as unresolved until the output file itself is valid. It does not run
aggregation until all task result files are confirmed.

## Cross-session resume

When a run is interrupted:

```bash
ls .agents/plans/YYYY-MM-DD-<slug>-*.md 2>/dev/null
```

Inspect the files, then update the plan:

```js
const DONE_IDS = [
  "01-first-task",
  "02-second-task",
];
```

Only include tasks whose result is complete and whose exact marker was
confirmed in the output file. Rerun the whole plan; it skips those IDs and
dispatches the rest. Unknown or duplicate IDs are configuration errors.
Set `FINAL_DONE = true` only after independently verifying the final file;
`FINAL_DONE` is not proof by itself.

Do not use a stale file, silence, or a chat summary as completion evidence.
Create a new slug when the scope changes.