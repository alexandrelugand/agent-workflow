# agent-workflow — Integration Setup Guide

> Configure JIRA, GitHub, and Telegram integrations for enhanced workflow tracking.

## Table of Contents

1. [Quick Start](#quick-start)
2. [JIRA Integration](#jira-integration)
3. [GitHub Integration](#github-integration)
4. [Telegram Integration](#telegram-integration)
5. [Configuration](#configuration)
6. [Testing](#testing)

## Quick Start

### Prerequisites

- JIRA Cloud account with API access
- GitHub account with personal access token
- Telegram bot with API access
- Agent-workflow installed in project

### 5-Minute Setup

```bash
# 1. Copy integration config
cp src/config/integrations.yml.example src/config/integrations.yml

# 2. Edit config (set API credentials)
nano src/config/integrations.yml

# 3. Enable integrations
# jira.enabled: true
# github.enabled: true
# telegram.enabled: true

# 4. Set environment variables
export JIRA_API_TOKEN="your-token"
export JIRA_EMAIL="your-email@example.com"
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPO="your-org/your-repo"
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_USER_ID="your-user-id"

# 5. Test integration
/aw-integrate-jira
```

## JIRA Integration

### Setup JIRA API

1. **Create JIRA API Token**
   - Go to JIRA → Profile → API tokens
   - Create new token
   - Copy token string

2. **Get JIRA API URL**
   - Format: `https://<your-domain>.atlassian.net`
   - Example: `https://acme.atlassian.net`

3. **Configure Environment**

```bash
# Add to ~/.bashrc or ~/.zshrc
export JIRA_API_TOKEN="ATATT...your-token..."
export JIRA_EMAIL="your.email@example.com"
export JIRA_API_URL="https://acme.atlassian.net"
export JIRA_PROJECT_KEY="PROJ"
```

### Create JIRA Project

```bash
# In JIRA UI
# Create project → Select Epic board → Enter project key
# E.g., "PROJ", "SAAS", "APP"
```

### Enable Integration

Edit `src/config/integrations.yml`:

```yaml
jira:
  enabled: true
  api_url: "https://acme.atlassian.net"
  api_token: "${JIRA_API_TOKEN}"
  email: "${JIRA_EMAIL}"
  project_key: "PROJ"
  epic_prefix: "EPIC"
  requirement_prefix: "REQ"
  task_prefix: "TASK"
```

### Usage

```bash
# Integrate with PRD stories
/aw-integrate-jira

# Integrate with specific story
/aw-integrate-jira s01
```

## GitHub Integration

### Setup GitHub

1. **Create Personal Access Token**
   - GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
   - Select scopes: `repo`, `read:org`, `write:issue`
   - Generate token
   - Copy token

2. **Get Repository**
   ```
   Format: owner/repo
   Example: acme/my-app
   ```

3. **Configure Environment**

```bash
export GITHUB_TOKEN="ghp_...your-token..."
export GITHUB_REPO="acme/my-app"
export GITHUB_DEFAULT_BRANCH="main"
export GITHUB_API_URL="https://api.github.com"
```

### Enable Integration

Edit `src/config/integrations.yml`:

```yaml
github:
  enabled: true
  api_url: "https://api.github.com"
  personal_access_token: "${GITHUB_TOKEN}"
  repo: "acme/my-app"
  default_branch: "main"
  issue_prefix: "ISS"
```

### Usage

```bash
# Setup GitHub integration
/aw-integrate-github

# Link specific story
/aw-integrate-github s01
```

### Create Repository Branch Protection (Optional)

```bash
# In GitHub UI
# Settings → Branches → main
# Add rule:
# - Require pull request reviews
# - Require status checks to pass
# - Require branches to be up to date before merging
```

## Telegram Integration

### Setup Telegram Bot

1. **Create Bot**
   - Message `@BotFather` on Telegram
   - Send `/newbot`
   - Choose bot name
   - Choose username (must end in bot)
   - Copy token

2. **Get User ID**
   - Message `@userinfobot` on Telegram
   - Send `/start`
   - Copy your user ID

3. **Configure Environment**

```bash
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
export TELEGRAM_USER_ID="123456789"
```

### Enable Integration

Edit `src/config/integrations.yml`:

```yaml
telegram:
  enabled: true
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  user_id: "${TELEGRAM_USER_ID}"
  notify_on:
    compile_requests: true
    task_completed: true
    pr_created: true
    review_passed: false
```

### Usage

Telegram notifications are automatic during pipeline execution:
- **/aw-execute**: Task progress, compilation requests
- **/aw-review**: Code review results
- **/aw-ship**: PR creation and status

## Configuration

### Complete Configuration Example

```yaml
# src/config/integrations.yml

# JIRA Integration
jira:
  enabled: false  # Set to true to enable
  api_url: "https://your-domain.atlassian.net"
  api_token: "${JIRA_API_TOKEN}"
  email: "${JIRA_EMAIL}"
  project_key: "PROJ"
  epic_prefix: "EPIC"
  requirement_prefix: "REQ"
  task_prefix: "TASK"

# GitHub Integration
github:
  enabled: false  # Set to true to enable
  api_url: "https://api.github.com"
  personal_access_token: "${GITHUB_TOKEN}"
  repo: "${GITHUB_REPO}"
  default_branch: "main"
  issue_prefix: "ISS"

# Telegram Integration
telegram:
  enabled: false  # Set to true to enable
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  user_id: "${TELEGRAM_USER_ID}"
  notify_on:
    compile_requests: true
    task_completed: true
    pr_created: true
    review_passed: false
```

### Environment Variables Template

Create `.env` file:

```bash
# .env file
JIRA_API_TOKEN=ATATT...
JIRA_EMAIL=user@example.com
JIRA_API_URL=https://your-domain.atlassian.net

GITHUB_TOKEN=ghp_...
GITHUB_REPO=owner/repo
GITHUB_DEFAULT_BRANCH=main

TELEGRAM_BOT_TOKEN=1234567890:ABCdef...
TELEGRAM_USER_ID=123456789
```

Then source it:

```bash
# .bashrc or .zshrc
source .env
```

## Testing

### Test JIRA Integration

```bash
# Run integration
/aw-integrate-jira s01

# Check output
cat logs/jira-integration.log

# Verify in JIRA UI
# Search for EPIC-100, REQ-1001, TASK-1001
```

### Test GitHub Integration

```bash
# Run integration
/aw-integrate-github s01

# Check output
cat logs/github-integration.log

# Verify in GitHub UI
# Search for ISS-1001
# Check branches: feature/s01
# Check PRs (created in /aw-ship)
```

### Test Telegram Integration

```bash
# Trigger notification
# Execute a task and wait for notifications

# Verify in Telegram
# Should receive:
# - Task progress updates
# - Compilation requests
# - PR notifications
```

### Manual API Test

```bash
# Test JIRA
curl -X GET "${JIRA_API_URL}/rest/api/3/myself" \
  -H "Authorization: Basic $(echo -n \"${JIRA_EMAIL}:${JIRA_API_TOKEN}\" | base64)"

# Test GitHub
curl -X GET "https://api.github.com/user" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}"

# Test Telegram
curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_USER_ID}" \
  -d "text=✨ Test notification from agent-workflow"
```

## Troubleshooting

### JIRA Integration

**Problem**: API token invalid
```
Error: "Invalid credentials"
Solution: Verify token and email are correct
```

**Problem**: Project not found
```
Error: "Project PROJ not found"
Solution: Check project_key in config matches JIRA project key
```

**Problem**: Permission denied
```
Error: "Permission denied"
Solution: Verify you can create issues in JIRA project
```

### GitHub Integration

**Problem**: Token invalid
```
Error: "Bad credentials"
Solution: Verify GITHUB_TOKEN has repo permissions
```

**Problem**: Repo not found
```
Error: "Not Found"
Solution: Check GITHUB_REPO format (owner/repo)
```

**Problem**: Rate limit exceeded
```
Error: "API rate limit exceeded"
Solution: Wait 1 hour or use personal access token
```

### Telegram Integration

**Problem**: Bot not found
```
Error: "Bad Request: bot was blocked"
Solution: Start bot conversation with /start
```

**Problem**: Message too long
```
Error: "Bad Request: message is too long"
Solution: Keep notifications under 500 characters
```

**Problem**: Bot permission denied
```
Error: "Forbidden: bot can't send messages"
Solution: Check bot can message user
```

## Next Steps

After setup:

1. Run `/aw-integrate-jira` to create JIRA tickets
2. Run `/aw-integrate-github` to create GitHub issues
3. Use `/aw-orchestrator` to execute workflow
4. Monitor logs for integration activities
5. Verify tickets and issues in external tools

## Documentation

- **Integrations**: `src/docs/integrations.md`
- **Skills**: `src/skills/integrations/`
- **Commands**: `src/commands/aw-integrate-*.md`
- **Configuration**: `src/config/integrations.yml`

## Support

If you encounter issues:

1. Check logs in `logs/` directory
2. Review this setup guide
3. Test API endpoints manually
4. Consult integration skill files
5. Check agent-workflow documentation