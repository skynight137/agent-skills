---
name: Delegation resume contract
description: Durable rules for resumable delegated work in this skill repository.
---

Delegated workflows use an executable plan with stable task IDs and one
distinct result plan per task under `.agents/plans/`. Completion is explicit:
the result file and the `FILE_WRITTEN:` marker must be verified before an ID is
added to `DONE_IDS`.

**Why:** A Code Execution process can be killed after one worker has written its
result but before the dispatcher returns its response. Explicit resume state
lets a later run preserve completed work without trusting chat history or
mistaking partial files for finished tasks.

**How to apply:** Prefer sequential dispatch for dependencies or shared
mutation; use parallel dispatch only for independent tasks with unique output
paths. On resume, inspect result files, update `DONE_IDS`, and rerun the same
plan. Aggregate only after every task is confirmed.

Ten-axis code reviews add a quality gate on top of delegation: tests-first
intent discovery, evidence-based findings, named structural remedies, explicit
dependency/dead-code checks, and a verdict that blocks unresolved critical or
high findings.

**Why:** A durable review is only useful if every worker applies the same
quality standard; otherwise parallel axes produce inconsistent findings and a
final aggregator can hide missing verification.

**How to apply:** Keep the ten axis IDs stable, include verification evidence
and finding status in every axis plan, and require the final plan to state
approval, follow-up, or requested changes with residual risks.

The review skill is named `code-review-axes-and-quality` and composes with
`delegation-mode` rather than duplicating its dispatch and resume rules.

**Why:** Keeping review methodology separate from orchestration lets other
quality workflows reuse the same resumable execution contract.

**How to apply:** Read the companion delegation skill before creating or
running a review plan; preserve the existing axis task IDs when resuming.