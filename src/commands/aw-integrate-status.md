---
description: Display redacted integration status
argument-hint: (optional: jira|github|telegram|all)
allowed-tools:
  - Bash
---
# aw-integrate-status — Redacted integration status

Show only the installed runtime's safe integration summary. Do not inspect or print provider configuration, environment-variable values, request/response data, URLs, tokens, headers, or issue payloads.

## Load installed runtime

Resolve the consumer root by walking upward from the current Git worktree until its user-owned integration config is found. This supports story worktrees whose runtime/config stay in the shared consumer root:

```bash
consumer_root="$(git rev-parse --show-toplevel)"
while [ ! -f "$consumer_root/.agent-workflow/integrations.yaml" ]; do
  parent="$(dirname "$consumer_root")"
  if [ "$parent" = "$consumer_root" ]; then
    echo "Optional integration configuration is not installed."
    exit 0
  fi
  consumer_root="$parent"
done
node "$consumer_root/.agent-workflow/runtime/integration-cli.mjs" status
```

The runtime emits JSON containing only the global enabled flag and each provider's `enabled` and `configured` booleans. Status does not contact Jira or any other provider. Missing or disabled Jira is normal and does not block local work.

Example safe output:

```json
{
  "enabled": true,
  "jira": { "enabled": false, "configured": false },
  "github": { "enabled": false, "configured": false },
  "telegram": { "enabled": false, "configured": false }
}
```

Use `/aw-integrate-configure` for explicit Jira validation. Validation reports environment-variable names only and never enables Jira; enable it only after successful identity, project, and issue-type checks.
