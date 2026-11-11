#!/usr/bin/env bash
# Jira is optional: missing, disabled, or incomplete Jira never blocks local work.
set -euo pipefail
search_dir="$PWD"
while [ ! -f "$search_dir/.agent-workflow/integrations.yaml" ]; do
  parent="$(dirname "$search_dir")"
  [ "$parent" != "$search_dir" ] || exit 0
  search_dir="$parent"
done
config="$search_dir/.agent-workflow/integrations.yaml"

provider_enabled() {
  awk -v provider="$1" '
    { sub(/\r$/, "") }
    $0 == "  " provider ":" { in_provider=1; next }
    /^  [[:alnum:]_-]+:/ { in_provider=0 }
    in_provider && /^    enabled:[[:space:]]*true([[:space:]]|$)/ { enabled=1 }
    END { exit !enabled }
  ' "$config"
}

# Jira credentials and connection validation are handled only by explicit setup.
# Retain the required credential gates for the other existing providers.
if provider_enabled github; then
  missing=()
  [ -n "${GITHUB_TOKEN:-}" ] || missing+=(GITHUB_TOKEN)
  if [ "${#missing[@]}" -gt 0 ]; then
    printf 'GitHub integration requires environment variable(s): %s\n' "${missing[*]}" >&2
    exit 1
  fi
fi

if provider_enabled telegram; then
  missing=()
  [ -n "${TELEGRAM_BOT_TOKEN:-}" ] || missing+=(TELEGRAM_BOT_TOKEN)
  [ -n "${TELEGRAM_USER_ID:-}" ] || missing+=(TELEGRAM_USER_ID)
  if [ "${#missing[@]}" -gt 0 ]; then
    printf 'Telegram integration requires environment variable(s): %s\n' "${missing[*]}" >&2
    exit 1
  fi
fi
exit 0
