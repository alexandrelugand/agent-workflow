import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStatus, validateJira, previewJiraImport, importJiraStories, linkJiraStory, unlinkJiraStory } from './integration-cli.mjs';

const env = { JIRA_API_URL: 'https://example.atlassian.net', JIRA_PROJECT_KEY: 'DEMO', JIRA_EMAIL: 'user@example.test', JIRA_API_TOKEN: 'synthetic-only' };
const config = 'integrations:\n  jira:\n    enabled: false\n    issue_type: "Story"\n';
const response = body => ({ ok: true, json: async () => body });

const activeConfig = 'integrations:\n  enabled: true\n  jira:\n    enabled: true\n    issue_type: "Story"\n    browse_base_url: ""\n    retry_attempts: 1\n    retry_delay: 0\n';
const storyMarkdown = `# Stories\n\n## Story s01-jira-setup — Jira setup\n\n**As a** maintainer **I want** a Jira setup story **so that** imports can refer to it.\n\n### Acceptance criteria\n- [x] Setup is verified.\n\n### Dependencies\nNone.\n\n## Story s02-jira-import — Import selected stories\n\n**As a** product owner **I want** to select a story **so that** only that story is imported.\n\n### Acceptance criteria\n- [x] Completed criterion text.\n- [ ] Pending criterion text.\n\n### Dependencies\n\`s01-jira-setup\`.\n\n## Story s03-jira-lifecycle — Jira lifecycle\n\n**As a** maintainer **I want** a later story **so that** it stays unrequested.\n`;
function importerFixture({ stories = storyMarkdown, record = null, dependencyRecord = null } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aw-jira-import-cli-'));
  const worktree = join(root, '.worktrees', 's02-jira-import');
  mkdirSync(join(root, '.agent-workflow'), { recursive: true });
  mkdirSync(join(worktree, 'docs'), { recursive: true });
  writeFileSync(join(root, '.agent-workflow/integrations.yaml'), activeConfig);
  writeFileSync(join(worktree, 'docs/stories.md'), stories);
  if (record !== null || dependencyRecord !== null) mkdirSync(join(worktree, 'docs/integrations'), { recursive: true });
  if (record !== null) writeFileSync(join(worktree, 'docs/integrations/s02-jira-import.md'), record);
  if (dependencyRecord !== null) writeFileSync(join(worktree, 'docs/integrations/s01-jira-setup.md'), dependencyRecord);
  return {
    root, worktree,
    options: { workingDirectory: worktree, consumerRoot: root, env },
    clean: () => rmSync(root, { recursive: true, force: true })
  };
}
const jiraResponse = (body, status = 200, headers = new Headers()) => ({ ok: status >= 200 && status < 300, status, headers, json: async () => body });
const jiraIssue = (key, links = []) => ({ key, fields: { project: { key: 'DEMO' }, issuetype: { name: 'Story' }, issuelinks: links } });
const markerMatch = storyId => ({ key: 'DEMO-17', fields: { labels: [`aw-story-${storyId}`], project: { key: 'DEMO' }, issuetype: { name: 'Story' } } });

test('Jira preview rejects fuzzy or absent IDs before making requests', async () => {
  const fixture = importerFixture();
  let requests = 0;
  try {
    const options = { ...fixture.options, fetchImpl: async () => { requests++; return jiraResponse({ issues: [], isLast: true }); } };
    await assert.rejects(previewJiraImport({ storyIds: ['s02'], ...options }), /Invalid story ID/);
    await assert.rejects(previewJiraImport({ storyIds: ['s99-not-listed'], ...options }), /was not found/);
    const duplicateFixture = importerFixture({ stories: `${storyMarkdown}\n## Story s02-jira-import — duplicate\n` });
    try { await assert.rejects(previewJiraImport({ storyIds: ['s02-jira-import'], ...duplicateFixture.options, fetchImpl: options.fetchImpl }), /appears more than once/); }
    finally { duplicateFixture.clean(); }
    assert.equal(requests, 0);
  } finally { fixture.clean(); }
});

