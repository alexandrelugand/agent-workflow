---
description: Link one existing Jira issue to one selected story
argument-hint: <story-id> <jira-key> jira
allowed-tools:
  - Read
  - Bash
---

# /aw-integrate-link — Link one Jira issue

For Jira, accept exactly one full story ID and one existing Jira issue key. Do not accept Epic/Requirement/Task hierarchies, multiple keys, fuzzy IDs, or a request to create a Jira issue.

Resolve the shared consumer runtime while keeping story files and integration records in the current worktree:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

Validate the story ID against the current worktree's `docs/stories.md`, then run:

```sh
node "$integration_cli" link <story-id> <jira-key>
```

The CLI verifies that the issue exists in the configured project and has the configured issue type, then stores only its Jira key and browse URL in `docs/integrations/<story-id>.md`. It refuses to overwrite a different local Jira key; explicitly unlink the old local reference first if the user requests a change. Repeating the same link is idempotent. Preserve every GitHub and unrelated record section.

If the user asked to link a GitHub issue, use the GitHub integration flow instead and do not alter the Jira section. Never store external IDs in `docs/stories.md` or create a remote Jira issue from this manual-link command.
