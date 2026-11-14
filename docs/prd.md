# PRD — Jira backlog management for agent-workflow

## Target

`agent-workflow`: the repository and installed command/skill set that guides product work through Research → Design → Plan → Execute → Review → Ship.

## Development approach

Extend the existing Node.js integration service, Markdown commands, and Bash installer. Keep the current story/worktree pipeline and the repository as the source of product and technical content.

## Project context

The Jira integration currently has a ticket-creation method but its story synchronization method is a success-shaped stub. The installer does not distribute that runtime or a project Jira configuration. The two existing integration YAML files and command docs disagree about the configuration path, and the exposed status object can contain credentials. Existing Jira examples assume an Epic → Requirement → Task hierarchy that a normal project may not have.

## Problem or need

Project maintainers need a safe, optional way to track selected agent-workflow stories in Jira. Jira should carry operational backlog fields and live status; the repository must keep the authoritative user story, acceptance criteria, research, design, architecture, and delivery decisions. A failed Jira request must never falsify local progress or create a duplicate ticket.

## Target users

- Project maintainers installing agent-workflow for Claude Code or Codex, locally or globally.
- Product owners importing explicitly selected stories into a Jira Cloud project.
- Developers and reviewers who need Jira to reflect the existing execution and delivery cycle.

## Scope — prioritized features

### In-scope (core functionality)

| Feature | Complexity (1-5) | Why this score |
|---|---:|---|
| Optional, secure Jira runtime installation and project configuration | 4 | Cross-target installation, environment credentials, configuration validation, and redaction. |
| Previewed, confirmed, idempotent import and one-ticket-per-story linking | 4 | Jira REST calls, uncertain-create recovery, dependency links, and local mapping. |
| Jira status and pull-request synchronization across the existing delivery cycle | 4 | Workflow-specific transitions, merge proof, read-only status reporting, and fail-soft pipeline behavior. |

Scale: 1 trivial operations · 2 form + persistence + list · 3 core features / several states · 4 integrations, permissions · 5 live features, data migrations, external services. A 5 is a high-risk — keep it only if it's the core value proposition.

### Excluded features

- Importing all historical stories or inferring completed work from Markdown checkboxes.
- Creating one Jira issue per acceptance criterion, plan task, or technical requirement.
- Automatically creating an Epic or Requirement for each story; a configured Epic parent is optional.
- Bidirectional synchronization of story text, acceptance criteria, plan checkboxes, code, or full pipeline history.
- Webhooks, exhaustive backlog polling, or a Jira dependency that blocks local pipeline work.
- Automatic Jira Done at plan approval, implementation completion, successful review, or PR creation; Jira Done requires explicit user authorization of `/aw-ship` and is not gated on merge proof.
- Importing a separate consumer project's stories as part of this repository change.
- Tests that contact a real Jira instance.

### Differentiators

- One selected product story maps to one stable Jira issue; its story and acceptance criteria remain authoritative in Git.
- Jira owns only live backlog fields: status, priority, and assignee.
- No blind retry of an uncertain issue creation and no false report of remote success.
- The current Research → Design → Plan → Execute → Review → Ship workflow remains unchanged when Jira is disabled or unavailable.

## Constraints

- Use Jira Cloud REST API v3 and validate the configured project and issue type against Jira rather than assuming a project hierarchy or workflow.
- Store project settings in `.agent-workflow/integrations.yaml`; keep credentials in `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` environment variables.
- Install the runtime under `.agent-workflow/runtime/`; preserve an existing user configuration during install, update, and init.
- Use stable story markers, Jira's Atlassian Document Format for issue descriptions, and discovered transition IDs.
- Jira remains optional. Disabled or unconfigured integration makes no Jira request; pipeline-side failures are visible but do not discard local progress.
- Keep tests deterministic and mocked; no runtime Jira credentials or network access in tests.

## Success criteria

- Claude and Codex project installs, global install followed by project `init`, and `update` all supply the Jira runtime without overwriting or deleting a project configuration; the managed-file manifest excludes that configuration.
- Configuration validation reports missing variable names without values, validates the Jira identity/project and configured issue type, and enables Jira only after successful validation.
- A disabled or unconfigured Jira integration causes zero HTTP requests and preserves current local pipeline behavior.
- Status, logs, errors, command output, and test output never reveal the API token or Authorization header.
- Import previews only the requested story IDs, makes no Jira writes until explicit confirmation, reuses a single existing match, and stops without creation on ambiguous matches.
- Every successfully imported story has one stable Jira issue and a local key/URL record; reruns do not create duplicates; uncertain creates search by marker before a transient retry.
- Jira Stories transition to `in_progress` at Research/orchestrated start and implementation fixes, to `in_review` when review starts, and remain `in_review` when review passes. Only user-authorized `/aw-ship` transitions a Story to `done`; merge proof controls only the remote-link outcome. Parent Epics move to `in_progress` when any child Story is in progress and to `done` only when all child Stories are done.
- Status commands distinguish local pipeline state from fetched Jira state and show remote state as unavailable when Jira cannot be reached.
- Jira outages never block or erase local execution; explicit configuration/import operations do not claim success after a Jira failure.
