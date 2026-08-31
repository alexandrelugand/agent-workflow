---
description: Link stories to JIRA/GitHub tickets
argument-hint: <story-id> <ticket-id> <platform> (optional: jira|github)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Glob
  - Bash
---

# aw-integrate-link — Link stories to JIRA/GitHub tickets

> Manually link agent-workflow stories to existing JIRA or GitHub tickets

## Purpose

Create manual links between story files and external tickets (JIRA Epics, Requirements, Tasks or GitHub Issues) when automation isn't available or preferred.

## Usage

```bash
# Link story to JIRA epic
/aw-integrate-link s01 EPIC-100 jira

# Link story to GitHub issue
/aw-integrate-link s01 ISS-1001 github

# Link story to JIRA requirement
/aw-integrate-link s01 REQ-1001 jira

# Link story to JIRA task
/aw-integrate-link s01 TASK-1001 jira
```

## Phase 1 — Validate Inputs

1. **Resolve story ID**:
   - Read `docs/stories.md`
   - Match story name to story ID
   - If no match, list available stories and stop

2. **Validate ticket ID**:
   - Check format (EPIC-100, REQ-1001, TASK-1002, ISS-1001)
   - Verify ticket exists in external system (optional)
   - Check if story already has a link

3. **Validate platform**:
   - JIRA: EPIC, REQ, TASK prefixes
   - GitHub: ISS prefix

## Phase 2 — Update Story Documentation

### For PRD Stories (docs/prd.md)

Update `docs/prd.md`:

```markdown
## Stories

### Story s01 — User authentication
**As a** user **I want** to login with email/password **so that** I can access my account
**JIRA Epic**: EPIC-100
**JIRA Requirement**: REQ-1001
**GitHub Issue**: ISS-1001
**Story Status**: Planning
```

### For Design Stories (docs/stories.md)

Update `docs/stories.md`:

```markdown
## Story s01 — User authentication

**External IDs**:
- JIRA: EPIC-100, REQ-1001
- GitHub: ISS-1001

**Description**:
As a user, I want to login with email/password so that I can access my account

**Acceptance Criteria**:
- [ ] Login validates credentials
- [ ] Returns JWT token on success
- [ ] Returns 401 on failure

**Status**: Planning
```

### For Feature Tasks (docs/features/*)

Update feature files:

```markdown
# Feature: User Authentication

## JIRA Requirements
- REQ-1001: Login endpoint
- REQ-1002: Password reset

## GitHub Issues
- ISS-1001: User authentication implementation
- ISS-1002: Password reset functionality

## Story Links
- s01: User authentication
```

## Phase 3 — Create Integration Record

Create or update `docs/integrations/<story-id>.md`:

```markdown
# Story Integration: s01

## Link to JIRA
- **Epic**: EPIC-100
- **Requirement**: REQ-1001
- **Task**: TASK-1001 (if applicable)

## Link to GitHub
- **Issue**: ISS-1001
- **PR**: #42 (if created)
- **Branch**: feature/s01

## Sync Status
- **JIRA**: ✅ Linked manually
- **GitHub**: ✅ Linked manually

## Created
2026-08-31

## Notes
Manual link created via /aw-integrate-link
```

## Phase 4 — Log Integration

Log to `logs/integration.log`:

```
2026-08-31T10:30:00Z - Linked story s01 to JIRA EPIC-100, REQ-1001
2026-08-31T10:32:00Z - Linked story s01 to GitHub issue ISS-1001
```

## Phase 5 — Display Summary

```markdown
## Integration Link Summary

**Story**: s01 — User authentication

### JIRA Links
- Epic: EPIC-100 ✅
- Requirement: REQ-1001 ✅

### GitHub Links
- Issue: ISS-1001 ✅

### Integration Records
- docs/integrations/s01.md created

### Status
All links successfully created
```

## Error Handling

### Story Not Found

```markdown
## Error: Story not found

Cannot find story matching "s01" in docs/stories.md

Available stories:
- s01-user-authentication
- s02-user-profile
- s03-data-export

Please specify the correct story ID.
```

### Ticket Format Invalid

```markdown
## Error: Invalid ticket ID format

Expected format: EPIC-100, REQ-1001, TASK-1002, or ISS-1001
Received: INVALID-100

Please correct the ticket ID.
```

### Story Already Linked

```markdown
## Warning: Story already linked

Story s01 already has JIRA Epic EPIC-100

Do you want to:
1. Overwrite existing link
2. Keep existing link and skip
3. Cancel

Please select: [1] [2] [3]
```

### JIRA/GitHub Not Enabled

```markdown
## Error: Integration not enabled

JIRA and/or GitHub integration is not enabled.

Please run `/aw-integrate-configure` to enable and configure integrations.
```

## Integration Patterns

### Epic-Requirement-Task Hierarchy

```bash
# Link epic (from PRD)
/aw-integrate-link s01 EPIC-100 jira

# Link requirement (from architecture)
/aw-integrate-link s01 REQ-1001 jira

# Link task (from design)
/aw-integrate-link s01 TASK-1001 jira
```

### GitHub Issue Pattern

```bash
# Link issue directly
/aw-integrate-link s01 ISS-1001 github
```

## Examples

### Example 1: Full Integration

```bash
/aw-integrate-link s01-user-auth EPIC-100 jira
/aw-integrate-link s01-user-auth REQ-1001 jira
/aw-integrate-link s01-user-auth TASK-1001 jira
/aw-integrate-link s01-user-auth ISS-1001 github
```

Output:
```markdown
## Integration Link Summary

**Story**: s01-user-auth

### JIRA Links
- Epic: EPIC-100 ✅
- Requirement: REQ-1001 ✅
- Task: TASK-1001 ✅

### GitHub Links
- Issue: ISS-1001 ✅

### Status
All links successfully created
```

### Example 2: GitHub Only

```bash
/aw-integrate-link s02-profile-mgmt ISS-1002 github
```

Output:
```markdown
## Integration Link Summary

**Story**: s02-profile-mgmt

### GitHub Links
- Issue: ISS-1002 ✅

### Status
GitHub link successfully created
```

### Example 3: JIRA Only

```bash
/aw-integrate-link s03-data-export EPIC-100 jira
```

Output:
```markdown
## Integration Link Summary

**Story**: s03-data-export

### JIRA Links
- Epic: EPIC-100 ✅

### Status
JIRA link successfully created
```

## Best Practices

1. **Link in order**: Epic → Requirement → Task
2. **Use consistent naming**: Story IDs match ticket formats
3. **Document links**: Create `docs/integrations/<story-id>.md`
4. **Test links**: Verify tickets exist in external systems
5. **Keep updated**: Update links when requirements change

## Next Steps

After linking:
- Run `/aw-integrate-status` to verify links
- Run `/aw-orchestrator` to execute stories
- Monitor logs for synchronization events