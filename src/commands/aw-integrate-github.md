---
description: Integrate agent-workflow with GitHub for issues and pull requests
argument-hint: <story-id> (optional for initial setup)
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - Glob
---

# GitHub Integration — agent-workflow

> Integrate agent-workflow with GitHub. Creates issues, branches, and pull requests.

## Purpose

Create GitHub issues and PRs to track work and automate development workflow.

## Input

- **GitHub Configuration**: Check `src/config/integrations.yml`
  - Verify `github.enabled: true`
  - Set API token, repo, default branch
- **Story ID** (optional): For linking specific stories to issues

## Workflow

### Phase 1: Validate Integration

1. Check `github.enabled: true` in `src/config/integrations.yml`
2. Verify environment variables:
   - `GITHUB_TOKEN`
   - `GITHUB_REPO`
   - `GITHUB_DEFAULT_BRANCH`

### Phase 2: Create GitHub Issues

#### For PRD Stories

1. **Read PRD** from `docs/prd.md`
2. **Extract stories** with acceptance criteria
3. **Create GitHub issues** for each story
4. **Save issue IDs** in `docs/prd.md`

Example:

```markdown
## Stories

### Story s01 — User authentication
**JIRA Epic**: EPIC-100
**GitHub Issue**: ISS-1001
```

#### For Architecture Features

1. **Read features** from `docs/architecture.md`
2. **Create issues** for each feature
3. **Link to stories**: Via issue description

Example issue:

```markdown
**Summary**: Implement user authentication system
**Story**: s01
**Labels**: #feature, #story-s01

**Body**:
- As a user, I want to login with email/password
- As a user, I want to reset my password
```

### Phase 3: Create Branches

During `/aw-execute`:

1. **Extract story ID** from `feature/<id>`
2. **Check if branch exists** locally
3. **Create branch** if needed

```bash
# Check out feature branch
git checkout -b feature/s01

# Or switch to existing branch
git checkout feature/s01

# Push to remote
git push origin feature/s01
```

### Phase 4: Create Pull Requests

During `/aw-ship`:

1. **Verify tests pass** on branch
2. **Get PR details**:
   - Number of commits
   - Files changed
   - Test results
3. **Create PR** with structured description
4. **Comment on related issues** with PR link

PR Template from `src/templates/pr-body.md`:

```markdown
## Pull Request: Feature s01 — User authentication

**Story**: s01
**JIRA**: EPIC-100
**GitHub Issue**: ISS-1001

---

## Summary
Implements user authentication system with JWT tokens.

## Changes
- ✅ Created `/api/auth` routes
- ✅ Implemented authentication middleware
- ✅ Added unit tests (coverage: 85%)
- ✅ Updated documentation

## Test Results
✅ Unit tests passing
✅ Integration tests passing

## Checklist
- [x] Code follows style guidelines
- [x] Tests pass
- [x] Documentation updated

## Related Issues
- GitHub: #1001
- JIRA: REQ-1001
```

## GitHub API Usage

```bash
# Auth header
AUTH="Bearer ${GITHUB_TOKEN}"

# Create issue
curl -X POST "https://api.github.com/repos/${GITHUB_REPO}/issues" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication",
    "body": "...",
    "labels": ["feature", "story-s01"]
  }'

# Create PR
curl -X POST "https://api.github.com/repos/${GITHUB_REPO}/pulls" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "feat(s01): implement user authentication",
    "head": "feature/s01",
    "base": "main",
    "body": "..."
  }'

# Comment on issue
curl -X POST "https://api.github.com/repos/${GITHUB_REPO}/issues/1001/comments" \
  -H "Authorization: ${AUTH}" \
  -H "Content-Type: application/json" \
  -d '{"body": "PR created: https://github.com/${GITHUB_REPO}/pull/42"}'
```

## Output Files

After integration:

1. **`docs/prd.md`** — GitHub issue IDs added to stories
2. **`docs/features/`** — GitHub issue IDs in feature files
3. **`docs/tasks/`** — GitHub issue IDs in task files
4. **`logs/github-integration.log`** — Integration history
5. **`.github/pull-requests/`** — Summary of created PRs

## Branch Naming Convention

Use `feature/<story-id>` format:

```
feature/s01
feature/s02
feature/s03
```

## Error Handling

If GitHub API fails:

1. Log error to `logs/github-integration.log`
2. Create fallback record in `docs/github-issues.md`
3. Note failure in story/task file:
   ```markdown
   ## GitHub Integration
   - Issue: ✅ ISS-1001 (created)
   - PR: ❌ Failed (API error) — manual PR creation recommended
   ```

## Verification

After integration:

1. Check GitHub UI for created issues
2. Verify PRs have correct description and links
3. Confirm labels are applied
4. Test issue ↔ PR linkage

## Next Steps

- `/aw-execute` — Use GitHub issue as task reference
- `/aw-ship` — Create PR and link to GitHub issue

## Example Usage

```
# Setup GitHub integration
/aw-integrate-github

# Link specific story
/aw-integrate-github s01
```