test('confirmed Jira import sends criterion text without transferring checkbox state', async () => {
  const fixture = importerFixture();
  let createBody;
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') { createBody = JSON.parse(options.body); return jiraResponse({ key: 'DEMO-17' }); }
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    const adf = JSON.stringify(createBody.fields.description);
    assert.match(adf, /Completed criterion text/);
    assert.match(adf, /Pending criterion text/);
    assert.doesNotMatch(adf, /\[[x ]\]/);
    assert.deepEqual(result.failures, []);
  } finally { fixture.clean(); }
});

test('Jira preview reads only explicit stories and performs no create or link writes', async () => {
  const fixture = importerFixture();
  const requests = [];
  try {
    const preview = await previewJiraImport({ storyIds: ['s02-jira-import'], ...fixture.options, fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return jiraResponse({ issues: [], isLast: true });
    } });
    assert.equal(preview.preview, true);
    assert.deepEqual(preview.stories.map(story => story.storyId), ['s02-jira-import']);
    assert.equal(preview.stories[0].action, 'create');
    assert.equal(requests.length, 1);
    assert.equal(requests.some(request => /\/issue(?:Link)?$/.test(request.url)), false);
    assert.equal(existsSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md')), false);
  } finally { fixture.clean(); }
});

test('unconfirmed Jira import cancels without changing Jira or local records', async () => {
  const fixture = importerFixture();
  const writes = [];
  try {
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], ...fixture.options, fetchImpl: async (url, options) => {
      if (options.method === 'POST' && !url.endsWith('/search/jql')) writes.push(url);
      return jiraResponse({ issues: [], isLast: true });
    } });
    assert.equal(result.cancelled, true);
    assert.equal(writes.length, 0);
    assert.equal(existsSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md')), false);
  } finally { fixture.clean(); }
});

test('confirmed Jira import creates exactly the selected story and writes its key and browse URL', async () => {
  const fixture = importerFixture();
  const posts = [];
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') { posts.push(JSON.parse(options.body)); return jiraResponse({ key: 'DEMO-17' }); }
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    const record = readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8');
    assert.equal(posts.length, 1);
    assert.equal(result.imported.length, 1);
    assert.match(record, /- Key: DEMO-17/);
    assert.match(record, /- URL: https:\/\/example\.atlassian\.net\/browse\/DEMO-17/);
    assert.equal(existsSync(join(fixture.worktree, 'docs/integrations/s03-jira-lifecycle.md')), false);
  } finally { fixture.clean(); }
});

test('confirmed import reconciles one pending marker match without creating another issue', async () => {
  const fixture = importerFixture();
  const pendingDirectory = join(fixture.root, '.agent-workflow', 'jira-import-pending');
  mkdirSync(pendingDirectory, { recursive: true });
  writeFileSync(join(pendingDirectory, 's02-jira-import.json'), JSON.stringify({ storyId: 's02-jira-import', label: 'aw-story-s02-jira-import', createdAt: '2026-01-01T00:00:00.000Z' }));
  const posts = [];
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [markerMatch('s02-jira-import')], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') { posts.push(url); return jiraResponse({ key: 'DEMO-99' }); }
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    assert.equal(result.imported[0].key, 'DEMO-17');
    assert.equal(posts.length, 0);
    assert.equal(existsSync(join(pendingDirectory, 's02-jira-import.json')), false);
  } finally { fixture.clean(); }
});

