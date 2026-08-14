// ============================================================================
// Durable ten-axis review plan for the current publishable skill tree.
// Run this file in a Code Execution block. On resume, update DONE_IDS only
// after validating the durable axis result files.
// ============================================================================

const WORKSPACE = process.env.REPLIT_WORKSPACE || process.cwd();
const PLAN_ROOT = ".agents/plans";
const PLAN_DIR = `${WORKSPACE}/${PLAN_ROOT}`;
const DATE = "2026-08-14";
const SLUG = "current-project-review";
const MODE = "sequential";
const DONE_IDS = [
  "01-correctness",
  "02-performance",
  "03-scalability",
  "04-infra-fit",
  "05-library-hygiene",
  "06-security",
  "07-data-concurrency",
  "08-observability",
  "09-maintainability",
  "10-readability",
];
const FINAL_DONE = true;

const PROJECT_CONTEXT = `
## Project context
Stack: Markdown skill definitions, JavaScript ES modules executed by Code Execution, Bash installer; no application runtime or tracked automated test suite.
Review scope: current publishable source tree under skills/, installer init.sh, README.md, replit.md, and the latest commits on main through HEAD ac4795c.
Recent history: review HEAD~8..HEAD, with special attention to ac4795c, a2b045a, 92c2862, 93b290f, 2ab9e54, 367cbde, 1649cae, and dadd4c9.
Rules and memory: read replit.md and .agents/memory/MEMORY.md; .agents/memory/delegation-mode.md is the only linked memory topic.
Relevant files: skills/delegation-mode/SKILL.md, skills/delegation-mode/references/delegation-modes.md, skills/delegation-mode/scripts/delegation-plan.template.js, skills/writing-plans/SKILL.md, skills/writing-plans/plan-document-reviewer-prompt.md, skills/code-review-axes-and-quality/SKILL.md, skills/code-review-axes-and-quality/scripts/review-plan.template.js, init.sh, README.md, replit.md, .replit, and .gitignore.
Verification baseline: bash -n init.sh; node --check on both JavaScript templates; bash init.sh; git diff --check; inspect current tests and tracked files. Do not claim checks that were not run.
`;

const AXES = [
  ["01-correctness", "Correctness", "bugs, edge cases, incorrect assumptions, regressions"],
  ["02-performance", "Performance", "bottlenecks, unnecessary work, latency, memory, hot paths"],
  ["03-scalability", "Scalability", "failure or degradation under growth, concurrency, larger inputs"],
  ["04-infra-fit", "Infrastructure", "existing project wiring, boundaries, and operations"],
  ["05-library-hygiene", "Library hygiene", "dependencies, supported APIs, versions, and usage"],
  ["06-security", "Security", "input handling, auth, secrets, injection, SSRF, XSS, abuse"],
  ["07-data-concurrency", "Data integrity and concurrency", "atomicity, idempotency, races, ordering, retries"],
  ["08-observability", "Observability", "logs, metrics, traces, alerts, diagnostics, failure visibility"],
  ["09-maintainability", "Maintainability", "coupling, cohesion, change risk, duplication, architecture"],
  ["10-readability", "Readability", "naming, control flow, local comprehension, cognitive load"],
];

const fs = await import("node:fs/promises");
const path = await import("node:path");
const { fileURLToPath, pathToFileURL } = await import("node:url");
const finalOutput = `${PLAN_DIR}/${DATE}-${SLUG}-FINAL.md`;

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
  markerRoot: WORKSPACE,
  errorPrefix: "Invalid review plan",
});
const { fail } = validation;

async function readValidAxis(task) {
  const output = `${PLAN_DIR}/${DATE}-${SLUG}-${task[0]}.md`;
  const result = await validation.validateDurableFile({
    output,
    label: `${task[0]} output`,
    expectedFrontmatter: { kind: "plan", category: "review", status: "done" },
    missingReason: "axis result file does not exist",
    notFileReason: "axis result is not a regular file",
    frontmatterReason: "missing truthful review-plan frontmatter",
    markerReason: "completion marker is missing, duplicated, or not final",
    requiredText: [`**Scope:**`, `**Axis:** ${task[1]}`, "**Verification:**"],
    forbiddenText: ["<the exact scope reviewed>", "<the commands and results actually run>"],
  });
  return result.ok ? { ...result, axis: task[1] } : result;
}

function parseFindingRows(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .filter((cells) => cells.length === 7 && /^(CRITICAL|HIGH|MEDIUM|LOW)$/.test(cells[1]));
}

