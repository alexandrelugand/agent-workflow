# Integration Setup Guide

## Optional Jira setup

Jira runtime configuration is `.agent-workflow/integrations.yaml`, created by the installer only if absent. It is user-owned and never overwritten or removed by update. Jira is disabled by default; local pipeline behavior does not depend on Jira.

Set these variables in the process environment or a user-managed secret store; do not write their values to YAML, logs, command output, or repository files:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Configure only safe values in YAML:

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

Use `/aw-integrate-configure` to run the explicit Jira identity, project, and issue-type check while the integration is still disabled. Validation does not enable configuration. Enable `jira.enabled` only after successful validation. Missing, disabled, or incomplete Jira remains request-free and does not block ordinary local work.

Use `/aw-integrate-status` for a redacted status summary. Never print or log credentials, authorization headers, raw provider responses, request payloads, or raw configuration.

## Other providers
For GitHub, set `github.repo` in `.agent-workflow/integrations.yaml` to the non-secret `owner/repository` identifier and provide `GITHUB_TOKEN` in the process environment or a user-managed secret store. The starter config supplies `https://api.github.com` as `github.api_url`; do not store the token in YAML.

The shared optional configuration is `.agent-workflow/integrations.yaml`. Keep provider credentials in environment variables or a user-managed secret store; do not put secrets or environment-variable expansions in YAML. This Jira setup story does not add provider-specific network validation or issue lifecycle behavior.
