import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStatus, validateJira, previewJiraImport, importJiraStories, linkJiraStory, unlinkJiraStory, syncJiraLifecycle } from './integration-cli.mjs';

const env = { JIRA_API_URL: 'https://example.atlassian.net', JIRA_PROJECT_KEY: 'DEMO', JIRA_EMAIL: 'user@example.test', JIRA_API_TOKEN: 'synthetic-only' };
const config = 'integrations:\n  jira:\n    enabled: false\n    issue_type: "Story"\n';
const response = body => ({ ok: true, json: async () => body });

const activeConfig = 'integrations:\n  enabled: true\n  jira:\n    enabled: true\n    issue_type: "Story"\n    browse_base_url: ""\n    retry_attempts: 1\n    retry_delay: 0\n';
const storyMarkdown = `# Stories\n\n## Story s01-jira-setup — Jira setup\n\n**As a** maintainer **I want** a Jira setup story **so that** imports can refer to it.\n\n### Acceptance criteria\n- [x] Setup is verified.\n\n### Dependencies\nNone.\n\n## Story s02-jira-import — Import selected stories\n\n**As a** product owner **I want** to select a story **so that** only that story is imported.\n\n### Acceptance criteria\n- [x] Completed criterion text.\n- [ ] Pending criterion text.\n\n### Dependencies\n\`s01-jira-setup\`.\n\n## Story s03-jira-lifecycle — Jira lifecycle\n\n**As a** maintainer **I want** a later story **so that** it stays unrequested.\n`;
function importerFixture({ stories = storyMarkdown, record = null, dependencyRecord = null, config = activeConfig } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'aw-jira-import-cli-'));
  const worktree = join(root, '.worktrees', 's02-jira-import');
  mkdirSync(join(root, '.agent-workflow'), { recursive: true });
  mkdirSync(join(worktree, 'docs'), { recursive: true });
  writeFileSync(join(root, '.agent-workflow/integrations.yaml'), config);
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

