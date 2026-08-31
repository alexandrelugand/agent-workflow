# Integration Configuration Guide

Minimal configuration examples and best practices for agent-workflow integrations.

## Table of Contents

- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Troubleshooting Config](#troubleshooting-config)

## Quick Start

### Minimal Setup (5 minutes)

```bash
# 1. Create .env file with tokens
echo "JIRA_API_TOKEN=your-token" > .env
echo "GITHUB_TOKEN=your-token" >> .env
echo "TELEGRAM_BOT_TOKEN=your-bot-token" >> .env

# 2. Create config file
cat > src/config/integrations.yaml << 'EOF'
integrations:
  enabled: true

  jira:
    enabled: true
    api_url: "${JIRA_API_URL}"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "PROJ"

  github:
    enabled: true
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "org/repo"

  telegram:
    enabled: true
    bot_token: "${TELEGRAM_BOT_TOKEN}"
    user_id: "${TELEGRAM_USER_ID}"
    notify_on:
      task_completed: true
EOF

# 3. Test configuration
/aw-integrate-status
```

## Configuration Reference

### Root Configuration

```yaml
integrations:
  enabled: true                      # Enable/disable all integrations
```

### JIRA Configuration

```yaml
jira:
  enabled: true                      # Enable JIRA integration
  api_url: "${JIRA_API_URL}"        # JIRA server URL
  api_token: "${JIRA_API_TOKEN}"    # JIRA API token (base64)
  email: "${JIRA_EMAIL}"            # JIRA email
  project_key: "PROJ"               # JIRA project key
  epics:
    prefix: "EPIC"                  # Epic ticket prefix
  requirements:
    prefix: "REQ"                   # Requirement ticket prefix
  tasks:
    prefix: "TASK"                  # Task ticket prefix
```

### GitHub Configuration

```yaml
github:
  enabled: true                      # Enable GitHub integration
  api_url: "https://api.github.com" # GitHub API base URL
  personal_access_token: "${GITHUB_TOKEN}"  # GitHub token
  repo: "org/repo"                  # Repository (org/repo)
  default_branch: "main"            # Default branch name
  issue_prefix: "ISS-"              # Issue prefix
```

### Telegram Configuration

```yaml
telegram:
  enabled: true                      # Enable Telegram integration
  bot_token: "${TELEGRAM_BOT_TOKEN}" # Telegram bot token
  user_id: "${TELEGRAM_USER_ID}"    # Telegram user ID
  notify_on:
    pipeline_started: true          # Notify on pipeline start
    task_progress: true             # Notify on task progress
    task_completed: true            # Notify on task completion
    compilation_failed: true        # Notify on compilation errors
    review_failed: true             # Notify on review failures
    pr_created: true                # Notify on PR creation
    errors_encountered: true        # Notify on errors
```

## Examples

### Example 1: JIRA Only

```yaml
# src/config/integrations.yaml
integrations:
  enabled: true

  jira:
    enabled: true
    api_url: "https://your-company.atlassian.net"
    api_token: "${JIRA_API_TOKEN}"
    email: "${JIRA_EMAIL}"
    project_key: "MYPROJ"
    epics:
      prefix: "EPIC"
    requirements:
      prefix: "REQ"
    tasks:
      prefix: "TASK"
```

**Environment variables**:
```bash
export JIRA_API_URL="https://your-company.atlassian.net"
export JIRA_API_TOKEN="base64-encoded-token"
export JIRA_EMAIL="your-email@company.com"
```

### Example 2: GitHub Only

```yaml
# src/config/integrations.yaml
integrations:
  enabled: true

  github:
    enabled: true
    api_url: "https://api.github.com"
    personal_access_token: "${GITHUB_TOKEN}"
    repo: "myorg/myapp"
    default_branch: "main"
    issue_prefix: "ISS-"
```

**Environment variables**:
```bash
export GITHUB_TOKEN="ghp_..."
```

### Example 3: Telegram Only

```yaml
# src/config/integrations.yaml
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

**Environment variables**:
```bash
export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export TELEGRAM_USER_ID="123456789"
```

### Example 4: All Integrations

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
    repo: "org/repo"
    default_branch: "main"
    issue_prefix: "ISS-"

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

**Environment variables**:
```bash
export JIRA_API_URL="https://your-company.atlassian.net"
export JIRA_API_TOKEN="base64-encoded-token"
export JIRA_EMAIL="your-email@company.com"

export GITHUB_TOKEN="ghp_..."

export TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
export TELEGRAM_USER_ID="123456789"
```

### Example 5: Conditional Notifications

```yaml
# Only notify on errors and task completion
telegram:
  enabled: true
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  user_id: "${TELEGRAM_USER_ID}"
  notify_on:
    task_completed: true
    compilation_failed: true
    review_failed: true
    pr_created: false  # Disable PR notifications
    pipeline_started: false  # Disable pipeline start notifications
```

### Example 6: Custom Ticket Prefixes

```yaml
# Different prefixes for different integrations
jira:
  enabled: true
  project_key: "PROJ"
  epics:
    prefix: "EF"  # Epic Feature
  requirements:
    prefix: "FR"  # Feature Requirement
  tasks:
    prefix: "FT"  # Feature Task

github:
  enabled: true
  issue_prefix: "FE-"  # Feature Issue
```

## Best Practices

### 1. Use Environment Variables

Never hardcode tokens in configuration:

```yaml
# ❌ Bad
personal_access_token: "ghp_1234abcd"

# ✅ Good
personal_access_token: "${GITHUB_TOKEN}"
```

### 2. Add .env to .gitignore

```
.env
.env.local
.env.*.local
```

### 3. Use .env.example for Reference

```bash
# .env.example
JIRA_API_URL=https://your-company.atlassian.net
JIRA_API_TOKEN=your-base64-encoded-token
JIRA_EMAIL=your-email@company.com
GITHUB_TOKEN=ghp_...
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_USER_ID=123456789
```

### 4. Test Configuration

```bash
# Test configuration
/aw-integrate-status

# Expected output: ✅ All integrations active
```

### 5. Rotate Tokens Regularly

Change API tokens every 90 days for security.

### 6. Use Specific Scopes

```bash
# JIRA token: Project Read/Write
# GitHub token: repo, issues, pull_requests only
# Telegram bot: No special permissions needed
```

### 7. Validate Before Use

```bash
# Check for syntax errors
cat src/config/integrations.yaml | yamllint

# Verify YAML syntax
python -c "import yaml; yaml.safe_load(open('src/config/integrations.yaml'))"
```

### 8. Document Integration Patterns

Create `docs/integration-patterns.md` for team knowledge.

## Troubleshooting Config

### Configuration File Not Found

```
Error: Integration configuration file not found
Solution: Run /aw-integrate-configure to create config file
```

### Invalid YAML Syntax

```bash
# Check syntax
cat src/config/integrations.yaml | python -m yaml

# Expected output: Valid configuration
# If error: Incorrect indentation or syntax
```

### Environment Variables Not Set

```bash
# Check if variables exist
env | grep JIRA

# Expected: JIRA_API_TOKEN=..., JIRA_EMAIL=...
# If missing: Set variables in .env file
```

### Integration Not Enabled

Check `enabled` field in configuration:

```yaml
# Make sure integrations are enabled
integrations:
  enabled: true  # Must be true

  jira:
    enabled: false  # This disables JIRA integration
```

### Token Expiration

```
Error: Authentication failed
Solution: Token has expired. Regenerate and update configuration.
```

## Verification Steps

### Step 1: Check Configuration File

```bash
# Verify file exists
ls -la src/config/integrations.yaml

# Check syntax
cat src/config/integrations.yaml | python -m yaml
```

### Step 2: Check Environment Variables

```bash
# Load environment
export $(cat .env | xargs)

# Verify tokens
echo $JIRA_API_TOKEN
echo $GITHUB_TOKEN
echo $TELEGRAM_BOT_TOKEN
```

### Step 3: Test Integrations

```bash
# Test each integration
/aw-integrate-status

# Expected: All integrations show status OK
```

### Step 4: Test End-to-End

```bash
# Run a story with integrations
/aw-orchestrator s01

# Expected: Tickets created, notifications sent
```

## Next Steps

1. Choose integration pattern (JIRA only, GitHub only, all, or mixed)
2. Set up environment variables
3. Create configuration file
4. Test configuration with `/aw-integrate-status`
5. Run story with `/aw-orchestrator`
6. Monitor logs in `logs/integration.log`

## Related Documentation

- [Integration Setup Guide](./integration-setup.md) — Complete setup procedures
- [Integration Synchronization Guide](./integration-sync.md) — Synchronization events and patterns
- [Integration Status Command](../commands/aw-integrate-status.md) — Status command reference