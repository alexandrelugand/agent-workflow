# Integration Guide for Agent-Workflow

Comprehensive guide for integrating JIRA, GitHub, and Telegram with agent-workflow pipeline.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)
- [API Reference](#api-reference)
- [Advanced Topics](#advanced-topics)

## Introduction

### What is Agent-Workflow Integration?

Agent-workflow integration connects your development pipeline with external tools (JIRA, GitHub, Telegram) to provide:
- Automatic ticket creation and tracking
- Real-time notifications during development
- Seamless synchronization between pipeline and external tools

### Why Use Integrations?

**Benefits**:
- **Visibility**: Track progress in your favorite tools
- **Communication**: Stay updated without monitoring multiple systems
- **Consistency**: Maintain alignment between stories and tickets
- **Automation**: Reduce manual work and errors

## Prerequisites

### For JIRA Integration

- JIRA Cloud account (Self-managed also supported)
- API token with project permissions
- JIRA project key

### For GitHub Integration

- GitHub account with personal access token
- Repository access
- Permissions: `repo`, `issues`, `pull_requests`

### For Telegram Integration

- Telegram account
- Bot token (create via @BotFather)
- User ID (get via @userinfobot)

### General Prerequisites

- Node.js installed
- Git installed
- Claude Code CLI installed
- agent-workflow repository cloned

## Installation

### Step 1: Clone Repository

```bash
git clone https://github.com/your-org/agent-workflow.git
cd agent-workflow
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Integrations

```bash
/aw-integrate-configure
```

The interactive configuration will guide you through:
1. Choosing integrations to enable
2. Setting up API tokens
3. Configuring notification preferences
4. Testing connections

## Configuration

### Configuration Files

**Primary Configuration**: `src/config/integrations.yaml`

**Environment Variables**: `.env` file

### Minimal Configuration

```yaml
# src/config/integrations.yaml
integrations:
  enabled: true

  jira:
    enabled: false
    api_url: "${JIRA_API_URL}"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "PROJ"

  github:
    enabled: false
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "org/repo"

  telegram:
    enabled: false
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    user_id: "${TELEGRAM_USER_ID}"
    notify_on:
      task_completed: true
      pr_created: true
```

### Environment Variables

```bash
# .env
JIRA_API_URL=https://your-company.atlassian.net
JIRA_API_TOKEN=base64-encoded-token
JIRA_EMAIL=your-email@company.com

GITHUB_TOKEN=ghp_...

TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_USER_ID=123456789
```

### Verification

```bash
# Check configuration status
/aw-integrate-status
```

## Usage

### Basic Commands

#### `/aw-integrate-configure`

Interactive configuration wizard:

```bash
/aw-integrate-configure
```

Options:
1. Choose integrations to enable
2. Set up API credentials
3. Configure notification preferences
4. Test connections
5. Save configuration

#### `/aw-integrate-status`

Check integration status:

```bash
/aw-integrate-status
```

Displays:
- Enabled integrations
- Story-ticket links
- Recent activity
- Connection health

#### `/aw-integrate-link`

Link story to external ticket:

```bash
# Link to JIRA
/aw-integrate-link s01 EPIC-100 jira

# Link to GitHub
/aw-integrate-link s01 ISS-1001 github
```

#### `/aw-integrate-unlink`

Remove story-ticket links:

```bash
# Unlink from JIRA
/aw-integrate-unlink s01 jira

# Unlink from GitHub
/aw-integrate-unlink s01 github

# Unlink from all platforms
/aw-integrate-unlink s01 all
```

### Pipeline Integration

Integrations are automatically invoked during pipeline execution:

```
/aw-orchestrator s01
  ↓
Phase 0: Integration Setup (tickets created)
  ↓
Phase 1: Research (status updates)
  ↓
Phase 4: Execute (progress notifications)
  ↓
Phase 5: Review (results, JIRA updates)
  ↓
Phase 6: Ship (PRs, completion)
```

### Custom Integration

Create custom integrations by extending the integration service:

```javascript
// src/services/integration-service.mjs
class CustomIntegrationService {
  async handleCustomEvent(event, context) {
    // Handle custom event
  }
}
```

## Examples

### Example 1: Full Workflow with All Integrations

```bash
# 1. Configure all integrations
/aw-integrate-configure
# Select JIRA, GitHub, and Telegram
# Enter API tokens and preferences

# 2. Verify configuration
/aw-integrate-status
# Should show: ✅ All integrations active

# 3. Link stories to tickets
/aw-integrate-link s01-user-auth EPIC-100 jira
/aw-integrate-link s01-user-auth REQ-1001 jira
/aw-integrate-link s01-user-auth ISS-1001 github

# 4. Execute story
/aw-orchestrator s01-user-auth

# Expected behavior:
# - JIRA: Epic created, Requirements created
# - GitHub: Issues created, PR created
# - Telegram: Notifications throughout pipeline

# 5. Ship story
/aw-ship

# Expected behavior:
# - JIRA: Task status updated to Done
# - GitHub: PR merged
# - Telegram: Completion notification
```

### Example 2: GitHub Only Workflow

```bash
# 1. Configure GitHub only
/aw-integrate-configure
# Select GitHub only
# Configure GitHub token and repository

# 2. Link story
/aw-integrate-link s02-profile-mgmt ISS-1002 github

# 3. Execute
/aw-orchestrator s02-profile-mgmt

# Expected behavior:
# - GitHub: Issue created, PR created
# - Telegram: PR notifications

# 4. Ship
/aw-ship
```

### Example 3: JIRA Only Workflow

```bash
# 1. Configure JIRA only
/aw-integrate-configure
# Select JIRA only
# Configure JIRA credentials

# 2. Link story
/aw-integrate-link s03-data-export EPIC-100 jira
/aw-integrate-link s03-data-export REQ-1003 jira

# 3. Execute
/aw-orchestrator s03-data-export

# Expected behavior:
# - JIRA: Epics and Requirements created
# - No GitHub or Telegram activity

# 4. Check JIRA
# View tickets created and updated
```

### Example 4: Mixed Integrations

```bash
# 1. Configure JIRA + GitHub (no Telegram)
/aw-integrate-configure
# Select JIRA and GitHub
# Configure credentials
# Skip Telegram

# 2. Link stories
/aw-integrate-link s04-payment EPIC-100 jira
/aw-integrate-link s04-payment ISS-1004 github

# 3. Execute
/aw-orchestrator s04-payment

# Expected behavior:
# - JIRA: Tickets created and updated
# - GitHub: Issues and PRs created
# - Telegram: No notifications (disabled)
```

## Troubleshooting

### Integration Not Enabled

**Symptom**: Integration status shows disabled

**Solution**:
```bash
# Enable integration
/aw-integrate-configure

# Verify status
/aw-integrate-status
```

### Token Authentication Failed

**Symptom**: "Authentication failed" or "401 Unauthorized"

**Solution**:
1. Verify token is correct: `echo $JIRA_API_TOKEN` or `echo $GITHUB_TOKEN`
2. Check token has required permissions
3. Regenerate token if expired

### Connection Refused

**Symptom**: "Connection refused" or "Timeout"

**Solution**:
1. Check internet connection
2. Verify API URLs are correct
3. Check firewall settings
4. Test with curl:
   ```bash
   curl -X GET "https://api.github.com/user" -H "Authorization: Bearer $GITHUB_TOKEN"
   ```

### Rate Limit Exceeded

**Symptom**: "Rate limit exceeded"

**Solution**:
1. Wait for rate limit to reset (usually 1 hour)
2. Use personal access token for higher limits
3. Check API usage limits

### Logs Not Writing

**Symptom**: `logs/integration.log` is empty

**Solution**:
1. Check write permissions: `ls -la logs/`
2. Ensure `logs/` directory exists
3. Check file system permissions

### Verification Commands

```bash
# Check configuration
cat src/config/integrations.yaml

# Check environment variables
env | grep -E "JIRA|GITHUB|TELEGRAM"

# Test connections
/aw-integrate-status

# View logs
tail -f logs/integration.log

# Check for errors
grep ERROR logs/integration.log
```

## Best Practices

### Security

1. **Never commit tokens**: Always use environment variables
2. **Add to .gitignore**: `.env` files should never be committed
3. **Rotate tokens**: Every 90 days recommended
4. **Use specific scopes**: Only request minimal required permissions

### Configuration

1. **Test before commit**: Verify configuration with `/aw-integrate-status`
2. **Keep config minimal**: Enable only integrations you need
3. **Use consistent naming**: Story IDs and ticket prefixes match
4. **Document links**: Create `docs/integrations/<story-id>.md`

### Usage

1. **Link early**: Create manual links before starting stories
2. **Monitor logs**: Check `logs/integration.log` regularly
3. **Verify sync**: Run `/aw-integrate-status` before each cycle
4. **Use manual linking**: For existing projects with existing tickets

### Notifications

1. **Configure wisely**: Only enable events you care about
2. **Test notifications**: Verify Telegram messages arrive
3. **Manage noise**: Disable notifications during quiet periods
4. **Customize templates**: Modify notification styles if needed

## API Reference

### Integration Service API

#### Methods

```javascript
// Initialize integration service
await IntegrationService.init(config)

// Create JIRA ticket
await IntegrationService.createJiraTicket(type, data)

// Create GitHub issue
await IntegrationService.createGitHubIssue(data)

// Send Telegram notification
await IntegrationService.sendTelegramNotification(event, context)

// Sync story with JIRA
await IntegrationService.syncStoryWithJira(storyId)

// Sync story with GitHub
await IntegrationService.syncStoryWithGitHub(storyId)

// Get integration status
await IntegrationService.getIntegrationStatus()
```

### Configuration API

#### Root Properties

```yaml
integrations:
  enabled: true  # Master switch for all integrations
```

#### JIRA Properties

```yaml
jira:
  enabled: true
  api_url: string
  api_token: string
  email: string
  project_key: string
  epics:
    prefix: string
  requirements:
    prefix: string
  tasks:
    prefix: string
```

#### GitHub Properties

```yaml
github:
  enabled: true
  api_url: string
  personal_access_token: string
  repo: string
  default_branch: string
  issue_prefix: string
```

#### Telegram Properties

```yaml
telegram:
  enabled: true
  bot_token: string
  user_id: string
  notify_on:
    pipeline_started: boolean
    task_progress: boolean
    task_completed: boolean
    compilation_failed: boolean
    review_failed: boolean
    pr_created: boolean
    errors_encountered: boolean
```

## Advanced Topics

### Custom Event Handlers

Create custom synchronization events:

```javascript
// Example: Custom deployment event
class CustomIntegrationService extends IntegrationService {
  async handleDeploymentEvent(storyId) {
    const message = `🚀 Deployment: Story ${storyId}`;
    await this.sendTelegramNotification('deployment', {
      message,
      storyId,
      status: 'in-progress'
    });

    await this.updateJIRATask(storyId, {
      status: 'In Progress',
      description: 'Deployment in progress...'
    });
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

Create adapters for additional platforms:

```javascript
// Example: Slack adapter
class SlackService {
  async sendNotification(event, context) {
    // Implement Slack API call
  }
}

// Register in IntegrationService
this.slackService = new SlackService(config);
```

### Batch Operations

Perform batch operations on multiple stories:

```bash
# Link multiple stories to JIRA
for story in s01 s02 s03; do
  /aw-integrate-link $story EPIC-100 jira
done

# Check all story links
/aw-integrate-status --all
```

### Integration Health Monitoring

Set up monitoring:

```javascript
// Monitor integration health
async function monitorIntegrations() {
  const status = await IntegrationService.getIntegrationStatus();

  if (!status.jira.enabled) {
    console.warn('JIRA integration is disabled');
  }

  if (status.github.error) {
    console.error('GitHub integration error:', status.github.error);
  }

  // Send alert if critical
  if (status.telegram.last_notification === null) {
    await sendCriticalAlert('Telegram integration not working');
  }
}
```

## Performance Optimization

### Reduce API Calls

```yaml
# Minimal configuration
telegram:
  enabled: true
  notify_on:
    task_completed: true
    pr_created: true
    # Disable unnecessary notifications
```

### Caching

Integration service caches API responses to reduce calls.

### Logging

Configure log rotation:

```javascript
IntegrationService.init(config, {
  maxLogSize: '10m',  // Rotate when 10MB
  maxFiles: 5         // Keep 5 log files
});
```

## Resources

### Documentation

- [Integration Setup Guide](../src/templates/integrations/integration-setup.md)
- [Integration Synchronization Guide](../src/templates/integrations/integration-sync.md)
- [Integration Configuration Guide](../src/templates/integrations/integration-config.md)
- [Agent-Workflow README](../README.md)

### External Resources

- [JIRA API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [GitHub REST API Documentation](https://docs.github.com/rest)
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)

### Support

- GitHub Issues: Report bugs and request features
- Documentation: `/docs/integrations/`
- Contributing: `CONTRIBUTING.md`

## Next Steps

1. Review configuration examples
2. Set up your preferred integrations
3. Link stories to tickets
4. Run your first story
5. Monitor logs and adjust as needed
6. Explore advanced topics

---

**Status**: Stable
**Version**: 1.0.0
**Last Updated**: 2026-08-31
**Maintainer**: Agent-Workflow Team