# Post-Story Integration Hook

Run after story execution or shipping. This hook performs no Jira requests and makes no Jira or integration-record changes. It never infers status from local code, review verdicts, PR creation, a merge promise, or Markdown checkboxes. Only explicit lifecycle calls in execution/review and `/aw-ship` may transition Jira; Done requires `/aw-ship` to verify `MERGED`.

Keep any existing `docs/integrations/<story-id>.md` Jira key and browse URL unchanged. Jira remains disabled/request-free when disabled or incompletely configured. GitHub and notification integrations retain their own behavior and data.

A user may explicitly import a story after it appears in the current worktree's `docs/stories.md` by running `/aw-integrate-jira <story-id>`. The command previews first and requires separate user confirmation before creating or linking Jira issues.
