# Research — Story s02-jira-import

## The five structuring facts

1. `JIRAService.createTicket()` hard-codes Epic/Story/Task mapping, sends a plain-text description, retries every thrown response/network error, and returns only a key (`src/services/integration-service.mjs:312-361`). That violates configured issue type, ADF, and safe ambiguous-create behavior.
2. The installed CLI currently has only `validate` and `status` actions (`src/services/integration-cli.mjs:76-85`). It must keep shared config discovery separate from story files and integration records in the current worktree.
3. `docs/stories.md` already has stable `## Story <id> — ...`, `### Acceptance criteria`, and `### Dependencies` sections for explicit selection (`docs/stories.md:30-53`). The importer must not infer Jira status from criterion checkboxes or import dependencies that were not requested.
4. Existing Jira prompts/hooks still create Epics, Requirements, Tasks, and placeholder records for PRD stories (`src/commands/aw-integrate-jira.md:45-80`, `src/commands/aw-orchestrator.md:49-55`, `src/hooks/post-prd/00-integration-prd.md:31-59`). These are direct conflicts with one issue per story and explicit import only.
5. Jira REST v3 provides enhanced JQL search, ADF issue descriptions, and issue links, but search may lag after writes. A create timeout cannot safely be treated as proof that no issue was created.

## Target story

Import only explicitly requested story IDs, after a no-write preview and explicit confirmation. Reuse an existing local link or exactly one issue carrying `aw-story-<story-id>`; stop on multiple matches. Create one configured issue per story with repository content in ADF, persist the Jira key/URL locally, and never claim success after a failed or uncertain request. Link dependencies only when both stories already have Jira links and the project permits `Blocks`. Manual link/unlink remains one Jira issue per story; unlink removes only the local reference.

## Current state of the code

- `IntegrationService.createJiraTicket()` is the only service wrapper for Jira creation; repository call-site search found only its tests. `JIRAService.buildTicketPayload()` maps `epic`, `requirement`, and `task`, defaults unknown types to Task, uses `data.description || ''`, and does not add a stable story marker (`src/services/integration-service.mjs:190-200,312-361`). It does not use configured `jira.issue_type`.
- `JIRAService.createTicket()` retries every thrown error, including permanent HTTP errors and network-ambiguous POST outcomes (`src/services/integration-service.mjs:318-339`). `JIRAService.syncStory()` remains a stub, owned by dependent story s03 (`:367-371`).
- `integration-cli.mjs` validates Jira and returns redacted status; it already injects `fetch` for validation and resolves the shared consumer config root (`src/services/integration-cli.mjs:28-85`). `resolveConsumerRoot()` may return the main checkout from a story worktree (`src/services/project-root.mjs:5-24`); story markdown and `docs/integrations/<id>.md` must instead be read/written in the current worktree.
- Existing Jira commands and hooks still describe hierarchical tickets, automatic PRD-wide ticket creation, and status/timeline fields in local records. The `aw-integrate-link` examples also allow multiple Jira tickets per story; unlink documentation deletes the whole record. `src/templates/jira-ticket.md` has no call sites beyond itself and encodes the obsolete hierarchy.
- Jira stays disabled/request-free unless global and Jira flags are true and all four environment variables exist (`src/services/integration-service.mjs:109-115`). The `.gitignore` excludes `.agent-workflow/`, so a non-secret local recovery marker there would remain outside tracked story content and installer-managed files.
- Tests use Node's built-in `node:test`, injected fetch, and temporary files. No package manifest or lockfile exists; no Jira credentials or live provider are available in this research.

## Anchor points

- Extend `JIRAService` and the `IntegrationService` facade in `src/services/integration-service.mjs` for marker search, configured-type creation, ADF payloads, and dependency links.
- Extend `src/services/integration-cli.mjs` and `src/services/integration-cli.test.mjs` with read-only preview and separately confirmed import operations. Parse only the requested story sections from the current `docs/stories.md`.
- Use `src/services/integration-service.test.mjs` for Jira request/payload/retry/link behavior. Keep the existing request redirect guard and safe provider errors.
- Replace obsolete Jira hierarchy instructions in `/aw-integrate-jira`, align manual `/aw-integrate-link` and `/aw-integrate-unlink`, and remove any automatic Jira import instructions from callers/hooks.
- Update the user-facing import/record-format guidance and remove the unreferenced `src/templates/jira-ticket.md` hierarchy template if implementation confirms it remains unused.

## Verified APIs / functions

