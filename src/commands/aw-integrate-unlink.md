---
description: Unlink stories from JIRA/GitHub tickets
argument-hint: <story-id> <platform> (optional: jira|github)
allowed-tools:
  - Read
  - Write
  - AskUserQuestion
  - Glob
  - Bash
---

# aw-integrate-unlink — Unlink stories from JIRA/GitHub tickets

> Remove manual links between stories and external tickets

## Purpose

Remove links between story files and JIRA or GitHub tickets when manual linking is no longer needed.

## Usage

```bash
# Unlink story from JIRA
/aw-integrate-unlink s01 jira

# Unlink story from GitHub
/aw-integrate-unlink s01 github

# Unlink all story links
/aw-integrate-unlink s01 all
```

## Phase 1 — Validate Inputs

1. **Resolve story ID**:
   - Read `docs/stories.md`
   - Match story name to story ID
   - If no match, list available stories and stop

2. **Validate platform**:
   - `all`: Unlink from all platforms
   - `jira`: Unlink only JIRA links
   - `github`: Unlink only GitHub links

3. **Check if links exist**:
   - Read story documentation
   - Verify which links exist

## Phase 2 — Remove Links from Documentation

### For PRD Stories (docs/prd.md)

Remove JIRA links:

```markdown
## Stories

### Story s01 — User authentication
**As a** user **I want** to login with email/password **so that** I can access my account
**Status**: Planning

## Removed Links
- JIRA Epic: EPIC-100
- JIRA Requirement: REQ-1001
- GitHub Issue: ISS-1001
```

### For Design Stories (docs/stories.md)

Remove external IDs:

```markdown
## Story s01 — User authentication

**Description**:
As a user, I want to login with email/password so that I can access my account

**Acceptance Criteria**:
- [ ] Login validates credentials
- [ ] Returns JWT token on success
- [ ] Returns 401 on failure

**Status**: Planning

## Removed External Links
- JIRA: EPIC-100, REQ-1001, TASK-1001
- GitHub: ISS-1001
```

### For Integration Records

Delete `docs/integrations/<story-id>.md` or update to reflect no links.

## Phase 3 — Log Unlink

Log to `logs/integration.log`:

```
2026-08-31T10:30:00Z - Unlinked story s01 from JIRA
2026-08-31T10:32:00Z - Unlinked story s01 from GitHub
```

## Phase 4 — Display Summary

```markdown
## Integration Unlink Summary

**Story**: s01 — User authentication

### Unlinked from JIRA
- Epic: EPIC-100 ✅ Removed
- Requirement: REQ-1001 ✅ Removed
- Task: TASK-1001 ✅ Removed

### Unlinked from GitHub
- Issue: ISS-1001 ✅ Removed

### Integration Records
- docs/integrations/s01.md deleted

### Status
All links successfully removed
```

## Error Handling

### Story Not Found

```markdown
## Error: Story not found

Cannot find story matching "s01" in docs/stories.md

Available stories:
- s01-user-authentication
- s02-user-profile
- s03-data-export

Please specify the correct story ID.
```

### No Links Found

```markdown
## Warning: No links found

Story s01 has no JIRA or GitHub links

Nothing to unlink.
```

### Story Has Active PR

```markdown
## Error: Cannot unlink

Story s01 has an active PR (#42) that is not merged.

Please:
1. Merge or close PR #42 first
2. Unlink after PR is resolved

Current PR: https://github.com/org/repo/pull/42
```

## Verification

After unlinking:

1. **Check documentation**:
   ```bash
   grep -n "JIRA\|GitHub" docs/stories.md
   grep -n "JIRA\|GitHub" docs/prd.md
   ```

2. **Check integration file**:
   ```bash
   ls -la docs/integrations/s01.md
   ```

3. **Verify logs**:
   ```bash
   grep "Unlinked story s01" logs/integration.log
   ```

## Security Considerations

1. **Active PRs**: Never unlink stories with active PRs
2. **Merged PRs**: Only unlink after PR is merged and closed
3. **Production Issues**: Never unlink story if it's in production

## Best Practices

1. **Close PR first**: Always merge or close PR before unlinking
2. **Document changes**: Record what was unlinked
3. **Verify**: Confirm no references remain
4. **Update integration file**: Remove or update integration docs

## Undo Option

If unlink was accidental:

```bash
# Re-link the story
/aw-integrate-link s01 <ticket-id> <platform>

# Or restore from git
git checkout HEAD~1 -- docs/stories.md docs/prd.md docs/integrations/s01.md
```

## Examples

### Example 1: Full Unlink

```bash
/aw-integrate-unlink s01 all
```

Output:
```markdown
## Integration Unlink Summary

**Story**: s01 — User authentication

### Unlinked from JIRA
- Epic: EPIC-100 ✅ Removed
- Requirement: REQ-1001 ✅ Removed
- Task: TASK-1001 ✅ Removed

### Unlinked from GitHub
- Issue: ISS-1001 ✅ Removed

### Integration Records
- docs/integrations/s01.md deleted

### Status
All links successfully removed
```

### Example 2: JIRA Only

```bash
/aw-integrate-unlink s01 jira
```

Output:
```markdown
## Integration Unlink Summary

**Story**: s01 — User authentication

### Unlinked from JIRA
- Epic: EPIC-100 ✅ Removed
- Requirement: REQ-1001 ✅ Removed
- Task: TASK-1001 ✅ Removed

### GitHub Links
- Issue: ISS-1001 (kept)

### Status
JIRA links successfully removed
```

### Example 3: GitHub Only

```bash
/aw-integrate-unlink s01 github
```

Output:
```markdown
## Integration Unlink Summary

**Story**: s01 — User authentication

### JIRA Links
- Epic: EPIC-100 (kept)
- Requirement: REQ-1001 (kept)

### Unlinked from GitHub
- Issue: ISS-1001 ✅ Removed

### Status
GitHub link successfully removed
```

## Next Steps

After unlinking:
- Run `/aw-integrate-status` to verify
- Run `/aw-orchestrator` to execute stories (without external links)
- Monitor logs for any remaining references

## Related Commands

- `/aw-integrate-link` — Link story to tickets
- `/aw-integrate-status` — View integration status
- `/aw-integrate-configure` — Configure integrations