// Shared validation for resumable delegation and review plan runners.

export function createPlanValidation({
  fs,
  path,
  planDir,
  markerRoot = process.cwd(),
  errorPrefix,
}) {
  function fail(message) {
    throw new Error(`${errorPrefix}: ${message}`);
  }

  function assertNoPlaceholders(value, label) {
    if (value.includes("<") || value.includes(">")) {
      fail(`${label} still contains a placeholder`);
    }
  }

  function assertSafeSlug(value) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
      fail(`SLUG must contain lowercase letters, numbers, and hyphens: ${value}`);
    }
  }

  function assertSafePlanPath(candidate, label) {
    const root = path.resolve(planDir);
    const resolved = path.resolve(candidate);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      fail(`${label} must stay inside ${root}: ${candidate}`);
    }
    return resolved;
  }

  function frontmatter(text) {
    const match = text.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
    if (!match) return null;
    return Object.fromEntries(
      match[1]
        .split("\n")
        .map((line) => line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/))
        .filter(Boolean)
        .map(([, key, value]) => [key, value.trim()]),
    );
  }

  function markerCount(text, marker) {
    return text.split("\n").filter((line) => line.trimEnd() === marker).length;
  }

  function completionMarkerCount(text, output) {
    const markerPaths = new Set([
      output,
      path.relative(markerRoot, output),
      path.relative(process.cwd(), output),
    ]);
    const markers = new Set([...markerPaths].map((marker) => `FILE_WRITTEN: ${marker}`));
    return text.split("\n").filter((line) => markers.has(line.trimEnd())).length;
  }

  function hasFinalCompletionMarker(text, output) {
    const finalText = text.trimEnd();
    const markerPaths = new Set([
      output,
      path.relative(markerRoot, output),
      path.relative(process.cwd(), output),
    ]);
    return [...markerPaths].some((marker) => finalText.endsWith(`FILE_WRITTEN: ${marker}`));
  }

  function validatePlanConfiguration({
    date,
    slug,
    projectContext,
    mode,
    doneIds,
    knownIds,
    outputPaths,
    finalOutput,
  }) {
    assertNoPlaceholders(date, "DATE");
    assertNoPlaceholders(slug, "SLUG");
    assertNoPlaceholders(projectContext, "PROJECT_CONTEXT");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      fail(`DATE must use YYYY-MM-DD: ${date}`);
    }
    assertSafeSlug(slug);
    if (!["sequential", "parallel"].includes(mode)) {
      fail(`MODE must be "sequential" or "parallel", got ${mode}`);
    }
    if (!Array.isArray(doneIds)) fail("DONE_IDS must be an array");
    if (!Array.isArray(knownIds)) fail("knownIds must be an array");
    if (new Set(doneIds).size !== doneIds.length) {
      fail("DONE_IDS contains duplicate IDs");
    }
    const known = new Set(knownIds);
    for (const id of doneIds) {
      if (!known.has(id)) fail(`DONE_IDS contains unknown task ID: ${id}`);
    }
    for (const { output, label } of outputPaths) {
      assertSafePlanPath(output, label);
    }
    assertSafePlanPath(finalOutput, "final output");
  }

  async function validateDurableFile({
    output,
    label,
    expectedFrontmatter = {},
    missingReason = "result file does not exist",
    notFileReason = "result path is not a regular file",
    frontmatterReason = "missing truthful plan frontmatter",
    markerReason = "completion marker is missing, duplicated, or not the final non-empty line",
    requiredText = [],
    forbiddenText = [],
    minLines = 0,
  }) {
    const resolved = assertSafePlanPath(output, label);
    let stat;
    try {
      stat = await fs.lstat(resolved);
    } catch {
      return { ok: false, output, reason: missingReason };
    }
    if (!stat.isFile()) return { ok: false, output, reason: notFileReason };

    const text = await fs.readFile(resolved, "utf8");
    const metadata = frontmatter(text);
    if (
      !metadata ||
      Object.entries(expectedFrontmatter).some(([key, value]) => metadata[key] !== value)
    ) {
      return { ok: false, output, reason: frontmatterReason };
    }
    if (completionMarkerCount(text, output) !== 1 || !hasFinalCompletionMarker(text, output)) {
      return { ok: false, output, reason: markerReason };
    }
    if (requiredText.some((value) => !text.includes(value))) {
      return { ok: false, output, reason: "missing required result content" };
    }
    if (forbiddenText.some((value) => text.includes(value))) {
      return { ok: false, output, reason: "result still contains a placeholder" };
    }
    if (minLines && text.trim().split("\n").length < minLines) {
      return { ok: false, output, reason: "result file does not contain a meaningful result" };
    }
    return { ok: true, output, path: resolved, text, metadata };
  }

  return {
    fail,
    assertNoPlaceholders,
    assertSafeSlug,
    assertSafePlanPath,
    frontmatter,
    markerCount,
    validatePlanConfiguration,
    validateDurableFile,
  };
}