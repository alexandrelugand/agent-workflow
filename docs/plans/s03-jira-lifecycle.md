---
validated: yes
---
# Plan — Story s03-jira-lifecycle

Branch: `feature/s03-jira-lifecycle`
Research: `docs/research/s03-jira-lifecycle.md` — read it first; this plan does not repeat it.

## Target story

Reflect actual execution, review, and verified delivery in the one linked Jira issue per story. Acceptance criteria: `docs/stories.md:63-69`.

## Decisions

| Concern | Chosen contract | Rejected alternative |
|---|---|---|
| Workflow status mapping | Parse the documented nested `jira.status_names`; resolve a semantic target against each issue's available transitions by exact destination `to.name`, then post the returned transition ID. No match or ambiguity is a warning; already-at-target is a no-op. | Hard-coded transition IDs, matching action names, or inferring status from local files. |
| `blocked` status | Optional only. Skip when `status_names.blocked` is absent; transition only when the configured destination has one available match. | Defaulting to a guessed Jira status or marking every failed review Done/Blocked. |
| Lifecycle failure behavior | Runtime returns explicit warnings for Jira failures and preserves local progress. Disabled/incomplete Jira performs no request. Configure/import retain fail-closed writes. | Letting an optional remote outage stop execution, review, ship, or cleanup. |
| Ship proof and PR link | `/aw-ship` supplies the exact PR URL and `--merged` only after `gh pr view` proves `MERGED`. A stable remote-link `globalId` updates one PR link; its minimal status records open versus merged. Done requires the merge proof. | Treating an open/manual PR or a local checkbox as delivery, or appending repeated comments/full pipeline history. |
| Status display | Read issue status from Jira for keys in the current worktree's integration records. Show key and fetched status; represent failed reads as `unavailable`, never as an inferred local state. | Mirroring Jira status into local Markdown or exposing Jira URLs, payloads, headers, or credentials. |

## Tasks (ordered)

1. [x] **Implement Jira status configuration and service operations.** Extend the limited config parser only for the existing nested `status_names` schema, keep documented defaults and `blocked` optional, and add issue-status lookup, per-issue transition discovery/post, and stable PR remote-link upsert. Replace the false-success Jira `syncStory()` stub and its wrapper with explicit methods. Cover exact destination-to-ID mapping, current-status no-op, absent/ambiguous targets, optional blocked, remote-link open/merged updates, and safe provider failures with injected `fetch`.
2. [x] **Add CLI lifecycle and remote status behavior.** Resolve the Jira key from the current worktree's integration record while loading config from the shared consumer root. Add a fail-soft lifecycle action for `in_progress`, `in_review`, optional `blocked`, and proof-gated `done`; continue attempting the independent transition/link operations if one fails. Extend `status` to list linked issue keys and fetch each real Jira status, marking disabled, malformed, or failed reads unavailable without exposing URLs or payloads. Add CLI tests for no-link/no-network, disabled behavior, issue-level fetch failure, merge-proof guard, warning propagation, and record preservation.
3. [x] **Wire lifecycle events and document the contract.** At execution start, request `in_progress`; at review start, request `in_review`, and after a rejected review request `blocked` only through the optional mapping. In both standalone commands and `/aw-orchestrator`, Jira failures warn but do not stop the delegated work. In `/aw-ship`, add/update the PR remote link while the issue remains In Review for an open PR; invoke Done only after exact `MERGED` proof, and never let Jira failure block the existing cleanup gate. Update `/aw-integrate-status` and `/aw-status` to show Jira state separately from local progress; update the Jira adapter, source configuration examples, and post-story hook wording without making the hook perform requests.
4. [x] **Verify the story end to end.** Run the focused service/CLI suites with mocked Jira responses, the repository's required hook/installer suites, and the final `.mjs` syntax checks. Confirm every acceptance criterion, disabled/no-credential request-free behavior, command fail-soft behavior, and the unchanged manual merge gate. Do not use a Jira tenant or real credentials.

