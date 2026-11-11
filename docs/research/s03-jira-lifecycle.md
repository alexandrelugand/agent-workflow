# Research — Story s03-jira-lifecycle

## The five structuring facts

- `JIRAService.syncStory()` at `src/services/integration-service.mjs:300-303` returns `{ synced: true }` without a Jira request; `IntegrationService.syncStoryWithJira()` only wraps that stub at lines 563-575.
- Jira's `status_names` is nested in `src/config/integrations.yaml:12-16`, but `IntegrationService.parseYAML()` at `src/services/integration-service.mjs:355-373` reads only four-space scalar fields; the configured transition destinations are not currently available as nested data.
- Jira Cloud returns per-issue available transitions from `GET /rest/api/3/issue/{issueIdOrKey}/transitions`; the destination is `transition.to.name`, and `POST .../transitions` requires that returned transition's ID. Missing transition permission can produce an empty list rather than an HTTP failure. [Atlassian transition API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-transitions-get)
- The S02 CLI stores the only story-to-issue mapping in `docs/integrations/<story-id>.md`; `getStatus()` in `src/services/integration-cli.mjs:65-73` currently returns configuration booleans only and makes no status request.
- `/aw-ship` is manual by default: an open PR is not merged, and cleanup requires a fresh `gh pr view` result exactly equal to `MERGED` (`src/commands/aw-ship.md:22-49`). Jira Done must be issued only after that proof; lifecycle request failures must not stop local work.

## Target story

A linked Jira issue reflects actual execution, review, and verified delivery. Jira owns live status; the repository owns the story and local pipeline evidence.

Acceptance criteria (`docs/stories.md:63-69`):

- At execution start, resolve configured `in_progress` against that issue's available transitions and post the returned ID. Missing destinations warn without stopping execution.
- At review start, resolve configured `in_review`. A rejected review is never Done; use `blocked` only when explicitly configured and an applicable transition exists.
- Only `/aw-ship` may mark Done, after verified PR merge. An open/manual PR is not proof. Add an idempotent Jira remote link for the PR and record the verified merge outcome without copying the pipeline history.
- `/aw-integrate-status` shows linked keys plus fetched Jira statuses. `/aw-status` reports local and Jira state separately and shows failed Jira reads as unavailable.
- Lifecycle Jira failures warn and fail soft. Explicit configure/import operations keep their existing fail-closed behavior.

## Current state of the code

- `src/services/integration-service.mjs` centralizes Jira REST requests, issue lookup, and dependency linking. Its generic request helper uses the approved Jira base URL, redacted errors, and no automatic request retry; issue creation owns its separate ambiguity-aware retry loop. `JIRAService.syncStory()` is the remaining false-success stub.
- The source config already declares `todo`, `in_progress`, `in_review`, and `done` names, but the minimal YAML parser does not preserve the nested `status_names` map. The schema must remain within the accepted runtime-config ADR; no YAML package is present or needed.
- `src/services/integration-cli.mjs` resolves the shared consumer root for configuration and uses the caller's worktree for story content and integration records. `existingJiraLink()` rejects multiple keys. Its status action currently returns only enabled/configured flags; its import/link actions already fail when Jira rejects a required write.
- `/aw-execute`, `/aw-review`, `/aw-orchestrator`, and `/aw-ship` are the execution, review, orchestration, and merge-proof boundaries. `/aw-integrate-status` and `/aw-status` currently do not display remote Jira issue state.
- `src/hooks/post-story/00-integration-story.md` explicitly forbids generic post-story Jira requests. Keep that hook non-networked; use explicit command-level lifecycle actions instead.

## Anchor points

