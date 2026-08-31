---
description: Configure agent-workflow integrations (JIRA, GitHub, Telegram)
argument-hint: <tool> (optional: jira|github|telegram|all)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Glob
  - Bash
---

# aw-integrate-configure — Configure agent-workflow integrations

> Configure JIRA, GitHub, and Telegram integrations for agent-workflow

## Purpose

Set up and manage integration configurations for external tools (JIRA, GitHub, Telegram) in agent-workflow.

## Usage

```bash
# Interactive configuration for all integrations
/aw-integrate-configure

# Configure specific integration
/aw-integrate-configure jira
/aw-integrate-configure github
/aw-integrate-configure telegram

# Configure all integrations
/aw-integrate-configure all
```

## Phase 1 — Interactive Configuration Menu

1. Present menu with options:
   - Enable/Disable each integration
   - Configure JIRA settings (API URL, token, email, project key)
   - Configure GitHub settings (repo, personal access token)
   - Configure Telegram settings (bot token, user ID)
   - View current configuration
   - Save and exit

2. For each integration:
   - Ask if user wants to enable it
   - If yes, ask for required configuration values
   - Validate values before saving
   - Use environment variables for sensitive data

## Phase 2 — Validate Configuration

For each integration enabled:

### JIRA Validation
- Verify API URL format (must end with /)
- Verify API token is set
- Verify email is set
- Verify project key is set and valid (3+ characters, alphanumeric)

### GitHub Validation
- Verify repo format (org/repo)
- Verify personal access token is set
- Verify token has required scopes (repo, issues, pull_requests)

### Telegram Validation
- Verify bot token is set
- Verify user ID is set and numeric
- Test bot connection if requested

## Phase 3 — Save Configuration

1. **Update `src/config/integrations.yaml`**:
   ```yaml
   integrations:
     enabled: true
     jira:
       enabled: true
       api_url: "${JIRA_API_URL}"
       api_token: "${JIRA_API_TOKEN}"
       email: "${JIRA_EMAIL}"
       project_key: "PROJ"
       # ... other settings
     github:
       enabled: true
       api_url: "https://api.github.com"
       personal_access_token: "${GITHUB_TOKEN}"
       repo: "org/repo"
       # ... other settings
     telegram:
       enabled: true
       bot_token: "${TELEGRAM_BOT_TOKEN}"
       user_id: "${TELEGRAM_USER_ID}"
       # ... other settings
   ```

2. **Create/update environment file** (`.env` or `.env.local`):
   ```bash
   JIRA_API_URL="https://your-domain.atlassian.net"
   JIRA_API_TOKEN="your-token"
   JIRA_EMAIL="your-email@example.com"
   JIRA_PROJECT_KEY="PROJ"

   GITHUB_TOKEN="ghp_..."

   TELEGRAM_BOT_TOKEN="123456:ABC-DEF..."
   TELEGRAM_USER_ID="123456789"
   ```

3. **Create/update `.gitignore`**:
   ```
   .env
   .env.local
   .env.*.local
   logs/
   ```

4. **Create integration documentation**:
   - `docs/integrations/setup-guide.md` — Setup instructions
   - `docs/integrations/troubleshooting.md` — Troubleshooting guide

## Phase 4 — Verification

After saving configuration:

1. **Test JIRA connection**:
   ```bash
   curl -X GET "${JIRA_API_URL}/rest/api/3/myself" \
     -H "Authorization: Basic $(echo -n "${JIRA_EMAIL}:${JIRA_API_TOKEN}" | base64)"
   ```

2. **Test GitHub connection**:
   ```bash
   curl -X GET "https://api.github.com/user" \
     -H "Authorization: Bearer ${GITHUB_TOKEN}"
   ```

3. **Test Telegram connection**:
   ```bash
   curl -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getMe"
   ```

4. **Log verification**:
   - Check `logs/integration.log` for success messages
   - Verify no errors in configuration

## Phase 5 — Display Summary

Show integration status:

```markdown
## Integration Configuration Summary

**JIRA**:
- Status: ✅ Enabled
- API URL: ${JIRA_API_URL}
- Project: ${JIRA_PROJECT_KEY}
- Validation: ✅ All checks passed

**GitHub**:
- Status: ✅ Enabled
- Repository: ${GITHUB_REPO}
- Validation: ✅ All checks passed

**Telegram**:
- Status: ✅ Enabled
- User ID: ${TELEGRAM_USER_ID}
- Validation: ✅ All checks passed

## Next Steps

- Run `/aw-integrate-status` to view current integrations
- Use `/aw-integrate-link` to link stories to existing tickets
- Run `/aw-orchestrator` to start a story with integrations enabled
```

## Error Handling

If configuration validation fails:

1. Log error to `logs/integration-error.log`
2. Show error details to user
3. Ask if they want to:
   - Fix the configuration and try again
   - Skip this integration and continue
   - Exit configuration

Example error:

```markdown
## Configuration Error

**JIRA**: API token is required but not set.

Please set the `JIRA_API_TOKEN` environment variable or update your configuration.
```

## Environment Variables Required

| Variable | JIRA | GitHub | Telegram | Description |
|----------|------|--------|----------|-------------|
| JIRA_API_URL | ✅ | ❌ | ❌ | JIRA Cloud instance URL |
| JIRA_API_TOKEN | ✅ | ❌ | ❌ | JIRA API token |
| JIRA_EMAIL | ✅ | ❌ | ❌ | JIRA account email |
| JIRA_PROJECT_KEY | ✅ | ❌ | ❌ | JIRA project identifier |
| GITHUB_TOKEN | ❌ | ✅ | ❌ | GitHub personal access token |
| TELEGRAM_BOT_TOKEN | ❌ | ❌ | ✅ | Telegram bot token |
| TELEGRAM_USER_ID | ❌ | ❌ | ✅ | Telegram user ID |

## Security Considerations

1. **Never commit sensitive data** to version control
2. **Use environment variables** for tokens and passwords
3. **Use `.gitignore`** to exclude `.env` files
4. **Rotate tokens regularly** and update configuration
5. **Test permissions** before enabling integrations
6. **Limit token scopes** to only required permissions

## Troubleshooting

See `docs/integrations/troubleshooting.md` for common issues and solutions.

## Example Workflow

```bash
1. /aw-integrate-configure
2. Select "JIRA" → Enable → Enter configuration → Save
3. Select "GitHub" → Enable → Enter configuration → Save
4. Select "Telegram" → Enable → Enter configuration → Save
5. Verify all connections pass
6. View summary and proceed
```