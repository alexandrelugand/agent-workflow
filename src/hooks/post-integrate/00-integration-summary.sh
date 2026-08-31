#!/bin/bash
# Post-integration hook
# Run after integration operations

set -e

echo ""
echo "📊 Integration Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check configuration status
if [ -f "src/config/integrations.yaml" ]; then
    echo "Configuration:"
    grep -A5 "^integrations:" src/config/integrations.yaml | grep "enabled: true" && echo "  ✅ All integrations enabled" || echo "  ⚠️  Some integrations disabled"
    echo ""
fi

# List integration files
if [ -d "docs/integrations" ]; then
    echo "Integration Files:"
    find docs/integrations -name "*.md" -type f | while read -r file; do
        echo "  📄 $(basename $file)"
    done
    echo ""
fi

# Check recent activity
if [ -d "logs" ] && [ -f "logs/integration.log" ]; then
    echo "Recent Activity:"
    tail -n 10 logs/integration.log | grep -E "Linked|Created|Updated" | while read -r line; do
        echo "  📝 $line"
    done
    echo ""
fi

# Check for errors
if [ -d "logs" ] && [ -f "logs/integration.log" ]; then
    ERROR_COUNT=$(grep -c "ERROR" logs/integration.log 2>/dev/null || echo 0)
    if [ "$ERROR_COUNT" -gt 0 ]; then
        echo "⚠️  Found $ERROR_COUNT errors in integration log"
        echo "   Check logs/integration.log for details"
    else
        echo "✅ No errors in integration log"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "For detailed logs: tail -f logs/integration.log"
echo ""

exit 0