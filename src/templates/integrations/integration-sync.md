# Integration Synchronization Guide

Complete guide for automatic synchronization between agent-workflow and external tools.

## Table of Contents

- [Overview](#overview)
- [Synchronization Events](#synchronization-events)
- [JIRA Synchronization](#jira-synchronization)
- [GitHub Synchronization](#github-synchronization)
- [Telegram Synchronization](#telegram-synchronization)
- [Custom Synchronization](#custom-synchronization)
- [Troubleshooting](#troubleshooting)

## Overview

Synchronization automatically links agent-workflow stories with external tickets and provides real-time notifications during pipeline execution.

### Architecture

```
agent-workflow Pipeline → Integration Service → JIRA/GitHub/Telegram
                            ↓
                      Synchronization
                            ↓
                   External Tickets & Notifications
```

## Synchronization Events

| Phase | Integration | Events | Auto-Execute |
|-------|-------------|--------|--------------|
| **Phase 0** | JIRA | Epic creation | ✅ |
| **Phase 0** | GitHub | Issue creation | ✅ |
| **Phase 0** | Telegram | Pipeline start | ✅ |
| **Phase 1** | JIRA | Requirement creation | ✅ |
| **Phase 1** | JIRA | Task creation | ✅ |
| **Phase 4** | Telegram | Task progress | ✅ |
| **Phase 4** | Telegram | Task completed | ✅ |
| **Phase 5** | JIRA | Task status update | ✅ |
| **Phase 5** | Telegram | Review results | ✅ |
| **Phase 6** | GitHub | PR creation | ✅ |
| **Phase 6** | GitHub | PR link comment | ✅ |
| **Phase 6** | Telegram | PR created alert | ✅ |
| **Phase 6** | JIRA | Task completion | ✅ |
| **Phase 6** | Telegram | Pipeline complete | ✅ |

## JIRA Synchronization

### Ticket Creation Flow

1. **Epic Creation** (Phase 0):
   ```bash
   /aw-orchestrator s01
   ↓
   JIRA Service → Read PRD → Create Epic EPIC-100
   ↓
   Update docs/integrations/s01.md
   ```

2. **Requirement Creation** (Phase 1):
   ```bash
   /aw-orchestrator s01
   ↓
   JIRA Service → Read Architecture → Create Requirement REQ-1001
   ↓
   Link REQ-1001 → EPIC-100
   ↓
   Update docs/integrations/s01.md
   ```

3. **Task Creation** (Phase 1):
   ```bash
   /aw-orchestrator s01
   ↓
   JIRA Service → Read Design → Create Task TASK-1001
   ↓
   Link TASK-1001 → REQ-1001
   ↓
   Update docs/integrations/s01.md
   ```

### Ticket Status Updates

1. **In Progress** (Phase 4):
   - Triggered when execute phase starts
   - Task moved from Backlog to In Progress

2. **Done** (Phase 6):
   - Triggered when story is shipped
   - Task moved from In Progress to Done
   - PR link added to ticket description

### Linking Pattern

JIRA ticket hierarchy:
```
Epic (EPIC-100)
  └─ Requirement (REQ-1001)
      └─ Task (TASK-1001)
```

### Manual Linking

Use `/aw-integrate-link` for existing tickets:

```bash
/aw-integrate-link s01 EPIC-100 jira
/aw-integrate-link s01 REQ-1001 jira
/aw-integrate-link s01 TASK-1001 jira
```

## GitHub Synchronization

### Issue Creation Flow

1. **Issue Creation** (Phase 0):
   ```bash
   /aw-orchestrator s01
   ↓
   GitHub Service → Read Stories → Create Issue ISS-1001
   ↓
   Add labels: feature, story-s01
   ↓
   Update docs/integrations/s01.md
   ```

### Branch Creation

1. **Branch Creation** (Phase 0):
   ```bash
   /aw-orchestrator s01
   ↓
   worktree-manager → Create .worktrees/s01/feature/s01
   ↓
   GitHub Service → Create branch feature/s01
   ↓
   Push branch to remote
   ```

### PR Creation Flow

1. **PR Creation** (Phase 6):
   ```bash
   /aw-orchestrator s01
   ↓
   GitHub Service → Verify tests pass
   ↓
   Create PR #42
   ↓
   PR body from template
   ↓
   Link PR → Issue ISS-1001
   ↓
   Comment on GitHub issue with PR link
   ↓
   Update docs/integrations/s01.md
   ```

### PR Template

```markdown
## Pull Request: Feature s01 — User authentication

**Story**: s01
**JIRA**: EPIC-100 / REQ-1001
**GitHub Issue**: ISS-1001

---

## Summary
Implements user authentication system with JWT tokens.

## Changes
- ✅ Created `/api/auth` routes
- ✅ Implemented authentication middleware
- ✅ Added unit tests (coverage: 85%)
- ✅ Updated documentation

## Test Results
✅ Unit tests passing
✅ Integration tests passing

## Related Issues
- GitHub: #1001
- JIRA: REQ-1001
```

## Telegram Synchronization

### Notification Flow

1. **Pipeline Started** (Phase 0):
   ```bash
   Telegram Service → Event: pipeline_started
   ↓
   Message: "🚀 Pipeline started: Story s01 — User authentication"
   ```

2. **Task Progress** (Phase 4):
   ```bash
   Telegram Service → Event: task_progress
   ↓
   Message: "🚀 Task progress: TASK-1001/3\n\nStep 2/3: Implement login controller"
   ```

3. **Task Completed** (Phase 4):
   ```bash
   Telegram Service → Event: task_completed
   ↓
   Message: "✨ Task completed: TASK-1001\n\nStory: s01-user-auth\nCommits: 2"
   ```

4. **Review Results** (Phase 5):
   ```bash
   Telegram Service → Event: review_failed
   ↓
   Message: "👀 Code Review: s01\n\nQuality: 78/100\nIssues: 3\nStatus: ⚠️ Failed"
   ```

5. **PR Created** (Phase 6):
   ```bash
   Telegram Service → Event: pr_created
   ↓
   Message: "🚢 PR created: s01\n\nPR: https://github.com/org/repo/pull/42\nTests: ✅ Passing"
   ```

### Notification Templates

**Default Template**:
```markdown
<icon> <event type>: <task-id>

Task: <task-name>
Story: <story-name>
Branch: <branch-name>

<details>
```

**Event-Specific Templates**:
- Compilation Request: `⚠️ Compilation Request: Task <id>`
- Task Progress: `🚀 Task Progress: <id>/<total>`
- Code Review: `👀 Code Review: <id>`
- PR Created: `🚢 PR Created: <id>`
- Task Completed: `✨ Task Completed: <id>`

### Notification Configuration

Configure which events trigger notifications in `src/config/integrations.yaml`:

```yaml
telegram:
  enabled: true
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  user_id: "${TELEGRAM_USER_ID}"
  notify_on:
    pipeline_started: true
    task_progress: true
    task_completed: true
    compilation_failed: true
    review_failed: true
    pr_created: true
    errors_encountered: true
```

## Custom Synchronization

### Custom Events

Create custom synchronization events by extending the integration service:

```javascript
// Example: Custom event handler
async handleCustomEvent(event, context) {
  if (event === 'custom:deployment') {
    // Handle custom deployment event
    const message = `🚀 Deployment: Story ${context.storyId}`;
    await this.sendTelegramNotification('deployment', { message, ...context });
    await this.updateJIRATask(context.storyId, { status: 'Deployed' });
  }
}
```

### Webhook Integration (Future)

Register webhooks for real-time events:

```yaml
# src/config/integrations.yaml
github:
  webhooks_enabled: true
  webhook_url: "https://your-domain.com/webhook/github"
```

### Custom Adapters

Create custom integration adapters:

```javascript
// Example: Slack adapter
class SlackService {
  async sendNotification(event, context) {
    // Send to Slack
  }
}

// Register in IntegrationService
this.slackService = new SlackService(config);
```

## Troubleshooting

### Synchronization Failures

**Error**: "JIRA ticket not found in PRD"
- Solution: Verify PRD includes story details for JIRA integration
- Run `/aw-integrate-link` for manual linking

**Error**: "GitHub branch already exists"
- Solution: Use `/aw-integrate-unlink` first to remove old link
- Verify branch naming convention

**Error**: "Telegram message exceeds max length"
- Solution: Reduce message complexity or disable notifications for this event
- Edit max_message_length in config

### Connection Issues

**Error**: "JIRA API timeout"
- Solution: Check API URL format
- Verify API token is valid and not expired
- Check internet connection

**Error**: "GitHub rate limit exceeded"
- Solution: Wait for rate limit to reset (usually 1 hour)
- Use personal access token for higher limits

**Error**: "Telegram connection refused"
- Solution: Verify bot token is correct
- Check user_id is valid
- Test connection with curl

### Log Issues

Check `logs/integration.log` for detailed error messages:

```bash
tail -n 50 logs/integration.log
grep "ERROR" logs/integration.log
grep "WARN" logs/integration.log
```

### Verification

Verify synchronization by:

1. **Check JIRA**: Tickets should be created in correct order
2. **Check GitHub**: Issues and PRs should match stories
3. **Check Telegram**: Notifications should arrive on time
4. **Check Logs**: `logs/integration.log` should show success messages

## Best Practices

1. **Create tickets early**: Link stories to tickets during PRD phase
2. **Use consistent naming**: Story IDs and ticket prefixes match
3. **Test integrations**: Run `/aw-integrate-status` before each cycle
4. **Monitor logs**: Check `logs/integration.log` for errors
5. **Configure notifications**: Enable events you care about
6. **Use manual linking**: For complex or existing projects

## Next Steps

1. Review synchronization events in config
2. Test integrations with `/aw-integrate-status`
3. Run a story with `/aw-orchestrator` to test sync
4. Monitor logs for errors
5. Customize notification preferences