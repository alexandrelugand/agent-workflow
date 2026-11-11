# Research — Story s01-jira-setup

## The five structuring facts

1. `IntegrationService` defaults to a source-tree config path and throws when it is absent (`src/services/integration-service.mjs:15-22,45-54`); consumer installs do not have that source tree.
2. `getIntegrationStatus()` returns each full provider config (`src/services/integration-service.mjs:240-255`), and Jira failure logging includes raw response text and ticket input (`:267-270,383-408`).
3. `JIRAService.syncStory()` is a success-shaped stub, not a network operation (`src/services/integration-service.mjs:437-442`).
4. `install.sh` copies commands/skills/agents and templates but not the integration runtime; its global cache has only templates/rules, and payload resolution attempts a repository clone before the `init` mode can select the cache (`install.sh:24-35,186-215`).
5. The two tracked configs have incompatible roots (`src/config/integrations.yaml:4-16`, `src/config/integrations.yml:4-14`); current tests import a named export while source exports only the default (`src/services/integration-service.test.mjs:8`, `src/services/integration-service.mjs:667-668`).

## Target story

`s01-jira-setup` (complexity 4): install a consumer-project Jira runtime and seed config without overwriting user settings; use the four required environment variables; verify identity, project, and issue type before enabling; make disabled/incomplete integration request-free; redact secrets everywhere. Acceptance criteria: `docs/stories.md:6-20`.

## Current state of the code

- `IntegrationService` loads config synchronously and defaults to `src/config/integrations.yaml` (`src/services/integration-service.mjs:14-22,45-55`). Its hand-written parser supports only a limited subset of the existing YAML (`:60-140`).
- Jira is initialized only when its `enabled` value is truthy (`:168-175`). `getIntegrationStatus()` exposes the config object unredacted (`:240-255`).
- `JIRAService` reads URL/token/email/project settings from config (`:358-372`); ticket creation uses Basic auth (`:377-392`) but retries non-OK responses and logs the response body (`:383-408`). The ticket builder hard-codes Epic/Story/Task types and uses a string description (`:415-431`).
- `install.sh` tracks only tooling paths in `.aw-manifest` (`:54-78`), copies templates separately (`:95-128`), seeds a global cache with templates/AGENTS/install script (`:186-193`), and `init`/`update` do not install the service (`:209-220`).
- `/aw-integrate-configure` still instructs writing `src/config/integrations.yaml` and `.env` (`src/commands/aw-integrate-configure.md:71-108`). The source `integrations.yaml` contains a placeholder `PROJ` and secret-variable references (`src/config/integrations.yaml:9-24`); the `.yml` file is a different top-level shape.

## Anchor points

| Concern | Current anchor |
|---|---|
| Runtime path and config loading | `IntegrationService.constructor()`, `loadConfig()` — `src/services/integration-service.mjs:15-54` |
| Jira initialization/status/redaction | `initializeJiraService()`, `getIntegrationStatus()` — `:168-175,240-255` |
| Jira request/error logging | `JIRAService.createTicket()`, `IntegrationService.createJiraTicket()` — `:261-271,358-410` |
| Project and global installation | `install_target()`, global `seed_cache()`, `init`, `update` — `install.sh:159-177,185-220` |
| Configuration command contract | `src/commands/aw-integrate-configure.md:35-108,122-145` |

## Verified APIs / functions

- Atlassian documents REST API v3 as latest; Jira v3 issue `description` requires Atlassian Document Format. For standard API tokens, Basic auth uses the Atlassian account email and token; scoped tokens use `https://api.atlassian.com/ex/jira/<cloudId>`.
- `GET /rest/api/3/myself` verifies the authenticated identity. `GET /rest/api/3/issue/createmeta/{projectIdOrKey}/issuetypes` returns the issue types available to create in the project; the deprecated parent `createmeta` endpoint is not required.
- These are Jira Cloud contracts, not assumptions about a specific tenant: [REST v3 authentication/ADF](https://developer.atlassian.com/cloud/jira/platform/rest/v3/intro/), [project issue-type metadata](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-createmeta-projectidorkey-issuetypes-get), [Atlassian API tokens](https://support.atlassian.com/atlassian-account/docs/manage-api-tokens-for-your-atlassian-account/).

## Traps & constraints

- Disabled or missing config must be detected before constructing/sending any Jira request; explicit setup is the only path that checks identity/project access.
- Never log `response.text()`, raw config, request headers, or the ticket payload. The current Jira wrapper also logs `...data` on error (`:267-270`).
- Jira issue type names and project permissions are tenant-specific. Validate the configured name against create metadata instead of assuming `Story` exists.
- The current service test contract is stale: it imports `{ IntegrationService }` (`integration-service.test.mjs:8`) but the module exports default only (`integration-service.mjs:667-668`); tests call methods such as `loadConfig(path)` and `checkHealth()` not present on the service (`integration-service.test.mjs:53-55,148-155`). The repo has no package manifest/lockfile, so there is no repository-defined test command; the architecture chooses Node's built-in `node:test`.
- `install.sh`'s `.agent-workflow/` is already ignored by Git (`.gitignore:1-9`). The new manifest must track runtime files only; never list `.agent-workflow/integrations.yaml` for cleanup.
- Global `init` therefore needs a complete local runtime/config payload available before remote-source resolution, or a temporary-project smoke test still depends on cloning the repository.
- `src/hooks/pre-integrate/00-integration-check.sh:9-34,36-72` exits nonzero when the source config is absent or Jira is enabled without three old variables, and creates local integration/log directories before deciding whether any integration is enabled. Migrate this gate so absent/disabled/incomplete Jira remains request-free and does not block the ordinary local pipeline; configuration validation stays explicit.
- Consumer-path instructions are spread across commands, integration skills, hooks, templates, `src/docs/integrations.md`, `docs/integration-guide.md`, `docs/integrations/README.md`, and older setup/implementation plans. Migrate runtime instructions, but retain `src/config/integrations.yaml` only when referring to the repository's installer source template.

## Open questions

- No consumer Jira tenant or project is specified, so no live identity, project permission, or issue type can be verified here. `/aw-integrate-configure` must perform those checks explicitly when the user has supplied environment variables.
- No UI is involved; Design is skipped.

## Real complexity

4, matching `docs/stories.md:10-12`: installer distribution spans both targets and project/global/init/update modes, while configuration and status must enforce secret-safety. The bounded runtime/config contract and no-credential default keep this below a 5.

## Split proposal

Not needed. Runtime distribution, configuration validation, and safe status form one complete setup slice; issue import and lifecycle transitions remain in dependent stories `s02-jira-import` and `s03-jira-lifecycle`.