## Run interdicts

- Never create/import Jira story issues or Jira dependency links from lifecycle commands; this story only transitions an existing local link and adds the PR remote link.
- Never mark Done without `/aw-ship`'s exact merged-PR proof. An open PR, successful review, local state, or checked acceptance criterion is not proof.
- Never hard-code or guess a transition ID; never use `blocked` unless configured and exactly available. Do not retry an uncertain transition or fabricate a successful sync.
- Never stop local execution, review, ship, or proven-merge cleanup because of Jira failure; preserve explicit warnings. Keep configure/import writes fail-closed.
- Never infer Jira status from local Markdown, expose credentials/Authorization/response bodies/provider URLs, or write fetched Jira status into local integration records.
- Preserve unrelated integration-record sections and user-owned config. Keep Jira request-free while disabled or incomplete; add no package dependency or general YAML parser.
- Do not rewrite `src/templates/integrations/integration-sync.md`, `docs/integration-guide.md`, `plans/INTEGRATION_IMPLEMENTATION.md`, or reconcile/import the consumer backlog here; the later documentation/adoption phase owns them.
- Do not modify the dirty repository-base checkout or make live Jira requests.

## The point everything turns on

The two proof boundaries must not drift: a status transition uses the unique Jira transition whose `to.name` equals the configured destination, and Done is reachable only after `/aw-ship` verifies `MERGED`. Review those guards against the service mapping, CLI argument validation, and every standalone/orchestrated command path. A Jira response failure must become a visible warning without changing either local workflow outcome or the Done proof requirement.

## Files touched

Anticipated: `src/services/integration-service.mjs`, `src/services/integration-service.test.mjs`, `src/services/integration-cli.mjs`, `src/services/integration-cli.test.mjs`, `src/config/integrations.yaml`, `src/templates/integrations/integration-config.md`, `src/templates/integrations/integration-setup.md`, `src/commands/aw-execute.md`, `src/commands/aw-orchestrator.md`, `src/commands/aw-review.md`, `src/commands/aw-ship.md`, `src/commands/aw-integrate-status.md`, `src/commands/aw-status.md`, `src/skills/integrations/jira-adapter.md`, and `src/hooks/post-story/00-integration-story.md`.

## Test strategy

Budget: about **20 new behavior cases**, split between the service and CLI at the layer that owns each invariant. Service tests cover nested status mapping, dynamic transition IDs, no-op/missing/ambiguous destinations, optional `blocked`, actual status fetch, stable remote-link updates for open/merged PRs, and safe failures. CLI tests cover shared-config/worktree-record separation, linked versus unlinked stories, request-free disabled behavior, fetched status and per-issue unavailability, Done proof, partial Jira failures/warnings, and local-record preservation. Use temporary files, `node:test`, and injected `fetch`; no prompt/source-text tests, live Jira, repeated permission matrix, or duplicate assertion of one rule at multiple layers.

After the final edit, run `node --test src/services/integration-service.test.mjs src/services/integration-cli.test.mjs`, the required repository hook/installer suites, the repository's documented type-check step, and `node --check` on every changed `.mjs` file. If this Node-only repo defines no type-check command, record that limitation; do not add a dependency solely to manufacture one. No `package.json` or TypeScript configuration exists in this repository; `node --check` was run on all four changed `.mjs` files.

## Definition of Done

- Every criterion at `docs/stories.md:63-69` is covered by the service/CLI behavior and command contracts.
- Jira status comes only from Jira; transitions use discovered IDs; `blocked` is optional; only verified merged PRs can trigger Done.
- PR linking is idempotent, merge outcome is minimal, and lifecycle failures remain visible without interrupting local work.
- Disabled/incomplete Jira performs no request; existing explicit configure/import failure behavior and all unrelated integration data remain intact.
- Focused and required repository suites pass, changed runtime files pass syntax checks, and the story is ready for independent review.
