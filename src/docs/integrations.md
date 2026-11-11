# Integration Setup

## Configuration ownership

Consumer projects use `.agent-workflow/integrations.yaml`. The installer seeds this user-owned file only when absent and never tracks it for cleanup. `src/config/integrations.yaml` is the repository's installer source template, not the consumer runtime path.

## Optional Jira

Jira is disabled by default and has no implicit network activity. Keep credentials outside YAML, in process environment variables or a user-managed secret store:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Configure only safe values in `.agent-workflow/integrations.yaml`, including the Jira issue type and workflow status names. Run `/aw-integrate-configure` to explicitly validate the HTTPS site, authenticated identity, project access, and exact issue type while Jira is disabled. Validation never enables Jira; enable it only after successful validation.

Missing, disabled, or incomplete Jira remains request-free and does not block or mutate ordinary local pipeline behavior. `/aw-integrate-status` returns safe summary fields only. Do not log raw configuration, response bodies, request payloads, headers, or secrets.

See `src/commands/aw-integrate-configure.md` for the setup procedure.
