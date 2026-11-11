import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import IntegrationService from './integration-service.mjs';

const jiraConfig = (enabled, extra = '') => `integrations:\n  enabled: true\n  jira:\n    enabled: ${enabled}\n    project_key: "DEMO"\n    issue_type: "Story"\n    browse_base_url: ""\n    retry_attempts: 1\n    retry_delay: 0\n${extra}`;
const env = { JIRA_API_URL: 'https://example.atlassian.net', JIRA_PROJECT_KEY: 'DEMO', JIRA_EMAIL: 'user@example.test', JIRA_API_TOKEN: 'synthetic-only' };
function fixture(content) {
  const dir = mkdtempSync(join(tmpdir(), 'aw-jira-'));
  const path = join(dir, 'integrations.yaml');
  if (content !== undefined) writeFileSync(path, content);
  return { dir, path, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

const markerIssues = storyId => [{ key: 'DEMO-1', fields: { labels: [`aw-story-${storyId}`], project: { key: 'DEMO' }, issuetype: { name: 'Story' } } }];
const jiraResponse = (data, status = 200, headers = new Headers()) => ({ ok: status >= 200 && status < 300, status, headers, json: async () => data });
const jiraNoBody = (status = 201) => ({ ok: true, status, headers: new Headers() });
async function activeService(file, fetchImpl, options = {}) {
  const service = new IntegrationService(file.path, { environment: env, projectRoot: file.dir, fetch: fetchImpl, sleep: options.sleep });
  await service.init();
  return service;
}
const storyData = {
  storyId: 's02-jira-import', summary: 'Import selected stories',
  userStory: 'As a product owner, I can import a selected story.',
  acceptanceCriteria: ['[x] already done', '[ ] still open'],
  dependencies: ['s01-jira-setup']
};

test('missing config initializes with Jira inactive', async () => {
  const file = fixture();
  try { const service = new IntegrationService(file.path, { environment: env }); await service.init(); assert.equal(service.getIntegrationStatus().jira.enabled, false); }
  finally { file.clean(); }
});
test('disabled Jira performs no request', async () => {
  const file = fixture(jiraConfig(false)); let calls = 0;
  try {
    const service = new IntegrationService(file.path, { environment: env, fetch: async () => { calls++; } });
    await service.init();
    await assert.rejects(service.searchJiraStory('s02-jira-import'), /not enabled/);
    assert.equal(calls, 0);
  }
  finally { file.clean(); }
});
test('incomplete Jira performs no request', async () => {
  const file = fixture(jiraConfig(true)); let calls = 0;
  try {
    const service = new IntegrationService(file.path, { environment: {}, fetch: async () => { calls++; } });
    await service.init();
    await assert.rejects(service.searchJiraStory('s02-jira-import'), /not enabled/);
    assert.equal(calls, 0);
  }
  finally { file.clean(); }
});
test('status contains no credentials or provider config', async () => {
  const file = fixture(jiraConfig(true));
  try { const service = new IntegrationService(file.path, { environment: env }); await service.init(); const status = JSON.stringify(service.getIntegrationStatus()); assert.equal(status.includes(env.JIRA_API_TOKEN), false); assert.equal(status.includes('Authorization'), false); }
  finally { file.clean(); }
});
test('Jira initialization reads credentials only from environment', async () => {
  const file = fixture(jiraConfig(true));
  try { const service = new IntegrationService(file.path, { environment: env }); await service.init(); assert.equal(service.getIntegrationStatus().jira.enabled, true); }
  finally { file.clean(); }
});
test('enabled logging uses the default consumer-root log path without a configured filename', async () => {
  const file = fixture('integrations:\n  enabled: true\n  logging:\n    enabled: true\n');
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const service = new IntegrationService(file.path, { environment: {}, projectRoot: file.dir });
    await service.init();
    assert.equal(service.logFilePath.endsWith('/logs/integration.log') || service.logFilePath.endsWith('\\logs\\integration.log'), true);
    assert.equal(service.getIntegrationStatus().jira.enabled, false);
  } finally { console.log = originalLog; file.clean(); }
});
test('Jira errors and captured logs redact request and authorization data', async () => {
  const file = fixture(jiraConfig(true));
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const service = new IntegrationService(file.path, { environment: env, fetch: async () => { throw new Error('synthetic-only Authorization: Basic private'); } });
    await service.init();
    await assert.rejects(service.searchJiraStory('s02-jira-import'), error => !/synthetic-only|Authorization|private/.test(error.message));
    assert.doesNotMatch(logs.join('\n'), /synthetic-only|Authorization|private/);
  } finally { console.log = originalLog; file.clean(); }
});
test('default config resolves the shared consumer root from a nested worktree', async () => {
  const root = mkdtempSync(join(tmpdir(), 'aw-root-'));
  const nested = join(root, '.worktrees', 's01-jira-setup');
  const previous = process.cwd();
  try {
    mkdirSync(join(root, '.agent-workflow'), { recursive: true });
    mkdirSync(nested, { recursive: true });
    writeFileSync(join(root, '.agent-workflow/integrations.yaml'), jiraConfig(false));
    process.chdir(nested);
    const service = new IntegrationService();
    assert.equal(service.configPath, join(root, '.agent-workflow/integrations.yaml'));
  } finally { process.chdir(previous); rmSync(root, { recursive: true, force: true }); }
});