- **Search:** Jira REST v3 `POST /rest/api/3/search/jql`; request accepts `jql`, `fields`, `maxResults`, and `nextPageToken`. The endpoint example returns `isLast`; search only by project plus the exact stable label, request only needed fields, follow every page, and report 0/1/multiple matches distinctly. Atlassian notes recent updates may not be immediately visible; `reconcileIssues` is available for read-after-write when issue IDs are known.
- **Create:** Jira REST v3 `POST /rest/api/3/issue`. Create-screen metadata governs valid fields; `description` is ADF, and `fields.issuetype`, `project`, `summary`, `labels`, and optional `parent` are supplied in `fields`. Use configured `jira.issue_type`; do not recreate the legacy Epic/Requirement/Task mapping.
- **ADF:** ADF is a versioned `doc` root containing block nodes; paragraphs and lists can represent the user story, criteria, and dependency text. Send criterion text without transferring checkbox state as Jira status.
- **Dependency links:** `GET /rest/api/3/issueLinkType` exposes issue-link types and their descriptions; descriptions are configurable, so match the stable `name === 'Blocks'` rather than inward/outward wording or capitalization. `POST /rest/api/3/issueLink` requires `type`, `inwardIssue`, and `outwardIssue`, returns no body, and requires Jira issue linking plus project permissions. For story A blocked by dependency B, A is inward and B outward. Issue details expose the linked endpoint as one of `inwardIssue` or `outwardIssue`; when fetching blocked issue A, detect an existing B dependency from `inwardIssue.key === B`. Do not create a link type.

Primary sources:
- [Enhanced JQL search](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/#api-rest-api-3-search-jql-post) and [search reconciliation](https://developer.atlassian.com/cloud/jira/platform/search-and-reconcile/)
- [Create issue](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/#api-rest-api-3-issue-post)
- [Issue linking model](https://developer.atlassian.com/cloud/jira/platform/issue-linking-model/)
- [Issue link creation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-links/#api-rest-api-3-issuelink-post) and [issue link types](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-link-types/#api-rest-api-3-issuelinktype-get)
- [Atlassian Document Format](https://developer.atlassian.com/cloud/jira/platform/apis/document/structure/)

## Traps & constraints

- Preview may issue Jira reads (the enhanced search uses HTTP POST but is read-only); it must perform no issue-create or issue-link writes. Confirmation must be explicit, and the confirmed import must re-check current Jira matches rather than trust a stale preview.
- JQL search is paginated and can return zero, exactly one, or multiple issues. A multiple-marker result must never fall through to create. Validate story IDs before constructing JQL or file paths.
- A timed-out create may have succeeded while enhanced search has not indexed the issue yet. A blind retry can duplicate it; the search API documents this consistency gap, and `reconcileIssues` cannot help without a known issue ID. Planning must select a fail-closed recovery policy and decide whether to persist a non-secret pending-create marker under ignored `.agent-workflow/` state.
- A scoped-token API base (`https://api.atlassian.com/ex/jira/<cloudId>`) does not itself identify a human-facing Jira browse host. The accepted architecture requires a browse URL in the story record; the current config has no browse-base field. Tenant validation cannot settle this without the target site.
- Jira issue-link permissions and available link types vary by site/project. A missing `Blocks` type, missing linked dependency, or denied link must leave the textual dependency reference intact and be reported separately from successful ticket creation.
- Do not overwrite another Jira key silently; keep GitHub references and user-owned data intact when updating/removing a Jira link. Never delete the Jira issue on unlink. Do not log request/response bodies, auth headers, or story payloads.
- Explicit selection is the only import scope. No automatic PRD/story-wide creation, Epic/Requirement fan-out, checkbox-status inference, or lifecycle synchronization in this story.

## Open questions

1. For scoped-token tenants, should the secret-free config add optional `jira.browse_base_url` so local links remain clickable, while ordinary Jira site URLs derive `/browse/<key>` automatically?
2. Because enhanced JQL search can lag after an ambiguous create, the plan should choose a safe pending-operation policy. Recommendation: never retry a possibly accepted create until marker lookup finds one issue; persist a non-secret pending marker and stop on zero/multiple results pending explicit reconciliation.
3. The story permits a configured Epic parent but no `jira.epic_key` field exists. Recommendation: support only an explicitly configured parent key; never create an Epic automatically. Confirm whether to add this optional non-secret field.

## Real complexity

**4, unchanged.** The source confirms the score: this story crosses explicit user confirmation, Jira v3 ADF/search/link semantics, retry/idempotency under eventual consistency, local worktree files, and preservation of existing GitHub data. No UI; skip Design. No split proposal: the importer is one shippable one-issue-per-story slice.
