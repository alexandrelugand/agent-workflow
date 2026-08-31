# Integration Documentation

This directory contains detailed information about integration patterns, examples, and best practices.

## Table of Contents

- [Overview](#overview)
- [Integration Guide](#integration-guide)
- [Integration Examples](#integration-examples)
- [Troubleshooting](#troubleshooting)
- [Related Documentation](#related-documentation)

## Overview

Integrations connect agent-workflow with external tools (JIRA, GitHub, Telegram) to provide:
- Automatic ticket creation and tracking
- Real-time notifications during development
- Seamless synchronization between pipeline and external tools

## Integration Guide

### Quick Start

```bash
# 1. Configure integrations
/aw-integrate-configure

# 2. Verify configuration
/aw-integrate-status

# 3. Link stories to tickets
/aw-integrate-link s01 EPIC-100 jira
/aw-integrate-link s01 ISS-1001 github

# 4. Execute story
/aw-orchestrator s01
```

### Configuration Files

- `src/config/integrations.yaml` — Main configuration file
- `.env` — Environment variables for API tokens

### Command Reference

| Command | Description |
|---------|-------------|
| `/aw-integrate-configure` | Interactive configuration wizard |
| `/aw-integrate-status` | Check integration status |
| `/aw-integrate-link` | Link story to tickets |
| `/aw-integrate-unlink` | Remove story-ticket links |
| `/aw-integrate-jira` | JIRA-specific commands |
| `/aw-integrate-github` | GitHub-specific commands |

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

## Integration Examples

### Example 1: Full Workflow with All Integrations

See `s01-user-auth.md` for complete example:

```bash
# Configure all integrations
/aw-integrate-configure

# Link stories
/aw-integrate-link s01-user-auth EPIC-100 jira
/aw-integrate-link s01-user-auth REQ-1001 jira
/aw-integrate-link s01-user-auth ISS-1001 github

# Execute story
/aw-orchestrator s01-user-auth

# Ship story
/aw-ship
```

**Expected behavior**:
- JIRA: Epic created, Requirements created, Task updated
- GitHub: Issues created, PR created
- Telegram: Notifications throughout pipeline

### Example 2: JIRA Only Workflow

```bash
# Configure JIRA only
/aw-integrate-configure

# Link story
/aw-integrate-link s02-profile-mgmt EPIC-100 jira

# Execute
/aw-orchestrator s02-profile-mgmt

# Check JIRA
# View tickets created and updated
```

### Example 3: GitHub Only Workflow

```bash
# Configure GitHub only
/aw-integrate-configure

# Link story
/aw-integrate-link s03-data-export ISS-1002 github

# Execute
/aw-orchestrator s03-data-export

# View GitHub issues
```

### Example 4: Mixed Integrations

```bash
# Configure JIRA + GitHub (no Telegram)
/aw-integrate-configure

# Link story
/aw-integrate-link s04-payment EPIC-100 jira
/aw-integrate-link s04-payment ISS-1004 github

# Execute
/aw-orchestrator s04-payment

# Expected behavior:
# - JIRA: Tickets created and updated
# - GitHub: Issues and PRs created
# - Telegram: No notifications (disabled)
```

## Troubleshooting

### Common Issues

**Integration not enabled**:
```bash
# Enable integration
/aw-integrate-configure

# Verify status
/aw-integrate-status
```

**Token authentication failed**:
```bash
# Verify tokens
echo $JIRA_API_TOKEN
echo $GITHUB_TOKEN
echo $TELEGRAM_BOT_TOKEN

# Regenerate if expired
```

**Connection refused**:
```bash
# Check internet connection
ping api.github.com

# Test API
curl -X GET "https://api.github.com/user" \
  -H "Authorization: Bearer $GITHUB_TOKEN"
```

**Rate limit exceeded**:
```bash
# Wait for rate limit to reset (usually 1 hour)
# Use personal access token for higher limits
```

### Check Logs

```bash
# Check integration logs
tail -f logs/integration.log

# Check for errors
grep ERROR logs/integration.log
grep WARN logs/integration.log

# Check for specific story
grep "s01" logs/integration.log
```

### Verification

```bash
# Check configuration
cat src/config/integrations.yaml

# Check status
/aw-integrate-status

# Check environment variables
env | grep -E "JIRA|GITHUB|TELEGRAM"
```

## Related Documentation

- [Integration Setup Guide](../src/templates/integrations/integration-setup.md) — Complete setup procedures
- [Integration Synchronization Guide](../src/templates/integrations/integration-sync.md) — Synchronization events
- [Integration Configuration Guide](../src/templates/integrations/integration-config.md) — Configuration examples
- [Integration Guide](../integration-guide.md) — Comprehensive guide
- [Integration Status Command](../src/commands/aw-integrate-status.md) — Status command reference
- [Integration Link Command](../src/commands/aw-integrate-link.md) — Link command reference
- [Integration Unlink Command](../src/commands/aw-integrate-unlink.md) — Unlink command reference

## Sample Integration Records

See individual story files for detailed integration examples:

- [s01-user-auth.md](s01-user-auth.md) — Full workflow example

## Best Practices

1. **Never commit tokens**: Use environment variables
2. **Link early**: Create manual links before starting stories
3. **Monitor logs**: Check `logs/integration.log` regularly
4. **Verify sync**: Run `/aw-integrate-status` before each cycle
5. **Use manual linking**: For existing projects with existing tickets

## Support

- GitHub Issues: Report bugs and request features
- Documentation: `/docs/integrations/`
- Integration Service: `src/services/integration-service.mjs`

---

**Status**: Stable
**Version**: 1.0.0
**Last Updated**: 2026-08-31
**Maintainer**: Agent-Workflow Team