test('unapproved Jira host is rejected before authorization can be sent', async () => {
  const file = fixture(jiraConfig(true)); let calls = 0;
  try {
    const service = new IntegrationService(file.path, { environment: { ...env, JIRA_API_URL: 'https://attacker.invalid' }, fetch: async () => { calls++; } });
    await service.init();
    await assert.rejects(service.searchJiraStory('s02-jira-import'), /approved HTTPS Jira Cloud/);
    assert.equal(calls, 0);
  } finally { file.clean(); }
});

test('HTTP Jira status survives sanitized errors', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const service = new IntegrationService(file.path, { environment: env, fetch: async () => ({ ok: false, status: 403, text: async () => 'private-response' }) });
    await service.init();
    await assert.rejects(service.searchJiraStory('s02-jira-import'), error => error.status === 403 && /HTTP 403/.test(error.message) && !/private/.test(error.message));
  } finally { file.clean(); }
});

test('GitHub and Telegram provider errors never expose response or request data', async () => {
  const config = `integrations:\n  enabled: true\n  github:\n    enabled: true\n    api_url: "https://api.github.com"\n    personal_access_token: "synthetic-gh"\n    repo: "example/repo"\n    retry_attempts: 1\n  telegram:\n    enabled: true\n    bot_token: "synthetic-tg"\n    user_id: "123"\n`;
  const file = fixture(config);
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const service = new IntegrationService(file.path, { environment: {}, fetch: async () => ({ ok: false, status: 403, text: async () => 'provider-private-response' }) });
    await service.init();
    await assert.rejects(service.createGitHubIssue({ title: 'request-private', body: 'payload-private' }), error => error.status === 403 && !/private|synthetic/.test(error.message));
    await assert.rejects(service.sendTelegramNotification('task_completed', { description: 'payload-private' }), error => error.status === 403 && !/private|synthetic/.test(error.message));
    assert.doesNotMatch(logs.join('\n'), /provider-private-response|request-private|payload-private|synthetic-gh|synthetic-tg/);
  } finally { console.log = originalLog; file.clean(); }
});
test('GitHub and Telegram expand environment-backed credentials for requests only', async () => {
  const config = `integrations:\n  enabled: true\n  github:\n    enabled: true\n    api_url: "https://api.github.com"\n    repo: "example/repo"\n    retry_attempts: 1\n  telegram:\n    enabled: true\n`;
  const file = fixture(config);
  const requests = [];
  const environment = { GITHUB_TOKEN: 'synthetic-gh-env', TELEGRAM_BOT_TOKEN: 'synthetic-tg-env', TELEGRAM_USER_ID: '123' };
  try {
    const service = new IntegrationService(file.path, { environment, fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => url.includes('github.com') ? { number: 7 } : { message_id: 8 } };
    } });
    await service.init();
    await service.createGitHubIssue({ title: 'safe' });
    await service.sendTelegramNotification('task_completed', { task_id: 'task-1' });
    assert.ok(requests.some(request => request.options.headers.Authorization === 'Bearer synthetic-gh-env'));
    assert.ok(requests.some(request => request.url.includes('/botsynthetic-tg-env/sendMessage') && request.options.body.includes('"chat_id":"123"')));
    const status = JSON.stringify(service.getIntegrationStatus());
    assert.doesNotMatch(status, /synthetic-gh-env|synthetic-tg-env|Authorization/);
  } finally { file.clean(); }
});

