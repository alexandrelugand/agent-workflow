# ADR 001 — Project-local Jira runtime and configuration

- Status: accepted
- Date: 2026-11-11
- Scope: framing

## Context

The installer currently distributes commands, skills, agents, and templates, but not `src/services/integration-service.mjs` or a consumer-project Jira configuration. The service defaults to a source-tree path, while command and guide files refer to both `integrations.yml` and `integrations.yaml`. A project install must work for Claude and Codex, including `init` after a global install, and must preserve local configuration and secrets during update.

## Decision

- Use `.agent-workflow/integrations.yaml` as the one consumer-project configuration path and `.agent-workflow/runtime/` for the installed Node runtime.
- Keep `src/config/integrations.yaml` as the installer source template; remove the incompatible `src/config/integrations.yml` contract.
- Extend the shared `install.sh` flow for Claude/Codex project installs, updates, and global-cache `init`. Track managed runtime files in `.agent-workflow/.aw-manifest`; never put `.agent-workflow/integrations.yaml` in that manifest. Create the starter config only when absent and never overwrite it on update.
- Keep credentials out of YAML and use the four documented Jira environment variables. Leave Jira disabled by default; only the explicit configuration check performs identity/project calls before enabling it.
- Keep the installed runtime target-neutral and Node ESM; use Node built-ins rather than requiring consumer projects to install a package.

## Considered options

- Use `src/config/integrations.yaml` in consumer projects — rejected because the source-tree path is absent from ordinary installed projects.
- Continue supporting both `.yml` and `.yaml` — rejected because two shapes already produce divergent behavior and cannot provide one documented runtime contract.
- Store the Jira runtime inside `.claude/` or `.codex/` — rejected because both targets must share one project configuration and one runtime behavior.
- Treat the project configuration as an installer-managed file — rejected because `update` or `init` could overwrite user settings or remove credentials.

## Consequences

- The installer and its global cache must distribute the runtime payload and source configuration template; the Codex prompt builder remains independent.
- The installer manifest must distinguish managed runtime files from user-owned project configuration, and the smoke test must cover preservation across install/update/init for both targets.
- Jira execution requires Node.js 18 or newer in the consumer project. Configuration remains disabled and produces no network traffic when required settings are absent.
- Runtime configuration parsing is limited to the documented integration schema; adding arbitrary YAML features or a package dependency requires a new decision.
