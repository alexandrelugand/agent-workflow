---
name: github-adapter
description: Create GitHub issues and pull requests for agent-workflow stories and tasks. Integrates with GitHub.
---

# GitHub Adapter Skill

You create GitHub issues and PRs to track work and automate merging. Use during execution and shipping phases.

## Configuration

Read `src/config/integrations.yml` for project configuration:
- `api_url`: GitHub API endpoint
- `personal_access_token`: PAT with repo permissions
- `repo`: Repository identifier (e.g., "org/repo")
- `default_branch`: Target branch for PRs
- `issue_prefix`: Prefix for GitHub issues (ISS-)

## Workflow

### Step 1: Create Issues for Stories

During PRD and architecture phases:

1. **Read stories** from `docs/stories.md`
2. **Extract features** from each story
3. **Create GitHub issues** linked to stories

Example issue creation:

```markdown
# GitHub Issue for Story s01

## Story Reference
- **Story**: s01 — User authentication
- **JIRA Epic**: EPIC-100

## Issue
**Title**: Implement user authentication
**Body**:
```markdown
## Story s01 — User authentication

**As a** user **I want** to login with email/password **so that** I can access my account

## Acceptance Criteria
- [ ] Login validates credentials
- [ ] Returns JWT token on success
- [ ] Returns 401 on failure

## Plan
See docs/plans/s01.md

## Tests
Run tests: `npm test -- --testNamePattern=authentication`

## Reviews
See docs/reviews/s01.md
```

**Labels**: #feature, #story-s01, #epic-100
**Milestone**: Feature Set 1
```

### Step 2: Create Branches for Stories

During Execute phase:

1. **Extract story ID** from branch name (`feature/<id>`)
2. **Create Git branch** from `default-branch`
3. **Push branch** to remote

```bash
git checkout -b feature/s01
git push origin feature/s01
```

### Step 3: Create Pull Requests

During Ship phase:

1. **Verify tests pass** on branch
2. **Create PR** with structured description
3. **Link to issues** referenced in story
4. **Add checklists** for reviewers

PR Template:

```markdown
## Pull Request: Feature s01 — User authentication

**Story**: s01
**JIRA**: EPIC-100 / REQ-1001
**GitHub Issue**: ISS-1001

---

## Summary
Implements user authentication system with JWT tokens and password hashing.

## Changes
- ✅ Created `/api/auth` routes
- ✅ Implemented JWT authentication middleware
- ✅ Added password validation
- ✅ Added unit tests (coverage: 85%)
- ✅ Updated documentation

## Test Results
```
PASS tests/auth.test.js
  ✓ Login should validate credentials (5ms)
  ✓ Login should return JWT token (3ms)
  ✗ Login should return 401 on failure (2ms)
```

## Checklist
- [x] Code follows style guidelines
- [x] Self-review completed
- [x] Tests pass with new changes
- [x] Commit message follows convention
- [x] Documentation updated

## Related Issues
- GitHub: #1001
- JIRA: REQ-1001

---

**Story status**: Done
**Implemented by**: agent-workflow (Development Agent)
```

PR body structure from template `src/templates/pr-body.md`:

```markdown
## PR Details

### Story Reference
- **Story ID**: s01
- **JIRA Epic**: EPIC-100
- **JIRA Requirement**: REQ-1001

### Changes Summary
<bullet points of changes>

### Technical Details
- **Branch**: feature/s01
- **Base**: main
- **Changes**: X files changed

### Tests
- Unit tests: ✅ Passing
- Integration tests: ✅ Passing
- Coverage: 85%

### Documentation
- Updated README.md
- Added API documentation

### Deployment
- [ ] Staging environment
- [ ] Production environment
- [ ] Database migration run
```

### Step 4: Link Issues to PR

After PR is created:

1. **Find linked issues** via PR body regex
2. **Comment on issues** with PR link

```bash
# Comment on GitHub issues
curl -X POST "https://api.github.com/repos/{repo}/issues/{issue_number}/comments" \
  -H "Authorization: Bearer {token}" \
  -d '{"body": "PR created: https://github.com/{repo}/pull/{pr_number}"}'
```

## GitHub API Usage

```bash
# Create issue
POST /repos/{owner}/{repo}/issues
Authorization: Bearer {token}
Body: {
  "title": "Implement user authentication",
  "body": "...",
  "labels": ["feature", "story-s01"],
  "milestone": "Feature Set 1"
}

# Get PR
GET /repos/{owner}/{repo}/pulls/{pull_number}

# Close issue
PATCH /repos/{owner}/{repo}/issues/{issue_number}
Body: {"state": "closed"}

# Comment on issue
POST /repos/{owner}/{repo}/issues/{issue_number}/comments
```

## Error Handling

If GitHub API fails:
1. Log error with details
2. Document in `docs/notes/github-integration-failures.md`
3. Continue with markdown tracking
4. Manually create issues/PRs later

## Best Practices

- Always link PRs to their story issues
- Use descriptive PR titles matching commit messages
- Include test results in PR description
- Tag reviewers appropriately
- Reference related issues in PR body
- Use status checks (CI) before merging

## Output

Update story files with GitHub references:

```markdown
## GitHub References
- Issue: ISS-1001
- PR: #42
- Branch: feature/s01
- Status: merged
```

## Verification

After PR creation:
1. Verify PR appears in GitHub UI
2. Check PR has correct description
3. Confirm all labels are applied
4. Verify status checks pass (if configured)
5. Test PR link in related issues