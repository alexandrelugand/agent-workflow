#!/usr/bin/env bash
set -euo pipefail

# agent-workflow installer
#
# Usage :
#   ./install.sh                       Project (default), target Claude Code
#   ./install.sh --target codex        Project, target Codex (.codex/skills + AGENTS.md)
#   ./install.sh --target all          Project, Claude + Codex
#   ./install.sh --global              Global Claude (~/.claude) — commands in all repos
#   ./install.sh --global --target codex   Global Codex (~/.codex/skills)
#   ./install.sh --global --target all      Global Claude + Codex
#   ./install.sh init [--target …]     Set templates + rules in project (after global)
#   ./install.sh update [--target …]   Update tooling + templates (preserve your mods)
#   --hooks                            Set git hooks (opt-in, reversible)
#   --force                            Overwrite locally modified templates
#
# Two scopes: project (in current repo) or global (--global).
#
# curl -fsSL https://raw.githubusercontent.com/alexandrelugand/agent-workflow/main/install.sh | bash

REPO="https://github.com/alexandrelugand/agent-workflow.git"

# --- Resolve payload (src/) : local files, otherwise clone (curl|bash case) ---
SELF_DIR="$(cd "$(dirname -- "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || true)"
if [ -n "${SELF_DIR:-}" ] && [ -f "$SELF_DIR/src/commands/aw-prd.md" ]; then
  SRC="$SELF_DIR/src"
  PAYLOAD_ROOT="$SELF_DIR"
else
  TMP="$(mktemp -d)"
  echo "→ Fetching agent-workflow…"
  git clone --depth 1 "$REPO" "$TMP" >/dev/null 2>&1
  SRC="$TMP/src"
  PAYLOAD_ROOT="$TMP"
fi

VERSION="$(git -C "$PAYLOAD_ROOT" rev-parse --short HEAD 2>/dev/null || date +%Y-%m-%d)"
CACHE="$HOME/.claude/agent-workflow"
ORIG="./.agent-workflow/templates.orig"   # baseline templates (tool-neutral), for local-edit detection

# --- Arguments : mode + --target + --hooks + --force ---
FORCE=0; HOOKS=0; TARGET="claude"; MODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    -f|--force)   FORCE=1 ;;
    --hooks)      HOOKS=1 ;;
    --target)     TARGET="${2:-}"; shift ;;
    --target=*)   TARGET="${1#--target=}" ;;
    *)            MODE="$1" ;;
  esac
  shift
done

# Remove files installed in a previous run (listed in .aw-manifest) — never remove anything else.
clean_tooling() {
  local dest="$1" line
  [ -f "$dest/.aw-manifest" ] || return 0
  while IFS= read -r line; do
    case "$line" in
      commands/*|skills/*|agents/*|prompts/*) rm -rf "$dest/$line" ;;
    esac
  done < "$dest/.aw-manifest"
}

# Claude : copy verbatim (no build, no Node — daily path).
copy_tooling_claude() {
  local dest="$1" f
  clean_tooling "$dest"
  mkdir -p "$dest/commands" "$dest/skills" "$dest/agents"
  cp -r "$SRC/commands/." "$dest/commands/" || { echo "✗ Failed to copy commands"; exit 1; }
  cp -r "$SRC/skills/."   "$dest/skills/" || { echo "✗ Failed to copy skills"; exit 1; }
  cp -r "$SRC/agents/."   "$dest/agents/" || { echo "✗ Failed to copy agents"; exit 1; }
  : > "$dest/.aw-manifest"
  for f in "$SRC/commands/"*.md; do echo "commands/$(basename "$f")" >> "$dest/.aw-manifest"; done
  for f in "$SRC/skills/"*/;     do echo "skills/$(basename "$f")"   >> "$dest/.aw-manifest"; done
  for f in "$SRC/agents/"*.md;   do echo "agents/$(basename "$f")"   >> "$dest/.aw-manifest"; done
  echo "$VERSION" > "$dest/.aw-version"
}

