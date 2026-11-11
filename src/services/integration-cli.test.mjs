import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getStatus, validateJira } from './integration-cli.mjs';

const env = { JIRA_API_URL: 'https://example.atlassian.net', JIRA_PROJECT_KEY: 'DEMO', JIRA_EMAIL: 'user@example.test', JIRA_API_TOKEN: 'synthetic-only' };
const config = 'integrations:\n  jira:\n    enabled: false\n    issue_type: "Story"\n';
const response = body => ({ ok: true, json: async () => body });

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
