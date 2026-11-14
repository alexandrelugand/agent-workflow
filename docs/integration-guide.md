# Integration Guide

Agent-workflow can use Jira, GitHub, and Telegram as optional providers. This guide describes the current Jira contract; GitHub and Telegram configuration remains in their provider adapters.

## Responsibilities

- The repository is authoritative for story text, acceptance criteria, research, design, architecture, and delivery decisions.
- Jira is the operational source for backlog fields. The integration synchronizes lifecycle status and a pull-request link; it does not mirror story text or acceptance criteria back into the repository.
- One selected story maps to one Jira issue. Acceptance criteria and plan tasks do not become separate issues.
- Jira is optional. Disabled or incomplete configuration makes no Jira request and does not change local pipeline behavior.

## Runtime and configuration

The installer places the runtime under `.agent-workflow/runtime/`. The sole consumer configuration is `.agent-workflow/integrations.yaml`; it is user-owned, seeded only when absent, and never overwritten or removed by update. `src/config/integrations.yaml` is the repository's source template, not the consumer config.

The Jira CLI reads the four credentials below from the invoking process environment or from `.env` plus `.env.<NODE_ENV>` at the consumer repository root. `.env.development` is selected when `NODE_ENV` is unset; to use `.env.production` without a system setting, put `NODE_ENV=production` in `.env`. Precedence is process environment, environment-specific file, then `.env`. These local files are Git-ignored (except `.env.example`); other providers do not read credentials from them. Never put credentials in YAML, tracked source, logs, or command output:

- `JIRA_API_URL`
- `JIRA_PROJECT_KEY`
- `JIRA_EMAIL`
- `JIRA_API_TOKEN`

Jira settings such as `issue_type`, optional `epic_key`, and nested `status_names` are secret-free. Run `/aw-integrate-configure` to validate the HTTPS site, identity, project access, and configured issue type. Validation does not enable Jira; enable it only after successful validation. Missing, disabled, or incomplete configuration remains request-free.

## Explicit story import

Run `/aw-integrate-jira <full-story-id...>` only with story IDs explicitly selected by the user and present in the current worktree's `docs/stories.md`. The command previews create, reuse, recovery, and dependency-link actions before any write, then asks for confirmation. Cancellation performs no write. After confirmation, the import rechecks Jira and creates or reuses exactly one configured-type issue per selected story.

Issues use Jira REST v3 and an Atlassian Document Format (ADF) description containing the story, acceptance-criterion text, and dependency references, plus the stable `aw-story-<story-id>` label. Supported inline Markdown is translated to ADF marks (strong, emphasis, code, strike, and HTTP(S)/mailto links); literal Markdown delimiters are not sent. The import does not infer status from checkboxes, import unrequested or historical stories, create one issue per criterion, or create an Epic/Requirement/Task hierarchy. The optional existing parent comes from `jira.epic_key`, overridden by a story's `### Epic` section when set.

Successful imports store only the Jira key and browse URL in `docs/integrations/<story-id>.md`; unrelated provider data is preserved. `/aw-integrate-link` links one existing issue, and unlink removes only the local Jira reference. Uncertain issue creation is reconciled by its stable marker; unresolved pending creates require human resolution rather than a blind retry.

## Lifecycle and status

`/aw-research` and the orchestrator request `in_progress` when a story cycle starts; `/aw-execute` requests it again when implementation or review fixes begin. `/aw-review` requests `in_review`; a passed review leaves the Story there, and user-authorized `/aw-ship` requests `done`. A rejected review may request optional `blocked`. Parent Epics move to `in_progress` when any configured child Story is in progress and to `done` only when all configured child Stories are done. `/aw-ship` updates the same PR remote link from Open to Merged only after it verifies `MERGED`; merge proof controls only the link outcome, not Story Done.

Transition IDs are discovered from each Jira issue. The runtime matches the configured destination exactly against each transition's `to.name` and posts the returned ID. An issue already at the target is a no-op; missing or ambiguous transitions produce a warning instead of a guessed transition. Epic aggregation uses current child Story statuses and only transitions to In Progress when a child is in progress or to Done when every child is done; incomplete Epic searches and transitions warn without interrupting local work.

`/aw-integrate-status` fetches Jira status for locally linked issues. Failed reads appear as unavailable, never as status inferred from local files. Jira lifecycle failures are surfaced but do not stop local execution, review, ship, or proven-merge cleanup. Explicit configure and import operations remain fail-closed.

## Security and verification

Do not print credentials, Authorization headers, request or response bodies, provider URLs, or raw configuration in status output or logs. Automated Jira tests use an injected mock `fetch`; no permanent test contacts a live tenant. Validate real workflow names and permissions only in an explicitly configured non-production Jira project.