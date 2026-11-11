import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import IntegrationService from './integration-service.mjs';
import { resolveConsumerRoot } from './project-root.mjs';
import { requireApprovedJiraBaseUrl } from './jira-url.mjs';

const requiredVariables = ['JIRA_API_URL', 'JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];

function configuredIssueType(config) {
  let inJira = false;
  for (const line of config.split(/\r?\n/)) {
    if (/^  jira:\s*$/.test(line)) { inJira = true; continue; }
    if (inJira && /^  [\w-]+:\s*$/.test(line)) break;
    if (!inJira) continue;
    const field = line.match(/^    issue_type:\s*(.*?)\s*(?:#.*)?$/);
    if (!field) continue;
    const scalar = field[1].trim();
    if (scalar.startsWith('"') && scalar.endsWith('"')) {
      try { return JSON.parse(scalar); } catch { return scalar.slice(1, -1); }
    }
    if (scalar.startsWith("'") && scalar.endsWith("'")) return scalar.slice(1, -1).replace(/''/g, "'");
    return scalar;
  }
  return '';
}

export async function validateJira({ fetchImpl = globalThis.fetch, env = process.env, config = null, workingDirectory = process.cwd() } = {}) {
  const root = resolveConsumerRoot(import.meta.url, workingDirectory);
  config ??= readFileSync(join(root, '.agent-workflow/integrations.yaml'), 'utf8');
  const missing = requiredVariables.filter(name => !env[name]);
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  const base = requireApprovedJiraBaseUrl(env.JIRA_API_URL);
  const projectKey = env.JIRA_PROJECT_KEY;
  const issueType = configuredIssueType(config);
  if (!issueType) throw new Error('Configure jira.issue_type before validation');
  const auth = `Basic ${Buffer.from(`${env.JIRA_EMAIL}:${env.JIRA_API_TOKEN}`).toString('base64')}`;
  const request = async path => {
    let response;
    try { response = await fetchImpl(`${base}${path}`, { redirect: 'error', headers: { Authorization: auth, Accept: 'application/json' } }); }
    catch { throw new Error('Jira validation request failed; check site availability'); }
    if (!response.ok) throw new Error(`Jira validation request failed (HTTP ${response.status}); check credentials and project permissions`);
    try { return await response.json(); } catch { throw new Error(`Jira validation response was invalid (HTTP ${response.status})`); }
  };
  await request('/rest/api/3/myself');
  let startAt = 0;
  const maxResults = 50;
  let matchingType = false;
  while (true) {
    const metadata = await request(`/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes?startAt=${startAt}&maxResults=${maxResults}`);
    const issueTypes = Array.isArray(metadata.issueTypes) ? metadata.issueTypes : [];
    if (issueTypes.some(type => type.name === issueType)) { matchingType = true; break; }
    const pageStart = Number.isFinite(metadata.startAt) ? metadata.startAt : startAt;
    const total = Number.isFinite(metadata.total) ? metadata.total : pageStart + issueTypes.length;
    const nextStart = pageStart + issueTypes.length;
    if (issueTypes.length === 0 || nextStart >= total || nextStart <= startAt) break;
    startAt = nextStart;
  }
  if (!matchingType) throw new Error('Configured Jira issue type is unavailable in the selected project');
  return { valid: true, projectKey, issueType };
}

export async function getStatus({ workingDirectory = process.cwd() } = {}) {
  const root = resolveConsumerRoot(import.meta.url, workingDirectory);
  const service = new IntegrationService(join(root, '.agent-workflow/integrations.yaml'));
  const writeLog = console.log;
  console.log = () => {};
  try {
    await service.init();
    return service.getIntegrationStatus();
  } finally {
    console.log = writeLog;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const action = process.argv[2];
  if (action === 'validate') {
    validateJira().then(result => console.log(`Jira validation succeeded for project ${result.projectKey} and issue type ${result.issueType}`)).catch(error => { console.error(error.message); process.exitCode = 1; });
  } else if (action === 'status') {
    getStatus().then(status => console.log(JSON.stringify(status, null, 2))).catch(() => { console.error('Unable to load redacted integration status'); process.exitCode = 1; });
  } else {
    console.error('Usage: node integration-cli.mjs <validate|status>');
    process.exitCode = 2;
  }
}
