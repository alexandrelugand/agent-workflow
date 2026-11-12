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

`/aw-execute` requests `in_progress` for a linked story. `/aw-review` requests `in_review`; a rejected review may request `blocked` only when that mapping is configured and an applicable transition exists. An open PR remains In Review and receives an idempotent Jira remote link. `/aw-ship` requests Done only after it verifies the PR state is exactly `MERGED`, and updates that same link with the merged outcome.

Transition IDs are discovered from the individual Jira issue. The runtime matches the configured destination exactly against each transition's `to.name` and posts the returned ID. An issue already at the target is a no-op; missing or ambiguous transitions produce a warning instead of a guessed transition. After a new or recovered story is verified under its selected Epic, only an Epic in Jira's `done` status category is transitioned to `jira.status_names.todo`. Existing stories are not reparented; Epic reopen failures warn without undoing the import.

`/aw-integrate-status` fetches Jira status for locally linked issues. Failed reads appear as unavailable, never as status inferred from local files. Jira lifecycle failures are surfaced but do not stop local execution, review, ship, or proven-merge cleanup. Explicit configure and import operations remain fail-closed.

## Security and verification

Do not print credentials, Authorization headers, request or response bodies, provider URLs, or raw configuration in status output or logs. Automated Jira tests use an injected mock `fetch`; no permanent test contacts a live tenant. Validate real workflow names and permissions only in an explicitly configured non-production Jira project.