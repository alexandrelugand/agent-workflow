---
description: Display redacted integration status
argument-hint: (optional: jira|github|telegram|all)
allowed-tools:
  - Bash
---
# aw-integrate-status — Redacted integration status

Show only the installed runtime's safe integration summary. Do not inspect or print provider configuration, environment-variable values, request/response bodies, Jira URLs, tokens, headers, or issue payloads. The safe Jira story fields are story ID, issue key, fetched status, and a generic unavailable reason.

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

The runtime emits JSON with global/provider `enabled` and `configured` flags plus one entry per local Jira link: issue key and the status fetched from Jira. This command makes read-only Jira status requests when enabled and configured; a failed fetch is shown as `unavailable`, never inferred. Disabled/incomplete Jira performs no request and remains optional.

Example safe output:

```json
{
  "enabled": true,
  "jira": {
    "enabled": true,
    "configured": true,
    "stories": [
      { "storyId": "s02-jira-import", "issueKey": "PROJ-42", "status": "In Progress" },
      { "storyId": "s03-jira-lifecycle", "issueKey": "PROJ-43", "status": "unavailable", "reason": "Jira status fetch failed" }
    ]
  },
  "github": { "enabled": false, "configured": false },
  "telegram": { "enabled": false, "configured": false }
}
```

Use `/aw-integrate-configure` for explicit Jira validation. Validation reports environment-variable names only and never enables Jira; enable it only after successful identity, project, and issue-type checks.
