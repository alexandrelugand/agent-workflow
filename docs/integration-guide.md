# Integration Guide

## Consumer configuration

The sole consumer configuration path is `.agent-workflow/integrations.yaml`. The installer creates it only when absent; it is user-owned and never overwritten or removed by update. `src/config/integrations.yaml` is only the repository source template.

## Optional Jira setup

Jira is disabled by default. Keep `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the process environment or a user-managed secret store, never in YAML or command output. The secret-free settings include `jira.issue_type`, optional `jira.browse_base_url` for scoped API bases, and optional `jira.epic_key` for an existing parent. `/aw-integrate-configure` validates the HTTPS Jira Cloud site, identity, project access, and exact configured issue type; validation never enables Jira.

Missing, disabled, or incomplete Jira causes no request and does not mutate ordinary local pipeline behavior. `/aw-integrate-status` returns redacted summaries only; never expose raw provider config, response bodies, request payloads, headers, or secrets.

## Explicit story import

Run `/aw-integrate-jira <story-id...>` only after the user selects full story IDs present in the current worktree's `docs/stories.md`. It displays a read-only preview of create/reuse/recovery and dependency-link actions. Ask the user to confirm; only then run the separate `import <story-id...> --confirm` action. Import rechecks Jira and creates or reuses one configured-type issue per selected story. It does not import unrequested stories, infer status from checkboxes, create placeholders, or build an Epic/Requirement/Task hierarchy.

Each `docs/integrations/<story-id>.md` stores only the Jira key and browse URL in its Jira section. Other provider data is preserved. Manual Jira link accepts one existing issue per story; unlink removes only the local Jira reference and never deletes the remote issue. Pending-create markers under ignored `.agent-workflow/jira-import-pending/` prevent automatic duplicate creates after ambiguous outcomes; human resolution is required when reconciliation is inconclusive.

Do not use this story for lifecycle transitions, status mirroring, PR synchronization, or `/aw-ship` behavior; those belong to the later Jira lifecycle story.
