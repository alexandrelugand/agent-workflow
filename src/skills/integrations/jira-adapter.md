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

Read only secret-free settings from the config. Credentials come from `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_EMAIL`, and `JIRA_API_TOKEN` in the process environment. Never print or store their values. Jira must remain disabled until `/aw-integrate-configure` validates the site, identity, project, and configured issue type.

`jira.issue_type` determines the created issue type. Optional `jira.epic_key` names an existing parent and never causes an Epic to be created. A Jira site API URL is enough to build `/browse/<key>`; a scoped API base requires the optional secret-free `jira.browse_base_url` before writes.

## Lifecycle synchronization

The shared runtime resolves configured destination names through each linked issue's available Jira transitions. Execution requests `in_progress`; review requests `in_review` and may request optional `blocked` after rejection; only `/aw-ship` may request `done`, after it verifies the PR is merged. PR remote links use a stable ID and are updated rather than duplicated. Lifecycle Jira errors are warnings; disabled/incomplete Jira stays request-free. `/aw-integrate-status` and `/aw-status` read Jira's actual status and report fetch failures as unavailable.

## Explicit import workflow

1. Require one or more full story IDs explicitly supplied by the user and present in the current worktree's `docs/stories.md`. Never infer or enumerate a selection.
2. Run a read-only preview using exactly those IDs:

   ```sh
   node "$integration_cli" preview <story-id...>
   ```

   Explain create, reuse, recovery, ambiguous/pending, and dependency-link actions. Preview may search Jira but does not create issues, create issue links, or modify records.
3. Ask the user to confirm the displayed plan. On cancellation, stop without writes.
4. After explicit confirmation, run the separate write action:

   ```sh
   node "$integration_cli" import <story-id...> --confirm
   ```

   The CLI rechecks Jira, creates or reuses exactly one configured-type issue per selected story, and writes the local link only after verifying the issue. The ADF description includes the user story, acceptance text without checkbox state, and dependency references. A stable `aw-story-<story-id>` label is used for matching.
5. Dependencies are linked with Jira's `Blocks` relationship only when both stories have local Jira references; report a missing/denied link separately without losing a successful issue record.

Jira records belong in the current worktree's `docs/integrations/<story-id>.md` and contain only the Jira key and browse URL in the Jira section. Preserve GitHub and all unrelated record data.

## Recovery and manual links

A non-secret pending marker is persisted before any issue create. A possibly accepted create is never blindly retried: the service searches the stable marker, recovers exactly one match, and retains the marker when zero or multiple matches remain. After inspecting Jira and explicitly confirming no issue was created, human resolution is:

```sh
node "$integration_cli" resolve-pending <story-id> --confirm-not-created
```

For one existing Jira issue, `/aw-integrate-link <story-id> <jira-key> jira` validates the project and configured type and refuses to replace a different local key. `/aw-integrate-unlink <story-id> jira` removes only the local Jira section and never deletes the Jira issue.

Do not mirror fetched Jira status into local integration records or infer it from checkboxes. Pipeline commands own lifecycle requests; `/aw-ship` requires verified merge proof before Done.
