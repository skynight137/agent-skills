// ============================================================================
// PLAN: .agents/plans/YYYY-MM-DD-<slug>.js
//
// Copy this file into .agents/plans/ and fill in the constants and TASKS.
// Run the complete file in a Code Execution block. On resume, update DONE_IDS
// only after inspecting and validating the durable result files.
// ============================================================================

const WORKSPACE = process.env.REPLIT_WORKSPACE || process.cwd();
const PLAN_ROOT = ".agents/plans";
const PLAN_DIR = `${WORKSPACE}/${PLAN_ROOT}`;
const DATE = "YYYY-MM-DD";
const SLUG = "<slug>";
const MODE = "sequential"; // "sequential" or "parallel"
const DONE_IDS = []; // e.g. ["01-discovery", "02-implementation"]
const FINAL_DONE = false;

const PROJECT_CONTEXT = `
## Project context
Stack: <language, framework, runtime, database>
Scope: <feature, files, branch, or commit range>
Rules and memory: <relevant project instructions and memory topics>
`;

const TASKS = [
  {
    id: "01-example",
    label: "Example task",
    focus: "Describe exactly what this worker should do.",
    dependsOn: [],
  },
  // Add more tasks with unique IDs and explicit dependencies.
];

const finalOutput = `${PLAN_DIR}/${DATE}-${SLUG}-FINAL.md`;

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath, pathToFileURL } = await import("node:url");

async function loadValidationCore() {
  const candidates = [
    path.join(WORKSPACE, "skills/delegation-mode/scripts/plan-validation-core.js"),
    path.join(WORKSPACE, ".agents/skills/replit/skills/delegation-mode/scripts/plan-validation-core.js"),
    path.join(WORKSPACE, ".agents/skills/delegation-mode/scripts/plan-validation-core.js"),
    path.join(path.dirname(fileURLToPath(import.meta.url)), "plan-validation-core.js"),
  ];
  for (const candidate of candidates) {
    try {
      return await import(pathToFileURL(candidate).href);
    } catch (error) {
      if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
    }
  }
  throw new Error("Unable to locate shared plan-validation-core.js");
}

const { createPlanValidation } = await loadValidationCore();
const validation = createPlanValidation({
  fs,
  path,
  planDir: PLAN_DIR,
  errorPrefix: "Invalid delegation plan",
});
const { fail } = validation;

async function validResultFile(output, taskId) {
  return validation.validateDurableFile({
    output,
    label: `${taskId} output`,
    expectedFrontmatter: { kind: "plan", status: "done" },
    frontmatterReason: "missing truthful plan frontmatter with kind: plan and status: done",
    minLines: 6,
  });
}

function validateConfiguration() {
  if (!Array.isArray(TASKS) || TASKS.length === 0) fail("TASKS must contain at least one task");

  const ids = new Set();
  const outputs = new Set();
  for (const task of TASKS) {
    if (!/^\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(task.id)) {
      fail(`task ID must look like 01-descriptive-name: ${task.id}`);
    }
    if (ids.has(task.id)) fail(`duplicate task ID: ${task.id}`);
    ids.add(task.id);
    task.output = `${PLAN_DIR}/${DATE}-${SLUG}-${task.id}.md`;
    const resolved = assertSafePlanPath(task.output, `${task.id} output`);
    if (outputs.has(resolved)) fail(`duplicate output path: ${resolved}`);
    outputs.add(resolved);
    task.dependsOn ??= [];
    if (!Array.isArray(task.dependsOn)) fail(`${task.id}.dependsOn must be an array`);
    for (const dependency of task.dependsOn) {
      if (dependency === task.id) fail(`${task.id} cannot depend on itself`);
      if (!TASKS.some((candidate) => candidate.id === dependency)) {
        fail(`${task.id} depends on unknown task: ${dependency}`);
      }
    }
  }
  validation.validatePlanConfiguration({
    date: DATE,
    slug: SLUG,
    projectContext: PROJECT_CONTEXT,
    mode: MODE,
    doneIds: DONE_IDS,
    knownIds: [...ids],
    outputPaths: TASKS.map((task) => ({ output: task.output, label: `${task.id} output` })),
    finalOutput,
  });
}

async function validateDoneIds() {
  for (const task of TASKS.filter((candidate) => DONE_IDS.includes(candidate.id))) {
    const result = await validResultFile(task.output, task.id);
    if (!result.ok) {
      fail(`DONE_IDS includes ${task.id}, but its result is invalid: ${result.reason}`);
    }
  }
  if (FINAL_DONE) {
    const result = await validResultFile(finalOutput, "FINAL");
    if (!result.ok) fail(`FINAL_DONE is true, but the final report is invalid: ${result.reason}`);
  }
}

function dependenciesConfirmed(task, doneSet) {
  return task.dependsOn.every((dependency) => doneSet.has(dependency));
}

