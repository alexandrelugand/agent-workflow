# Architecture — Jira backlog management for agent-workflow

## Stack

- Existing Bash installer and Node.js ESM service; Markdown files remain the command and pipeline contracts.
- Jira runtime targets Node.js 18+ and uses built-in APIs (`fetch`, file I/O); no daemon, database, or new runtime service.
- Jira Cloud REST API v3; requests are made only by explicit setup/import commands or by lifecycle commands when Jira is configured and enabled.
- Tests use Node's built-in `node:test` runner and injected/mock `fetch`; no test contacts Jira or requires credentials. The repository has no package manifest or lockfile.

## Repo structure

- `src/commands/` defines cross-tool command behavior for Claude Code and Codex.
- `src/services/integration-service.mjs` is the source implementation for Jira operations; the installer copies the runtime payload to `.agent-workflow/runtime/` in consumer projects.
- `src/config/integrations.yaml` is the source template. The sole consumer-project configuration is `.agent-workflow/integrations.yaml`; `src/config/integrations.yml` is removed as a competing contract.
- `install.sh` installs the same target-neutral runtime for Claude and Codex. Its global cache must carry the runtime and configuration template for project `init`. A `.agent-workflow/.aw-manifest` tracks managed runtime files only; the project configuration is user-owned and never removed or overwritten on update.
- `bin/aw-build.mjs` transforms command/agent prompts for Codex. The Jira runtime is copied independently and does not fork by target.
- `docs/stories.md` is the input backlog; `docs/integrations/<story-id>.md` records the stable Jira key and URL only.

## Patterns & conventions

- Preserve the existing worktree-per-story, validated-plan, review, and manual-ship gates. There is no UI; all stories skip Design.
- Jira stays optional: absent or disabled configuration means no Jira request. Pipeline sync is fail-soft and reports remote errors without losing local work; explicit configure/import commands fail closed.
- Credentials come only from `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN`. Validate configuration before enabling; never expose raw configuration, headers, response bodies, or secret values in status, logs, errors, or command output.
- Keep runtime configuration declarative and secret-free. Semantic status destinations (`todo`, `in_progress`, `in_review`, optional `blocked`, `done`) map to Jira status names; transitions are discovered for each issue and invoked by the returned transition ID.
- A story has one Jira issue. Its Jira label `aw-story-<story-id>` is the stable marker; user story, acceptance criteria, and dependency references remain in the repository. Jira owns live status, priority, and assignee; local integration records do not mirror them.
- Use Atlassian Document Format for Jira v3 descriptions. Search by the stable label before creating and after any ambiguous create response. Dependency links use the project's available `Blocks` link type; unsupported links remain visible in the issue text and command result.
- Research/orchestrated start and implementation fixes request Story `in_progress`; review start requests `in_review`; a passing review requests `done`. Parent Epics enter `in_progress` when any configured child Story is in progress and enter `done` only when all configured child Stories are done. Jira transitions remain best-effort and use per-issue transition IDs; the merge gate governs only the PR remote-link Merged outcome.

## Data model

| Local source | Jira representation | Authority |
|---|---|---|
| Story ID `s<number>-<slug>` | Label `aw-story-<story-id>` | Stable cross-system identity |
| Summary and user story | Issue summary and description | Repository content |
| Acceptance criteria | ADF list in issue description | Repository content |
| Story dependencies | Jira issue links when available; text references otherwise | Repository content |
| Jira issue key and browse URL | `docs/integrations/<story-id>.md` | Local pointer only |
| Status, priority, assignee | Live Jira fields; never copied to the local record | Jira |
| PR URL / verified merge | Idempotent remote issue link | GitHub proof authorizes only the link's Merged outcome, not Story Done |

An optional existing Epic parent may come from `jira.epic_key` or a story's `### Epic` section, which takes precedence. The runtime validates it in the configured project and never creates an Epic or Requirement. Existing issues are not reparented; a successfully created or recovered story may reopen a completed parent to configured `status_names.todo`.

## Integration points

- Jira Cloud REST v3 Basic authentication supports a site URL for API tokens and `api.atlassian.com/ex/jira/<cloudId>` for scoped API tokens. Accept only HTTPS Jira Cloud base URLs; do not send credentials to arbitrary hosts.
- Explicit configuration checks the identity (`GET /myself`), project access, and configured issue type using create-metadata issue types for the project. Missing environment-variable names are shown without values.
- Issue creation uses `POST /issue`; v3 descriptions use Atlassian Document Format. Stable-marker searches use enhanced JQL `POST /search/jql` and request only the fields needed to identify matches.
- Dependency links use `GET /issueLinkType` and `POST /issueLink`. PR links use `POST /issue/{issueIdOrKey}/remotelink` with a stable `globalId`; Jira updates the remote link when the same ID is submitted again.
- Lifecycle status reads use `GET /issue/{issueIdOrKey}?fields=status`; writes use `GET /issue/{issueIdOrKey}/transitions` followed by `POST /issue/{issueIdOrKey}/transitions` with the discovered ID. No workflow status or transition ID is hard-coded.
- `/aw-integrate-status` and `/aw-status` show fetched Jira state separately from file-derived local state. A failed request yields an unavailable/unknown remote state, never an inferred status.

## Design / UX

No graphical UI. Import presents a read-only preview and requires an explicit confirmation before writes. Status output distinguishes local pipeline progress, linked Jira key, and current Jira status.

## Verified Jira references

- [Jira Cloud REST API v3: authentication and ADF](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/)
- [Create issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post) and [create metadata issue types for a project](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-get)
- [Enhanced JQL search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post)
- [Issue link creation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/#api-rest-api-3-issuelink-post) and [link types](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-link-types/#api-rest-api-3-issuelinktype-get)
- [Issue transitions](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-issueidorkey-transitions-get) and [remote issue links](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-remote-links/#api-rest-api-3-issue-issueidorkey-remotelink-post)
- [Atlassian API token authentication](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/)
