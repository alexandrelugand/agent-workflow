---
description: Show the project's pipeline state — framing docs, per-story progress, next command
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---
# aw-status — Where the project stands

Derive local pipeline state from repository files — never guess. Bash may run read-only Git queries and one read-only Jira status invocation through the installed runtime.

1. Framing: do docs/prd.md, docs/stories.md, docs/architecture.md, docs/design-system.md exist? A missing one is the next step. Also grep '^Stories ready:' docs/reviews/stories.md → yes / no / none, and show it on the framing line (a `no` or a missing review means the breakdown hasn't passed /aw-stories-review).

Optional Jira lookup: from the current project/worktree resolve the installed runtime and invoke status once:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ -f "$runtime" ]; then node "$runtime" status; else echo 'Jira runtime not installed; status unavailable.'; fi
```

The runtime fetches one read-only Jira status per local link when enabled. Match only returned `jira.stories` entries by story ID. Missing links mean `not linked`; a returned `unavailable` stays unavailable. If Jira is disabled or the CLI fails, report it as not configured/unavailable; never infer a Jira status from local files.
2. Stories: list the ids from docs/stories.md. For each id derive:
   - complexity: the story's score (from docs/stories.md) — show it next to the id.
   - research: docs/research/<id>.md exists?
   - design: docs/designs/<id>/design.md exists? (UI stories only — otherwise n/a)
   - plan: docs/plans/<id>.md — missing / draft (no `validated: yes` in the frontmatter) / validated, plus ticked vs total task checkboxes (x/y).
   - review: grep '^Ship allowed:' docs/reviews/<id>.md → yes / no / none.
   - ship state: branch merged into the default branch → shipped; else an open PR exists → "PR open — merge pending" (manual strategy); else —.
   - Jira: use the fetched `issueKey` and `status` for this story; no entry means not linked, and `unavailable` means unavailable. Keep this separate from local ship state.
   - blocked: a story whose Dependencies (docs/stories.md) aren't all shipped is blocked — its next command is "blocked by <ids>", never a pipeline step.
3. Start with a one-line summary of local pipeline state: X shipped / Y in flight / Z not started. Then print a compact table: story (complexity) | research | design | plan | review | local ship | Jira | next. The next command follows the repository pipeline: research → design (UI) → plan → validate the plan (rerun /aw-plan) → execute → review (a `no` verdict → /aw-execute fix mode) → ship — or "merge pending" while the PR awaits a human merge. Keep shipped stories to one line each.
4. Decisions: if docs/decisions/ exists, mention the ADR count and the latest one.

If docs/ doesn't exist at all, the project hasn't started: point to /aw-prd.

End with the single most useful next command for this project, e.g.: "Next: /aw-plan s02-...".
