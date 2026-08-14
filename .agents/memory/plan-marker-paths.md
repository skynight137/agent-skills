---
name: Plan marker path compatibility
description: Durable plan markers must remain compatible with workspace-relative and absolute output paths.
---

The shared plan validation core accepts exactly one final `FILE_WRITTEN:` marker
whose path is either the prompted output path or its equivalent workspace-relative
form. It still rejects missing, duplicated, and non-final markers.

**Why:** Existing durable review artifacts use `.agents/plans/...` markers while
some executable plans construct absolute output paths when `REPLIT_WORKSPACE`
is set. Rejecting the equivalent relative form would invalidate resumable work.

**How to apply:** Keep worker prompts explicit about the exact output path, and
route all marker checks through the shared validation core rather than adding
runner-specific path normalization.