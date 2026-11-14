# Jira Lifecycle Synchronization Guide

This guide documents Jira lifecycle synchronization in agent-workflow. It does not create Jira issues; use `/aw-integrate-jira` for the separate preview-and-confirm import. GitHub and Telegram remain optional providers; their provider-specific behavior is documented in their adapters.

## Ownership and prerequisites

The repository owns story content and local pipeline progress. Jira owns the remote issue status; the runtime never infers it from Markdown checkboxes. Jira remains optional: disabled or incomplete configuration, an absent runtime, or an unlinked story means no lifecycle request.

The consumer config is `.agent-workflow/integrations.yaml` and the installed runtime is `.agent-workflow/runtime/integration-cli.mjs`. The config is user-owned and contains no credentials. Keep Jira variables in the process environment, a user-managed secret store, or Git-ignored consumer-root `.env` / `.env.<NODE_ENV>` files. `.env.development` is the default; put `NODE_ENV=production` in `.env` to select `.env.production`. Process values override files.

## Pipeline events

| Verified local event | Jira action |
|---|---|
| `/aw-research` or `/aw-orchestrator` starts a linked story | Request the configured `in_progress` destination. |
| `/aw-execute` starts or resumes implementation | Request the configured `in_progress` destination. |
| `/aw-review` starts | Request the configured `in_review` destination. |
| Review is rejected | Request `blocked` only when configured and exactly available; never request Done. |
| Review passes | Leave the Story in `in_review`; a passing review alone does not request Done. |
| A child Story changes status | Reconcile its parent Epic: In Progress when any configured child Story is In Progress; Done only when all are Done. |
| `/aw-ship` creates or finds a PR after explicit user approval | Request the configured `done` destination and upsert the stable Jira remote link as Open. |
| `/aw-ship` verifies PR state exactly `MERGED` | Upsert the same link as Merged; merge proof controls the link outcome, not the Story's Done status. |

Story Done means the user explicitly authorized `/aw-ship` after review; a passing review alone leaves the Story In Review. Only exact merged-state proof supplied by `/aw-ship` permits the PR remote link to be marked Merged; Jira workflow state and the PR link outcome are separate.

## Transition resolution

Workflow transition IDs are project- and issue-specific; never hard-code or guess one. For each requested status, the runtime reads the issue's current status and available transitions, compares the configured destination exactly with `transition.to.name`, and posts the returned ID only when there is one match.

- Already at the target: no-op.
- No matching destination or more than one match: warning; no transition POST.
- `blocked` not configured: normal skip.
- Jira unavailable or transition rejected: visible warning; local pipeline work continues.

Epic aggregation reads all configured child Story statuses from Jira. It never marks an Epic Done when there are no child Stories or any child remains outside the configured Done status. Missing/ambiguous Epic transitions or failed status searches warn without stopping local work.

Configure destination names under `jira.status_names` in the shared consumer config. Confirm actual workflow names in the target Jira project before enabling lifecycle sync.

## Pull-request remote link

The runtime upserts one Jira remote link using a stable global ID. It updates that link from Open to Merged instead of appending repeated comments or copying the pipeline history. The link's URL must be a validated pull-request URL. Jira failures do not block the manual-merge gate or cleanup after a proven merge.

## Import boundary

Import is a separate, explicit write path. `/aw-integrate-jira` accepts only full story IDs selected by the user, shows a read-only preview, and requests confirmation before the separate import action. One selected story creates or reuses one issue. A configured `jira.epic_key` or story-level `### Epic` selects an existing parent for new issues; a verified new/recovered child can reopen a parent in Jira's `done` category to `status_names.todo`. No Epic, Requirement, placeholder, acceptance-criterion issue, or historical backlog import is automatic. Do not use lifecycle commands to create issues or dependency links.

## Safe operation

`/aw-integrate-status` fetches remote status only when Jira is enabled and complete. A failed fetch is shown as unavailable, never inferred locally. Do not expose credentials, Authorization headers, raw config, request/response bodies, or Jira URLs in status, logs, or errors. Tests use mock responses; never use a real Jira tenant in the automated suite.