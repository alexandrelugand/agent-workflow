# Post-PRD Integration Hook

Run after `docs/prd.md` is created. This hook does not contact Jira, create issue placeholders, create integration records, or import stories. PRD completion is not authorization to create Jira issues.

Jira is optional and remains request-free when disabled or incompletely configured. Credentials stay in the process environment or a user-managed secret store; never print them.

After `/aw-stories` has produced `docs/stories.md`, a user may explicitly select full story IDs and invoke `/aw-integrate-jira <story-id...>`. That command shows a read-only preview and asks for separate confirmation before any Jira writes. Never infer the selection from the PRD or import the backlog automatically.