function unresolvedBlockers(axisResults) {
  return axisResults.flatMap((result) =>
    parseFindingRows(result.text)
      .filter((cells) => ["CRITICAL", "HIGH"].includes(cells[1]) && cells[6] !== "resolved")
      .map((cells) => ({
        axis: result.axis,
        severity: cells[1],
        id: cells[0],
        status: cells[6],
      })),
  );
}

async function readValidFinal(axisResults) {
  const artifact = await validation.validateDurableFile({
    output: finalOutput,
    label: "final output",
    expectedFrontmatter: { kind: "plan", category: "review", status: "done" },
    missingReason: "final report does not exist",
    notFileReason: "final report is not a regular file",
    frontmatterReason: "missing truthful final-review frontmatter",
    markerReason: "final completion marker is missing, duplicated, or not final",
  });
  if (!artifact.ok) return artifact;
  const { text } = artifact;
  const verdict = text.match(/\*\*Verdict:\*\*\s*(APPROVE|APPROVE_WITH_FOLLOW_UP|REQUEST_CHANGES)\b/);
  if (!verdict) return { ok: false, reason: "final report has no valid verdict" };
  const blockers = unresolvedBlockers(axisResults);
  if (blockers.length && verdict[1] !== "REQUEST_CHANGES") {
    return {
      ok: false,
      reason: `final verdict ${verdict[1]} ignores unresolved ${blockers.map((item) => `${item.severity} ${item.axis}/${item.id}`).join(", ")}`,
    };
  }
  return { ok: true, verdict: verdict[1], blockers };
}

function validateConfiguration() {
  validation.validatePlanConfiguration({
    date: DATE,
    slug: SLUG,
    projectContext: PROJECT_CONTEXT,
    mode: MODE,
    doneIds: DONE_IDS,
    knownIds: AXES.map(([id]) => id),
    outputPaths: AXES.map(([id]) => ({
      output: `${PLAN_DIR}/${DATE}-${SLUG}-${id}.md`,
      label: `${id} output`,
    })),
    finalOutput,
  });
}

function axisPrompt([id, label, focus]) {
  const output = `${PLAN_DIR}/${DATE}-${SLUG}-${id}.md`;
  return `${PROJECT_CONTEXT}
## Assigned axis: ${label}
Focus only on: ${focus}.

Review protocol:
1. Establish intent and exact scope before judging implementation.
2. Read relevant tests first; check behavior coverage, edge cases, and
   regression coverage.
3. Read complete implementation context, callers, canonical helpers,
   configuration, type boundaries, and dependencies, not only diff hunks.
4. Focus on the assigned axis and avoid duplicate findings belonging elsewhere.
5. Verify the actual test, lint, type-check, build, manual, benchmark, and
   dependency checks; never claim a check that was not run.
6. If the issue is structural, propose a named remedy that removes complexity.
   Identify dead code explicitly without silently deleting uncertain code.

Read complete relevant files. Do not modify application source. Write your
complete findings to this exact path:
${output}

Use this frontmatter:
---
id: ${DATE}-${SLUG}-${id}
name: ${SLUG} — ${label} findings
kind: plan
category: review
status: done
reusable: false
description: Findings from the ${label} review.
tags: [code-review, ${id.replace(/^\d+-/, "")}]
---

Include:
**Scope:** the exact scope reviewed
**Axis:** ${label}
**Verification:** commands actually run and their results, or explicit unavailable checks

Then include a seven-column findings table with severity, location, impact,
recommended fix, and status. An empty result must explicitly say that no
findings were found for this scope. Use status required, recommended, optional,
accepted-risk, or resolved. Never mark a finding resolved without evidence.
Include dead-code or dependency conclusions when relevant.

Include this exact completion line as the final non-empty line in the file:
FILE_WRITTEN: ${output}

After actually writing a valid completed file, end your response with exactly:
FILE_WRITTEN: ${output}
Do not include that marker unless the file exists and is complete.`;
}

async function dispatch(axis) {
  return subagent({
    name: `${SLUG}-${axis[0]}`,
    task: axisPrompt(axis),
    config: { $kind: "general" },
  });
}

async function report(axis, result) {
  const text = result?.text ?? "";
  console.log(text || `(no response from ${axis[0]})`);
  const artifact = await readValidAxis(axis);
  if (artifact.ok) {
    console.log(`✓ ${axis[0]} confirmed from durable file: ${artifact.output}`);
    return { id: axis[0], ok: true };
  }
  console.log(`⚠ ${axis[0]} unresolved: ${artifact.reason}`);
  return { id: axis[0], ok: false, reason: artifact.reason };
}

validateConfiguration();
await fs.mkdir(PLAN_DIR, { recursive: true });