test('Jira import preserves GitHub and unrelated integration record data', async () => {
  const fixture = importerFixture({ record: '# Story Integration: s02-jira-import\n\n## GitHub\n- Issue: #22\n\n## Notes\nKeep this data.\n' });
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') return jiraResponse({ key: 'DEMO-17' });
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      throw new Error('unexpected synthetic request');
    };
    await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    const record = readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8');
    assert.match(record, /## GitHub\n- Issue: #22/);
    assert.match(record, /## Notes\nKeep this data/);
    assert.match(record, /## Jira\n- Key: DEMO-17/);
  } finally { fixture.clean(); }
});

test('manual Jira link validates one configured issue and is idempotent', async () => {
  const fixture = importerFixture();
  const pendingDirectory = join(fixture.root, '.agent-workflow', 'jira-import-pending');
  mkdirSync(pendingDirectory, { recursive: true });
  const pendingPath = join(pendingDirectory, 's02-jira-import.json');
  writeFileSync(pendingPath, JSON.stringify({ storyId: 's02-jira-import', label: 'aw-story-s02-jira-import', createdAt: '2026-01-01T00:00:00.000Z' }));
  let issueReads = 0;
  try {
    const fetchImpl = async url => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [markerMatch('s02-jira-import')], isLast: true });
      issueReads++;
      return jiraResponse(jiraIssue('DEMO-17'));
    };
    await assert.rejects(linkJiraStory({ storyId: 's02-jira-import', issueKey: 'DEMO-18', ...fixture.options, fetchImpl }), /not matched to the linked issue/);
    assert.equal(existsSync(pendingPath), true);
    assert.equal(issueReads, 0);
    await linkJiraStory({ storyId: 's02-jira-import', issueKey: 'DEMO-17', ...fixture.options, fetchImpl });
    assert.equal(existsSync(pendingPath), false);
    await linkJiraStory({ storyId: 's02-jira-import', issueKey: 'DEMO-17', ...fixture.options, fetchImpl });
    const record = readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8');
    assert.equal(issueReads, 2);
    assert.equal((record.match(/Key: DEMO-17/g) || []).length, 1);
    await assert.rejects(linkJiraStory({ storyId: 's02-jira-import', issueKey: 'DEMO-18', ...fixture.options, fetchImpl }), /already linked to DEMO-17/);
    assert.equal(issueReads, 2);
  } finally { fixture.clean(); }
});

