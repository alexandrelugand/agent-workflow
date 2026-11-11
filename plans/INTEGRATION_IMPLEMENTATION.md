# Jira Integration Implementation Status

**Status:** Generic Jira integration code for stories S01–S03 is implemented and merged. Consumer adoption remains optional and is not configured in the inspected `on-mange-quoi` checkout.

## Delivered

### S01 — Optional setup and secure runtime

- The Node.js ESM runtime is installed under `.agent-workflow/runtime/` for supported Claude/Codex targets.
- The user-owned consumer config is `.agent-workflow/integrations.yaml`; installer update/init preserve it and do not treat it as a managed runtime file.
- Jira credentials are read from `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the process environment. Validation reports missing variable names without values.
- Jira is disabled by default. Missing, disabled, or incomplete configuration performs no Jira request.

### S02 — Explicit story import and linking

- `/aw-integrate-jira` previews only explicitly selected full story IDs and requires confirmation before writes.
- Each selected story maps to one Jira REST v3 issue with an ADF description and stable `aw-story-<id>` label; no issue is created per acceptance criterion and no Epic/Requirement hierarchy is created automatically.
- Stable-marker search, pending-create recovery, idempotent reuse, local key/URL records, and optional confirmed dependency links prevent blind duplicate creation.
- Manual link/unlink commands operate on one existing issue; unlink never deletes the Jira issue.

### S03 — Lifecycle and verified delivery

- Execution and review request configured `in_progress` and `in_review` Jira destinations. `blocked` is optional.
- Transition IDs are discovered per issue and selected by exact destination `to.name`; missing or ambiguous destinations warn without a POST.
- `/aw-integrate-status` fetches remote Jira status and reports failures as unavailable, never inferred from local Markdown.
- PR links are idempotent remote links. Done is requested only after `/aw-ship` verifies the PR state exactly `MERGED`; Jira failures do not block local work or cleanup.

## Current source locations

- Service and provider behavior: `src/services/integration-service.mjs`.
- Installed CLI runtime: `src/services/integration-cli.mjs`.
- Source config template: `src/config/integrations.yaml`.
- Runtime consumer config: `.agent-workflow/integrations.yaml` (user-owned, not the source template).
- Commands: `src/commands/aw-integrate-configure.md`, `aw-integrate-jira.md`, `aw-integrate-link.md`, `aw-integrate-status.md`, `aw-orchestrator.md`, `aw-review.md`, `aw-execute.md`, `aw-ship.md`, and `aw-status.md`.

## Verification evidence and limits

- The independent S03 review reported `Max severity: none` and `Ship allowed: yes`.
- Reviewer-run service, CLI, pre-integration hook, and installer suites: 84 passed, 0 failed. Changed runtime files passed `node --check`.
- Tests use mocked Jira responses. No live Jira request or real credential was used.
- The repository has no `package.json` or TypeScript config, so no project type-check command is available. The merged PR has no reported checks or deployment records; production deployment is not confirmed.

## Consumer backlog adoption

The inspected `on-mange-quoi` story history has merged PRs for S01–S14 (PRs #1–#16, including two S13 PRs). No unshipped story ID was selected for Jira import; historical stories are not imported. S11 and S12 acceptance checkboxes were stale and are being reconciled to their merged PRs.

That checkout has no installed `.agent-workflow/runtime` or Jira integration config, and the invoking process has no `JIRA_*` variables. No Jira import, status lookup, link verification, or lifecycle enablement was attempted. Ignored `.env` files were not inspected. Keep Jira disabled until a maintainer supplies a configured non-production project and an explicit future story selection; then preview, confirm, and verify any import before enabling lifecycle sync.