# Integration Configuration Guide

The installer seeds `.agent-workflow/integrations.yaml` only when absent. This file is user-owned and is never overwritten or removed by update. Jira remains disabled until its connection is explicitly validated.

## Jira setup

The Jira CLI reads the following from the process environment or consumer-root `.env` and `.env.<NODE_ENV>` files. `.env.development` is the default when `NODE_ENV` is unset; put `NODE_ENV=production` in `.env` to select `.env.production` without a system setting. Process values override file values. Keep local `.env*` files Git-ignored. Never put credentials in YAML, prompts, tracked files, logs, or command output:

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
    issue_type: "Story"
    browse_base_url: "" # Required for issue links when JIRA_API_URL is a scoped API base
    epic_key: "" # Optional existing default Epic; overridden by a story's ### Epic key
    status_names:
      # Reopen a completed parent Epic to this destination after story creation.
      todo: "To Do"
      in_progress: "In Progress"
      in_review: "In Review"
      done: "Done"
      # Optional; omit unless this workflow has a matching transition.
      # blocked: "Blocked"
```

Run `/aw-integrate-configure` to execute explicit identity, project, and issue-type validation. Validation does not enable Jira; set `jira.enabled: true` only after successful validation. Missing, disabled, or incomplete Jira remains request-free and does not block local work.

The names are Jira destination statuses, not transition IDs; the runtime discovers the available transition for each issue. `blocked` is optional and is attempted only after a rejected review when configured and available.

`/aw-research` and the orchestrator set linked Stories to `in_progress`; `/aw-review` sets `in_review` and sets `done` after a passing review. `/aw-execute` returns review fixes to `in_progress`. Parent Epics move to `in_progress` when any configured child Story is in progress and to `done` only when all child Stories are done. `/aw-ship` requires a verified merge only to mark its PR remote link as Merged.

`/aw-integrate-status` shows linked issue keys and fetched Jira status, with failed reads marked unavailable. It never displays configuration values, credential values, request headers, payloads, response bodies, or Jira URLs.

## Other optional integrations

Use `.agent-workflow/integrations.yaml` for secret-free provider settings and keep any provider credentials in environment variables. Enable providers only after their own configuration is complete. Jira configuration or credentials must not be copied into `.env` files by agent-workflow commands.