# Codex : transform via Node build → .codex/skills.
copy_tooling_codex() {
  local dest="$1" stg d
  command -v node >/dev/null 2>&1 || { echo "✗ Node required for codex target (md→skills build)." >&2; return 1; }
  stg="$(mktemp -d)"
  node "$PAYLOAD_ROOT/bin/aw-build.mjs" --target codex --src "$SRC" --out "$stg" >/dev/null
  clean_tooling "$dest"
  mkdir -p "$dest"
  cp -r "$stg/." "$dest/" || { echo "✗ Failed to copy codex skills"; exit 1; }
  : > "$dest/.aw-manifest"
  for d in "$dest/skills/"*/; do echo "skills/$(basename "$d")" >> "$dest/.aw-manifest"; done
  echo "$VERSION" > "$dest/.aw-version"
  rm -rf "$stg"
}

# Copy a template only if absent or not locally modified (baseline: $ORIG).
sync_templates() {
  local payload="$1" f name type
  mkdir -p ./templates "$ORIG"
  for f in "$payload/templates/"*; do
    [ -e "$f" ] || continue  # Skip if file doesn't exist
    name="$(basename "$f")"
    type="file"
    [ -d "$f" ] && type="dir"

    # Case 1: File/template absent
    if [ ! -e "./templates/$name" ]; then
      if [ "$type" = "dir" ]; then
        cp -r "$f" "./templates/$name"; cp -r "$f" "$ORIG/$name"
      else
        cp "$f" "./templates/$name"; cp "$f" "$ORIG/$name"
      fi
    # Case 2: Template already copied in templates and ORIG, and identical
    elif [ -e "$ORIG/$name" ] && ( [ "$type" = "dir" ] || cmp -s "./templates/$name" "$ORIG/$name" 2>/dev/null ); then
      : # No copy needed
    # Case 3: --force and directory exists → remove and copy
    elif [ "$FORCE" = 1 ] && [ "$type" = "dir" ] && [ -e "./templates/$name" ]; then
      rm -rf "./templates/$name" "$ORIG/$name"
      cp -r "$f" "./templates/$name"; cp -r "$f" "$ORIG/$name"
      echo "↻  templates/$name overwritten (--force)."
    # Case 4: Modified in templates but identical to source → update ORIG
    elif [ "$type" = "dir" ] || cmp -s "./templates/$name" "$f" 2>/dev/null; then
      [ "$type" = "dir" ] || cp "$f" "$ORIG/$name"
    # Case 5: Modified in templates → warn
    else
      echo "⚠️  templates/$name locally modified — not overwritten (re-run with --force to overwrite)."
    fi
  done
}

# AGENTS.md is the shared rules source (native for Codex, imported by CLAUDE.md for Claude).
drop_agents_md() {
  local payload="$1"
  if [ -f ./AGENTS.md ]; then
    echo "⚠️  ./AGENTS.md already exists — not overwritten. Merge agent-workflow rules manually if needed."
  else
    cp "$payload/AGENTS.md" ./AGENTS.md
  fi
}
wire_claude_md() {
  if [ -f ./CLAUDE.md ]; then
    grep -qxF '@AGENTS.md' ./CLAUDE.md || printf '\n@AGENTS.md\n' >> ./CLAUDE.md
  else
    printf '@AGENTS.md\n' > ./CLAUDE.md
  fi
}

# Enforcement repo-level : git hooks (opt-in, reversible). Tool-independent.
install_hooks() {
  command -v git >/dev/null 2>&1 && git rev-parse --git-dir >/dev/null 2>&1 || {
    echo "⚠️️ Not a git repo — hooks not installed. (git init then ./install.sh --hooks)"; return 0; }
  mkdir -p ./.aw-hooks
  cp "$SRC/hooks/aw-gate.sh" "$SRC/hooks/pre-commit" "$SRC/hooks/pre-push" ./.aw-hooks/
  chmod +x ./.aw-hooks/aw-gate.sh ./.aw-hooks/pre-commit ./.aw-hooks/pre-push
  git config core.hooksPath .aw-hooks
  echo "✅ Git hooks installed (core.hooksPath=.aw-hooks). Gates: no code without validated plan, no ship without review."
  echo "   Disable: git config --unset core.hooksPath"
}