test('manual Jira unlink removes only the local Jira reference and makes no request', async () => {
  const fixture = importerFixture({ record: '# Story Integration: s02-jira-import\n\n## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n\n## GitHub\n- Issue: #22\n' });
  let requests = 0;
  try {
    const result = await unlinkJiraStory({ storyId: 's02-jira-import', ...fixture.options, fetchImpl: async () => { requests++; } });
    const recordPath = join(fixture.worktree, 'docs/integrations/s02-jira-import.md');
    const record = readFileSync(recordPath, 'utf8');
    assert.equal(result.unlinked, true);
    assert.equal(result.remoteIssueDeleted, false);
    assert.equal(requests, 0);
    assert.equal(existsSync(recordPath), true);
    assert.doesNotMatch(record, /## Jira|DEMO-17/);
    assert.match(record, /## GitHub\n- Issue: #22/);
  } finally { fixture.clean(); }
});

test('dependency link failures are reported without losing the imported Jira record', async () => {
  const fixture = importerFixture({ dependencyRecord: '# Story Integration: s01-jira-setup\n\n## Jira\n- Key: DEMO-8\n- URL: https://example.atlassian.net/browse/DEMO-8\n' });
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') return jiraResponse({ key: 'DEMO-17' });
      if (url.endsWith('/issueLinkType')) return jiraResponse({ issueLinkTypes: [{ name: 'Blocks', inward: 'Blocked by', outward: 'Blocks' }] });
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      if (url.endsWith('/issueLink')) return jiraResponse({}, 403);
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    assert.equal(result.imported[0].key, 'DEMO-17');
    assert.deepEqual(result.dependencyFailures, [{ blockedStory: 's02-jira-import', dependency: 's01-jira-setup', reason: 'Issue-link permission denied' }]);
    assert.match(readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8'), /Key: DEMO-17/);
  } finally { fixture.clean(); }
});

test('validates identity and exact project issue type', async () => {
  const requests = [];
  const result = await validateJira({ env, config, fetchImpl: async (url, options) => { requests.push([url, options]); return response(url.endsWith('/myself') ? { accountId: 'user' } : { issueTypes: [{ name: 'Story' }] }); } });
  assert.deepEqual(result, { valid: true, projectKey: 'DEMO', issueType: 'Story' });
  assert.equal(requests.length, 2);
  assert.ok(requests.every(([, options]) => options.redirect === 'error'));
});
test('reports absent environment variable names without values', async () => {
  await assert.rejects(validateJira({ env: {}, config, fetchImpl: async () => { throw new Error('unexpected'); } }), /JIRA_API_URL, JIRA_PROJECT_KEY, JIRA_EMAIL, JIRA_API_TOKEN/);
});
test('rejects non Jira, non HTTPS, credential-bearing, and nonstandard-port URLs before request', async () => {
  for (const JIRA_API_URL of ['https://example.invalid', 'http://example.atlassian.net', 'https://user:pass@example.atlassian.net', 'https://example.atlassian.net:8443']) {
    await assert.rejects(validateJira({ env: { ...env, JIRA_API_URL }, config, fetchImpl: async () => { throw new Error('unexpected'); } }), /approved HTTPS Jira Cloud/);
  }
});
test('validates scoped token base URL', async () => {
  const urls = [];
  await validateJira({ env: { ...env, JIRA_API_URL: 'https://api.atlassian.com/ex/jira/cloud-id-123' }, config, fetchImpl: async url => { urls.push(url); return response(url.endsWith('/myself') ? {} : { issueTypes: [{ name: 'Story' }] }); } });
  assert.equal(urls[0], 'https://api.atlassian.com/ex/jira/cloud-id-123/rest/api/3/myself');
});
test('matches complete multiword issue type exactly', async () => {
  const multiword = 'integrations:\n  jira:\n    issue_type: "Service Request"\n';
  await assert.rejects(validateJira({ env, config: multiword, fetchImpl: async url => response(url.endsWith('/myself') ? {} : { issueTypes: [{ name: 'Service' }] }) }), /issue type is unavailable/);
  const result = await validateJira({ env, config: multiword, fetchImpl: async url => response(url.endsWith('/myself') ? {} : { issueTypes: [{ name: 'Service Request' }] }) });
  assert.equal(result.issueType, 'Service Request');
});
test('loads shared consumer config when called from a story worktree', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aw-consumer-'));
  const worktree = join(root, '.worktrees', 's01-jira-setup');
  try {
    mkdirSync(join(root, '.agent-workflow'), { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(root, '.agent-workflow/integrations.yaml'), config);
    const result = await validateJira({ env, workingDirectory: worktree, fetchImpl: async url => response(url.endsWith('/myself') ? {} : { issueTypes: [{ name: 'Story' }] }) });
    assert.equal(result.valid, true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('status action returns only safe summary fields from shared consumer config', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aw-status-root-'));
  const worktree = join(root, '.worktrees', 'story');
  try {
    mkdirSync(join(root, '.agent-workflow'), { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(root, '.agent-workflow/integrations.yaml'), 'integrations:\n  enabled: true\n  jira:\n    enabled: false\n');
    const status = await getStatus({ workingDirectory: worktree });
    assert.deepEqual(status.jira, { enabled: false, configured: false });
    assert.doesNotMatch(JSON.stringify(status), /api_url|token|email|Authorization/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('reports identity and project HTTP status without response details', async () => {
  await assert.rejects(validateJira({ env, config, fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'private response' }) }), /HTTP 401/);
  let count = 0;
  await assert.rejects(validateJira({ env, config, fetchImpl: async () => { count++; return count === 1 ? response({ accountId: 'user' }) : { ok: false, status: 403, text: async () => 'private response' }; } }), /HTTP 403/);
});
test('finds configured issue type on a later metadata page', async () => {
  const requests = [];
  const result = await validateJira({ env, config: 'integrations:\n  jira:\n    issue_type: "Service Request"\n', fetchImpl: async url => {
    requests.push(url);
    if (url.endsWith('/myself')) return response({ accountId: 'user' });
    const startAt = Number(new URL(url).searchParams.get('startAt'));
    if (startAt === 0) return response({ startAt: 0, maxResults: 50, total: 51, issueTypes: Array.from({ length: 50 }, (_, index) => ({ name: `Type ${index}` })) });
    return response({ startAt: 50, maxResults: 50, total: 51, issueTypes: [{ name: 'Service Request' }] });
  } });
  assert.equal(result.issueType, 'Service Request');
  assert.ok(requests.some(url => new URL(url).searchParams.get('startAt') === '50'));
});
