# Integration Setup and Jira Import

## Configuration ownership

Consumer projects use `.agent-workflow/integrations.yaml`. The installer seeds this user-owned file only when absent and never tracks it for cleanup. `src/config/integrations.yaml` is the installer source template.

## Optional Jira

Jira is disabled by default. Keep `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the process environment or a user-managed secret store, never in YAML, logs, or command output. Configure the secret-free `jira.issue_type`; optional `jira.browse_base_url` supplies a human-facing site for scoped API bases, and optional `jira.epic_key` names an existing parent. Run `/aw-integrate-configure` to validate the HTTPS site, identity, project access, and exact configured issue type. Validation never enables Jira.

Missing, disabled, or incomplete Jira remains request-free. Import only full story IDs the user explicitly selects from the current worktree's `docs/stories.md`: `/aw-integrate-jira <story-id...>` previews without Jira writes, then requires explicit user confirmation before the separate confirmed import. The importer rechecks Jira, creates or reuses one configured-type issue per selected story, and writes its key and browse URL only to `docs/integrations/<story-id>.md`.

The integration record's Jira section is limited to the key and URL. Preserve GitHub references and unrelated user data. Manual link validates one existing Jira issue per story; unlink removes only the local reference and never deletes the remote issue. Ambiguous creates retain a non-secret pending marker until one exact match is locally linked or a human explicitly resolves it.

Do not import PRD/backlog stories automatically, infer Jira status from checkboxes, create placeholders or Epic/Requirement/Task hierarchies, or perform Jira lifecycle synchronization in this story.
