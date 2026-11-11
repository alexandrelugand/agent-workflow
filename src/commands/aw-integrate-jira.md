---
description: Integrate agent-workflow with JIRA to track stories, features, and tasks
argument-hint: <story-id> (optional for PRD stories, required for story integration)
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
---

# JIRA Integration — agent-workflow

> Integrate agent-workflow with JIRA. Creates tickets for stories, features, and tasks.

## Purpose

Create JIRA tickets to track work from agent-workflow stories through to task execution.

At the start of this command, resolve the consumer root; commands run from story worktrees while `.agent-workflow` stays in the shared checkout:

```sh
git_common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
consumer_root="$(dirname "$git_common_dir")"
integration_config="$consumer_root/.agent-workflow/integrations.yaml"
integration_cli="$consumer_root/.agent-workflow/runtime/integration-cli.mjs"
```

## Input

- **JIRA Configuration**: Check `"$integration_config"`
  - Keep `jira.enabled: false` until explicit validation succeeds
  - Credentials come only from the four required environment variables
- **Story ID** (optional): For creating tasks linked to specific stories
  - If not provided, integrates with current PRD story breakdown

## Workflow

### Phase 1: Validate Integration Config

1. Check `"$integration_config"` for secret-free project and issue-type settings
2. Run `node "$integration_cli" validate` through `/aw-integrate-configure`; keep Jira disabled until successful validation
3. Verify `JIRA_API_URL`, `JIRA_PROJECT_KEY`, `JIRA_API_TOKEN`, and `JIRA_EMAIL` are present in the environment (do not print values)

### Phase 2: Integrate with PRD Stories

If creating Epics from PRD:

1. **Read PRD** from `docs/prd.md`
2. **Extract user stories**:
   - For each story: Read acceptance criteria, complexity, dependencies
3. **Create Epic tickets**:
   - Summary: Story title
   - Description: User story format + acceptance criteria
   - Labels: #epic, #prd
4. **Save JIRA Epic IDs** in `docs/prd.md`

Example update:

```markdown
## Stories

### Story s01 — User authentication
**JIRA Epic**: EPIC-100

### Story s02 — User profile management
**JIRA Epic**: EPIC-101
```

### Phase 3: Integrate with Architecture Features

If creating Requirements:

1. **Read features** from `docs/architecture.md` or `docs/features/`
2. **Create Requirement tickets**:
   - Summary: Feature name
   - Description: Technical approach, endpoints, data models
   - Labels: #feature, #requirement
   - Link to Epic: In JIRA, link Requirement → Epic
3. **Save JIRA Requirement IDs** in feature files

Example update:

```markdown
# Feature: User Authentication

## JIRA Requirement: REQ-1001

## Description
Technical implementation of authentication system

## API Endpoints
- POST /api/auth/login
- POST /api/auth/register
```

### Phase 4: Integrate with Development Tasks

If creating Tasks for specific story:

1. **Extract tasks** from `docs/designs/<story>/design.md` or `docs/tasks/`
2. **Create Task tickets**:
   - Summary: Task description
   - Description: Implementation steps, acceptance criteria
   - Labels: #task, #development
   - Link to Requirement: In JIRA, link Task → Requirement
3. **Save JIRA Task IDs** in task files

Example update:

```markdown
# Task: Login endpoint implementation

## JIRA Task: TASK-1001

## Dependencies
- REQ-1001

## Implementation steps
1. Create login controller
2. Implement authentication logic
```

## Jira Setup Boundary

Jira setup and explicit pre-enable connection validation belong to `/aw-integrate-configure`, which invokes `node "$integration_cli" validate` using the consumer-root runtime path. Read only secret-free settings from `"$integration_config"`; credentials come from process environment and must never be copied into commands, files, logs, or output. Keep Jira disabled until validation succeeds.

## Output Files

After integration:

1. **`docs/prd.md`** — JIRA Epic IDs added to each story
2. **`docs/features/`** — JIRA Requirement IDs in each feature file
3. **`docs/tasks/`** — JIRA Task IDs in each task file
4. **`logs/jira-integration.log`** — Integration history and errors
5. **`docs/jira-issues.md`** — Summary of created tickets

## Error Handling

If JIRA API fails:

1. Log error with stack trace to `logs/jira-integration.log`
2. Create fallback record in `docs/jira-issues.md`
3. Note failure in story/task file:
   ```markdown
   ## JIRA Integration
   - Epic: ✅ EPIC-100 (created)
   - Requirement: ❌ Failed (API timeout) — manual creation recommended
   ```

## Verification

After integration:

1. Check `logs/jira-integration.log` for errors
2. Verify JIRA UI shows created tickets
3. Confirm links between Epics, Requirements, Tasks
4. Check that labels and priorities are correct

## Next Steps

- `/aw-architect` — Use Requirements created in JIRA
- `/aw-design-system` — Reference Tasks in JIRA for development
- `/aw-execute` — Work on tasks with JIRA Task IDs

## Example Usage

```
# Integrate with all PRD stories
/aw-integrate-jira

# Integrate with specific story
/aw-integrate-jira s01
```