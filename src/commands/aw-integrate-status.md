---
description: Display current integration status
argument-hint: (optional: jira|github|telegram|all)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Glob
  - Bash
---

# aw-integrate-status — Display integration status

> Show current status of JIRA, GitHub, and Telegram integrations

## Purpose

Display comprehensive status information about all configured integrations and their connection status.

## Usage

```bash
# Display all integrations status
/aw-integrate-status

# Display specific integration status
/aw-integrate-status jira
/aw-integrate-status github
/aw-integrate-status telegram
```

## Phase 1 — Load Integration Service

1. Import or instantiate the `IntegrationService`:
   ```javascript
   import IntegrationService from '../../src/services/integration-service.mjs';
   const integrationService = new IntegrationService();
   await integrationService.init();
   ```

2. Retrieve integration status:
   ```javascript
   const status = integrationService.getIntegrationStatus();
   ```

## Phase 2 — Display Integration Status

### For All Integrations

Display in formatted markdown:

```markdown
## Integration Status Summary

**Enabled**: Yes

### JIRA Integration
- **Status**: ✅ Enabled
- **API URL**: ${JIRA_API_URL}
- **Project Key**: ${JIRA_PROJECT_KEY}
- **Last Sync**: N/A
- **Notifications**: Epic ✅, Requirement ✅, Task ✅

### GitHub Integration
- **Status**: ✅ Enabled
- **Repository**: ${GITHUB_REPO}
- **Default Branch**: ${GITHUB_DEFAULT_BRANCH}
- **Last Sync**: N/A
- **Notifications**: Issue ✅, PR ✅

### Telegram Integration
- **Status**: ✅ Enabled
- **User ID**: ${TELEGRAM_USER_ID}
- **Notifications**: Task Progress ✅, PR Created ✅, Errors ✅
```

### For Specific Integration

Display targeted status:

```markdown
## JIRA Integration Status

- **Status**: ✅ Enabled
- **API URL**: ${JIRA_API_URL}
- **Project Key**: ${JIRA_PROJECT_KEY}
- **Validation**: ✅ All checks passed
- **Configuration File**: src/config/integrations.yaml
- **Last Activity**: N/A
```

## Phase 3 — Display Stories Linked to Integrations

Display stories with their JIRA/GitHub tickets:

```markdown
## Stories with External Tickets

| Story | JIRA Epic | JIRA Requirement | GitHub Issue | Status |
|-------|-----------|------------------|--------------|--------|
| s01 - User authentication | EPIC-100 | REQ-1001 | ISS-1001 | ✅ Linked |
| s02 - User profile management | EPIC-101 | REQ-1002 | ISS-1002 | ✅ Linked |
| s03 - Data export | ❌ | ❌ | ISS-1003 | ⚠️ Not linked |
```

## Phase 4 — Display Recent Activity

Display recent integration activity from logs:

```markdown
## Recent Integration Activity

### JIRA
- 2026-08-31 10:30 - Created EPIC-100 (user authentication)
- 2026-08-31 10:32 - Created REQ-1001 (login endpoint)
- 2026-08-31 11:00 - Created TASK-1001 (implement login)

### GitHub
- 2026-08-31 10:35 - Created issue ISS-1001 (user authentication)
- 2026-08-31 10:40 - Created branch feature/s01
- 2026-08-31 11:05 - Created PR #42 (user authentication)

### Telegram
- 2026-08-31 10:30 - Task completed notification for TASK-1001
- 2026-08-31 10:45 - PR created notification
```

## Phase 5 — Display Error Summary

Display any recent errors:

```markdown
## Integration Errors

| Integration | Error | Time | Status |
|-------------|-------|------|--------|
| JIRA | API timeout | 2026-08-31 09:15 | ⚠️ Retried |
| GitHub | Rate limit | 2026-08-31 09:30 | ⚠️ Waited |
| Telegram | Connection refused | 2026-08-31 10:00 | ✅ Resolved |
```

## Phase 6 — Display Recommendations

Display recommendations based on current status:

```markdown
## Recommendations

### ✅ Well Configured
- JIRA: All required tokens configured
- GitHub: Repository permissions verified
- Telegram: User ID validated

### ⚠️ Attention Needed
- Consider enabling JIRA notifications for task completion
- Enable GitHub webhook support for real-time updates
- Configure Telegram notifications for review phases

### 📊 Integration Health
- JIRA: 95% healthy
- GitHub: 100% healthy
- Telegram: 100% healthy
```

## Output Formats

### Default (Markdown)

Formatted markdown with emoji and sections.

### JSON (for scripts)

Export status as JSON:

```bash
/aw-integrate-status --format json
```

Output:
```json
{
  "enabled": true,
  "integrations": {
    "jira": {
      "enabled": true,
      "config": {
        "api_url": "https://your-domain.atlassian.net",
        "project_key": "PROJ"
      },
      "health": "healthy"
    },
    "github": {
      "enabled": true,
      "config": {
        "repo": "org/repo"
      },
      "health": "healthy"
    },
    "telegram": {
      "enabled": true,
      "config": {
        "user_id": "123456789"
      },
      "health": "healthy"
    }
  }
}
```

## Error Handling

If integration service fails to initialize:

```markdown
## Error: Failed to load integration configuration

Cannot load `src/config/integrations.yaml`

**Solution**:
1. Check if the file exists at `src/config/integrations.yaml`
2. Verify file permissions
3. Run `/aw-integrate-configure` to set up integrations
```

## Integration with Logging

Read from `logs/integration.log`:

```bash
tail -n 50 logs/integration.log
```

## Example Output

```markdown
## Integration Status Summary

**Enabled**: Yes

### JIRA Integration
- **Status**: ✅ Enabled
- **API URL**: https://mycompany.atlassian.net
- **Project Key**: PROJ
- **Validation**: ✅ All checks passed

### GitHub Integration
- **Status**: ✅ Enabled
- **Repository**: mycompany/myapp
- **Default Branch**: main
- **Validation**: ✅ All checks passed

### Telegram Integration
- **Status**: ✅ Enabled
- **User ID**: 123456789
- **Validation**: ✅ All checks passed

## Stories Linked

| Story | JIRA Epic | GitHub Issue | Status |
|-------|-----------|--------------|--------|
| s01-user-auth | EPIC-100 | ISS-1001 | ✅ |
| s02-profile-mgmt | EPIC-101 | ISS-1002 | ✅ |
| s03-data-export | ❌ | ISS-1003 | ⚠️ |

## Recent Activity

- 10:30 - EPIC-100 created
- 10:32 - REQ-1001 created
- 10:35 - GitHub issue ISS-1001 created
- 10:40 - PR #42 created

## Health Check

- JIRA: 95%
- GitHub: 100%
- Telegram: 100%
```

## Next Steps

- Run `/aw-integrate-link` to link stories to tickets
- Run `/aw-orchestrator` to execute stories with integrations
- Configure additional notification preferences