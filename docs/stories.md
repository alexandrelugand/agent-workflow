# User Stories — Jira backlog management for agent-workflow

> One story = one shippable slice, written to be executed by an agent.
> Id format: `s<number>-<short-slug>` — reused in every pipeline file and in the branch name.

## Story s01-jira-setup — Install and safely configure Jira

**As a** project maintainer **I want** to install and configure Jira safely **so that** I can opt in without exposing credentials or changing local work when Jira is disabled.

### Complexity

4 — the installer spans Claude/Codex and project/global/init paths; configuration and status must remain secret-safe.

### Acceptance criteria

- [ ] Claude and Codex project installs, global installation followed by project `init`, and `update` install the Jira runtime and seed `.agent-workflow/integrations.yaml` only when absent; updates preserve the existing configuration and never delete it as a managed file.
- [ ] `.agent-workflow/integrations.yaml` is the sole runtime configuration path. Jira settings contain no credential values; the runtime reads `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` from the environment.
- [ ] Configuration validation checks the URL, required environment-variable presence, Jira identity/project access, and configured issue type availability. Errors identify missing variable names but never print values; configuration is not enabled after a failed check.
- [ ] Disabled or incomplete Jira configuration causes zero Jira HTTP requests and leaves local pipeline behavior unchanged.
- [ ] `getIntegrationStatus()` and all Jira logs, errors, command output, and tests expose neither credentials nor Authorization headers.

### Dependencies

None.

### Agentic notes

`src/services/integration-service.mjs` currently defaults to `src/config/integrations.yaml`, exposes the complete integration config from `getIntegrationStatus()`, and logs Jira response text and ticket input on errors. `src/config/integrations.yml` is a second, incompatible configuration shape. `install.sh` installs commands/skills/agents and templates but not the service; its global cache seeds templates and rules only. `bin/aw-build.mjs` emits prompt tooling for Codex. The repository has no package manifest or lockfile; use the existing Node ESM / built-in runtime rather than assuming a new package manager. No UI; skip Design.

## Story s02-jira-import — Import selected stories without duplicates

**As a** product owner **I want** to preview and import only the stories I select **so that** Jira tracks one stable issue per story without replacing the repository's product content.

### Complexity

4 — this slice combines user confirmation, Jira REST payloads, duplicate recovery, local linking, and optional dependency links.

### Acceptance criteria

- [ ] The Jira import command accepts explicit story IDs, shows a preview of create/reuse/link actions, and performs no Jira writes until the user explicitly confirms; cancellation leaves Jira and local links unchanged.
- [ ] Each requested story produces or reuses one issue of the configured project issue type. Its summary, user story, acceptance criteria, and dependency references are sent in Jira REST v3-compatible Atlassian Document Format, with the stable `aw-story-<story-id>` label. The command never infers completion from Markdown checkboxes and never imports unrequested stories.
- [ ] An existing local link or exactly one Jira issue found by the stable marker is reused. Multiple marker matches are reported as ambiguous and do not trigger creation. Success records only the Jira key and URL in `docs/integrations/<story-id>.md`; a repeat import does not create a duplicate.
- [ ] After a network-ambiguous create, the service searches for the marker before any retry. Retries are bounded to transient failures; permanent errors do not trigger a blind retry, and failures never claim that a ticket was created.
- [ ] When Jira exposes an applicable `Blocks` link type and both stories are linked, dependencies are linked in the correct direction. Missing dependency tickets, link types, or permissions leave the dependency reference in the issue and are reported. No Epic/Requirement is created automatically; a configured Epic parent is optional.
- [ ] Manual link/unlink commands use the one-issue-per-story contract; unlink removes the local reference only and does not delete a Jira issue.

### Dependencies

`s01-jira-setup`.

### Agentic notes

The current `JIRAService.createTicket()` retries every failure and can duplicate an issue after an ambiguous response. Jira REST v3 `description` requires Atlassian Document Format. Jira's enhanced search is `/rest/api/3/search/jql`; the older `/search` operations are being removed. Jira issue links require site issue-linking and project permission. Keep the import scoped to requested IDs and do not treat story checkbox state as Jira status.

## Story s03-jira-lifecycle — Reflect the delivery cycle in Jira

**As a** developer **I want** a linked Jira issue to reflect execution, review, and verified delivery **so that** Jira status never claims more progress than the repository proves.

### Complexity

4 — pipeline hooks must use per-issue workflow transitions and preserve local progress through remote failures.

### Acceptance criteria

- [ ] When execution starts for a linked story, the runtime resolves the configured `in_progress` destination against that issue's available transitions and posts the returned transition ID; a missing destination is reported without stopping local work.
- [ ] At review start, the linked issue moves to configured `in_review`. A rejected review is never marked Done; `blocked` is used only when configured and an applicable transition exists.
- [ ] The issue moves to configured `done` only after `/aw-ship` verifies the PR's merged state. An open/manual PR is not proof of completion. The Jira issue receives an idempotent PR link and records the verified merge outcome without copying the full pipeline history.
- [ ] `/aw-integrate-status` shows linked issue keys and fetched Jira statuses. `/aw-status` labels local pipeline state separately from Jira state; a failed fetch is shown as unavailable, never inferred from local files.
- [ ] Jira failures during execution, review, or ship leave local progress intact and produce an explicit sync warning. Explicit configure/import operations fail rather than report success when Jira rejects the request.

### Dependencies

`s02-jira-import`.

### Agentic notes

`JIRAService.syncStory()` currently returns `{ synced: true }` without a request. Jira workflow transitions are project-specific: query each issue's available transitions and use the matching ID. The existing ship strategy is manual by default; an opened PR must remain In Review until a later `/aw-ship` run proves it merged. No UI; skip Design.
