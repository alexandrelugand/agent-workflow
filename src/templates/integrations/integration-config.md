# Integration Configuration Guide

The installer seeds `.agent-workflow/integrations.yaml` only when absent. This file is user-owned and is never overwritten or removed by update. Jira remains disabled until its connection is explicitly validated.

## Jira setup

Set the following in the process environment or a user-managed secret store. Never put their values in YAML, prompts, logs, or command output:

- `JIRA_API_URL` — HTTPS Jira Cloud site or scoped-token base URL
- `JIRA_PROJECT_KEY` — project key
- `JIRA_EMAIL` — Atlassian account email
- `JIRA_API_TOKEN` — API token

Keep the YAML secret-free:

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

Run `/aw-integrate-configure` to execute explicit identity, project, and issue-type validation. Validation does not enable Jira; set `jira.enabled: true` only after successful validation. Missing, disabled, or incomplete Jira remains request-free and does not block local work.

Check `/aw-integrate-status` for a redacted status summary. It never displays configuration values, credential values, request headers, payloads, or response bodies.

## Other optional integrations

Use `.agent-workflow/integrations.yaml` for secret-free provider settings and keep any provider credentials in environment variables. Enable providers only after their own configuration is complete. Jira configuration or credentials must not be copied into `.env` files by agent-workflow commands.
