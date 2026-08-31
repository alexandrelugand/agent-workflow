---
name: telegram-notifier
description: Send real-time notifications to user via Telegram about agent-workflow progress and events. Optional integration.
---

# Telegram Notifier Skill

You send notifications to the user via Telegram for agent-workflow events. Use during execution, review, and ship phases.

## Configuration

Read `src/config/integrations.yml` for configuration:

- `bot_token`: Telegram bot token (from environment)
- `user_id`: Telegram user ID (from environment)
- `notify_on`: Events to send notifications for

## Supported Events

### 1. Compilation Request

Triggered when compilation is needed or failed:

```markdown
⚠️ Compilation Request: Task <task-id>
Story: <story-name>

Please run 'npm run build' to verify compilation.

Branch: feature/<task-id>
```

**Context**: Development Agent executing plan and needs compilation check.

### 2. Task Progress

Triggered at each step of task execution:

```markdown
🚀 Task Progress: <task-id>/<total>

Step <current>/<total>: <description>

Branch: feature/<task-id>
Story: <story-name>

[Optional detailed progress...]
```

### 3. Code Review Results

Triggered after code review:

```markdown
👀 Code Review: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

Quality Score: <X>/100
Issues: <count>
Suggestions: <count>
Status: <passed|failed>

[Optional detailed review findings...]
```

### 4. PR Created

Triggered when pull request is created:

```markdown
🚢 Pull Request Created: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

PR: https://github.com/<repo>/pull/<pr-number>

Tests:
- Unit tests: ✅ Passing
- Integration tests: ✅ Passing

Status: Ready for review
```

### 5. Task Completed

Triggered when task is fully executed:

```markdown
✨ Task Completed: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

Commits: <count>
Files changed: <count>
Lines added: <added>
Lines removed: <removed>

Status: Done
```

### 6. Pipeline Progress

Triggered at major workflow milestones:

```markdown
📈 Pipeline Progress

Phase: <phase-name>
Story: <story-id>

Current step: <step-name>
Status: <progress: X/Y>

[Optional detailed progress...]
```

## Notification Templates

### Default Template

```markdown
<icon> <event type>: <task-id>

Task: <task-name>
Story: <story-name>
Branch: <branch-name>

<details>

Branch: https://github.com/<repo>/tree/<branch-name>
PR: <pr-link> (if applicable)

Status: <status>
Progress: <progress>
```

### Event-Specific Templates

#### Compilation Request

```
⚠️ Compilation Request: <task-id>

Story: <story-name>
Task: <task-name>

Please run: npm run build
Branch: feature/<task-id>

This step requires compilation verification before proceeding.
```

#### Task Progress

```
🚀 Task Progress: <task-id>/<total>

Step <current>/<total>: <description>

Story: <story-name>
Branch: feature/<task-id>
```

#### Code Review

```
👀 Code Review: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

Quality Score: <X>/100
Issues: <count>
Suggestions: <count>
Status: <status>

[Review findings...]
```

#### PR Created

```
🚢 PR Created: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

PR: https://github.com/<repo>/pull/<pr-number>

Tests:
- Unit tests: ✅ Passing
- Integration tests: ✅ Passing

Status: Ready for review
```

#### Task Completed

```
✨ Task Completed: <task-id>

Task: <task-name>
Story: <story-name>
Branch: feature/<task-id>

Commits: <count>
Files changed: <count>
Lines added: <added>
Lines removed: <removed>

Status: Done

Next step: <next-step>
```

## Implementation

### Telegram Bot API

```bash
# Send message
POST https://api.telegram.org/bot<TOKEN>/sendMessage
Authorization: Bearer <TOKEN>
Body: {
  "chat_id": "<user_id>",
  "text": "<message>",
  "parse_mode": "Markdown"
}

# Send error notification
POST https://api.telegram.org/bot<TOKEN>/sendMessage
Body: {
  "chat_id": "<user_id>",
  "text": "❌ Error in task <task-id>: <error>",
  "parse_mode": "Markdown"
}
```

### Integration with agent-workflow

Notify from:

1. **Development Agent** — during Execute phase (step progress, compilation, task completion)
2. **Review Agent** — after code review (results, suggestions)
3. **Ship Agent** — when PR is created (PR link, status)
4. **Orchestrator** — at workflow milestones (pipeline progress)

Example integration in `/aw-execute`:

```markdown
You are the implementer agent.

For each task:
1. Execute plan
2. After implementation, check compilation if needed
3. Notify user via Telegram if compilation request triggered:
   "⚠️ Compilation Request: Task <id>\n\nStory: <name>\n\nPlease run 'npm run build'\n\nBranch: feature/<id>"
4. Complete task and notify:
   "✨ Task <id> completed!\n\nStory: <name>\n\nCommits: <count>\n\nNext: /aw-review"
```

Example in `/aw-review`:

```markdown
You are the reviewer agent.

After reviewing:
1. Calculate quality score
2. Count issues and suggestions
3. Notify user via Telegram:
   "👀 Code Review: <id>\n\nTask: <name>\n\nQuality: <X>/100\n\nStatus: <status>"
```

Example in `/aw-ship`:

```markdown
You are the ship agent.

When creating PR:
1. Verify PR link
2. Notify user:
   "🚢 PR Created: <id>\n\nPR: <url>\n\nStatus: Ready\n\nTests: ✅ Passing"
```

## Error Handling

If Telegram API fails:
1. Log error to file: `logs/telegram-failures.md`
2. Continue with current operation (don't block pipeline)
3. Note in task file: "Telegram notification failed"

Example:

```markdown
## Notification Status
- Telegram: ❌ Failed (API error: timeout)
- Markdown: ✅ Available in docs/tasks/<id>.md
```

## Best Practices

- Keep notifications concise (max 500 chars)
- Use emoji to visually highlight event type
- Include all relevant context in one message
- Link to relevant files/PRs
- Use proper formatting (Markdown)
- Don't spam notifications (batch progress updates)
- Respect notification preferences (don't send what's disabled in config)

## Configuration Control

Check `config/integrations.yml` before sending:

```yaml
telegram:
  enabled: true
  notify_on:
    compile_requests: true    # Send when compilation needed
    task_completed: true      # Send when task done
    pr_created: true          # Send when PR created
    review_passed: false      # Don't send on review passed
```

## Output

After notifying, update task file with notification status:

```markdown
## Notification
- Telegram: ✅ Sent (2024-01-15 10:30)
- Channel: User <user_id>
- Message: [truncated message]
```

## Verification

Test notification by:

1. Trigger a notification event
2. Check user's Telegram for message
3. Verify message contains correct information
4. Test formatting and emojis
5. Verify links work

Example test:

```bash
# Send test notification
curl -X POST https://api.telegram.org/bot<TOKEN>/sendMessage \
  -d "chat_id=<user_id>" \
  -d "text=✨ Test notification from agent-workflow"

# Verify received message
# Should show test notification with emoji and proper formatting
```