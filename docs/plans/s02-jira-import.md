---
validated: yes
---
# Plan — Story s02-jira-import

Branch: `feature/s02-jira-import`
Research: `docs/research/s02-jira-import.md` — read it first; this plan does not repeat it.

## Target story

Import only explicitly selected stories into Jira, one issue per story, with a read-only preview and explicit confirmation. Reuse an existing local link or the unique stable marker; prevent duplicates after ambiguous creates; store a local Jira key and browse URL; link dependencies only when both stories are already linked and Jira permits it. Manual link/unlink follows the same one-issue-per-story contract.

Acceptance criteria: `docs/stories.md:38-45`.

## Decisions

| Concern | Chosen contract | Rejected alternative |
|---|---|---|
| Import entry point | Keep `/aw-integrate-jira <story-id...>` as the single explicit import command; its preview is read-only and writes require a separate `--confirm` CLI action after user confirmation. | Add a second import alias or import every PRD/backlog story. |
| Issue identity and fields | Search project + exact `aw-story-<story-id>` label through Jira enhanced JQL; create with configured `jira.issue_type`, ADF description, and the marker label. Strip checkbox state from acceptance text; never map it to Jira status. | Hard-coded Epic/Requirement/Task hierarchy or copying local completion state. |
| Scoped-token browse URL | Derive `/browse/<key>` from a Jira site URL. Add optional, secret-free `jira.browse_base_url` for scoped API bases; require it before writes when the API URL cannot identify a browse host. | Persist a non-clickable API `self` URL as the browse link. |
| Optional Epic parent | Add optional `jira.epic_key`; set Jira `parent` only when explicitly configured and valid. Never create an Epic automatically. | Create one Epic/Requirement per story or infer a parent. |
| Ambiguous create recovery | Write a non-secret pending marker under ignored `.agent-workflow/jira-import-pending/` before `POST /issue`. On a possible write with no returned key, search the stable marker; reconcile exactly one match, stop on zero/multiple, and never retry a possibly accepted create automatically. Require explicit human resolution before clearing an unresolved marker. Bounded automatic retry is limited to a definite Jira 429 response after a marker search, honoring `Retry-After`. | Blind retry after timeout/5xx or trust eventually consistent JQL as proof that no issue was created. |
| Local link ownership | Store the Jira key and browse URL in `docs/integrations/<story-id>.md`; preserve unrelated provider data. Unlink removes only the local Jira reference, never a remote Jira issue. | Mirror status/priority/assignee locally or delete the entire record/ticket. |

## Tasks (ordered)

1. [x] Record the import-recovery decision in `docs/decisions/002-jira-import-recovery.md`; add the optional `jira.browse_base_url` and `jira.epic_key` settings and descriptions to the source config and setup template. Keep them secret-free.
2. [x] Replace generic Jira ticket creation with story-scoped service operations: enhanced JQL marker search with pagination, configured issue type, ADF content, stable label, optional parent, and safe response handling. Add focused service tests for zero/one/multiple matches, pagination, exact request fields, ADF, and permanent errors.
3. [x] Implement durable ambiguous-create recovery and dependency links. Persist intent before create, reconcile by marker after ambiguous outcomes, retain pending state on zero/multiple matches, clear it only after successful local linking or explicit human resolution, and retry only a definite 429 within the configured bound. Link `Blocks` in the documented direction only when both issues exist and no link is already present; report link failures without losing the issue record. Add focused tests for recovery, retry bounds, link direction, existing links, and unavailable/denied link operations.
4. [x] Add strict story parsing and CLI preview/import/link/unlink operations. Parse only requested IDs from the current worktree's `docs/stories.md`; use the shared consumer root only for runtime config and pending state. Preview performs no Jira writes; import requires `--confirm`, rechecks Jira, writes the local key/URL record only after success, preserves unrelated provider data, and reports partial dependency-link failures. Manual link validates a single Jira issue per story; unlink removes only the local reference. Add CLI behavior tests for explicit selection, checkbox-state exclusion, preview/cancel safety, confirmation, idempotent local links, and local-only unlink.
5. [x] Migrate direct Jira callers to the one-story/one-issue flow: rewrite `/aw-integrate-jira`, `/aw-integrate-link`, `/aw-integrate-unlink`, the Jira adapter skill, orchestrator instructions, and post-PRD/post-story Jira hooks so they do not auto-import, create placeholders, or copy lifecycle status. Update import/record-format guidance. Remove the unreferenced `src/templates/jira-ticket.md` hierarchy template and the synthetic `docs/integrations/s01-user-auth.md` record.
6. [x] Run the focused Jira service and CLI suites, then the repository's focused hook/installer suites once; run `node --check` on changed `.mjs` files after the final edit. Confirm all five acceptance criteria and every task checkbox before review.

