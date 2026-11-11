# Integration Setup

## Configuration

Consumer projects use `.agent-workflow/integrations.yaml`. This file is user-owned: the installer seeds it only when absent and never overwrites or removes it. `src/config/integrations.yaml` is the installer's source template only.

## Jira (optional)

Jira remains disabled until explicitly configured and validated. Put these values in the process environment or a user-managed secret store, never in YAML, logs, or command output:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Keep issue type and workflow names as secret-free YAML settings. Run `/aw-integrate-configure` to check the HTTPS Jira Cloud site, identity, project access, and exact issue type while Jira is disabled. Validation does not enable the integration. Enable it only after successful validation.

Missing, disabled, or incomplete Jira remains request-free and cannot block or mutate ordinary local pipeline behavior. Status output contains safe summaries only. Never expose raw config, request data, response bodies, headers, or secrets.

No Jira issue import or lifecycle behavior is implemented by this setup story.
