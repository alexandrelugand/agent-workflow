---
description: Chain a story's full cycle — Research → Design → Plan → Execute → Review → Ship — with two blocking human checkpoints (plan validation, ship confirmation)
argument-hint: <story id or name>
allowed-tools:
  - Read
  - Glob
  - Grep
  - Write
  - AskUserQuestion
  - Agent
  - Bash
---
# aw-orchestrator — One story, full cycle, checkpoints kept

Target story: $ARGUMENTS

You conduct the cycle; you never do a phase's work inline when a subagent owns it, and you never write code yourself. The two human checkpoints are non-negotiable: plan validation and ship confirmation. A checkpoint is an actual AskUserQuestion call — never a rhetorical sentence in your output. This is a conductor, not an autopilot.

## Phase 0 — Prerequisites (fail-closed)
The orchestrator drives one story's cycle — it never replaces the framing. Check, in order:
1. docs/prd.md exists? Missing → STOP: "No PRD — the pipeline starts with /aw-prd <target>. Nothing to orchestrate yet."
2. docs/stories.md exists? Missing → STOP: "No stories — run /aw-stories first."
3. docs/architecture.md exists? Missing → STOP: "No architecture — run /aw-architect first."
4. docs/reviews/stories.md says `Stories ready: yes`? If missing or negative, warn (don't stop): the breakdown hasn't passed /aw-stories-review.
(docs/design-system.md is not required here: Phase 2 fail-closes on it only when the story has UI.)

Then resolve $ARGUMENTS to the story id (`s<number>-<slug>`) against docs/stories.md. No unambiguous match → list the available stories and stop. Never invent a framing doc or a story to keep going.

Invoke the `worktree-manager` subagent with the resolved id and repository base
directory. Continue only after it returns the absolute `.worktrees/<id>` path,
confirms branch `feature/<id>` and a clean status. Every phase below, every
subagent and both checkpoints operate on files in that worktree. Never create
or checkout the feature branch in the repository base directory.

## Phase 0.5 — Integration Setup (Optional)

Before reading integration settings from a story worktree, locate the consumer root that owns the shared runtime:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_config="$consumer_root/.agent-workflow/integrations.yaml"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ ! -f "$integration_config" ]; then
  consumer_root=""
