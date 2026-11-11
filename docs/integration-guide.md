# Integration Guide

## Consumer configuration

The sole consumer configuration path is `.agent-workflow/integrations.yaml`. The installer creates it only when absent; it is user-owned and never overwritten or removed by update. `src/config/integrations.yaml` is only the repository source template.

## Optional Jira setup

Jira is disabled by default. Keep the four required values in the process environment or a user-managed secret store, never in YAML or command output:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

The YAML contains only safe settings, including project/workflow metadata such as configured issue type and status names. Run `/aw-integrate-configure` to explicitly validate the HTTPS Jira Cloud site, identity, project issue-type metadata, and exact configured issue type. This check is the only pre-enable Jira network action and never enables configuration. Enable Jira only after it succeeds.

Missing, disabled, or incomplete Jira causes no request and does not block or mutate ordinary local pipeline behavior. `/aw-integrate-status` returns redacted summaries only; never expose raw provider config, response bodies, request payloads, headers, or secrets in logs/errors/output.

See `src/commands/aw-integrate-configure.md` for exact instructions. Jira import and lifecycle behavior are outside this setup guide's scope.
