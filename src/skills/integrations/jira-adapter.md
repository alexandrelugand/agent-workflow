---
name: jira-adapter
description: Preview and import explicitly selected stories as one configured Jira issue per story
---

# Jira Adapter Skill

Jira import is explicit and story-scoped. Never import a PRD or backlog automatically, create placeholders, split a story into Epic/Requirement/Task tickets, transfer checkbox state, or infer remote status from local files.

## Configuration and runtime

Resolve the shared consumer runtime from a story worktree:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_config="$consumer_root/.agent-workflow/integrations.yaml"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

Read only secret-free settings from the config. The CLI reads `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` from the process environment or consumer-root `.env` and `.env.<NODE_ENV>` (`.env.development` by default; put `NODE_ENV=production` in `.env` to select production). Process values override files, which are Git-ignored. Never print or store credential values. Jira must remain disabled until `/aw-integrate-configure` validates the site, identity, project, and configured issue type.

`jira.issue_type` determines the created issue type. Optional `jira.epic_key` names an existing default parent; a story's `### Epic` section overrides it. The selected parent must be an Epic in the configured project; no Epic is created. Existing issues are never reparented. After a new or recovered Story is verified under its parent, an Epic in Jira's `done` category is transitioned to `jira.status_names.todo`; failed reopen operations warn without undoing the import. A Jira site API URL is enough to build `/browse/<key>`; a scoped API base requires the optional secret-free `jira.browse_base_url` before writes.

## Lifecycle synchronization

Pipeline lifecycle calls are fail-soft: `/aw-research` and the orchestrator start a linked Story as In Progress; `/aw-review` sets In Review, and a passing review leaves it there; `/aw-execute` returns implementation fixes to In Progress. Only `/aw-ship`, after explicit user authorization, requests Story Done. A parent Epic moves to In Progress when any configured child Story is In Progress and to Done only when all are Done. Verified merge proof is required only to mark the Jira PR link as Merged.

## Explicit import workflow

1. Require one or more full story IDs explicitly supplied by the user and present in the current worktree's `docs/stories.md`. Never infer or enumerate a selection.
2. Run a read-only preview using exactly those IDs:

   ```sh
   node "$integration_cli" preview <story-id...>
   ```

   Explain create, reuse, recovery, ambiguous/pending, dependency-link, and selected Epic actions. Preview may search Jira but does not create issues, create issue links, or modify records.
3. Ask the user to confirm the displayed plan. On cancellation, stop without writes.
4. After explicit confirmation, run the separate write action:

   ```sh
   node "$integration_cli" import <story-id...> --confirm
   ```

   The CLI rechecks Jira, creates or reuses exactly one configured-type issue per selected story, and writes the local link only after verifying the issue. The ADF description includes the user story, acceptance text without checkbox state, and dependency references. A stable `aw-story-<story-id>` label is used for matching. A new story's selected Epic becomes the Jira parent; only a newly created/recovered story under a completed Epic may transition that Epic to `status_names.todo`.
5. Dependencies are linked with Jira's `Blocks` relationship only when both stories have local Jira references; report a missing/denied link separately without losing a successful issue record.

Jira records belong in the current worktree's `docs/integrations/<story-id>.md` and contain only the Jira key and browse URL in the Jira section. Preserve GitHub and all unrelated record data.

## Recovery and manual links

A non-secret pending marker is persisted before any issue create. A possibly accepted create is never blindly retried: the service searches the stable marker, recovers exactly one match, and retains the marker when zero or multiple matches remain. After inspecting Jira and explicitly confirming no issue was created, human resolution is:

```sh
node "$integration_cli" resolve-pending <story-id> --confirm-not-created
```

For one existing Jira issue, `/aw-integrate-link <story-id> <jira-key> jira` validates the project and configured type and refuses to replace a different local key. `/aw-integrate-unlink <story-id> jira` removes only the local Jira section and never deletes the Jira issue.

Do not mirror fetched Jira status into local integration records or infer it from checkboxes. Pipeline commands own lifecycle requests. Story Done means the user authorized `/aw-ship` after review; a passing review alone leaves it In Review. Verified merge proof is needed only to mark the Jira PR remote link as Merged.