function workerPrompt(task) {
  return `${PROJECT_CONTEXT}
## Assigned task: ${task.label}
Focus only on: ${task.focus}
Dependencies already confirmed: ${task.dependsOn.join(", ") || "none"}

Read complete relevant files. Do not rely on chat context. Write the complete
result to this exact path:
${task.output}

Use valid Markdown plan frontmatter:
---
id: ${DATE}-${SLUG}-${task.id}
name: ${SLUG} — ${task.label}
kind: plan
status: done
---

Record scope, evidence, conclusions or changes, verification, and remaining
risks. Mark status: done only after the result is complete and verified. If
safe completion is blocked, use status: blocked, explain the blocker, omit the
completion marker, and do not claim the task is done.

Include this exact completion line as the final non-empty line in the file:
FILE_WRITTEN: ${task.output}

After actually writing a valid completed file, end your response with exactly:
FILE_WRITTEN: ${task.output}
Do not include that marker unless the file exists and is complete.`;
}

async function report(task, result) {
  const text = result?.text ?? "";
  console.log(text || `(no response from ${task.id})`);
  const artifact = await validResultFile(task.output, task.id);
  const responseMarker = `FILE_WRITTEN: ${task.output}`;
  const responseConfirmed = text.trimEnd().endsWith(responseMarker);
  if (artifact.ok) {
    if (!responseConfirmed) console.log(`⚠ ${task.id} file confirmed; response marker was unavailable`);
    console.log(`✓ ${task.id} confirmed from durable file: ${task.output}`);
    return { id: task.id, ok: true };
  }
  console.log(`⚠ ${task.id} unresolved: ${artifact.reason}`);
  return { id: task.id, ok: false, reason: artifact.reason };
}

async function dispatch(task) {
  return subagent({
    name: `${SLUG}-${task.id}`,
    task: workerPrompt(task),
    config: { $kind: "general" },
  });
}

validateConfiguration();
await fs.mkdir(PLAN_DIR, { recursive: true });
await validateDoneIds();

const doneSet = new Set(DONE_IDS);
console.log(`Plan: ${DATE}-${SLUG}`);
console.log(`Mode: ${MODE}`);
console.log(`Already confirmed: ${doneSet.size}/${TASKS.length}`);

let pending = TASKS.filter((task) => !doneSet.has(task.id));
const unresolved = [];
let progress = true;

while (pending.length && progress) {
  progress = false;
  const runnable = pending.filter((task) => dependenciesConfirmed(task, doneSet));
  if (!runnable.length) break;

  if (MODE === "parallel") {
    const results = await Promise.allSettled(runnable.map(dispatch));
    for (const [index, settled] of results.entries()) {
      const task = runnable[index];
      const outcome = settled.status === "fulfilled"
        ? await report(task, settled.value)
        : { id: task.id, ok: false, reason: String(settled.reason) };
      if (outcome.ok) {
        doneSet.add(task.id);
        progress = true;
      } else {
        unresolved.push(outcome);
      }
    }
  } else {
    const task = runnable[0];
    console.log(`Dispatching ${task.id} sequentially...`);
    try {
      const outcome = await report(task, await dispatch(task));
      if (outcome.ok) {
        doneSet.add(task.id);
        progress = true;
      } else {
        unresolved.push(outcome);
      }
    } catch (error) {
      unresolved.push({ id: task.id, reason: String(error?.message ?? error) });
    }
  }
  pending = TASKS.filter((task) => !doneSet.has(task.id));
}

if (pending.length) {
  pending.forEach((task) => {
    if (!unresolved.some((item) => item.id === task.id)) {
      unresolved.push({
        id: task.id,
        reason: `dependencies unresolved: ${task.dependsOn.filter((id) => !doneSet.has(id)).join(", ") || "worker did not complete"}`,
      });
    }
  });
}

if (unresolved.length) {
  console.log("Unresolved tasks:");
  unresolved.forEach(({ id, reason }) => console.log(`- ${id}: ${reason}`));
} else if (doneSet.size === TASKS.length && !FINAL_DONE) {
  console.log("All task files are valid. Dispatching final aggregation...");
  const summary = await subagent({
    name: `${SLUG}-summary`,
    task: `Read every confirmed task result:
${TASKS.map((task) => `- ${task.output}`).join("\n")}

Write a deduplicated final plan to ${finalOutput}. Include the completed
scope, decisions, prioritized next actions, verification evidence, and
remaining risks. Use valid plan frontmatter with status: done.

Include this exact completion line as the final non-empty line in the file:
FILE_WRITTEN: ${finalOutput}

After actually writing the file, end your response with exactly:
FILE_WRITTEN: ${finalOutput}`,
    config: { $kind: "general" },
  });
  const finalResult = await validResultFile(finalOutput, "FINAL");
  if (finalResult.ok) {
    console.log(`✓ Final plan confirmed: ${finalOutput}`);
    console.log("Set FINAL_DONE = true only after independently reviewing this file.");
  } else {
    console.log(`⚠ Final aggregation unresolved: ${finalResult.reason}`);
  }
} else if (FINAL_DONE) {
  console.log("All tasks and the independently validated final plan are confirmed.");
}