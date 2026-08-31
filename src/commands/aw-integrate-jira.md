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

## Input

- **JIRA Configuration**: Check `src/config/integrations.yml`
  - Verify `jira.enabled: true`
  - Set API URL, token, email
- **Story ID** (optional): For creating tasks linked to specific stories
  - If not provided, integrates with current PRD story breakdown

## Workflow

### Phase 1: Validate Integration Config

1. Check if JIRA is enabled in `src/config/integrations.yml`
2. Verify environment variables are set:
   - `JIRA_API_TOKEN`
   - `JIRA_EMAIL`
   - `JIRA_PROJECT_KEY`

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

## JIRA API Usage

Use JIRA REST API v3 with Basic Auth:

```bash
# Get API token
export JIRA_API_TOKEN="your-token"
export JIRA_EMAIL="your-email@example.com"
export JIRA_API_URL="https://your-domain.atlassian.net"

# Auth header
AUTH="$(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)"

# Create Epic
curl -X POST "${JIRA_API_URL}/rest/api/3/issue" \
  -H "Authorization: Basic ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "project": {"key": "PROJ"},
      "issuetype": {"name": "Epic"},
      "summary": "User authentication",
      "description": "...",
      "labels": ["epic", "#prd"]
    }
  }'
```

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