test('global false with an inline comment keeps enabled Jira inactive', async () => {
  const file = fixture(`integrations:\n  enabled: false # integrations off\n  jira:\n    enabled: true\n    issue_type: "Story"\n`);
  let requests = 0;
  try {
    const service = new IntegrationService(file.path, { environment: env, fetch: async () => { requests++; } });
    await service.init();
    assert.equal(service.getIntegrationStatus().enabled, false);
    assert.equal(service.getIntegrationStatus().jira.enabled, false);
    await assert.rejects(service.searchJiraStory('s02-jira-import'), /not enabled/);
    assert.equal(requests, 0);
  } finally { file.clean(); }
});
test('environment-backed provider credential failures stay redacted', async () => {
  const config = `integrations:\n  enabled: true\n  github:\n    enabled: true\n    api_url: "https://api.github.com"\n    personal_access_token: "\${GITHUB_TOKEN}"\n    repo: "example/repo"\n    retry_attempts: 1\n  telegram:\n    enabled: true\n    bot_token: "\${TELEGRAM_BOT_TOKEN}"\n    user_id: "\${TELEGRAM_USER_ID}"\n`;
  const file = fixture(config);
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const service = new IntegrationService(file.path, { environment: { GITHUB_TOKEN: 'synthetic-gh-env', TELEGRAM_BOT_TOKEN: 'synthetic-tg-env', TELEGRAM_USER_ID: '123' }, fetch: async () => ({ ok: false, status: 401, text: async () => 'private-provider-body' }) });
    await service.init();
    await assert.rejects(service.createGitHubIssue({ title: 'private-request' }), error => error.status === 401 && !/synthetic|private/.test(error.message));
    await assert.rejects(service.sendTelegramNotification('task_completed', { description: 'private-request' }), error => error.status === 401 && !/synthetic|private/.test(error.message));
    assert.doesNotMatch(logs.join('\n'), /synthetic|private-provider-body|private-request/);
  } finally { console.log = originalLog; file.clean(); }
});
test('fresh installer config plus documented repo and token creates expected GitHub issue request', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'aw-template-github-'));
  const template = readFileSync(new URL('../config/integrations.yaml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
  const config = template.replace('repo: "owner/repository"', 'repo: "acme/workflow"').replace('enabled: false\n    api_url:', 'enabled: true\n    api_url:');
  const path = join(dir, 'integrations.yaml');
  writeFileSync(path, config);
  const requests = [];
  const logs = [];
  const originalLog = console.log;
  console.log = (...args) => logs.push(args.join(' '));
  try {
    const service = new IntegrationService(path, { environment: { GITHUB_TOKEN: 'synthetic-fresh-template-token' }, fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, json: async () => ({ number: 12 }) };
    } });
    await service.init();
    await service.createGitHubIssue({ title: 'Fresh setup' });
    assert.equal(requests[0].url, 'https://api.github.com/repos/acme/workflow/issues');
    assert.equal(requests[0].options.headers.Authorization, 'Bearer synthetic-fresh-template-token');
    assert.doesNotMatch(JSON.stringify(service.getIntegrationStatus()), /synthetic-fresh-template-token/);
    assert.doesNotMatch(logs.join('\n'), /synthetic-fresh-template-token|Authorization/);
  } finally { console.log = originalLog; rmSync(dir, { recursive: true, force: true }); }
});

test('Jira marker search distinguishes zero matches and sends exact enhanced JQL', async () => {
  const file = fixture(jiraConfig(true));
  const requests = [];
  try {
    const service = await activeService(file, async (url, options) => { requests.push({ url, options }); return jiraResponse({ issues: [], isLast: true }); });
    assert.deepEqual(await service.searchJiraStory('s02-jira-import'), []);
    assert.equal(requests[0].url, 'https://example.atlassian.net/rest/api/3/search/jql');
    assert.deepEqual(JSON.parse(requests[0].options.body), { jql: 'project = "DEMO" AND labels = "aw-story-s02-jira-import"', fields: ['key', 'labels', 'project', 'issuetype'], maxResults: 100 });
  } finally { file.clean(); }
});