test('confirmed Jira import converts Markdown to ADF without transferring checkbox state', async () => {
  const stories = storyMarkdown
    .replace('Completed criterion text', '**Completed** criterion *text* with `inline code` and ~~old wording~~')
    .replace('Pending criterion text', 'Pending [criterion link](https://example.test)');
  const fixture = importerFixture({ stories });
  let createBody;
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue') && options.method === 'POST') { createBody = JSON.parse(options.body); return jiraResponse({ key: 'DEMO-17' }); }
      if (url.includes('/issue/DEMO-17?')) return jiraResponse(jiraIssue('DEMO-17'));
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    const textNodes = [];
    const collectTextNodes = node => {
      if (node.type === 'text') textNodes.push(node);
      else for (const child of node.content || []) collectTextNodes(child);
    };
    collectTextNodes(createBody.fields.description);
    const visibleText = textNodes.map(node => node.text).join('');
    assert.match(visibleText, /Completed criterion text with inline code and old wording/);
    assert.match(visibleText, /Pending criterion link/);
    assert.doesNotMatch(visibleText, /\*\*|__|~~|`|\[[xX ]\]|\]\(/);
    assert.ok(textNodes.some(node => node.text === 'As a' && node.marks?.some(mark => mark.type === 'strong')));
    assert.ok(textNodes.some(node => node.text === 'Completed' && node.marks?.some(mark => mark.type === 'strong')));
    assert.ok(textNodes.some(node => node.text === 'inline code' && node.marks?.some(mark => mark.type === 'code')));
    assert.ok(textNodes.some(node => node.text === 'text' && node.marks?.some(mark => mark.type === 'em')));
    assert.ok(textNodes.some(node => node.text === 'old wording' && node.marks?.some(mark => mark.type === 'strike')));
    assert.ok(textNodes.some(node => node.text === 'criterion link' && node.marks?.some(mark => mark.type === 'link' && mark.attrs.href === 'https://example.test')));
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

test('per-story Epic overrides the global parent and reopens a completed Epic', async () => {
  const stories = storyMarkdown.replace(
    '### Dependencies\n`s01-jira-setup`.',
    '### Epic\nDEMO-42\n\n### Dependencies\n`s01-jira-setup`.'
  );
  const fixture = importerFixture({
    stories,
    config: activeConfig.replace('    issue_type: "Story"\n', '    issue_type: "Story"\n    epic_key: "DEMO-99"\n')
  });
  const requests = [];
  try {
    const preview = await previewJiraImport({ storyIds: ['s02-jira-import'], ...fixture.options, fetchImpl: async url => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(preview.stories[0].epicKey, 'DEMO-42');

    const fetchImpl = async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue/DEMO-42?fields=key,issuetype,project,status')) return jiraResponse({
        key: 'DEMO-42', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Epic' }, status: { name: 'Done', statusCategory: { key: 'done' } } }
      });
      if (url.endsWith('/issue') && options.method === 'POST') return jiraResponse({ key: 'DEMO-17' });
      if (url.endsWith('/issue/DEMO-17?fields=key,issuetype,project,issuelinks,parent')) {
        const issue = jiraIssue('DEMO-17');
        issue.fields.parent = { key: 'DEMO-42' };
        return jiraResponse(issue);
      }
      if (url.endsWith('/issue/DEMO-42/transitions') && options.method === 'POST') return jiraResponse({}, 204);
      if (url.endsWith('/issue/DEMO-42/transitions')) return jiraResponse({ transitions: [{ id: '42', to: { name: 'To Do' } }] });
      throw new Error('unexpected synthetic request');
    };
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl });
    const create = requests.find(request => request.url.endsWith('/issue') && request.options.method === 'POST');
    assert.deepEqual(JSON.parse(create.options.body).fields.parent, { key: 'DEMO-42' });
    assert.equal(requests.some(request => request.url.includes('DEMO-99')), false);
    assert.deepEqual(result.imported, [{ storyId: 's02-jira-import', key: 'DEMO-17', url: 'https://example.atlassian.net/browse/DEMO-17', epicKey: 'DEMO-42' }]);
    assert.deepEqual(result.epicReopened, [{ storyId: 's02-jira-import', epicKey: 'DEMO-42', status: 'To Do' }]);
    assert.deepEqual(result.failures, []);
    assert.equal(result.epicWarnings, undefined);
  } finally { fixture.clean(); }
});

test('existing Jira stories are not moved to a different selected Epic', async () => {
  const stories = storyMarkdown.replace(
    '### Dependencies\n`s01-jira-setup`.',
    '### Epic\nDEMO-42\n\n### Dependencies\n`s01-jira-setup`.'
  );
  const fixture = importerFixture({
    stories,
    record: '# Story Integration: s02-jira-import\n\n## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n'
  });
  const requests = [];
  try {
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('/issue/DEMO-17?fields=key,issuetype,project,issuelinks,parent')) {
        const issue = jiraIssue('DEMO-17');
        issue.fields.parent = { key: 'DEMO-99' };
        return jiraResponse(issue);
      }
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(result.imported[0].key, 'DEMO-17');
    assert.deepEqual(result.epicWarnings, [{ storyId: 's02-jira-import', epicKey: 'DEMO-42', reason: 'Existing Jira story was not moved to the selected Epic' }]);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.method, 'GET');
  } finally { fixture.clean(); }
});

test('Epic reopen failures warn without undoing the Jira story import', async () => {
  const stories = storyMarkdown.replace(
    '### Dependencies\n`s01-jira-setup`.',
    '### Epic\nDEMO-42\n\n### Dependencies\n`s01-jira-setup`.'
  );
  const fixture = importerFixture({ stories });
  try {
    const result = await importJiraStories({ storyIds: ['s02-jira-import'], confirm: true, ...fixture.options, fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      if (url.endsWith('/issue/DEMO-42?fields=key,issuetype,project,status')) return jiraResponse({
        key: 'DEMO-42', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Epic' }, status: { name: 'Done', statusCategory: { key: 'done' } } }
      });
      if (url.endsWith('/issue') && options.method === 'POST') return jiraResponse({ key: 'DEMO-17' });
      if (url.endsWith('/issue/DEMO-17?fields=key,issuetype,project,issuelinks,parent')) {
        const issue = jiraIssue('DEMO-17');
        issue.fields.parent = { key: 'DEMO-42' };
        return jiraResponse(issue);
      }
      if (url.endsWith('/issue/DEMO-42/transitions')) return jiraResponse({}, 403);
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(result.imported[0].key, 'DEMO-17');
    assert.deepEqual(result.failures, []);
    assert.deepEqual(result.epicWarnings, [{ storyId: 's02-jira-import', epicKey: 'DEMO-42', reason: 'Epic reopen failed (HTTP 403)' }]);
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

test('loads Jira credentials from consumer env files with mode and process precedence', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  const environmentKeys = ['AW_PROJECT_ROOT', 'NODE_ENV', 'JIRA_API_URL', 'JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
  const previous = new Map(environmentKeys.map(name => [name, process.env[name]]));
  try {
    for (const name of environmentKeys) delete process.env[name];
    const baseEnvironment = [
      'JIRA_API_URL=https://example.atlassian.net # shared site',
      'JIRA_PROJECT_KEY=BASE',
      'JIRA_EMAIL=base@example.test',
      'JIRA_API_TOKEN=base-token'
    ].join('\n');
    writeFileSync(join(fixture.root, '.env'), baseEnvironment);
    writeFileSync(join(fixture.root, '.env.development'), [
      'JIRA_PROJECT_KEY=DEVELOPMENT',
      'JIRA_EMAIL=development@example.test',
      'JIRA_API_TOKEN="development-token # quoted"'
    ].join('\n'));
    writeFileSync(join(fixture.root, '.env.production'), [
      'JIRA_PROJECT_KEY=DEMO',
      'JIRA_EMAIL=production@example.test',
      'JIRA_API_TOKEN="production-token # quoted"'
    ].join('\n'));
    const validate = async () => {
      const authorization = [];
      const result = await validateJira({ workingDirectory: fixture.worktree, fetchImpl: async (url, options) => {
        authorization.push(options.headers.Authorization);
        return response(url.endsWith('/myself') ? {} : { issueTypes: [{ name: 'Story' }] });
      } });
      return { result, authorization: authorization[0] };
    };

    const development = await validate();
    assert.equal(development.result.projectKey, 'DEVELOPMENT');
    assert.equal(development.authorization, `Basic ${Buffer.from('development@example.test:development-token # quoted').toString('base64')}`);

    process.env.NODE_ENV = 'production';
    const production = await validate();
    assert.equal(production.result.projectKey, 'DEMO');
    assert.equal(production.authorization, `Basic ${Buffer.from('production@example.test:production-token # quoted').toString('base64')}`);

    process.env.JIRA_PROJECT_KEY = 'PROCESS_OVERRIDE';
    const overridden = await validate();
    assert.equal(overridden.result.projectKey, 'PROCESS_OVERRIDE');
    assert.equal(overridden.authorization, production.authorization);

    delete process.env.NODE_ENV;
    delete process.env.JIRA_PROJECT_KEY;
    writeFileSync(join(fixture.root, '.env'), `NODE_ENV=production\n${baseEnvironment}`);
    const repositorySelected = await validate();
    assert.equal(repositorySelected.result.projectKey, 'DEMO');
    assert.equal(repositorySelected.authorization, production.authorization);

    const statusAuthorization = [];
    const status = await getStatus({ ...fixture.options, env: undefined, fetchImpl: async (url, options) => {
      statusAuthorization.push(options.headers.Authorization);
      return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Review' } } });
    } });
    assert.deepEqual(status.jira.stories, [{ storyId: 's02-jira-import', issueKey: 'DEMO-17', status: 'In Review' }]);
    assert.equal(statusAuthorization[0], repositorySelected.authorization);
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    fixture.clean();
  }
});

test('status action reports linked Jira issues as unavailable without requests when disabled', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  let requests = 0;
  try {
    writeFileSync(join(fixture.root, '.agent-workflow/integrations.yaml'), config);
    const status = await getStatus({ ...fixture.options, fetchImpl: async () => { requests++; throw new Error('unexpected request'); } });
    assert.deepEqual(status.jira, {
      enabled: false,
      configured: false,
      stories: [{ storyId: 's02-jira-import', issueKey: 'DEMO-17', status: 'unavailable', reason: 'Jira is disabled or incompletely configured' }]
    });
    assert.equal(requests, 0);
    assert.doesNotMatch(JSON.stringify(status), /api_url|synthetic-only|Authorization|https:\/\/example\.atlassian\.net/);
  } finally { fixture.clean(); }
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

test('status action fetches real Jira statuses without exposing links or configuration', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  const requests = [];
  try {
    const status = await getStatus({ ...fixture.options, fetchImpl: async url => {
      requests.push(url);
      return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Review' } } });
    } });
    assert.deepEqual(status.jira.stories, [{ storyId: 's02-jira-import', issueKey: 'DEMO-17', status: 'In Review' }]);
    assert.equal(requests.length, 1);
    assert.doesNotMatch(JSON.stringify(status), /api_url|synthetic-only|Authorization|https:\/\/example\.atlassian\.net/);
  } finally { fixture.clean(); }
});

test('status action marks an individual failed Jira fetch unavailable and continues', async () => {
  const fixture = importerFixture({
    record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n',
    dependencyRecord: '## Jira\n- Key: DEMO-1\n- URL: https://example.atlassian.net/browse/DEMO-1\n'
  });
  try {
    const status = await getStatus({ ...fixture.options, fetchImpl: async url => {
      if (url.includes('/issue/DEMO-1?')) return jiraResponse({ key: 'DEMO-1', fields: { project: { key: 'DEMO' }, status: { name: 'To Do' } } });
      return jiraResponse({ private: 'response body' }, 403);
    } });
    assert.deepEqual(status.jira.stories, [
      { storyId: 's01-jira-setup', issueKey: 'DEMO-1', status: 'To Do' },
      { storyId: 's02-jira-import', issueKey: 'DEMO-17', status: 'unavailable', reason: 'Jira status fetch failed' }
    ]);
    assert.doesNotMatch(JSON.stringify(status), /private|Authorization|synthetic-only/);
  } finally { fixture.clean(); }
});

test('status action reports ambiguous local Jira records without querying an issue', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- Key: DEMO-18\n' });
  let requests = 0;
  try {
    const status = await getStatus({ ...fixture.options, fetchImpl: async () => { requests++; throw new Error('unexpected request'); } });
    assert.deepEqual(status.jira.stories, [{ storyId: 's02-jira-import', issueKey: null, status: 'unavailable', reason: 'Local Jira link is invalid or ambiguous' }]);
    assert.equal(requests, 0);
  } finally { fixture.clean(); }
});

test('lifecycle action skips unlinked stories without Jira requests', async () => {
  const fixture = importerFixture();
  let requests = 0;
  try {
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'in_progress', ...fixture.options, fetchImpl: async () => { requests++; } });
    assert.deepEqual(result, { storyId: 's02-jira-import', skipped: true, reason: 'Story has no Jira link' });
    assert.equal(requests, 0);
  } finally { fixture.clean(); }
});

test('passing review marks a Story Done and completes its Epic when all child Stories are Done', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  let storyStatus = 'In Review';
  let epicStatus = 'In Progress';
  const posts = [];
  try {
    const story = jiraIssue('DEMO-17');
    story.fields.parent = { key: 'DEMO-99' };
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'done', ...fixture.options, fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/issue/DEMO-17?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse(story);
      if (url.endsWith('/issue/DEMO-99?fields=key,issuetype,project,status')) return jiraResponse({
        key: 'DEMO-99', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Epic' }, status: { name: epicStatus } }
      });
      if (url.endsWith('/issue/DEMO-17?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: storyStatus } } });
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [{
        key: 'DEMO-17', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Story' }, parent: { key: 'DEMO-99' }, status: { name: 'In Review' } }
      }], isLast: true });
      if (url.endsWith('/transitions')) {
        if (options.method === 'POST') {
          posts.push({ issue: url.includes('/DEMO-99/') ? 'DEMO-99' : 'DEMO-17', body: JSON.parse(options.body) });
          if (url.includes('/DEMO-99/')) epicStatus = 'Done';
          else storyStatus = 'Done';
          return jiraResponse({}, 204);
        }
        return jiraResponse({ transitions: [{ id: url.includes('/DEMO-99/') ? '99' : '17', to: { name: 'Done' } }] });
      }
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(result.synced, true);
    assert.deepEqual(result.transition, { transitioned: true });
    assert.deepEqual(result.epic, { key: 'DEMO-99', targetStatus: 'done', status: 'Done', transitioned: true });
    assert.deepEqual(posts, [
      { issue: 'DEMO-17', body: { transition: { id: '17' } } },
      { issue: 'DEMO-99', body: { transition: { id: '99' } } }
    ]);
  } finally { fixture.clean(); }
});

test('starting or resuming a Story moves its parent Epic to In Progress', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  let storyStatus = 'In Review';
  let epicStatus = 'Done';
  try {
    const story = jiraIssue('DEMO-17');
    story.fields.parent = { key: 'DEMO-99' };
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'in_progress', ...fixture.options, fetchImpl: async (url, options = {}) => {
      if (url.endsWith('/issue/DEMO-17?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse(story);
      if (url.endsWith('/issue/DEMO-99?fields=key,issuetype,project,status')) return jiraResponse({
        key: 'DEMO-99', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Epic' }, status: { name: epicStatus } }
      });
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: storyStatus } } });
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [{
        key: 'DEMO-17', fields: { project: { key: 'DEMO' }, issuetype: { name: 'Story' }, parent: { key: 'DEMO-99' }, status: { name: 'In Review' } }
      }], isLast: true });
      if (url.endsWith('/transitions')) {
        if (options.method === 'POST') {
          if (url.includes('/DEMO-99/')) epicStatus = 'In Progress';
          else storyStatus = 'In Progress';
          return jiraResponse({}, 204);
        }
        return jiraResponse({ transitions: [{ id: '17', to: { name: 'In Progress' } }] });
      }
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(result.synced, true);
    assert.equal(result.transition.transitioned, true);
    assert.deepEqual(result.epic, { key: 'DEMO-99', targetStatus: 'in_progress', status: 'In Progress', transitioned: true });
  } finally { fixture.clean(); }
});

test('review-complete Stories stay Done while their PR link moves from Open to Merged', async () => {
  const record = '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n';
  const fixture = importerFixture({ record });
  const linkBodies = [];
  let currentStatus = 'Done';
  try {
    const fetchImpl = async (url, options = {}) => {
      if (url.endsWith('?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' } } });
      if (url.endsWith('/remotelink')) { linkBodies.push(JSON.parse(options.body)); return jiraResponse({}, 201); }
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: currentStatus } } });
      if (url.endsWith('/transitions') && options.method === 'POST') { currentStatus = 'Done'; return jiraResponse({}, 204); }
      if (url.endsWith('/transitions')) return jiraResponse({ transitions: [{ id: '7', name: 'Complete', to: { name: 'Done' } }] });
      throw new Error('unexpected synthetic request');
    };
    const before = readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8');
    const open = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'done', pullRequestUrl: 'https://github.com/acme/repo/pull/42', ...fixture.options, fetchImpl });
    assert.equal(open.synced, true);
    assert.equal(open.transition.alreadyAtTarget, true);
    assert.equal(open.pullRequestLinked, true);
    const merged = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'done', pullRequestUrl: 'https://github.com/acme/repo/pull/42', merged: true, ...fixture.options, fetchImpl });
    assert.equal(merged.synced, true);
    assert.equal(merged.transition.alreadyAtTarget, true);
    assert.equal(linkBodies.length, 2);
    assert.equal(linkBodies[0].globalId, linkBodies[1].globalId);
    assert.equal(linkBodies[0].object.status.resolved, false);
    assert.equal(linkBodies[1].object.status.resolved, true);
    assert.equal(readFileSync(join(fixture.worktree, 'docs/integrations/s02-jira-import.md'), 'utf8'), before);
  } finally { fixture.clean(); }
});

test('lifecycle action warns on PR-link failure but still attempts its status transition', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  const requests = [];
  try {
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'in_review', pullRequestUrl: 'https://github.com/acme/repo/pull/42', ...fixture.options, fetchImpl: async (url, options = {}) => {
      if (url.endsWith('?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' } } });
      requests.push({ url, options });
      if (url.endsWith('/remotelink')) return jiraResponse({}, 403);
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'To Do' } } });
      if (url.endsWith('/transitions') && options.method === 'POST') return jiraResponse({}, 204);
      return jiraResponse({ transitions: [{ id: '8', to: { name: 'In Review' } }] });
    } });
    assert.equal(result.synced, false);
    assert.equal(result.transition.transitioned, true);
    assert.deepEqual(result.warnings, ['Jira PR link failed (HTTP 403)']);
    assert.ok(requests.some(request => request.url.endsWith('/transitions') && request.options.method === 'POST'));
  } finally { fixture.clean(); }
});

test('lifecycle action records a PR link and continues when the Jira transition fails', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  try {
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'in_review', pullRequestUrl: 'https://github.com/acme/repo/pull/42', ...fixture.options, fetchImpl: async (url, options = {}) => {
      if (url.endsWith('?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' } } });
      if (url.endsWith('/remotelink')) return jiraResponse({}, 201);
      return jiraResponse({}, 403);
    } });
    assert.equal(result.pullRequestLinked, true);
    assert.deepEqual(result.warnings, ['Jira status transition failed (HTTP 403)']);
    assert.equal(result.synced, false);
  } finally { fixture.clean(); }
});

test('invalid pull-request URL warns but does not block review-complete Done', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  const requests = [];
  try {
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'done', pullRequestUrl: 'https://github.com/acme/repo/issues/42', ...fixture.options, fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('?fields=key,issuetype,project,issuelinks,parent')) return jiraResponse(jiraIssue('DEMO-17'));
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Review' } } });
      if (url.endsWith('/transitions') && options.method === 'POST') return jiraResponse({}, 204);
      if (url.endsWith('/transitions')) return jiraResponse({ transitions: [{ id: '17', to: { name: 'Done' } }] });
      throw new Error('unexpected synthetic request');
    } });
    assert.equal(result.synced, false);
    assert.deepEqual(result.transition, { transitioned: true });
    assert.equal(result.pullRequestLinked, false);
    assert.deepEqual(result.warnings, ['Jira PR link failed (invalid HTTPS pull request URL)']);
    assert.equal(requests.some(request => request.url.endsWith('/remotelink')), false);
  } finally { fixture.clean(); }
});

test('lifecycle action treats unconfigured blocked status as a normal skip', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  let requests = 0;
  try {
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'blocked', ...fixture.options, fetchImpl: async () => { requests++; throw new Error('unexpected request'); } });
    assert.deepEqual(result, {
      storyId: 's02-jira-import', issueKey: 'DEMO-17', targetStatus: 'blocked', synced: false,
      transition: { transitioned: false }, skipped: true, reason: 'blocked status is not configured'
    });
    assert.equal(requests, 0);
  } finally { fixture.clean(); }
});

test('lifecycle action remains request-free when Jira is disabled', async () => {
  const fixture = importerFixture({ record: '## Jira\n- Key: DEMO-17\n- URL: https://example.atlassian.net/browse/DEMO-17\n' });
  let requests = 0;
  try {
    writeFileSync(join(fixture.root, '.agent-workflow/integrations.yaml'), config);
    const result = await syncJiraLifecycle({ storyId: 's02-jira-import', status: 'in_progress', ...fixture.options, fetchImpl: async () => { requests++; throw new Error('unexpected request'); } });
    assert.deepEqual(result, { storyId: 's02-jira-import', issueKey: 'DEMO-17', skipped: true, reason: 'Jira is disabled or incompletely configured' });
    assert.equal(requests, 0);
  } finally { fixture.clean(); }
});
