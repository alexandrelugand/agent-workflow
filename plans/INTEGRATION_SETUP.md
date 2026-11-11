# Integration Setup

## Consumer configuration

The sole consumer path is `.agent-workflow/integrations.yaml`. The installer creates this user-owned config only when absent; updates never overwrite or remove it. `src/config/integrations.yaml` is the install source template only.

## Optional Jira

Jira is disabled by default. Keep these required values in the process environment or a user-managed secret store, never in YAML, logs, command output, or repository files:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Keep YAML settings secret-free. Configure the Jira issue type and workflow status names there. Use `/aw-integrate-configure` to explicitly validate the approved HTTPS Jira Cloud base URL, authenticated identity, project issue-type metadata, and exact configured issue type. This check is the only pre-enable Jira network action and does not enable configuration. Set `jira.enabled: true` only after successful validation.

Missing, disabled, or incomplete Jira remains request-free and does not block or mutate ordinary local pipeline behavior. `/aw-integrate-status` shows safe summaries only. Never expose raw provider config, response bodies, request payloads, headers, or secrets.

Other integrations remain optional. This guide does not prescribe Jira issue import or lifecycle behavior.