test('Jira marker search returns one exact label match', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const service = await activeService(file, async () => jiraResponse({ issues: markerIssues('s02-jira-import'), isLast: true }));
    assert.deepEqual(await service.searchJiraStory('s02-jira-import'), [{ key: 'DEMO-1', projectKey: 'DEMO', issueType: 'Story' }]);
  } finally { file.clean(); }
});

test('Jira marker search preserves multiple exact matches for ambiguity handling', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const service = await activeService(file, async () => jiraResponse({ issues: [
      ...markerIssues('s02-jira-import'), { key: 'DEMO-2', fields: { labels: ['aw-story-s02-jira-import'], project: { key: 'DEMO' }, issuetype: { name: 'Story' } } }
    ], isLast: true }));
    assert.deepEqual(await service.searchJiraStory('s02-jira-import'), [
      { key: 'DEMO-1', projectKey: 'DEMO', issueType: 'Story' }, { key: 'DEMO-2', projectKey: 'DEMO', issueType: 'Story' }
    ]);
  } finally { file.clean(); }
});

test('Jira marker search follows every enhanced JQL page', async () => {
  const file = fixture(jiraConfig(true));
  const tokens = [];
  try {
    const service = await activeService(file, async (url, options) => {
      const body = JSON.parse(options.body); tokens.push(body.nextPageToken || null);
      return body.nextPageToken
        ? jiraResponse({ issues: markerIssues('s02-jira-import'), isLast: true })
        : jiraResponse({ issues: [], isLast: false, nextPageToken: 'page-2' });
    });
    assert.deepEqual(await service.searchJiraStory('s02-jira-import'), [{ key: 'DEMO-1', projectKey: 'DEMO', issueType: 'Story' }]);
    assert.deepEqual(tokens, [null, 'page-2']);
  } finally { file.clean(); }
});

test('story creation sends configured issue type, ADF, stable label, and optional parent after persisting intent', async () => {
  const file = fixture(jiraConfig(true, '    epic_key: "DEMO-99"\n'));
  const requests = [];
  try {
    const service = await activeService(file, async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      assert.equal(existsSync(join(file.dir, '.agent-workflow/jira-import-pending/s02-jira-import.json')), true);
      return jiraResponse({ key: 'DEMO-17' });
    });
    assert.deepEqual(await service.createJiraStory(storyData), { key: 'DEMO-17', url: 'https://example.atlassian.net/browse/DEMO-17', created: true });
    const payload = JSON.parse(requests[1].options.body);
    assert.equal(requests[1].options.method, 'POST');
    assert.equal(payload.fields.project.key, 'DEMO');
    assert.deepEqual(payload.fields.issuetype, { name: 'Story' });
    assert.equal(payload.fields.summary, storyData.summary);
    assert.deepEqual(payload.fields.labels, ['aw-story-s02-jira-import']);
    assert.deepEqual(payload.fields.parent, { key: 'DEMO-99' });
    assert.equal(payload.fields.description.type, 'doc');
    assert.equal(payload.fields.description.version, 1);
    const adf = JSON.stringify(payload.fields.description);
    assert.match(adf, /already done/);
    assert.match(adf, /still open/);
    assert.doesNotMatch(adf, /\[[x ]\]/);
    assert.match(adf, /s01-jira-setup/);
  } finally { file.clean(); }
});

test('permanent Jira create errors are not retried', async () => {
  const file = fixture(jiraConfig(true, '    retry_attempts: 3\n'));
  let posts = 0;
  try {
    const service = await activeService(file, async url => {
      if (url.endsWith('/search/jql')) return jiraResponse({ issues: [], isLast: true });
      posts++;
      return jiraResponse({ errorMessages: ['private'] }, 400);
    });
    await assert.rejects(service.createJiraStory(storyData), /HTTP 400/);
    assert.equal(posts, 1);
    assert.equal(existsSync(join(file.dir, '.agent-workflow/jira-import-pending/s02-jira-import.json')), true);
  } finally { file.clean(); }
});

