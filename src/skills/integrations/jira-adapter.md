---
name: jira-adapter
description: Create JIRA tickets (Epic, Requirement, Task) for stories and tasks. Integrates agent-workflow with JIRA.
---

# JIRA Adapter Skill

You create JIRA tickets to track work in agent-workflow. Use during framing and planning phases.

## Configuration

Read `src/config/integrations.yml` for project-specific configuration:
- `api_url`: JIRA Cloud instance URL
- `api_token`: JIRA API token (from environment variable)
- `email`: JIRA account email
- `project_key`: Project identifier (e.g., PROJ)
- `epic_prefix`, `requirement_prefix`, `task_prefix`: Ticket type prefixes

## Workflow

### Step 1: Create Epic (for PRD)

When creating a PRD story breakdown:

1. **Read PRD** from `docs/prd.md`
2. **Extract user stories** — each story becomes an Epic
3. **Create Epic ticket** with:
   - Summary: Story title
   - Description: User story format + acceptance criteria
   - Labels: #epic, #prd
   - Component: from story's agentic notes
4. **Save ticket ID** in `docs/prd.md` as `e_<id>` (e.g., Epic-100)

Example output in `docs/prd.md`:

```markdown
## Stories

### Story s01 — User authentication
**As a** user **I want** to login with email/password **so that** I can access my account
**JIRA Epic**: EPIC-100

### Story s02 — User profile management
**As a** user **I want** to edit my profile **so that** I can keep information up to date
**JIRA Epic**: EPIC-101
```

### Step 2: Create Requirements (for Architecture)

After architecture phase:

1. **Read features** from `docs/architecture.md` or `docs/features/`
2. **Create Requirement tickets** (one per feature)
3. **Link to Epics**: In JIRA, link Requirement → Epic
4. **Save IDs** in feature files

Example feature file:

```markdown
# Feature: User Authentication

## JIRA Requirement: REQ-1001

## Description
Technical implementation of user authentication system

## Architecture
- JWT-based tokens
- Password hashing (bcrypt)
- Session management

## API Endpoints
- POST /api/auth/login
- POST /api/auth/register
- POST /api/auth/logout

## Tests
- Unit tests for auth logic
- Integration tests for API endpoints
```

### Step 3: Create Tasks (for Development)

During design/system design phase:

1. **Read tasks** breakdown
2. **Create Task tickets** linked to Requirements
3. **Save IDs** in task files

Example task file:

```markdown
# Task: Login endpoint implementation

## JIRA Task: TASK-1001

## Dependencies
- REQ-1001

## Implementation steps
1. Create login controller
2. Implement authentication logic
3. Add input validation
4. Write unit tests
5. Write integration tests

## Acceptance Criteria
- [ ] Login validates credentials
- [ ] Returns JWT token on success
- [ ] Returns 401 on failure
- [ ] Tests pass
```

## JIRA REST API

Use JIRA REST API v3:

```bash
# Get project keys
GET /rest/api/3/project/{projectIdOrKey}
Authorization: Basic <base64(api_token + ":" + email)>

# Create epic
POST /rest/api/3/issue
Body:
{
  "fields": {
    "project": {"key": "PROJ"},
    "issuetype": {"name": "Epic"},
    "summary": "User authentication",
    "description": "...",
    "labels": ["epic", "#prd"]
  }
}

# Get issue key from response
{"id": "10001", "key": "PROJ-100"}
```

## Error Handling

If JIRA API fails:
1. Log error
2. Continue with markdown tracking
3. Create fallback ticket in `docs/jira-issues.md`
4. Note in `docs/notes/jira-integration-failures.md`

## Best Practices

- Always link tasks to their parent requirement
- Use consistent prefix naming (EPIC, REQ, TASK)
- Set proper priorities (P0, P1, P2, P3)
- Link related Epics via JIRA's "Relates to" field
- Keep descriptions clear and actionable

## Output

Save JIRA ticket information in story/task files for traceability:

```markdown
## JIRA References
- Epic: EPIC-100
- Requirement: REQ-1001
- Task: TASK-1001
```

## Verification

After creating tickets:
1. Verify ticket appears in JIRA project
2. Check ticket has correct type (Epic/Requirement/Task)
3. Verify links between parent and child tickets
4. Confirm labels are applied correctly