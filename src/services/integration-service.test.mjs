import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import IntegrationService from './integration-service.mjs';

const jiraConfig = enabled => `integrations:\n  enabled: true\n  jira:\n    enabled: ${enabled}\n    project_key: "DEMO"\n    issue_type: "Story"\n    retry_attempts: 1\n`;
const env = { JIRA_API_URL: 'https://example.atlassian.net', JIRA_PROJECT_KEY: 'DEMO', JIRA_EMAIL: 'user@example.test', JIRA_API_TOKEN: 'synthetic-only' };
function fixture(content) {
  const dir = mkdtempSync(join(tmpdir(), 'aw-jira-'));
  const path = join(dir, 'integrations.yaml');
  if (content !== undefined) writeFileSync(path, content);
  return { dir, path, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

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
    await assert.rejects(service.createJiraTicket('task', { summary: 'disabled' }), /not enabled/);
    assert.equal(calls, 0);
  }
  finally { file.clean(); }
});
test('incomplete Jira performs no request', async () => {
  const file = fixture(jiraConfig(true)); let calls = 0;
  try {
    const service = new IntegrationService(file.path, { environment: {}, fetch: async () => { calls++; } });
    await service.init();
    await assert.rejects(service.createJiraTicket('task', { summary: 'incomplete' }), /not enabled/);
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
    await assert.rejects(service.createJiraTicket('task', { summary: 'private request payload' }), error => !/synthetic-only|Authorization|private/.test(error.message));
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
    await assert.rejects(service.jiraService.createTicket('task', { summary: 'private' }), /approved HTTPS Jira Cloud/);
    assert.equal(calls, 0);
  } finally { file.clean(); }
});

test('HTTP Jira status survives sanitized errors', async () => {
  const file = fixture(jiraConfig(true));
  try {
    const service = new IntegrationService(file.path, { environment: env, fetch: async () => ({ ok: false, status: 403, text: async () => 'private-response' }) });
    await service.init();
    await assert.rejects(service.createJiraTicket('task', { summary: 'private payload' }), error => error.status === 403 && /HTTP 403/.test(error.message) && !/private/.test(error.message));
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
    await assert.rejects(service.createJiraTicket('task', { summary: 'must not send' }), /not enabled/);
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
