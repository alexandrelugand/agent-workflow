---
validated: yes
---
# Plan — Story s01-jira-setup

Branch: `feature/s01-jira-setup`
Research: `docs/research/s01-jira-setup.md` — read it first; this plan does not repeat it.

## Target story

Install and safely configure an optional Jira runtime for consumer projects. Preserve user configuration, validate credentials/project/issue type only through the explicit setup path, and keep disabled or incomplete Jira request-free.

Acceptance criteria: `docs/stories.md:6-20`.

## Decisions

| Concern | Chosen contract | Rejected alternative |
|---|---|---|
| Runtime configuration | `.agent-workflow/integrations.yaml` is the sole consumer path and is user-owned; keep `src/config/integrations.yaml` only as the source template. | Runtime lookup in the source tree or dual `.yml`/`.yaml` support. |
| Credentials | Read `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` from the process environment; keep issue type and status names in secret-free YAML. | Secret values or fallback credentials in YAML, prompts, or command output. |
| Network gate | Missing, disabled, or incomplete Jira is request-free. Only explicit `jira validate` performs pre-enable identity/project/type requests; it never enables configuration. | Network activity during service initialization or implicit enablement after a partial check. |
| Install ownership | Install/update the target-neutral runtime as managed files; seed config only if absent and never track it in the manifest. Global `init` uses the cached source payload before attempting a clone. | Treating user config as managed or depending on a second remote fetch after global install. |
| Errors and status | Return safe status summaries and actionable status-level errors; never expose raw config, response bodies, request payloads, headers, or known secrets. | Logging full responses/configuration to aid debugging. |
| Runtime dependencies | Keep Node ESM and built-in APIs; validate against the documented config schema and tenant-provided issue type. | New package/runtime dependency or assumed Jira issue type/workflow names. |

## Tasks (ordered)

1. [x] **Load the canonical project config safely.** Change the runtime default to `.agent-workflow/integrations.yaml` under the project root; keep `src/config/integrations.yaml` as the install template. Treat missing, disabled, or incomplete Jira as inactive with no Jira request. Read credentials only from the four required environment variables; keep issue type and workflow names secret-free in YAML. Test absent config, disabled/incomplete config, and missing-variable names without values.
2. [x] **Add explicit connection validation.** Add a target-neutral Jira CLI entry point to the installed runtime. Its validation action checks an approved HTTPS Jira Cloud site/scoped-token base URL, required environment-variable presence, `GET /myself`, project issue-type metadata, and an exact match for the configured issue type. It is the only setup action that contacts Jira before enablement; it never enables config itself. Test success and URL, identity, project, issue-type, and credential failures with mocked `fetch`.
3. [x] **Redact status and failure output.** Make `getIntegrationStatus()` return only safe summary fields for every provider; remove raw response bodies and request payloads from service logs/errors, including Jira. Keep actionable HTTP-status guidance without URL credentials or token values. Test that synthetic credentials and Authorization headers are absent from returned status, captured logs, and errors.
4. [x] **Install and update the target-neutral runtime.** Extend `install.sh` to copy the runtime and seed `.agent-workflow/integrations.yaml` only when absent for Claude, Codex, and `all`. Track runtime files in `.agent-workflow/.aw-manifest`; never list the user config or delete other user files. Cache the source payload required by `init` and resolve that local payload before cloning, so global-install-then-`init` works without a network fetch. Preserve the existing command/template behavior. `bin/aw-build.mjs` remains unchanged unless the installer test proves Codex runtime packaging needs it.
5. [x] **Migrate configuration references and setup guidance.** Remove `src/config/integrations.yml`; migrate consumer/runtime references from old config paths to `.agent-workflow/integrations.yaml`, retaining `src/config/integrations.yaml` only when naming the source template. Update command, skill, hook, template, and guide references, including the configuration guides under `src/docs`, `docs/integrations`, and `docs/`. Update `/aw-integrate-configure` to write secret-free settings and enable only after successful validation; keep `/aw-integrate-status` redacted. Make `src/hooks/pre-integrate/00-integration-check.sh` no-op without Jira errors, network calls, or local file creation when Jira is missing, disabled, or incomplete. Do not implement import/lifecycle behavior; reconcile the old implementation roadmap in the final documentation story.
6. [x] **Add service and optional-hook behavior tests.** Replace the stale service assertions with Node `node:test` cases using mocked `fetch`; cover configuration selection, zero network while disabled/unconfigured/incomplete, required-variable reporting, Jira identity/project/type validation, and secret redaction. Add isolated shell-hook tests for missing, disabled, and incomplete Jira leaving the ordinary local pipeline unblocked and unchanged. Keep synthetic credentials out of assertion output; target at most about 15 service cases plus three hook cases. No real Jira calls.
7. [x] **Add temporary-project installer smoke coverage.** Exercise Claude and Codex project installs, update with an existing config and unmanaged file, global install followed by cached `init`, and managed-file cleanup. Assert config bytes and unmanaged files survive, runtime files are refreshed, and init does not need to clone. Use isolated temporary `HOME`/project directories and no Jira credentials or external network.

