# Integrations — agent-workflow

> Optional integrations for enhanced workflow tracking and notifications.

## Overview

agent-workflow supports several external tool integrations to enhance tracking and communication:

- **JIRA** — Project tracking and issue management
- **GitHub** — Version control, PRs, and issues
- **Telegram** — Real-time notifications and updates

## Configuration

Integrations are configured via `src/config/integrations.yml`:

```yaml
jira:
  enabled: false
  api_url: "https://your-domain.atlassian.net"
  api_token: "${JIRA_API_TOKEN}"
  email: "${JIRA_EMAIL}"
  project_key: "PROJ"

github:
  enabled: false
  api_url: "https://api.github.com"
  personal_access_token: "${GITHUB_TOKEN}"
  repo: "${GITHUB_REPO}"

telegram:
  enabled: false
  bot_token: "${TELEGRAM_BOT_TOKEN}"
  user_id: "${TELEGRAM_USER_ID}"
```

## Setup

### Environment Variables

Set these in your terminal before running agent-workflow:

```bash
# JIRA
export JIRA_API_TOKEN="your-token"
export JIRA_EMAIL="your-email@example.com"

# GitHub
export GITHUB_TOKEN="your-github-token"
export GITHUB_REPO="org/repo"

# Telegram
export TELEGRAM_BOT_TOKEN="your-bot-token"
export TELEGRAM_USER_ID="your-user-id"
```

### Enable Integration

Edit `src/config/integrations.yml`:

```yaml
jira:
  enabled: true  # Change from false to true

github:
  enabled: true

telegram:
  enabled: true
```

## Commands

### JIRA Integration

**Command**: `/aw-integrate-jira`

Creates JIRA tickets for stories, features, and tasks.

**Usage**:

```
# Integrate with PRD stories
/aw-integrate-jira

# Integrate with specific story
/aw-integrate-jira s01
```

**What it does**:

- Creates Epic tickets for PRD stories
- Creates Requirement tickets for architecture features
- Creates Task tickets for development tasks
- Links tickets hierarchically (Epic → Requirement → Task)
- Updates story/feature/task files with ticket IDs

**Output**:

- `docs/prd.md` with JIRA Epic IDs
- `docs/features/` with JIRA Requirement IDs
- `docs/tasks/` with JIRA Task IDs
- `logs/jira-integration.log` with operation history

### GitHub Integration

**Command**: `/aw-integrate-github`

Creates GitHub issues and pull requests.

**Usage**:

```
# Setup GitHub integration
/aw-integrate-github

# Link specific story
/aw-integrate-github s01
```

**What it does**:

- Creates GitHub issues for stories and features
- Creates feature branches (`feature/<story-id>`)
- Creates pull requests with structured descriptions
- Links PRs to related GitHub issues
- Comments on issues with PR links

**Output**:

- `docs/prd.md` with GitHub issue IDs
- `docs/features/` and `docs/tasks/` with issue IDs
- `.github/pull-requests/` summary
- `logs/github-integration.log`

## Skills

### JIRA Adapter

**Skill**: `src/skills/integrations/jira-adapter.md`

Handles JIRA ticket creation and management.

**Features**:

- Create Epics, Requirements, Tasks
- Link tickets hierarchically
- Update story files with JIRA IDs
- Handle API errors with fallbacks

**Usage**:
Called automatically by `/aw-integrate-jira` command.

### GitHub Adapter

**Skill**: `src/skills/integrations/github-adapter.md`

Handles GitHub issue and PR creation.

**Features**:

- Create GitHub issues for stories
- Create feature branches
- Create structured PRs with test results
- Link PRs to related issues

**Usage**:
Called automatically by `/aw-integrate-github` command.

### Telegram Notifier

**Skill**: `src/skills/integrations/telegram-notifier.md`

Sends real-time notifications.

**Features**:

- Compilation request notifications
- Task progress updates
- Code review results
- PR creation notifications
- Task completion summaries

**Events**:

- `compile_requests` — When compilation is needed
- `task_completed` — When task finishes
- `pr_created` — When PR is created
- `review_passed` — When review completes successfully

**Usage**:
Called automatically by pipeline commands:

- `/aw-execute` — Task progress and completion
- `/aw-review` — Code review results
- `/aw-ship` — PR creation

## Workflow Integration

### Recommended Sequence

