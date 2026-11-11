---
description: Remove a story's local Jira reference without deleting the Jira issue
argument-hint: <story-id> jira
allowed-tools:
  - Read
  - Bash
---

# /aw-integrate-unlink — Remove a local Jira reference

For Jira, accept one full story ID and the `jira` platform. Validate the ID against the current worktree's `docs/stories.md`, resolve the shared runtime, and run:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
node "$integration_cli" unlink <story-id>
```

This is local-only: it removes the Jira key and URL section from `docs/integrations/<story-id>.md`, never contacts Jira, and never deletes or changes the remote issue. Keep the integration record, GitHub reference, and all unrelated user data. If there is no Jira reference, report that no local change was needed.

Do not support a destructive `all` action. A GitHub reference is independent; use the GitHub integration flow for GitHub changes and preserve the Jira section.
