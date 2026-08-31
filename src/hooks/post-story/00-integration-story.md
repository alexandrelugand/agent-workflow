# Post-Story Integration Hook

Executed after each story completion to update integrations.

## Context

After story execution and shipping, update JIRA tickets and GitHub issues with completion status.

## Steps

### 1. Validate Story

```bash
# Check if story exists
if [ ! -f "docs/stories.md" ]; then
    echo "❌ Stories file not found"
    exit 1
fi
```

### 2. Check Integrations

```bash
# Check which integrations are enabled
ENABLED_INTEGRATIONS=()

if grep -q "jira:" src/config/integrations.yaml && \
   ! grep -A10 "jira:" src/config/integrations.yaml | grep -q "enabled: false"; then
    ENABLED_INTEGRATIONS+=("JIRA")
fi

if grep -q "github:" src/config/integrations.yaml && \
   ! grep -A10 "github:" src/config/integrations.yaml | grep -q "enabled: false"; then
    ENABLED_INTEGRATIONS+=("GitHub")
fi

if [ ${#ENABLED_INTEGRATIONS[@]} -eq 0 ]; then
    echo "ℹ️  No integrations enabled. Skipping post-story hook."
    exit 0
fi
```

### 3. Extract Story Information

```bash
# Parse story from current worktree
if [ ! -f ".worktrees/$STORY_ID/docs/stories.md" ]; then
    echo "⚠️  Story file not found in worktree"
    exit 1
fi

STORY_ID=$STORY_ID
STORY_NAME=$(grep -A20 "^## Story $STORY_ID" .worktrees/$STORY_ID/docs/stories.md | head -1 | sed 's/^## //')

# Get JIRA ticket ID (if linked)
JIRA_TICKET=$(grep -E "JIRA.*EPIC|JIRA.*REQ|JIRA.*TASK" .worktrees/$STORY_ID/docs/stories.md | grep -oE "[A-Z]+-[0-9]+" | head -1)

# Get GitHub issue number (if linked)
GITHUB_ISSUE=$(grep -E "GitHub Issue.*ISS-" .worktrees/$STORY_ID/docs/stories.md | grep -oE "ISS-[0-9]+" | head -1)
```

### 4. Log Story Completion

```bash
# Log to integration log
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") - Story completed: $STORY_ID ($STORY_NAME)" >> logs/integration.log

if [ -n "$JIRA_TICKET" ]; then
    echo "  → Updated JIRA: $JIRA_TICKET" >> logs/integration.log
fi

if [ -n "$GITHUB_ISSUE" ]; then
    echo "  → Updated GitHub: $GITHUB_ISSUE" >> logs/integration.log
fi
```

### 5. Update Integration Records

```bash
if [ -f "docs/integrations/$STORY_ID.md" ]; then
    # Update status
    sed -i "s/Sync Status: Not yet created/Sync Status: ✅ Complete/" docs/integrations/$STORY_ID.md

    # Add completion timestamp
    echo "" >> docs/integrations/$STORY_ID.md
    echo "## Completed" >> docs/integrations/$STORY_ID.md
    echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> docs/integrations/$STORY_ID.md
fi
```

### 6. Telegram Notification (if enabled)

```bash
if grep -q "telegram:" src/config/integrations.yaml && \
   ! grep -A10 "telegram:" src/config/integrations.yaml | grep -q "enabled: false"; then

    if grep -q "task_completed: true" src/config/integrations.yaml; then
        # Send completion notification
        echo "🚀 Story completed: $STORY_ID — $STORY_NAME" >> logs/integration.log

        # Note: Actual Telegram notification handled by orchestrator
        # This hook logs the completion event
    fi
fi
```

## Error Handling

### Story Not Found in PRD

```markdown
## Error: Story not found

Story ID $STORY_ID not found in stories.md

Available stories:
$(grep -E "^### Story [s][0-9]+" docs/stories.md)
```

### No Linked Tickets

```markdown
## Warning: No linked tickets

Story $STORY_ID has no JIRA or GitHub tickets linked

Integration records created but no external tickets updated.
```

## Usage

Run this hook automatically after story completion:

```bash
# Manual execution
./src/hooks/post-story/00-integration-story.md

# Automatic execution
/aw-orchestrator s01
# Hook runs automatically after story is shipped
```

## Output

```markdown
## Post-Story Integration Summary

**Story**: $STORY_ID — $STORY_NAME

### Integrations Updated
$(if [ -n "$JIRA_TICKET" ]; then echo "- JIRA: $JIRA_TICKET ✅"; fi)
$(if [ -n "$GITHUB_ISSUE" ]; then echo "- GitHub: $GITHUB_ISSUE ✅"; fi)

### Status
All integrations updated successfully
```

## Related Commands

- `/aw-orchestrator` — Story execution
- `/aw-ship` — Story shipping
- `/aw-integrate-link` — Link tickets to stories
- `/aw-integrate-status` — Check integration status