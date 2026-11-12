---
description: Configure optional integrations safely
argument-hint: jira
allowed-tools:
  - Read
  - Write
  - Bash
---
# Configure integrations

Jira is optional and disabled by default. Runtime settings are stored in the user-owned `.agent-workflow/integrations.yaml`; the installer never overwrites it. Never place credentials or environment-variable expansions in that file.

For Jira, configure `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the invoking process environment, in local Git-ignored `.env` / `.env.<NODE_ENV>` files at the consumer root, or in a user-managed secret store. The CLI loads `.env` plus `.env.<NODE_ENV>`; it defaults to `.env.development`, and process values override file values. To use `.env.production` without a system setting, put `NODE_ENV=production` in `.env`. Never print the values or store them in YAML, tracked files, or logs.

At the start of this command, resolve the consumer root; story commands run in `.worktrees/<id>`, while `.agent-workflow` is shared at the repository root:

```sh
consumer_root="$(git rev-parse --show-toplevel)"
while [ ! -d "$consumer_root/.agent-workflow" ]; do
  parent="$(dirname "$consumer_root")"
  if [ "$parent" = "$consumer_root" ]; then echo "agent-workflow runtime is not installed" >&2; exit 1; fi
  consumer_root="$parent"
done
config="$consumer_root/.agent-workflow/integrations.yaml"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

Configure only secret-free values in `"$config"`:
```yaml
integrations:
  enabled: true
  jira:
    enabled: false
    project_key: "YOUR_PROJECT_KEY"
    issue_type: "Story"
    status_names:
      todo: "To Do"
      in_progress: "In Progress"
      in_review: "In Review"
      done: "Done"
```

Run the explicit connection check while Jira remains disabled:

```sh
node "$runtime" validate
```

It checks the HTTPS Jira Cloud site, identity, project access, and exact configured issue type. It reports missing variable names only. Validation does not enable Jira. Enable `jira.enabled: true` only after successful validation. Missing/disabled/incomplete Jira otherwise remains request-free and does not block local pipeline work. Check `/aw-integrate-status` for a redacted summary.
