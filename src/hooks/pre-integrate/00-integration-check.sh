#!/bin/bash
# Pre-integration hook
# Run before integration operations

set -e

echo "🔍 Running pre-integration checks..."

# Check if integrations.yaml exists
if [ ! -f "src/config/integrations.yaml" ]; then
    echo "❌ Error: Integration configuration file not found"
    echo "   Please run /aw-integrate-configure to create it"
    exit 1
fi

# Check if integrations are enabled
if grep -q "enabled: false" src/config/integrations.yaml; then
    echo "⚠️  Warning: No integrations enabled in configuration"
    echo "   Enable integrations in src/config/integrations.yaml"
fi

# Check if integrations directory exists
if [ ! -d "docs/integrations" ]; then
    echo "⚠️  Warning: docs/integrations directory not found"
    echo "   Creating directory..."
    mkdir -p docs/integrations
fi

# Check if logs directory exists
if [ ! -d "logs" ]; then
    echo "⚠️  Warning: logs directory not found"
    echo "   Creating directory..."
    mkdir -p logs
fi

# Check environment variables for enabled integrations
ENABLED_INTEGRATIONS=()

if grep -q "jira:" src/config/integrations.yaml && \
   ! grep -A10 "jira:" src/config/integrations.yaml | grep -q "enabled: false"; then
    if [ -z "$JIRA_API_URL" ] || [ -z "$JIRA_API_TOKEN" ] || [ -z "$JIRA_EMAIL" ]; then
        echo "❌ Error: JIRA environment variables not set"
        echo "   Please set: JIRA_API_URL, JIRA_API_TOKEN, JIRA_EMAIL"
        exit 1
    fi
    ENABLED_INTEGRATIONS+=("JIRA")
fi

if grep -q "github:" src/config/integrations.yaml && \
   ! grep -A10 "github:" src/config/integrations.yaml | grep -q "enabled: false"; then
    if [ -z "$GITHUB_TOKEN" ]; then
        echo "❌ Error: GitHub environment variable not set"
        echo "   Please set: GITHUB_TOKEN"
        exit 1
    fi
    ENABLED_INTEGRATIONS+=("GitHub")
fi

if grep -q "telegram:" src/config/integrations.yaml && \
   ! grep -A10 "telegram:" src/config/integrations.yaml | grep -q "enabled: false"; then
    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_USER_ID" ]; then
        echo "❌ Error: Telegram environment variables not set"
        echo "   Please set: TELEGRAM_BOT_TOKEN, TELEGRAM_USER_ID"
        exit 1
    fi
    ENABLED_INTEGRATIONS+=("Telegram")
fi

if [ ${#ENABLED_INTEGRATIONS[@]} -eq 0 ]; then
    echo "ℹ️  No integrations enabled. Skipping integration checks."
    exit 0
fi

echo "✅ Pre-integration checks passed for: ${ENABLED_INTEGRATIONS[*]}"
echo ""

exit 0