- Add Jira status lookup, per-issue transition discovery, and remote PR-link upsert beside `JIRAService.getIssue()` and `linkStories()` in `src/services/integration-service.mjs`.
- Expose those operations through `IntegrationService` and replace the Jira-only `syncStory()` stub/wrapper.
- Extend `getStatus()` and add a best-effort lifecycle CLI action in `src/services/integration-cli.mjs`; it owns the local `docs/integrations/<story-id>.md` lookup while the service owns Jira HTTP.
- Wire phase starts and the verified ship result into the CLI in `src/commands/aw-execute.md`, `aw-review.md`, `aw-orchestrator.md`, and `aw-ship.md`.
- Surface remote status separately in `src/commands/aw-integrate-status.md` and `aw-status.md`; update the Jira adapter and config examples so their lifecycle contract is accurate.

## Verified APIs / functions

- `IntegrationService.parseYAML()` — local, deliberately limited YAML parser (`src/services/integration-service.mjs:355-373`).
- `IntegrationService.requireJiraService()`, `getJiraIssue()`, `getIntegrationStatus()` — service facade methods in `src/services/integration-service.mjs:473-503`.
- `JIRAService.request(path, options)` — Jira REST v3 transport with safe errors, request body support, and 204 handling (`src/services/integration-service.mjs:114-137`).
- `JIRAService.getIssue(issueKey)` and `linkStories(blockedKey, dependencyKey)` — existing issue validation and write patterns (`src/services/integration-service.mjs:257-293`).
- `resolveConsumerRoot()` — finds shared `.agent-workflow/integrations.yaml` while preserving the calling worktree (`src/services/project-root.mjs:5-25`).
- `readIntegrationRecord()` / `existingJiraLink()` — exact local story-to-issue mapping (`src/services/integration-cli.mjs:131-197`).
- Jira remote-link `POST /rest/api/3/issue/{issueIdOrKey}/remotelink` creates or updates the link when a stable `globalId` is supplied; its `object.status.resolved` can record the merged state. [Atlassian remote-link API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/#api-rest-api-3-issue-issueidorkey-remotelink-post)

## Traps & constraints

- Match a configured destination against `transition.to.name` and post the matching `transition.id`; do not hard-code Jira transition IDs or match only the transition action's `name`. Query transitions for each issue because workflows differ by project and current status.
- Treat zero matching transitions and multiple matching transitions as explicit sync warnings, not guessed transitions. If the issue already has the configured status, return an idempotent no-op. `blocked` has no default: do nothing unless `status_names.blocked` is configured and Jira offers exactly one matching transition.
- Use the stable Jira remote-link `globalId` to update the same PR link on retries. Jira requires issue-linking to be active and the caller to have Link issues permission; link failure must be reported independently from a successful status transition. Do not copy pipeline history or write Jira status into the local integration record.
- Status display reads Jira's actual `fields.status.name`; it must never derive a remote value from a local checkbox, review verdict, branch, or PR. If a link is absent or a fetch fails, display no link or `unavailable` respectively.
- When Jira is disabled or incomplete, do not call `fetch`. Lifecycle calls are best effort; explicit configuration/import paths remain fail-closed. Keep secrets, Authorization, response bodies, and provider URLs out of output.
- Existing tests use `node:test`, injected `fetch`, and synthetic credentials (`src/services/integration-service.test.mjs`, `integration-cli.test.mjs`). No live Jira request, credentials, dependency, or arbitrary YAML feature is needed.
- The broad legacy `src/templates/integrations/integration-sync.md` and consumer-backlog adoption are reserved for the later documentation/adoption phase; do not rewrite them as part of this story.

## Open questions

None. Use an idempotent remote link whose stable ID is derived from the validated HTTPS PR URL; update its minimal `object.status` to unresolved/open or resolved/merged. Use the existing exact `MERGED` proof in `/aw-ship` as the only authorization for Done.

## Real complexity

The story is scored **4** in `docs/stories.md`. Research confirms 4: several pipeline boundaries must share one fail-soft contract, while Jira workflows and transition availability vary per issue. The work remains one shippable story because service, CLI, command hooks, and status display are all required to keep Jira from claiming progress the repository cannot prove.

## Split proposal

Not required for complexity 4.
