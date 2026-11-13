# Integration Setup Guide

## Optional Jira setup

Jira runtime configuration is `.agent-workflow/integrations.yaml`, created by the installer only if absent. It is user-owned and never overwritten or removed by update. Jira is disabled by default; local pipeline behavior does not depend on Jira.

The Jira CLI reads these values from the process environment or consumer-root `.env` and `.env.<NODE_ENV>` files. It defaults to `.env.development`; put `NODE_ENV=production` in `.env` to select `.env.production` without an OS setting. Process values override files. Keep local `.env*` files Git-ignored and credentials out of YAML, tracked files, logs, and command output:

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
      # Optional; omit unless this workflow has a matching transition.
      # blocked: "Blocked"
```

Use `/aw-integrate-configure` to run the explicit Jira identity, project, and issue-type check while the integration is still disabled. Validation does not enable configuration. Enable `jira.enabled` only after successful validation. Missing, disabled, or incomplete Jira remains request-free and does not block ordinary local work.

The names are Jira destination statuses, not transition IDs; the runtime discovers the available transition for each issue. `blocked` is optional and is attempted only after a rejected review when configured and available.

`/aw-research` and the orchestrator set linked Stories to `in_progress`; `/aw-review` sets `in_review` and sets `done` after a passing review. `/aw-execute` returns review fixes to `in_progress`. Parent Epics move to `in_progress` when any configured child Story is in progress and to `done` only when all child Stories are done. `/aw-ship` requires a verified merge only to mark its PR remote link as Merged.

`/aw-integrate-status` shows linked issue keys and fetched Jira status, with failed reads marked unavailable. Never print or log credentials, authorization headers, raw provider responses, request payloads, raw configuration, or Jira URLs.

## Other providers
For GitHub, set `github.repo` in `.agent-workflow/integrations.yaml` to the non-secret `owner/repository` identifier and provide `GITHUB_TOKEN` in the process environment or a user-managed secret store. The starter config supplies `https://api.github.com` as `github.api_url`; do not store the token in YAML.

Lifecycle sync is separate from configuration: it uses the configured Jira destination names, discovers issue-specific transitions, and keeps local work fail-soft when Jira is unavailable.
