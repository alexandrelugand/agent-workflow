# Integration Setup Guide

Complete guide for setting up and configuring integrations for agent-workflow.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [JIRA Integration](#jira-integration)
- [GitHub Integration](#github-integration)
- [Telegram Integration](#telegram-integration)
- [Configuration Examples](#configuration-examples)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Introduction

Integrations connect agent-workflow with external tools like JIRA, GitHub, and Telegram to provide:
- **JIRA**: Ticket management, tracking stories as tickets
- **GitHub**: Issue and PR creation, branch management
- **Telegram**: Real-time notifications during pipeline execution

## Prerequisites

Before enabling integrations:

### For JIRA
- JIRA Cloud account
- API token with project permissions
- Project key

### For GitHub
- GitHub account with personal access token (repo, issues, pull_requests scopes)
- Repository access

### For Telegram
- Telegram account
- Bot token (create via @BotFather)
- User ID (get via @userinfobot)

## JIRA Integration

### Setup Steps

1. **Install JIRA CLI** (optional):
   ```bash
   npm install -g jira-cli
   jira login --server "https://your-domain.atlassian.net"
   ```

2. **Configure environment variables**:
   ```bash
   export JIRA_API_URL="https://your-domain.atlassian.net"
   export JIRA_API_TOKEN="your-api-token"
   export JIRA_EMAIL="your-email@example.com"
   export JIRA_PROJECT_KEY="PROJ"
   ```

3. **Configure in YAML**:
   ```yaml
   # src/config/integrations.yaml
   jira:
     enabled: true
     api_url: "${JIRA_API_URL}"
     api_token: "${JIRA_API_TOKEN}"
     email: "${JIRA_EMAIL}"
     project_key: "PROJ"
   ```

4. **Test connection**:
   ```bash
   curl -X GET "${JIRA_API_URL}/rest/api/3/myself" \
     -H "Authorization: Basic $(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)"
   ```

### Use Cases

- Create Epics for user stories
- Create Requirements for features
- Create Tasks for development tasks
- Link story files to JIRA tickets

### Ticket Types

- **Epic**: Major features from PRD
- **Requirement**: Architecture features and requirements
- **Task**: Individual development tasks

## GitHub Integration

### Setup Steps

1. **Generate Personal Access Token**:
   - Go to GitHub Settings → Developer Settings → Personal Access Tokens
   - Generate new token with scopes: `repo`, `issues`, `pull_requests`

2. **Configure environment variables**:
   ```bash
   export GITHUB_TOKEN="ghp_..."
   export GITHUB_REPO="org/repo"
   export GITHUB_DEFAULT_BRANCH="main"
   ```

3. **Configure in YAML**:
   ```yaml
   # src/config/integrations.yaml
   github:
     enabled: true
     api_url: "https://api.github.com"
     personal_access_token: "${GITHUB_TOKEN}"
     repo: "org/repo"
     default_branch: "main"
   ```

4. **Test connection**:
   ```bash
   curl -X GET "https://api.github.com/user" \
     -H "Authorization: Bearer ${GITHUB_TOKEN}"
   ```

### Use Cases

- Create issues for stories
- Create feature branches (`feature/<story-id>`)
- Create pull requests
- Comment on issues with PR links

### Issue Labels

Default labels:
- `feature`
- `agent-workflow`

Custom labels can be configured in YAML.

## Telegram Integration

### Setup Steps

1. **Create Telegram Bot**:
   - Message @BotFather
   - Send `/newbot` command
   - Follow instructions to get bot token

2. **Get Your User ID**:
   - Message @userinfobot
   - Get your numeric user ID

3. **Configure environment variables**:
   ```bash
   export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
   export TELEGRAM_USER_ID="123456789"
   ```

4. **Configure in YAML**:
   ```yaml
   # src/config/integrations.yaml
   telegram:
     enabled: true
     bot_token: "${TELEGRAM_BOT_TOKEN}"
     user_id: "${TELEGRAM_USER_ID}"
   ```

5. **Test connection**:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
   ```

### Use Cases

- Real-time notifications during pipeline execution
- Task progress updates
- PR creation alerts
- Code review results
- Error notifications

### Notification Events

| Event | Default |
|-------|---------|
| Pipeline started | ✅ |
| Task progress | ✅ |
| Task completed | ✅ |
| Compilation requested | ✅ |
| Compilation succeeded | ❌ |
| Compilation failed | ✅ |
| Code review completed | ✅ |
| Code review passed | ❌ |
| Code review failed | ✅ |
| PR created | ✅ |
| PR merged | ❌ |
| PR rejected | ✅ |
| Errors encountered | ✅ |

## Configuration Examples

### Full Configuration

```yaml
# src/config/integrations.yaml
integrations:
  enabled: true

  jira:
    enabled: true
    api_url: "${JIRA_API_URL}"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "PROJ"
    epics:
      prefix: "EPIC"
    requirements:
      prefix: "REQ"
    tasks:
      prefix: "TASK"

  github:
    enabled: true
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "myorg/myapp"
    default_branch: "main"
    issue_prefix: "ISS-"

  telegram:
    enabled: true
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    user_id: "${TELEGRAM_USER_ID}"
    notify_on:
      task_progress: true
      task_completed: true
      pr_created: true
      compilation_failed: true
      review_failed: true
```

### Minimal Configuration (JIRA Only)

```yaml
integrations:
  enabled: true

  jira:
    enabled: true
    api_url: "${JIRA_API_URL}"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "PROJ"
```

### Minimal Configuration (GitHub Only)

```yaml
integrations:
  enabled: true

  github:
    enabled: true
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "myorg/myapp"
    default_branch: "main"
```

### Minimal Configuration (Telegram Only)

```yaml
integrations:
  enabled: true

  telegram:
    enabled: true
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    user_id: "${TELEGRAM_USER_ID}"
    notify_on:
      task_completed: true
      pr_created: true
      errors_encountered: true
```

## Security Best Practices

1. **Never commit sensitive data**:
   ```yaml
   # Bad
   personal_access_token: "ghp_1234abcd"

   # Good
   personal_access_token: "${GITHUB_TOKEN}"
   ```

2. **Use environment variables** for all tokens and passwords

3. **Add .env to .gitignore**:
   ```
   .env
   .env.local
   .env.*.local
   ```

4. **Rotate tokens regularly** (every 90 days recommended)

5. **Use specific scopes**:
   - JIRA: Project Read/Write
   - GitHub: repo, issues, pull_requests only
   - Telegram: None needed for bot

6. **Limit bot permissions**: Telegram bot has no special permissions

7. **Test token expiration**: Periodically verify tokens still work

## Troubleshooting

### JIRA

**Error**: "Failed to create JIRA ticket: API token is required"
- Solution: Set `JIRA_API_TOKEN` environment variable

**Error**: "401 Unauthorized"
- Solution: Verify API token is correct and not expired
- Check token has required scopes

**Error**: "Project not found"
- Solution: Verify project key is correct
- Check token has project access

### GitHub

**Error**: "Failed to create GitHub issue: Authentication failed"
- Solution: Verify `GITHUB_TOKEN` is correct
- Check token has repo, issues, pull_requests scopes

**Error**: "Rate limit exceeded"
- Solution: Wait for rate limit to reset (usually 1 hour)
- Use personal access token with higher rate limits

**Error**: "Repository not found"
- Solution: Verify `GITHUB_REPO` format (org/repo)
- Check token has repository access

### Telegram

**Error**: "Failed to send Telegram notification: Unauthorized"
- Solution: Verify `TELEGRAM_BOT_TOKEN` is correct
- Test with @BotFather to get correct token

**Error**: "User ID not found"
- Solution: Message @userinfobot to get correct user ID

**Error**: "Connection refused"
- Solution: Check bot token and internet connection
- Verify no firewall blocking Telegram API

### General

**Error**: "Integration configuration file not found"
- Solution: Run `/aw-integrate-configure` to create config file
- Ensure `src/config/integrations.yaml` exists

**Error**: "Integration service failed to initialize"
- Solution: Check configuration file syntax
- Verify all required environment variables are set

**Error**: "Logs not being written"
- Solution: Ensure `logs/` directory exists
- Check write permissions in logs directory

## Next Steps

1. Run `/aw-integrate-configure` to set up integrations
2. Run `/aw-integrate-status` to verify configuration
3. Run `/aw-integrate-link` to link stories to tickets
4. Run `/aw-orchestrator` to execute stories with integrations
5. Review logs in `logs/integration.log`

## Additional Resources

- [JIRA API Documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)
- [GitHub REST API Documentation](https://docs.github.com/rest)
- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [agent-workflow README](../../README.md)
- [Integration Status Command](./aw-integrate-status.md)