# Post-Story Integration Hook

Run after story execution or shipping. This hook performs no Jira requests and makes no Jira or integration-record changes. Code completion, review, PR creation, merge, or Markdown checkbox state does not authorize an issue create, Jira status transition, PR synchronization, or copied lifecycle status.

Keep any existing `docs/integrations/<story-id>.md` Jira key and browse URL unchanged. Jira remains disabled/request-free when disabled or incompletely configured. GitHub and notification integrations retain their own behavior and data.

A user may explicitly import a story after it appears in the current worktree's `docs/stories.md` by running `/aw-integrate-jira <story-id>`. The command previews first and requires separate user confirmation before creating or linking Jira issues.
