---
description: Open the PR; merge and deploy per the project's ship strategy (manual by default)
argument-hint: <story id or name>
allowed-tools:
  - Read
  - Bash
---
You are shipping a story. Target story: $ARGUMENTS

Resolve $ARGUMENTS to the story id (`s<number>-<slug>`) — the review file docs/reviews/<id>.md must exist for it.

Locate `.worktrees/<id>`, verify its branch is exactly `feature/<id>`, and run
the entire command from that absolute worktree. Missing worktree, wrong branch,
detached HEAD or repository base → STOP; never checkout the feature branch in
the repository base directory.

## Step 0 — Gate (fail-closed, mechanical)
Run: `grep -q '^Ship allowed: yes' docs/reviews/<id>.md`
If the file is missing or the command fails, STOP immediately: "Ship blocked — review missing or negative. Run /aw-review <id>." Nothing below runs without a passing gate.

Then proceed:
1. Without switching branches, commit docs/reviews/<id>.md on the already verified feature branch if not already committed (the PR must carry its review). Then verify the tests pass. Failing tests → stop.
2. If a PR for `feature/<id>` already exists, do not open a duplicate; read its `state` and `url`: `OPEN` → continue with Jira still Done from review; `MERGED` → verify the merge, update the Jira PR link as merged, then continue to Cleanup; a closed-unmerged PR is not complete and does not qualify for Cleanup. Otherwise push and open a clean PR, capturing its URL.
3. Read the ship strategy from AGENTS.md ("Ship strategy" section). No section, or no explicit `auto` → the mode is manual.

## Jira lifecycle — best effort

From the verified story worktree, resolve the shared runtime and update only the linked issue:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
runtime="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

After creating or finding a PR, call `node "$runtime" lifecycle "<id>" done --pr-url "<url>"` for an open/manual PR. This preserves the review-complete Done status and upserts the PR link as Open. For an existing or auto-merged PR, first run `gh pr view feature/<id> --json state,url,mergedAt` and require `state` to equal exactly `MERGED`; then call `node "$runtime" lifecycle "<id>" done --pr-url "<url>" --merged` to update the same link as Merged. The review pass, not merge proof, is the Jira Done event.

Show any `warnings`, `synced: false`, or CLI error as a Jira sync warning and continue the local ship flow. Missing runtime, disabled/incomplete Jira, or no local Jira link is a normal skip. A Jira failure never blocks the manual-merge rule or Cleanup. An open or closed-unmerged PR is not marked Merged and does not change the review-complete Done status.

## Step 4 — Merge (per the ship strategy)

**Always squash.** One story = one commit on the default branch. The working commits stay on the branch, the history stays readable, and no merge commit is created. Without it a seven-story release lands as fifty commits nobody can read.

- **manual (default): do NOT merge.** End with: "PR opened: <url>. Merging is yours to decide (human review, protected branch, CI) — **squash-merge it**. After merging, rerun /aw-ship <id> to confirm the deployment and clean up the branch."
- **auto**: `gh pr merge <url> --squash --delete-branch=false`, trigger the deployment, confirm it's live (URL), then run the Cleanup step. End with: "Story shipped to production. Cycle complete. Next story: /aw-research <story>"

Never merge in manual mode, even if everything is green — the gate authorizes the ship, the human decides it.

## Final step — Cleanup (ONLY after a PROVEN merge)
Never clean up on the promise of a merge — only on proof:
1. Verify: `gh pr view feature/<id> --json state,mergedAt --jq '.state'` must return exactly `MERGED`. An OPEN PR, a closed-unmerged PR, or an "about to be merged" does NOT qualify: skip cleanup entirely.

   Do NOT use `git merge-base --is-ancestor` here: a squash merge rewrites the work into a new commit, so the branch's commits are never ancestors of the default branch. The check would fail on every correctly merged story and no branch would ever be cleaned up.
2. Verify the dedicated worktree is clean, then remove that exact worktree with
   `git worktree remove <repository-base>/.worktrees/<id>`. A dirty worktree is
   a hard stop; never use `--force`.
3. Only after the worktree is gone, delete the branch, local and remote:
   `git branch -D feature/<id>` and `git push origin --delete feature/<id>`.

   `-D` is required, again because of the squash: `-d` refuses a branch git
   considers unmerged, which is every squashed branch. The safety therefore
   rests entirely on step 1 — never remove the worktree or branch without the
   `MERGED` proof.

The content is in the default branch, the audit trail is in the merged PR: the branch has no further use.
