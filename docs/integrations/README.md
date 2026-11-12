# Integration Setup and Records

## Configuration

Consumer projects use `.agent-workflow/integrations.yaml`. The installer creates this user-owned file only when absent and never overwrites or removes it. `src/config/integrations.yaml` is the installer source template.

## Jira setup and explicit import

Jira is disabled until explicitly configured and validated. Keep `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the process environment, a user-managed secret store, or Git-ignored consumer-root `.env` / `.env.<NODE_ENV>` files (`.env.development` by default; set `NODE_ENV=production` in `.env` to select `.env.production`). Process values override files. Never put credentials in YAML, tracked files, logs, or command output. Run `/aw-integrate-configure` to validate the site, identity, project, and configured `jira.issue_type`; validation does not enable Jira.

Import only full story IDs the user explicitly selects from the current worktree's `docs/stories.md`:

1. `/aw-integrate-jira <story-id...>` shows a read-only preview.
2. The user explicitly confirms that preview.
3. The command separately runs the confirmed import, which rechecks Jira before creating or reusing one issue per selected story.

Preview performs no Jira writes. Cancellation, disabled Jira, and incomplete configuration make no issue or link writes. The importer does not enumerate PRD/backlog stories, copy checkbox state, create placeholder records, or create Epic/Requirement/Task hierarchies. `jira.epic_key` optionally names an existing default parent; a story's `### Epic` section overrides it. Newly created/recovered stories may reopen a selected Epic in Jira's `done` category to `status_names.todo`; existing issues are not reparented. For scoped API bases, configure secret-free `jira.browse_base_url` before writes.

## Jira record format

Each current-worktree record is `docs/integrations/<story-id>.md` and contains one Jira reference:

```markdown
## Jira
- Key: DEMO-17
- URL: https://example.atlassian.net/browse/DEMO-17
```

The importer updates only the Jira section and preserves GitHub references and unrelated user data. Manual Jira link validates one existing issue of the configured type; unlink removes only the local Jira section and never deletes the Jira issue.

A non-secret pending marker under the ignored shared `.agent-workflow/jira-import-pending/` directory prevents duplicate creates after ambiguous outcomes. Never blindly retry a possibly accepted create. Exactly one marker match is reconciled; zero or multiple matches retain pending state until a human explicitly confirms no issue was created.

Jira status, priority, assignee, transitions, and PR synchronization are not stored in these records and belong to the separate lifecycle story.
