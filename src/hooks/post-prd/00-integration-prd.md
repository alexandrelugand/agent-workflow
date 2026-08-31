# Post-PRD Integration Hook

Executed after PRD is created to set up initial JIRA integration.

## Context

After PRD creation, the next step is to link Epics to external JIRA project.

## Steps

### 1. Validate PRD

```bash
# Check if PRD exists
if [ ! -f "docs/prd.md" ]; then
    echo "❌ PRD file not found"
    exit 1
fi
```

### 2. Check JIRA Configuration

```bash
# Check if JIRA is enabled
if grep -q "enabled: false" src/config/integrations.yaml; then
    echo "⚠️  JIRA integration not enabled. Skipping post-PRD hook."
    exit 0
fi
```

### 3. Extract Stories from PRD

```bash
# Read stories from PRD
STORIES=$(grep -E "^### Story [s][0-9]+" docs/prd.md)

for story in $STORIES; do
    STORY_ID=$(echo $story | grep -oE "s[0-9]+")

    if [ -n "$STORY_ID" ]; then
        echo "📝 Creating JIRA Epic for story: $STORY_ID"

        # Create integration record
        cat > docs/integrations/$STORY_ID.md << EOF
# Story Integration: $STORY_ID

## JIRA Links
- **Epic**: To be created

## Sync Status
- **JIRA**: Not yet created

## Created
$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF

        echo "✅ Created integration record: docs/integrations/$STORY_ID.md"
    fi
done
```

### 4. Log Activity

```bash
# Log to integration log
echo "$(date -u +"%Y-%m-%dT%H:%M:%SZ") - Post-PRD hook: Created integration records for stories" >> logs/integration.log
```

### 5. Display Summary

```markdown
## Post-PRD Integration Summary

✅ PRD validation passed
✅ Integration records created
📊 Ready for JIRA Epic creation

Next steps:
1. /aw-integrate-link s01 EPIC-100 jira
2. /aw-integrate-link s02 EPIC-100 jira
3. Continue with /aw-stories
```

## Error Handling

### JIRA Token Not Set

```markdown
## Error: JIRA token not configured

Please set environment variables:

export JIRA_API_URL="https://your-company.atlassian.net"
export JIRA_API_TOKEN="your-base64-encoded-token"
export JIRA_EMAIL="your-email@company.com"

Then run: /aw-integrate-configure
```

### PRD Not Found

```markdown
## Error: PRD file not found

Please create PRD first: /aw-prd <target>
```

## Usage

Run this hook automatically after PRD creation:

```bash
# Manual execution
./src/hooks/post-prd/00-integration-prd.md

# Automatic execution
/aw-prd "my-feature"
# Hook runs automatically after PRD creation
```

## Related Commands

- `/aw-integrate-configure` — Configure JIRA
- `/aw-integrate-link` — Link stories to Epics
- `/aw-stories` — Create stories from PRD