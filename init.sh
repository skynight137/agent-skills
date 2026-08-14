#!/usr/bin/env bash

set -euo pipefail

# ── Paths ─────────────────────────────────────────────────────────────────────
WORKSPACE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SKILL_ROOT="$WORKSPACE/.agents/skills"
REPLIT_SKILL_SOURCE="$WORKSPACE/.local/skills"
REPLIT_SECONDARY_SKILL_SOURCE="$WORKSPACE/.local/secondary_skills"
REPLIT_RSYNC_ARGS=(-a --delete --exclude='.fingerprint')
SKILL_REPOS=(
#  "obra/superpowers"
#  "addyosmani/agent-skills"
ng-claude-code"
#  "remotion-dev/ski───────────────────────────────────────────────────────────────
COL_GREEN="\033[0;32m"
COL_YELLOW="\033[1;33m"
COL_RED="\033[0;31m"
COL_RESET="\033[0m"
COL_BOLD="\033[1m"

step() { echo -e "\n${COL_BOLD}▶ $*${COL_RESET}"; }
ok()   { echo -e "  ${COL_GREEN}✓${COL_RESET} $*"; }
die()  { echo -e "\n  ${COL_RED}✗ ERROR:${COL_RESET} $*\n"; exit 1; }

need_cmd() { command -v "$1" &>/dev/null || die "'$1' not found — required to continue"; }

assert_non_empty_tree() {
  local root="$1"
  local label="$2"

  [[ -n "$(find "$root" -type f -print -quit)" ]] \
    || die "$label produced no files: $root"
}

rewrite_replit_skill_references() {
  local root="$1"
  local file

  while IFS= read -r -d '' file; do
    sed -i \
      -e 's#\.local/skills#\.agents/skills/replit/skills#g' \
      -e 's#\.local/secondary_skills#\.agents/skills/replit/secondary_skills#g' \
      "$file"
  done < <(
    rg -l -0 --hidden '\.local/(skills|secondary_skills)' "$root" 2>/dev/null || true
  )
}

install_skill_repo() {
  local repository="$1"
  local owner="${repository%%/*}"
  local stage="$SKILL_STAGE/$owner"

  step "Installing skills from $repository"
  mkdir -p "$stage"
  printf '{"name":"copy-note-skill-stage","private":true}\n' > "$stage/package.json"
  (
    cd "$stage"
    npx -y skills add "$repository" --agent codex --skill '*' --yes --copy
  )

  [[ -d "$stage/.agents/skills" ]] \
    || die "Skill installer produced no .agents/skills directory for $repository"
  assert_non_empty_tree "$stage/.agents/skills" "$repository installer"

  mkdir -p "$SKILL_ROOT/$owner"
  rsync -a --delete "$stage/.agents/skills/" "$SKILL_ROOT/$owner/"
  assert_non_empty_tree "$SKILL_ROOT/$owner" "$repository synchronization"
  ok "Synchronized $repository → .agents/skills/$owner"
}

sync_replit_skill_tree() {
  local source="$1"
  local destination="$2"

  [[ -d "$source" ]] || die "Required Replit skill source is missing: $source"
  assert_non_empty_tree "$source" "Replit skill source"
  mkdir -p "$destination"
  rsync "${REPLIT_RSYNC_ARGS[@]}" "$source/" "$destination/"
  assert_non_empty_tree "$destination" "Replit skill synchronization"
  rewrite_replit_skill_references "$destination"
  ok "Synchronized $source → $destination"
}

install_skills() {
  local repository

  need_cmd npx
  need_cmd rsync
  need_cmd rg
  mkdir -p "$SKILL_ROOT"
  SKILL_STAGE="$(mktemp -d "${TMPDIR:-/tmp}/copy-note-skills.XXXXXX")"
  trap 'rm -rf -- "${SKILL_STAGE:-}"' EXIT

  for repository in "${SKILL_REPOS[@]}"; do
    install_skill_repo "$repository"
  done

  sync_replit_skill_tree \
    "$REPLIT_SKILL_SOURCE" \
    "$SKILL_ROOT/replit/skills"
  sync_replit_skill_tree \
    "$REPLIT_SECONDARY_SKILL_SOURCE" \
    "$SKILL_ROOT/replit/secondary_skills"
}

install_skills