fi
```

If `consumer_root` is empty or the runtime file is absent, skip optional integration work and continue locally. Otherwise read the shared config and use `integration_cli` for installed commands. Lifecycle calls must run with the verified story worktree as the current directory so the runtime reads that worktree's local Jira link.
### Jira Integration

Jira setup is optional. Do not import PRD/backlog stories automatically or create Epics, Requirements, Tasks, or placeholder records. After a user explicitly selects full IDs present in the current worktree's `docs/stories.md`, use `/aw-integrate-jira <story-id...>` for a read-only preview and separate confirmation before issue writes. Keep Jira key/URL references only in `docs/integrations/<story-id>.md`.

### GitHub Integration
If GitHub is enabled in `"$consumer_root/.agent-workflow/integrations.yaml"`:
1. Read `docs/stories.md` for story details
2. Create GitHub Issue: `/aw-integrate-github`
3. Update `docs/integrations/<id>.md` with GitHub issue number

### Telegram Integration
If Telegram is enabled in `"$consumer_root/.agent-workflow/integrations.yaml"`:
1. Send initialization notification: "🚀 Pipeline started: Story <id> — <story-name>"
2. Set up event notifications for each phase

**Note**: Integration setup is optional. Jira issues are created only through explicit user-selected import; no Jira issue is initialized automatically.

## Phase 1 — Research

At the start of this phase, from the verified worktree, best-effort request Jira `in_progress` before producing or reusing the research report:

```sh
worktree="<absolute .worktrees/<id>>"
git_common_dir="$(git -C "$worktree" rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ -f "$runtime" ]; then (cd "$worktree" && node "$runtime" lifecycle "<id>" in_progress); fi
```

Missing runtime, disabled/incomplete Jira, or an unlinked story is a normal skip. Surface warnings and continue Research.
If docs/research/<id>.md doesn't exist, produce it now following the aw-research contract: codebase-analysis skill on the story's scope, current state of the code, output structured by @templates/research.md. Otherwise reuse the existing file.

## Phase 2 — Design (UI stories only)
If the story has a screen and docs/designs/<id>/design.md doesn't exist, follow the aw-design contract: fail-closed on docs/design-system.md (missing → stop and point to /aw-design-system), resolve the path without blocking autonomy (autonomous agent, or a brief for an external tool — ask only when a human is in the loop), produce a finished screen anchored to the design system only, then render it and look at it. Output docs/designs/<id>/design.md + mockup.html. A story without UI skips this phase.

## Phase 3 — Plan
If docs/plans/<id>.md doesn't exist, produce it following the aw-plan contract: small verifiable tasks, structured by @templates/plan.md.

CHECKPOINT — mandatory, whether the plan is new or already existed. If the plan's frontmatter already says `validated: yes`, continue. Otherwise present the plan summary (tasks, files touched, test strategy) and ask via AskUserQuestion: "Validate this plan?" — options: Validate / Modify / Stop. An existing plan file does NOT count as validated. On Validate, set `validated: yes` in the plan's frontmatter. Anything else: don't touch the marker, don't continue.

## Phase 4 — Execute
Fail-closed: `docs/plans/<id>.md` must carry `validated: yes`; missing means back to the Phase 3 checkpoint. Before implementation starts, from the verified worktree run:

```sh
worktree="<absolute .worktrees/<id>>"
git_common_dir="$(git -C "$worktree" rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ -f "$runtime" ]; then (cd "$worktree" && node "$runtime" lifecycle "<id>" in_progress); fi
```

Disabled/incomplete Jira, an unlinked story, or absent runtime is a normal skip. Surface any warnings, `synced: false`, or CLI error, then continue. Delegate to the `implementer` exactly as /aw-execute does: no red-first ceremony or invariant mutations, focused suite per task and full suite plus end-to-end once at the end, type check after the last edit, no branch switching, only plan scope. Capture its summary.

**Telegram Notifications** (if enabled):
- Send progress updates during task execution
- Notify on task completion
- Alert on compilation errors

## Phase 5 — Review

Before dispatching the reviewer, from the verified worktree run the same runtime resolution with target `in_review`:

```sh
worktree="<absolute .worktrees/<id>>"
git_common_dir="$(git -C "$worktree" rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ -f "$runtime" ]; then (cd "$worktree" && node "$runtime" lifecycle "<id>" in_review); fi
```

Disabled/incomplete Jira, an unlinked story, or absent runtime is a normal skip. Surface sync warnings/errors and continue the independent review.
Delegate to the `reviewer` subagent exactly as /aw-review does: fresh context, story diff `git diff <default-branch>...feature/<id>`, test suite run by the reviewer, verdict ending with the exact `Max severity:` and `Ship allowed:` lines. Write the report to docs/reviews/<id>.md.

After the reviewer writes its report, do not request Jira `done`: a passing review leaves the Story in `in_review`. Only the explicit Ship approval in Phase 6 proceeds to `/aw-ship`, which requests Done after creating or finding a PR.

**Telegram Notifications** (if enabled):
- Send review results
- Alert on review passed or failed
- Notify on critical issues


If the verdict is `Ship allowed: no`, before the fix loop or stop, best-effort run from the verified worktree:

```sh
worktree="<absolute .worktrees/<id>>"
git_common_dir="$(git -C "$worktree" rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
if [ -f "$runtime" ]; then (cd "$worktree" && node "$runtime" lifecycle "<id>" blocked); fi
```

An unconfigured `blocked` status is skipped; Jira warnings never soften or open the review gate. A rejected review is not Done; Phase 4 requests `in_progress` before any implementation fixes.
Gate: verdict `Ship allowed: no` → go back to Phase 4 in fix mode. Maximum 2 fix loops; still blocked after that → stop and report the open findings. Never soften a verdict to move on.

## Phase 6 — Ship
CHECKPOINT — review passed: show the verdict and ask via AskUserQuestion: "Ship now?" — options: Ship / Not now. Only an explicit Ship proceeds; Not now stops here without invoking `/aw-ship` or requesting Jira `done`, leaving the Story In Review. Then run `/aw-ship`'s mechanical gate (`grep -q '^Ship allowed: yes' docs/reviews/<id>.md`), tests on the branch, push, and PR; then follow the project's ship strategy (manual by default: stop at the PR; auto: merge, deploy, confirm live, and clean up only after merge proof).

Jira lifecycle remains best effort within `/aw-ship`: after explicit user authorization and creating or finding a PR, request Story `done`. For an open PR, call `lifecycle <id> done --pr-url <url>` to mark it Done and upsert the PR link as Open. For an already-merged PR, require exact `MERGED` proof with `gh pr view feature/<id> --json state,url,mergedAt`, then call `lifecycle <id> done --pr-url <url> --merged` to update the link; `--merged` controls only the PR outcome. A review pass alone never requests Done. Jira warnings never block local ship or cleanup rules.

**Telegram Notifications** (if enabled):
- Send PR created notification
- Send story completion notification
- Send success message

**GitHub Integration** (if enabled):
- Create PR with structured description (via `/aw-ship`)
- Comment on GitHub issue with PR link
- Add labels to PR if configured


End with: "Story <id> shipped. Cycle complete." (auto mode), "PR opened — merging is yours." (manual mode) — or the exact blocking state if stopped (which phase, what's missing).