## Run interdicts

- Never create Jira issues or issue links during preview, cancellation, Jira-disabled setup, or incomplete configuration.
- Never import unrequested IDs, enumerate the backlog automatically, infer completion from checkboxes, or fan one story into Epic/Requirement/Task tickets.
- Never blindly retry a possibly accepted `POST /issue`; never log credentials, authorization, story payloads, response bodies, or raw provider errors.
- Never delete Jira issues on unlink. Preserve GitHub references and all unrelated user data in integration records.
- Do not implement lifecycle transitions, PR synchronization, Jira status mirroring, or `/aw-ship` completion behavior; those belong to s03.
- Do not rewrite lifecycle-wide templates or `plans/INTEGRATION_IMPLEMENTATION.md` here; the later documentation/adoption phase reconciles them after s03.
- No live Jira requests, tenant credentials, new runtime dependencies, invariant-mutation tests, or test-only source-text assertions.

## The point everything turns on

The critical invariant is whether an ambiguous issue-create can ever lead to a second create. Jira enhanced JQL may lag and offers stronger reconciliation only when an issue ID is known. The pending marker must be persisted before the POST; recovery may clear it only after one exact marker match is linked locally or a human explicitly confirms the issue was not created. Review this ordering against the actual code and every error path.

## Files touched

Anticipated: `docs/decisions/002-jira-import-recovery.md`; `src/services/integration-service.mjs` and `.test.mjs`; `src/services/integration-cli.mjs` and `.test.mjs`; `src/config/integrations.yaml`; `src/templates/integrations/integration-config.md`; `src/commands/aw-integrate-jira.md`, `aw-integrate-link.md`, `aw-integrate-unlink.md`, and `aw-orchestrator.md`; `src/hooks/post-prd/00-integration-prd.md`, `src/hooks/post-story/00-integration-story.md`; `src/skills/integrations/jira-adapter.md`; `docs/integrations/README.md`; `docs/integration-guide.md`. Delete `src/templates/jira-ticket.md` and `docs/integrations/s01-user-auth.md`.

## Test strategy

Budget: **22 new behavior cases** — 12 service and 10 CLI. Service cases cover marker query/pagination/match cardinality, exact configured-type/ADF/label/parent payload, permanent-vs-429 retry behavior, ambiguous-create recovery, and dependency-link idempotency/direction/failure. CLI cases cover strict explicit ID parsing, story-content extraction without checkbox state, zero writes in preview or without confirmation, pending-state recovery, record preservation, and local-only manual unlink. Each invariant is tested at its owning layer; no prompt wording tests or duplicate permission/security matrix.

Use injected `fetch` and isolated temporary repository/config roots. No real Jira tenant, network, or credentials. Existing S01 tests retain their setup/security coverage and are not duplicated for this story.

## Definition of Done

- All five acceptance criteria in `docs/stories.md:38-45` pass.
- One explicit import command creates/reuses exactly one configured issue per requested story and requires confirmation before writes.
- Ambiguous outcomes cannot trigger an automatic duplicate create; dependencies and local links are reported accurately.
- Existing GitHub data, user config, and Jira issue records are preserved; Jira-disabled behavior remains request-free.
- Focused tests pass, changed `.mjs` files pass syntax checks, the review report ends with the exact ship-gate lines, and the story is ready for independent review.