install_target() {
  case "$1" in
    claude)
      copy_tooling_claude "./.claude"
      sync_templates "$SRC"; drop_agents_md "$SRC"; wire_claude_md
      echo "✅ agent-workflow installed (Claude, project, version $VERSION)."
      echo "ℹ️  Commands: /aw-brain, /aw-prd … /aw-ship" ;;
    codex)
      copy_tooling_codex "./.codex"
      sync_templates "$SRC"; drop_agents_md "$SRC"   # AGENTS.md native for Codex, no CLAUDE.md
      echo "✅ agent-workflow installed (Codex, project, version $VERSION)."
      echo "ℹ️  Skills: aw-prd … aw-ship in .codex/skills." ;;
    all)
      install_target claude
      install_target codex ;;
    *)
      echo "Unknown target: $1 (claude|codex|all)" >&2; exit 1 ;;
  esac
}

case "$MODE" in
  ""|--project)
    install_target "$TARGET"
    if [ "$HOOKS" = 1 ]; then install_hooks; fi
    ;;

  -g|--global)
    # Cache partagé (templates + AGENTS.md + installeur) pour `init` par projet.
    seed_cache() {
      mkdir -p "$CACHE" "$CACHE/templates"
      cp -r "$SRC/templates/"* "$CACHE/" || { echo "✗ Failed to copy templates"; exit 1; }
      cp "$PAYLOAD_ROOT/AGENTS.md" "$CACHE/" || { echo "✗ Failed to copy AGENTS.md"; exit 1; }
      cp "$PAYLOAD_ROOT/install.sh" "$CACHE/install.sh" 2>/dev/null \
        || cp "${BASH_SOURCE[0]:${0}}" "$CACHE/install.sh" 2>/dev/null || true
    }
    case "$TARGET" in
      claude)
        copy_tooling_claude "$HOME/.claude"; seed_cache
        echo "✅ Tooling installed (global Claude, version $VERSION). Commands in all your repos." ;;
      codex)
        copy_tooling_codex "$HOME/.codex"; seed_cache
        echo "✅ Tooling installed (global Codex, version $VERSION). Skills in ~/.codex/skills." ;;
      all)
        copy_tooling_claude "$HOME/.claude"; copy_tooling_codex "$HOME/.codex"; seed_cache
        echo "✅ Tooling installed (global Claude + Codex, version $VERSION)." ;;
      *) echo "Unknown target: $TARGET (claude|codex|all)" >&2; exit 1 ;;
    esac
    echo "→ In each project: ~/.claude/agent-workflow/install.sh init [--target codex] [--hooks]"
    ;;

  init)
    local_src="$SRC"; [ -d "$local_src/templates" ] || local_src="$CACHE"
    sync_templates "$local_src"; drop_agents_md "$local_src"
    case "$TARGET" in claude|all) wire_claude_md ;; esac   # CLAUDE.md only if Claude is target
    echo "✅ templates + rules added to $(pwd) (target $TARGET)"
    if [ "$HOOKS" = 1 ]; then install_hooks; fi
    ;;

  update)
    install_target "$TARGET"
    echo "✅ agent-workflow updated ($TARGET, version $VERSION). AGENTS.md never touched — merge manually if rules evolved."
    if [ "$HOOKS" = 1 ]; then install_hooks; fi
    ;;

  *)
    echo "Unknown option: $MODE" >&2
    echo "Usage: ./install.sh [--target claude|codex|all] [--hooks] [--global | init | update] [--force]" >&2
    exit 1
    ;;
esac