## Run interdicts

- Do not create Jira issues or import stories in this story; that belongs to `s02-jira-import`.
- Do not implement Jira status transitions or PR handling; that belongs to `s03-jira-lifecycle`.
- Never write, stage, or log real credential values; never include `.agent-workflow/integrations.yaml` in a managed-file manifest.
- Do not change GitHub or Telegram API behavior beyond redacting their secrets/status output where required by the shared status contract.
- Do not add a package manifest, runtime dependency, or live-Jira test.

## The point everything turns on

The installer must distinguish managed runtime files from user-owned configuration. Compare the manifest and exact config bytes before/after `update`, then run `init` from the global cache with a failing `git` shim in `PATH`; if init reaches the clone path or rewrites/removes the config, the core installation contract is broken.

## Files touched

Anticipated: `src/services/integration-service.mjs`, `src/services/integration-service.test.mjs`, new `src/services/integration-cli.mjs`, `src/config/integrations.yaml`, delete `src/config/integrations.yml`, `install.sh`, new `src/install.test.mjs`, new `src/hooks/pre-integrate/00-integration-check.test.mjs`, `src/commands/aw-integrate-configure.md`, `src/commands/aw-integrate-status.md`, and consumer config-path/setup references in commands, skills, hooks, templates, `src/docs/integrations.md`, `docs/integration-guide.md`, and `docs/integrations/README.md`. `src/AGENTS.md`, `docs/architecture.md`, the accepted ADR, and the final `plans/INTEGRATION_IMPLEMENTATION.md` migration are not reworked in this story.

## Test strategy

- Service tests use injected/mock `fetch` and temp config files. Test zero network for disabled/unconfigured/incomplete Jira, explicit validation endpoints and issue-type match, safe status/error output, and no secret in captured output.
- Hook tests run `src/hooks/pre-integrate/00-integration-check.sh` in isolated temp projects; missing, disabled, and incomplete Jira must exit successfully and leave normal local files/directories untouched.
- Installer smoke tests execute the real `install.sh` in isolated temporary directories and a temporary `HOME`; no repository config or real user files are touched.
- Run the focused Node tests and installer smoke once after the relevant tasks. At the end run `node --check` on changed `.mjs` files. There is no TypeScript project or lockfile; do not invent a type-check command.
- Budget: 38 unique behavior cases (15 service, 9 CLI, 8 hook, 6 installer). Each layer covers a distinct contract: provider gating/redaction/logging, explicit Jira URL/identity/project/type and pagination, pipeline credential gates/worktree/CRLF behavior, and isolated project/global/cache/update ownership. No rule is re-asserted at another layer; cached Codex update/all and cached global reinstall are separate from cached init because they exercise builder-dependent update and self-copy-safe cache behavior.

## Definition of Done

- All five acceptance criteria in `docs/stories.md:16-20` pass.
- Claude/Codex project installs and global `init` deliver the runtime; config is never overwritten or removed by update.
- Jira disabled/unconfigured makes no Jira request; validation errors and status output contain no secret.
- Focused tests and the temporary-project smoke pass; all required docs/path references are migrated.
- The plan's task checkboxes are complete and the story is ready for independent review.