test('ambiguous create retains and blocks pending state until explicit resolution', async () => {
  const file = fixture(jiraConfig(true));
  let posts = 0;
  let searches = 0;
  try {
    const service = await activeService(file, async url => {
      if (url.endsWith('/search/jql')) { searches++; return jiraResponse({ issues: [], isLast: true }); }
      posts++;
      throw new Error('private network details');
    });
    await assert.rejects(service.createJiraStory(storyData), /ambiguous; pending import was retained/);
    assert.equal(posts, 1);
    const pending = JSON.parse(readFileSync(join(file.dir, '.agent-workflow/jira-import-pending/s02-jira-import.json'), 'utf8'));
    assert.deepEqual(Object.keys(pending).sort(), ['createdAt', 'label', 'storyId']);
    assert.equal(pending.storyId, 's02-jira-import');
    await assert.rejects(service.createJiraStory(storyData), /unresolved; explicitly resolve/);
    assert.equal(posts, 1);
    assert.equal(searches, 3);
    assert.throws(() => service.resolvePendingJiraImport('s02-jira-import'), /Explicit confirmation is required/);
    service.resolvePendingJiraImport('s02-jira-import', true);
    assert.equal(service.hasPendingJiraImport('s02-jira-import'), false);
  } finally { file.clean(); }
});

test('ambiguous create recovers exactly one marker match', async () => {
  const file = fixture(jiraConfig(true));
  let searches = 0;
  try {
    const service = await activeService(file, async url => {
      if (url.endsWith('/search/jql')) { searches++; return jiraResponse({ issues: searches === 1 ? [] : markerIssues('s02-jira-import'), isLast: true }); }
      throw new Error('connection closed after request');
    });
    assert.deepEqual(await service.createJiraStory(storyData), { key: 'DEMO-1', url: 'https://example.atlassian.net/browse/DEMO-1', reused: true });
    assert.equal(searches, 2);
    assert.equal(existsSync(join(file.dir, '.agent-workflow/jira-import-pending/s02-jira-import.json')), true);
  } finally { file.clean(); }
});


test('Jira 429 retries are bounded, search before retry, and honor Retry-After', async () => {
  const file = fixture(jiraConfig(true, '    retry_attempts: 2\n'));
  let posts = 0;
  let searches = 0;
  const delays = [];
  try {
    const service = await activeService(file, async url => {
      if (url.endsWith('/search/jql')) { searches++; return jiraResponse({ issues: [], isLast: true }); }
      posts++;
      return jiraResponse({}, 429, new Headers({ 'Retry-After': '0' }));
    }, { sleep: async ms => delays.push(ms) });
    await assert.rejects(service.createJiraStory(storyData), /rate limit prevented/);
    assert.equal(posts, 2);
    assert.equal(searches, 3);
    assert.deepEqual(delays, [0]);
  } finally { file.clean(); }
});

test('dependency link posts the documented Blocks direction', async () => {
  const file = fixture(jiraConfig(true));
  const posts = [];
  try {
    const service = await activeService(file, async (url, options) => {
      if (url.endsWith('/issueLinkType')) return jiraResponse({ issueLinkTypes: [{ name: 'Blocks', inward: 'Blocked by', outward: 'Blocks' }] });
      if (url.includes('/issue/DEMO-10?')) return jiraResponse({ fields: { issuelinks: [] } });
      posts.push({ url, body: JSON.parse(options.body) });
      return jiraNoBody();
    });
    assert.deepEqual(await service.linkJiraStories('DEMO-10', 'DEMO-20'), { linked: true, created: true });
    assert.deepEqual(posts[0].body, { type: { name: 'Blocks' }, inwardIssue: { key: 'DEMO-10' }, outwardIssue: { key: 'DEMO-20' } });
  } finally { file.clean(); }
});

test('existing Jira dependency link is not created again', async () => {
  const file = fixture(jiraConfig(true));
  let posts = 0;
  try {
    const service = await activeService(file, async url => {
      if (url.endsWith('/issueLinkType')) return jiraResponse({ issueLinkTypes: [{ name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }] });
      if (url.includes('/issue/DEMO-10?')) return jiraResponse({ fields: { issuelinks: [{ type: { name: 'Blocks', inward: 'is blocked by', outward: 'blocks' }, inwardIssue: { key: 'DEMO-20' } }] } });
      posts++;
      return jiraResponse(null, 201);
    });
    assert.deepEqual(await service.linkJiraStories('DEMO-10', 'DEMO-20'), { linked: true, created: false });
    assert.equal(posts, 0);
  } finally { file.clean(); }
});