```text
1. /aw-brain
   ↓
2. /aw-prd
   ↓  
3. /aw-integrate-jira        # Create JIRA Epics
   ↓
4. /aw-stories               # Breakdown stories
   ↓
5. /aw-architect             # Define architecture
   ↓
6. /aw-integrate-github      # Create GitHub issues
   ↓
7. /aw-design-system         # Define tasks
   ↓
8. /aw-execute               # Implement with JIRA task IDs
   ↓
9. /aw-review                # Review and notify
   ↓
10. /aw-ship                 # Create PRs and notify
```

## File Structure

### Integration-Specific Files

```text
agent-workflow/
├── src/
│   ├── config/
│   │   └── integrations.yml       # Configuration for all integrations
│   ├── skills/
│   │   └── integrations/
│   │       ├── jira-adapter.md    # JIRA ticket creation
│   │       ├── github-adapter.md  # GitHub issue/PR creation
│   │       └── telegram-notifier.md # Telegram notifications
│   └── commands/
│       ├── aw-integrate-jira.md   # JIRA integration command
│       └── aw-integrate-github.md # GitHub integration command
├── docs/
│   ├── jira-issues.md             # JIRA issues summary (fallback)
│   ├── github-issues.md           # GitHub issues summary (fallback)
│   └── integrations.md            # This file
├── logs/
│   ├── jira-integration.log       # JIRA operation logs
│   ├── github-integration.log     # GitHub operation logs
│   └── telegram-failures.md       # Telegram errors
└── src/templates/
    └── jira-ticket.md             # Template for JIRA tickets
```

## Error Handling

### Fallback Behavior

If an integration fails:

1. **Log error** to corresponding log file
2. **Document fallback** in issue tracking file
3. **Continue pipeline** without blocking
4. **Manual creation** recommended for failed items

Example:

```markdown
## JIRA Integration
- Epic: ✅ EPIC-100 (created)
- Requirement: ❌ Failed (API timeout) — manual creation recommended

## GitHub Integration
- Issue: ✅ ISS-1001 (created)
- PR: ❌ Failed (rate limit) — manual PR creation recommended
```

### Verification

After integration:

1. Check log files for errors
2. Verify external tool UI shows created items
3. Confirm links between tickets and issues
4. Test notifications (if enabled)

## Best Practices

### JIRA

- Always link tasks to their parent requirement
- Use consistent prefix naming (EPIC, REQ, TASK)
- Set proper priorities (P0-P3)
- Keep descriptions clear and actionable
- Link related Epics via "Relates to" field

### GitHub

- Always link PRs to their story issues
- Use descriptive PR titles matching commit messages
- Include test results in PR description
- Tag reviewers appropriately
- Use status checks (CI) before merging

### Telegram

- Keep notifications concise (max 500 chars)
- Use emoji for visual event highlights
- Include all relevant context
- Link to relevant files/PRs
- Don't spam notifications

## Troubleshooting

### JIRA Integration Not Working

1. Verify API token and email are correct
2. Check JIRA project key matches
3. Ensure you have permission to create issues
4. Check `logs/jira-integration.log` for errors
5. Verify JIRA API URL is correct

### GitHub Integration Not Working

1. Verify GITHUB_TOKEN has repo permissions
2. Check GITHUB_REPO format (org/repo)
3. Ensure default branch exists in repo
4. Check `logs/github-integration.log` for errors
5. Verify API endpoint is accessible

### Telegram Notifications Not Received

1. Verify TELEGRAM_BOT_TOKEN and user_id
2. Test bot with `/start` command
3. Check `logs/telegram-failures.md` for errors
4. Verify `notify_on` config has correct events enabled
5. Ensure bot has permission to send messages

## Security

### API Tokens

- Never commit tokens to git
- Use environment variables or secrets management
- Rotate tokens regularly
- Use minimal permission tokens
- Disable integrations when not in use

## Performance Impact

Integrations add minimal overhead:

- JIRA: ~2-3s per ticket created
- GitHub: ~1-2s per issue/PR created
- Telegram: ~0.5s per notification

Enable only integrations you need to avoid unnecessary overhead.

## Support

For integration issues:

1. Check log files in `logs/`
2. Verify configuration in `src/config/integrations.yml`
3. Test API manually with curl
4. Review skill files in `src/skills/integrations/`
5. Consult this documentation

## Version History

- **v1.0** (2024-01-15): Initial integration support
  - JIRA ticket creation
  - GitHub issue and PR creation
  - Telegram notifications