const doneSet = new Set(DONE_IDS);
const confirmedResults = [];
for (const axis of AXES.filter((candidate) => doneSet.has(candidate[0]))) {
  const result = await readValidAxis(axis);
  if (!result.ok) fail(`DONE_IDS includes ${axis[0]}, but its result is invalid: ${result.reason}`);
  confirmedResults.push(result);
}
if (FINAL_DONE) {
  if (doneSet.size !== AXES.length) {
    fail("FINAL_DONE requires every axis ID to be present in DONE_IDS");
  }
  const allAxisResults = [];
  for (const axis of AXES) {
    const result = await readValidAxis(axis);
    if (!result.ok) fail(`FINAL_DONE requires a valid ${axis[0]} result: ${result.reason}`);
    allAxisResults.push(result);
  }
  const finalResult = await readValidFinal(allAxisResults);
  if (!finalResult.ok) fail(`FINAL_DONE is true, but the final report is invalid: ${finalResult.reason}`);
}

console.log(`Review: ${DATE}-${SLUG}`);
console.log(`Mode: ${MODE}`);
console.log(`Already confirmed: ${doneSet.size}/${AXES.length}`);

const pending = AXES.filter(([id]) => !doneSet.has(id));
const unresolved = [];
if (MODE === "parallel") {
  const results = await Promise.allSettled(pending.map(dispatch));
  for (const [index, settled] of results.entries()) {
    const outcome = settled.status === "fulfilled"
      ? await report(pending[index], settled.value)
      : { id: pending[index][0], ok: false, reason: String(settled.reason) };
    if (!outcome.ok) unresolved.push(outcome);
  }
} else {
  for (const axis of pending) {
    console.log(`Dispatching ${axis[0]} sequentially...`);
    try {
      const outcome = await report(axis, await dispatch(axis));
      if (!outcome.ok) unresolved.push(outcome);
    } catch (error) {
      unresolved.push({ id: axis[0], reason: String(error?.message ?? error) });
      break;
    }
  }
}

if (unresolved.length) {
  console.log("Unresolved axes:");
  unresolved.forEach(({ id, reason }) => console.log(`- ${id}: ${reason}`));
} else if (doneSet.size + pending.length === AXES.length && !FINAL_DONE) {
  const axisResults = [];
  for (const axis of AXES) {
    const result = await readValidAxis(axis);
    if (!result.ok) {
      console.log(`⚠ Final aggregation blocked: ${axis[0]} is invalid: ${result.reason}`);
      process.exitCode = 1;
      break;
    }
    axisResults.push(result);
  }
  if (axisResults.length === AXES.length) {
    const blockers = unresolvedBlockers(axisResults);
    const finalPrompt = `You are aggregating a ten-axis code review.

Read all ten source files:
${axisResults.map((result) => `- ${result.output}`).join("\n")}

Write a deduplicated final report to ${finalOutput}. Sort the master findings
table by severity, group concrete priority work items, include the reviewed
scope and verification context, and give the next agent enough context to act.
Use exactly one verdict: APPROVE, APPROVE_WITH_FOLLOW_UP, or REQUEST_CHANGES.
The following machine-detected blockers must be reflected in the verdict:
${blockers.length ? blockers.map((item) => `- ${item.severity}: ${item.axis}/${item.id} (${item.status})`).join("\n") : "- none"}
Do not use APPROVE or APPROVE_WITH_FOLLOW_UP while any CRITICAL or HIGH finding
is unresolved. Use REQUEST_CHANGES when blockers remain.

Use valid frontmatter:
---
id: ${DATE}-${SLUG}-FINAL
name: ${SLUG} — final review
kind: plan
category: review
status: done
reusable: false
description: Merged outcome of the ten-axis ${SLUG} review.
tags: [code-review]
---

Include a line in this exact shape:
**Verdict:** APPROVE | APPROVE_WITH_FOLLOW_UP | REQUEST_CHANGES

Include this exact completion line as the final non-empty line in the file:
FILE_WRITTEN: ${finalOutput}

After actually writing the file, end your response with exactly:
FILE_WRITTEN: ${finalOutput}`;
    const summary = await subagent({
      name: `${SLUG}-summary`,
      task: finalPrompt,
      config: { $kind: "general" },
    });
    console.log(summary?.text || "(no response from summary)");
    const finalResult = await readValidFinal(axisResults);
    if (finalResult.ok) {
      console.log(`✓ Final review confirmed: ${finalOutput}`);
      console.log(`Verdict: ${finalResult.verdict}`);
      console.log("Set FINAL_DONE = true only after independently reviewing this file.");
    } else {
      console.log(`⚠ Final aggregation unresolved: ${finalResult.reason}`);
      process.exitCode = 1;
    }
  }
} else if (FINAL_DONE) {
  console.log("All ten axes and the independently validated final report are confirmed.");
}