test('unavailable or denied Jira dependency linking is reported without a link write', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const unavailable = await activeService(file, async () => jiraResponse({ issueLinkTypes: [] }));
    assert.deepEqual(await unavailable.linkJiraStories('DEMO-10', 'DEMO-20'), { linked: false, reason: 'Blocks link type is unavailable' });
    const denied = await activeService(file, async () => jiraResponse({}, 403));
    assert.deepEqual(await denied.linkJiraStories('DEMO-10', 'DEMO-20'), { linked: false, reason: 'Issue-link permission denied' });
  } finally { file.clean(); }
});

test('configured Jira status names resolve the available destination and post its transition ID', async () => {
  const file = fixture(jiraConfig(true, '    status_names:\n      in_progress: "Doing"\n      blocked: "Blocked"\n'));
  const requests = [];
  try {
    const service = await activeService(file, async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'To Do' } } });
      if (url.endsWith('/transitions') && options.method !== 'POST') return jiraResponse({ transitions: [
        { id: '9', name: 'Start work', to: { name: 'Doing' } },
        { id: '10', name: 'Close issue', to: { name: 'Closed' } }
      ] });
      if (url.endsWith('/transitions') && options.method === 'POST') return jiraNoBody(204);
      throw new Error('unexpected synthetic request');
    });
    const result = await service.transitionJiraIssue('DEMO-17', 'in_progress');
    assert.deepEqual(service.config.integrations.jira.status_names, { in_progress: 'Doing', blocked: 'Blocked' });
    assert.deepEqual(result, { transitioned: true, from: 'To Do', status: 'Doing' });
    assert.deepEqual(JSON.parse(requests.at(-1).options.body), { transition: { id: '9' } });
  } finally { file.clean(); }
});

test('default Jira status mapping uses the returned transition ID', async () => {
  const file = fixture(jiraConfig(true));
  let posted;
  try {
    const service = await activeService(file, async (url, options = {}) => {
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Progress' } } });
      if (url.endsWith('/transitions')) {
        if (options.method === 'POST') { posted = JSON.parse(options.body); return jiraNoBody(204); }
        return jiraResponse({ transitions: [{ id: '42', name: 'Review', to: { name: 'In Review' } }] });
      }
      throw new Error('unexpected synthetic request');
    });
    const result = await service.transitionJiraIssue('DEMO-17', 'in_review');
    assert.deepEqual(result, { transitioned: true, from: 'In Progress', status: 'In Review' });
    assert.deepEqual(posted, { transition: { id: '42' } });
  } finally { file.clean(); }
});

test('already-current Jira status does not request or post a transition', async () => {
  const file = fixture(jiraConfig(true));
  let requests = 0;
  try {
    const service = await activeService(file, async () => {
      requests++;
      return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Progress' } } });
    });
    const result = await service.transitionJiraIssue('DEMO-17', 'in_progress');
    assert.deepEqual(result, { transitioned: false, alreadyAtTarget: true, status: 'In Progress' });
    assert.equal(requests, 1);
  } finally { file.clean(); }
});

test('missing or ambiguous Jira destination transitions are reported without a POST', async t => {
  for (const [name, transitions, warning] of [
    ['missing', [], /no available transition/],
    ['ambiguous', [{ id: '1', to: { name: 'In Progress' } }, { to: { name: 'In Progress' } }], /multiple available transitions/]
  ]) {
    await t.test(name, async () => {
      const file = fixture(jiraConfig(true));
      const requests = [];
      try {
        const service = await activeService(file, async (url, options = {}) => {
          requests.push({ url, options });
          if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'To Do' } } });
          return jiraResponse({ transitions });
        });
        const result = await service.transitionJiraIssue('DEMO-17', 'in_progress');
        assert.match(result.warning, warning);
        assert.equal(requests.some(request => request.options.method === 'POST'), false);
      } finally { file.clean(); }
    });
  }
});

test('blocked Jira transition is skipped without a configured mapping or request', async () => {
  const file = fixture(jiraConfig(true));
  let requests = 0;
  try {
    const service = await activeService(file, async () => { requests++; throw new Error('unexpected request'); });
    const result = await service.transitionJiraIssue('DEMO-17', 'blocked');
    assert.deepEqual(result, { transitioned: false, skipped: true, reason: 'blocked status is not configured' });
    assert.equal(requests, 0);
  } finally { file.clean(); }
});

