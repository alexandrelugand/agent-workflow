---
description: Preview and explicitly import selected stories as one Jira issue each
argument-hint: <story-id...>
allowed-tools:
  - Read
  - Bash
  - AskUserQuestion
---

# /aw-integrate-jira — Import selected stories

Import only full story IDs explicitly supplied by the user. Do not enumerate PRD stories, backlog entries, or any other unrequested story. No arguments means stop and ask for the IDs; never infer a selection.

## Runtime paths

Commands run in the current repository worktree while `.agent-workflow` is shared. Resolve the common consumer root and installed runtime before use:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_config="$consumer_root/.agent-workflow/integrations.yaml"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

If the config or runtime is absent, stop without making a Jira request. The CLI reads the four Jira variables from the process environment or consumer-root `.env` and `.env.<NODE_ENV>` files (`.env.development` by default; `NODE_ENV=production` in `.env` selects `.env.production`). Process values override file values; local env files are Git-ignored. Never print or copy their values.

## Preview and confirmation

1. Validate that every supplied value is a full ID from the current worktree's `docs/stories.md` (`sNN-slug`). Do not accept fuzzy names or silently drop invalid IDs.
2. Check that Jira is enabled and complete. If it is disabled or incomplete, stop without a request or local change.
3. Run the read-only preview with exactly the supplied IDs:

   ```sh
   node "$integration_cli" preview <story-id...>
   ```

   The preview may search Jira for stable markers but never creates issues, creates issue links, or edits local records. Explain each create/reuse/recovery/blocked action and dependency-link candidate.
4. Ask the user to confirm the displayed selection and actions with `AskUserQuestion`. Cancellation ends here; do not run the import command.
5. Only after explicit confirmation, run the separate write action:

   ```sh
   node "$integration_cli" import <story-id...> --confirm
   ```

   The CLI rechecks Jira before each action, creates or reuses one issue of configured `jira.issue_type` for each requested story, and writes the local link only after the issue is verified. Report each failed story and each dependency-link failure separately; never claim an uncertain create succeeded.

## Issue and record contract

- Jira v3 issues use the configured issue type, an ADF description containing the story, acceptance-criterion text, and dependency references, and the exact `aw-story-<story-id>` label. Supported inline Markdown becomes ADF marks; raw Markdown delimiters are not sent. Checkbox state is not sent as status.
- `jira.epic_key` is the optional default existing Epic; a story's optional `### Epic` key overrides it. The selected key must identify an Epic in the configured project; no Epic or other parent issue is created automatically.
- Newly created issues receive the selected Epic parent. Existing issues are never reparented; mismatches are reported. After a new or recovered story is verified under its Epic, an Epic in Jira's `done` status category is transitioned to `jira.status_names.todo` (default `To Do`). Re-open failures warn without undoing the Story import.
- A Jira site API URL supplies `/browse/<key>`. Scoped API bases require secret-free `jira.browse_base_url` before writes.
- Records live in the current worktree at `docs/integrations/<story-id>.md` and contain only the Jira key and browse URL in the Jira section. Other provider data is preserved.
- An unresolved pending create marker blocks another create. Never retry a possibly accepted request. After checking Jira and explicitly confirming no issue was created, a human may resolve the marker with:

  ```sh
  node "$integration_cli" resolve-pending <story-id> --confirm-not-created
  ```

Do not change Jira status, synchronize lifecycle state, create remote dependency links outside a confirmed import, or delete issues. Execution and review commands manage lifecycle separately; `/aw-ship` may request Done only after it verifies the PR state is exactly `MERGED`.
