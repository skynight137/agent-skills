# Project overview

This repository publishes reusable agent skills. Its owned skill set includes
`code-simplification`, `delegation-mode`, `test-driven-development`,
`writing-plans`, and `writing-skills`; `code-review-axes-and-quality`
demonstrates how a larger review skill composes with the delegation execution
layer while enforcing review-artifact and verdict checks.

`delegation-mode` provides resumable sequential and parallel dispatch through
executable plan files and validated Markdown results under `.agents/plans/`.
`writing-plans` creates implementation plans in the same directory with
trackable status frontmatter and a verified compile/diff/staged-diff/commit
handoff.

## User preferences

- Prefer durable filesystem handoffs over chat-only summaries.
- Preserve stable task IDs so interrupted delegated work can resume safely.
- Write delegated results as plan files under `.agents/plans/`.
- Treat `skills/` as the publishable source and compile it with `bash init.sh`
  before reviewing the installed `.agents/skills/` tree.