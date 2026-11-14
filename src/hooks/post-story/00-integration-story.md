# Post-Story Integration Hook

Run after story execution or shipping. This hook performs no Jira requests and makes no Jira or integration-record changes. It never infers status from local code, PR creation, a merge promise, or Markdown checkboxes. Explicit lifecycle calls from `/aw-research`, `/aw-execute`, `/aw-review`, `/aw-ship`, and the orchestrator drive Jira transitions: passing review leaves the Story In Review; user-authorized `/aw-ship` requests Done; verified merge proof only marks the PR remote link Merged.

Keep any existing `docs/integrations/<story-id>.md` Jira key and browse URL unchanged. Jira remains disabled/request-free when disabled or incompletely configured. GitHub and notification integrations retain their own behavior and data.

A user may explicitly import a story after it appears in the current worktree's `docs/stories.md` by running `/aw-integrate-jira <story-id>`. The command previews first and requires separate user confirmation before creating or linking Jira issues.