test('configured blocked Jira status uses the discovered transition ID', async () => {
  const file = fixture(jiraConfig(true, '    status_names:\n      blocked: "Blocked"\n'));
  let posted;
  try {
    const service = await activeService(file, async (url, options = {}) => {
      if (url.endsWith('?fields=key,status,project')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Review' } } });
      if (options.method === 'POST') { posted = JSON.parse(options.body); return jiraNoBody(204); }
      return jiraResponse({ transitions: [{ id: '17', to: { name: 'Blocked' } }] });
    });
    const result = await service.transitionJiraIssue('DEMO-17', 'blocked');
    assert.deepEqual(result, { transitioned: true, from: 'In Review', status: 'Blocked' });
    assert.deepEqual(posted, { transition: { id: '17' } });
  } finally { file.clean(); }
});

test('Jira status lookup returns the current remote status only', async () => {
  const file = fixture(jiraConfig(true));
  let requestedUrl;
  try {
    const service = await activeService(file, async url => {
      requestedUrl = url;
      return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: 'In Review' } } });
    });
    assert.deepEqual(await service.getJiraIssueStatus('DEMO-17'), { key: 'DEMO-17', status: 'In Review' });
    assert.match(requestedUrl, /fields=key,status,project$/);
  } finally { file.clean(); }
});

test('Jira status lookup rejects an empty remote status', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const service = await activeService(file, async () => jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' }, status: { name: '  ' } } }));
    await assert.rejects(service.getJiraIssueStatus('DEMO-17'), /Jira issue status is unavailable/);
  } finally { file.clean(); }
});

test('Jira PR remote links use a stable global ID and record merged state', async () => {
  const file = fixture(jiraConfig(true));
  const bodies = [];
  try {
    const service = await activeService(file, async (requestUrl, options = {}) => {
      if (requestUrl.endsWith('?fields=key,issuetype,project,issuelinks')) return jiraResponse({ key: 'DEMO-17', fields: { project: { key: 'DEMO' } } });
      bodies.push(JSON.parse(options.body));
      return jiraNoBody(201);
    });
    const url = 'https://github.com/acme/agent-workflow/pull/42';
    await service.linkJiraPullRequest('DEMO-17', { url });
    await service.linkJiraPullRequest('DEMO-17', { url, merged: true });
    assert.equal(bodies[0].globalId, bodies[1].globalId);
    assert.equal(bodies[0].object.status.resolved, false);
    assert.equal(bodies[1].object.status.resolved, true);
    assert.equal(bodies[1].object.status.title, 'Merged');
    assert.equal(bodies[1].object.url, url);
  } finally { file.clean(); }
});

test('Jira PR remote-link operation rejects unsafe or non-pull URLs before requesting', async () => {
  const file = fixture(jiraConfig(true));
  let requests = 0;
  try {
    const service = await activeService(file, async () => { requests++; throw new Error('unexpected request'); });
    await assert.rejects(service.linkJiraPullRequest('DEMO-17', { url: 'http://github.com/acme/repo/pull/42' }), /valid HTTPS pull request URL/);
    await assert.rejects(service.linkJiraPullRequest('DEMO-17', { url: 'https://user:pass@github.com/acme/repo/pull/42' }), /valid HTTPS pull request URL/);
    await assert.rejects(service.linkJiraPullRequest('DEMO-17', { url: 'https://github.com/acme/repo/issues/42' }), /valid HTTPS pull request URL/);
    assert.equal(requests, 0);
  } finally { file.clean(); }
});

test('Jira PR link refuses an issue outside the configured project', async () => {
  const file = fixture(jiraConfig(true));
  const requests = [];
  try {
    const service = await activeService(file, async (url, options = {}) => {
      requests.push({ url, options });
      return jiraResponse({ key: 'OTHER-17', fields: { project: { key: 'OTHER' } } });
    });
    await assert.rejects(service.linkJiraPullRequest('DEMO-17', { url: 'https://github.com/acme/repo/pull/42' }), /not available in the configured project/);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].options.method, 'GET');
  } finally { file.clean(); }
});
