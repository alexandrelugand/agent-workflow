import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import IntegrationService from './integration-service.mjs';
import { resolveConsumerRoot } from './project-root.mjs';
import { requireApprovedJiraBaseUrl } from './jira-url.mjs';

const requiredVariables = ['JIRA_API_URL', 'JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
function readJiraEnvironmentFile(path) {
  let content;
  try { content = readFileSync(path, 'utf8'); }
  catch (error) {
    if (error.code === 'ENOENT') return {};
    throw new Error('Unable to read local Jira environment file');
  }
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (name !== 'NODE_ENV' && !requiredVariables.includes(name)) continue;
    const quoted = rawValue.trim().match(/^("(?:\\.|[^"\\])*"|'[^']*')/);
    if (quoted) {
      let value = quoted[0].slice(1, -1);
      if (quoted[0][0] === '"') {
        value = value.replace(/\\([nr\\"])/g, (_, escape) => escape === 'n' ? '\n' : escape === 'r' ? '\r' : escape);
      }
      values[name] = value;
      continue;
    }
    if (/^["']/.test(rawValue.trim())) continue;
    values[name] = rawValue.split('#', 1)[0].trim();
  }
  return values;
}

function loadJiraEnvironment(consumerRoot, environment = process.env) {
  const base = readJiraEnvironmentFile(join(consumerRoot, '.env'));
  const mode = environment.NODE_ENV || base.NODE_ENV || 'development';
  const specific = /^[A-Za-z0-9_-]+$/.test(mode)
    ? readJiraEnvironmentFile(join(consumerRoot, `.env.${mode}`))
    : {};
  return { ...base, ...specific, ...environment };
}

const storyIdPattern = /^s\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const issueKeyPattern = /^[A-Z][A-Z0-9_]*-\d+$/;

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

export async function validateJira({ fetchImpl = globalThis.fetch, env, config = null, workingDirectory = process.cwd() } = {}) {
  const root = resolveConsumerRoot(import.meta.url, workingDirectory);
  config ??= readFileSync(join(root, '.agent-workflow/integrations.yaml'), 'utf8');
  env ??= loadJiraEnvironment(root);
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

function listLocalJiraLinks(worktreeRoot) {
  const directory = join(worktreeRoot, 'docs', 'integrations');
  if (!existsSync(directory)) return { links: [], warning: null };
  let entries;
  try { entries = readdirSync(directory, { withFileTypes: true }); }
  catch { return { links: [], warning: 'Local Jira integration records are unavailable' }; }
  const links = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const match = entry.name.match(/^(s\d+-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/);
    if (!match) continue;
    const storyId = match[1];
    try {
      const record = readIntegrationRecord(worktreeRoot, storyId);
      if (record.jira) links.push({ storyId, issueKey: record.jira.key });
    } catch {
      links.push({ storyId, issueKey: null, localUnavailable: true });
    }
  }
  links.sort((left, right) => left.storyId < right.storyId ? -1 : left.storyId > right.storyId ? 1 : 0);
  return { links, warning: null };
}

export async function getStatus({ workingDirectory = process.cwd(), fetchImpl = globalThis.fetch, env } = {}) {
  const { worktreeRoot, service } = await createContext({ workingDirectory, fetchImpl, env }, { requireJira: false });
  const integrationStatus = service.getIntegrationStatus();
  const local = listLocalJiraLinks(worktreeRoot);
  const stories = [];
  for (const link of local.links) {
    if (link.localUnavailable) {
      stories.push({ storyId: link.storyId, issueKey: null, status: 'unavailable', reason: 'Local Jira link is invalid or ambiguous' });
    } else if (!integrationStatus.jira.enabled) {
      stories.push({ storyId: link.storyId, issueKey: link.issueKey, status: 'unavailable', reason: 'Jira is disabled or incompletely configured' });
    } else {
      try {
        const issue = await service.getJiraIssueStatus(link.issueKey);
        stories.push({ storyId: link.storyId, issueKey: link.issueKey, status: issue.status });
      } catch {
        stories.push({ storyId: link.storyId, issueKey: link.issueKey, status: 'unavailable', reason: 'Jira status fetch failed' });
      }
    }
  }
  return {
    ...integrationStatus,
    jira: { ...integrationStatus.jira, stories, ...(local.warning ? { warning: local.warning } : {}) }
  };
}

function requestedIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) throw new Error('Provide one or more explicit story IDs');
  const seen = new Set();
  for (const id of ids) {
    if (typeof id !== 'string' || !storyIdPattern.test(id)) throw new Error(`Invalid story ID: ${String(id)}`);
    if (seen.has(id)) throw new Error(`Story ID was requested more than once: ${id}`);
    seen.add(id);
  }
  return ids;
}

function parseStorySections(markdown, ids) {
  const headings = [...markdown.matchAll(/^## Story (s\d+-[a-z0-9]+(?:-[a-z0-9]+)*) — (.+?)\s*$/gm)];
  const sections = new Map();
  const requested = new Set(ids);
  for (let index = 0; index < headings.length; index++) {
    const match = headings[index];
    if (!requested.has(match[1])) continue;
    if (sections.has(match[1])) throw new Error(`Requested story ${match[1]} appears more than once in docs/stories.md`);
    const start = match.index + match[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    sections.set(match[1], { title: match[2].trim(), body: markdown.slice(start, end) });
  }
  const stories = new Map();
  for (const id of ids) {
    const section = sections.get(id);
    if (!section) throw new Error(`Requested story ${id} was not found in docs/stories.md`);
    const lines = section.body.split(/\r?\n/);
    const intro = [];
    for (const line of lines) {
      if (/^###\s/.test(line)) break;
      if (line.trim()) intro.push(line.trim());
    }
    const storyStart = intro.findIndex(line => /^\*\*As a\*\*/i.test(line));
    const userStory = storyStart < 0 ? '' : intro.slice(storyStart).join(' ').replace(/\s+/g, ' ').trim();
    const sectionLines = title => {
      const start = lines.findIndex(line => new RegExp(`^###\\s+${title}\\s*$`, 'i').test(line.trim()));
      if (start < 0) return [];
      const end = lines.findIndex((line, index) => index > start && /^###\s/.test(line));
      return lines.slice(start + 1, end < 0 ? lines.length : end);
    };
    const acceptanceCriteria = sectionLines('Acceptance criteria')
      .map(line => line.match(/^\s*[-*]\s+(?:\[[ xX]\]\s*)?(.+?)\s*$/)?.[1]?.trim())
      .filter(Boolean);
    const dependencyText = sectionLines('Dependencies').join('\n');
    const dependencies = [...new Set(dependencyText.match(/s\d+-[a-z0-9]+(?:-[a-z0-9]+)*/g) || [])];
    const epicEntries = sectionLines('Epic')
      .map(line => line.replace(/<!--.*?-->/g, '').match(/^\s*(?:[-*]\s*)?(.+?)\s*$/)?.[1]?.trim())
      .filter(Boolean);
    if (epicEntries.length > 1) throw new Error(`Requested story ${id} must have one Jira Epic key`);
    const epicKey = epicEntries[0] || null;
    if (epicKey && !issueKeyPattern.test(epicKey)) throw new Error(`Requested story ${id} has an invalid Jira Epic key`);
    stories.set(id, { storyId: id, summary: section.title, userStory, acceptanceCriteria, dependencies, epicKey });
  }
  return stories;
}

function readStoryData(worktreeRoot, ids) {
  return parseStorySections(readFileSync(join(worktreeRoot, 'docs/stories.md'), 'utf8'), requestedIds(ids));
}

function integrationPath(worktreeRoot, storyId) {
  if (!storyIdPattern.test(storyId)) throw new Error('Invalid story ID');
  return join(worktreeRoot, 'docs', 'integrations', `${storyId}.md`);
}

function jiraSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = [];
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/^(#{2,6})\s+(?:Jira(?:\s+Links?)?|Link to Jira)\s*$/i);
    if (!match) continue;
    const level = match[1].length;
    let end = index + 1;
    while (end < lines.length) {
      const next = lines[end].match(/^(#{1,6})\s+/);
      if (next && next[1].length <= level) break;
      end++;
    }
    sections.push({ start: index, end, lines: lines.slice(index + 1, end) });
    index = end - 1;
  }
  return sections;
}

function existingJiraLink(content) {
  const sections = jiraSections(content);
  if (!sections.length) return null;
  const keys = new Set();
  let url = null;
  for (const section of sections) {
    for (const line of section.lines) {
      const keyField = line.match(/^\s*[-*]\s*(?:\*\*)?(?:issue\s+)?key(?:\*\*)?\s*:\s*([A-Z][A-Z0-9_]*-\d+)\s*$/i);
      if (keyField) keys.add(keyField[1]);
      const urlField = line.match(/^\s*[-*]\s*(?:\*\*)?url(?:\*\*)?\s*:\s*(https:\/\/\S+)\s*$/i);
      if (urlField) url = urlField[1];
      if (!keyField) for (const key of line.match(/[A-Z][A-Z0-9_]*-\d+/g) || []) keys.add(key);
    }
  }
  if (keys.size > 1) throw new Error('Integration record contains multiple Jira issues; resolve it before importing');
  const key = [...keys][0];
  return key ? { key, url } : null;
}

function removeJiraSections(content) {
  const lines = content.split(/\r?\n/);
  const sections = jiraSections(content);
  for (const section of sections.reverse()) lines.splice(section.start, section.end - section.start);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

function upsertJiraLink(content, storyId, key, url) {
  if (!issueKeyPattern.test(key) || typeof url !== 'string' || !url.startsWith('https://')) throw new Error('A valid Jira key and browse URL are required');
  const retained = removeJiraSections(content).trimEnd() || `# Story Integration: ${storyId}`;
  return `${retained}\n\n## Jira\n- Key: ${key}\n- URL: ${url}\n`;
}

function removeJiraLink(content, storyId) {
  if (!jiraSections(content).length) return { content, removed: false };
  const retained = removeJiraSections(content).trimEnd() || `# Story Integration: ${storyId}`;
  return { content: `${retained}\n`, removed: true };
}

function readIntegrationRecord(worktreeRoot, storyId) {
  const path = integrationPath(worktreeRoot, storyId);
  const content = existsSync(path) ? readFileSync(path, 'utf8') : '';
  return { path, content, jira: existingJiraLink(content) };
}

function saveJiraLink(worktreeRoot, storyId, record, key, url) {
  mkdirSync(join(worktreeRoot, 'docs', 'integrations'), { recursive: true });
  writeFileSync(record.path, upsertJiraLink(record.content, storyId, key, url));
}

function jiraUrlOrNull(service, key) {
  try { return service.getJiraBrowseUrl(key); } catch { return null; }
}

async function createContext(options = {}, { requireJira = true } = {}) {
  const worktreeRoot = resolve(options.workingDirectory || process.cwd());
  const consumerRoot = options.consumerRoot ? resolve(options.consumerRoot) : resolveConsumerRoot(import.meta.url, worktreeRoot);
  const service = new IntegrationService(options.configPath || join(consumerRoot, '.agent-workflow/integrations.yaml'), {
    projectRoot: consumerRoot,
    fetch: options.fetchImpl || globalThis.fetch,
    environment: options.env ?? loadJiraEnvironment(consumerRoot),
    sleep: options.sleep
  });
  const writeLog = console.log;
  console.log = () => {};
  try { await service.init(); } finally { console.log = writeLog; }
  if (requireJira && !service.getIntegrationStatus().jira.enabled) throw new Error('Jira integration is disabled or incompletely configured');
  return { worktreeRoot, consumerRoot, service };
}

function assertConfiguredIssueType(service, issue) {
  const expected = service.config.integrations?.jira?.issue_type;
  if (!expected || issue.fields?.issuetype?.name !== expected) throw new Error('Jira issue does not use the configured issue type');
}

function assertMarkerIssueType(service, issue) {
  const expected = service.config.integrations?.jira?.issue_type;
  if (!expected || issue.issueType !== expected || issue.projectKey !== service.environment.JIRA_PROJECT_KEY) {
    throw new Error('Jira marker match does not use the configured project issue type');
  }
}

async function requirePendingMarkerMatch(service, storyId, issueKey) {
  const matches = await service.searchJiraStory(storyId);
  if (matches.length !== 1 || matches[0].key !== issueKey) {
    throw new Error(`Pending Jira import for ${storyId} is not matched to the linked issue; resolve it explicitly`);
  }
  assertMarkerIssueType(service, matches[0]);
}

async function inspectRequestedStories(ids, options = {}) {
  const worktreeRoot = resolve(options.workingDirectory || process.cwd());
  const stories = readStoryData(worktreeRoot, ids);
  const { service } = await createContext({ ...options, workingDirectory: worktreeRoot });
  const inspected = new Map();
  for (const [storyId, story] of stories) {
    const record = readIntegrationRecord(worktreeRoot, storyId);
    const pending = service.hasPendingJiraImport(storyId);
    if (record.jira) {
      if (!pending) inspected.set(storyId, { story, record, action: 'reuse-local', key: record.jira.key, url: record.jira.url });
      else {
        const matches = await service.searchJiraStory(storyId);
        if (matches.length === 1 && matches[0].key === record.jira.key) {
          assertMarkerIssueType(service, matches[0]);
          inspected.set(storyId, { story, record, action: 'recover-pending', key: record.jira.key, url: record.jira.url });
        } else inspected.set(storyId, { story, record, action: 'blocked-pending', key: record.jira.key, matches: matches.map(match => match.key) });
      }
      continue;
    }
    const matches = await service.searchJiraStory(storyId);
    if (matches.length > 1) inspected.set(storyId, { story, record, action: 'ambiguous', matches: matches.map(match => match.key) });
    else if (matches.length === 1) {
      assertMarkerIssueType(service, matches[0]);
      inspected.set(storyId, { story, record, action: pending ? 'recover-pending' : 'reuse-marker', key: matches[0].key, url: jiraUrlOrNull(service, matches[0].key) });
    } else if (pending) inspected.set(storyId, { story, record, action: 'blocked-pending' });
    else inspected.set(storyId, { story, record, action: 'create' });
  }
  return { worktreeRoot, service, stories, inspected };
}

function dependencyPreview(story, inspected, worktreeRoot) {
  return story.dependencies.map(dependencyId => {
    const selected = inspected.get(dependencyId);
    if (selected) {
      return ['ambiguous', 'blocked-pending'].includes(selected.action)
        ? { storyId: dependencyId, action: 'skip', reason: 'dependency import is blocked or ambiguous' }
        : { storyId: dependencyId, action: 'link-after-import' };
    }
    const record = readIntegrationRecord(worktreeRoot, dependencyId);
    return record.jira
      ? { storyId: dependencyId, action: 'link-after-import' }
      : { storyId: dependencyId, action: 'skip', reason: 'dependency has no local Jira link' };
  });
}
function configuredEpicKey(story, service) {
  return story.epicKey || service.config.integrations?.jira?.epic_key || null;
}

function assertJiraEpicParent(issue, epicKey) {
  return issue.fields?.parent?.key === epicKey;
}


export async function previewJiraImport({ storyIds, ...options } = {}) {
  const ids = requestedIds(storyIds);
  const context = await inspectRequestedStories(ids, options);
  return {
    preview: true,
    stories: [...context.stories].map(([storyId, story]) => {
      const item = context.inspected.get(storyId);
      const epicKey = ['create', 'recover-pending'].includes(item.action) ? configuredEpicKey(story, context.service) : null;
      return {
        storyId, summary: story.summary, action: item.action,
        ...(item.key ? { key: item.key, url: item.url } : {}),
        ...(item.matches ? { matches: item.matches } : {}),
        ...(epicKey ? { epicKey } : {}),
        dependencyLinks: dependencyPreview(story, context.inspected, context.worktreeRoot)
      };
    })
  };
}


export async function importJiraStories({ storyIds, confirm = false, ...options } = {}) {
  const ids = requestedIds(storyIds);
  if (!confirm) return { cancelled: true, preview: await previewJiraImport({ storyIds: ids, ...options }) };
  const worktreeRoot = resolve(options.workingDirectory || process.cwd());
  const stories = readStoryData(worktreeRoot, ids);
  const { service } = await createContext({ ...options, workingDirectory: worktreeRoot });
  const imported = new Map();
  const failures = [];
  const epicReopened = [];
  const epicWarnings = [];
  for (const [storyId, story] of stories) {
    try {
      const record = readIntegrationRecord(worktreeRoot, storyId);
      let issue;
      let url;
      let creation = null;
      if (record.jira) {
        if (service.hasPendingJiraImport(storyId)) await requirePendingMarkerMatch(service, storyId, record.jira.key);
        issue = await service.getJiraIssue(record.jira.key);
        assertConfiguredIssueType(service, issue);
        url = service.getJiraBrowseUrl(record.jira.key);
      } else {
        creation = await service.createJiraStory(story);
        issue = await service.getJiraIssue(creation.key);
        assertConfiguredIssueType(service, issue);
        url = creation.url;
      }
      const epicKey = configuredEpicKey(story, service);
      const assignedEpicKey = epicKey && assertJiraEpicParent(issue, epicKey) ? epicKey : null;
      if (epicKey && !assignedEpicKey) {
        epicWarnings.push({
          storyId, epicKey,
          reason: creation?.created || creation?.recovered
            ? 'Jira story was not assigned to the selected Epic'
            : 'Existing Jira story was not moved to the selected Epic'
        });
      }
      saveJiraLink(worktreeRoot, storyId, record, issue.key, url);
      service.clearPendingJiraImport(storyId);
      imported.set(storyId, { story, key: issue.key, url, ...(assignedEpicKey ? { epicKey: assignedEpicKey } : {}) });
      if (creation && (creation.created || creation.recovered) && assignedEpicKey) {
        try {
          const reopen = await service.reopenJiraEpicIfDone(assignedEpicKey);
          if (reopen.reopened) epicReopened.push({ storyId, epicKey: assignedEpicKey, status: reopen.status });
          if (reopen.warning) epicWarnings.push({ storyId, epicKey: assignedEpicKey, reason: reopen.warning });
        } catch (error) {
          epicWarnings.push({
            storyId, epicKey: assignedEpicKey,
            reason: Number.isInteger(error?.status) ? `Epic reopen failed (HTTP ${error.status})` : 'Epic reopen failed'
          });
        }
      }
    } catch (error) {
      failures.push({ storyId, message: error.message });
    }
  }
  const dependencyFailures = [];
  const linked = [];
  for (const [storyId, entry] of imported) {
    for (const dependencyId of entry.story.dependencies) {
      const dependency = readIntegrationRecord(worktreeRoot, dependencyId).jira;
      if (!dependency) continue;
      try {
        if (service.hasPendingJiraImport(dependencyId)) {
          await requirePendingMarkerMatch(service, dependencyId, dependency.key);
          service.clearPendingJiraImport(dependencyId);
        }
        const result = await service.linkJiraStories(entry.key, dependency.key);
        if (result.linked) linked.push({ blockedStory: storyId, dependency: dependencyId, key: dependency.key, created: result.created });
        else dependencyFailures.push({ blockedStory: storyId, dependency: dependencyId, reason: result.reason });
      } catch (error) {
        dependencyFailures.push({ blockedStory: storyId, dependency: dependencyId, reason: error.message });
      }
    }
  }
  return {
    imported: [...imported].map(([storyId, value]) => ({ storyId, key: value.key, url: value.url, ...(value.epicKey ? { epicKey: value.epicKey } : {}) })),
    failures, linked, dependencyFailures,
    ...(epicReopened.length ? { epicReopened } : {}),
    ...(epicWarnings.length ? { epicWarnings } : {})
  };
}


export async function linkJiraStory({ storyId, issueKey, ...options } = {}) {
  requestedIds([storyId]);
  if (typeof issueKey !== 'string' || !issueKeyPattern.test(issueKey)) throw new Error('Provide one valid Jira issue key');
  const { worktreeRoot, service } = await createContext(options);
  readStoryData(worktreeRoot, [storyId]);
  const record = readIntegrationRecord(worktreeRoot, storyId);
  if (record.jira && record.jira.key !== issueKey) throw new Error(`Story ${storyId} is already linked to ${record.jira.key}; unlink it before changing the Jira issue`);
  if (service.hasPendingJiraImport(storyId)) await requirePendingMarkerMatch(service, storyId, issueKey);
  const issue = await service.getJiraIssue(issueKey);
  assertConfiguredIssueType(service, issue);
  const url = service.getJiraBrowseUrl(issueKey);
  if (!record.jira || record.jira.url !== url) saveJiraLink(worktreeRoot, storyId, record, issueKey, url);
  service.clearPendingJiraImport(storyId);
  return { storyId, key: issueKey, url, linked: true };
}

export async function unlinkJiraStory({ storyId, ...options } = {}) {
  requestedIds([storyId]);
  const worktreeRoot = resolve(options.workingDirectory || process.cwd());
  readStoryData(worktreeRoot, [storyId]);
  const record = readIntegrationRecord(worktreeRoot, storyId);
  if (!record.jira) return { storyId, unlinked: false };
  const updated = removeJiraLink(record.content, storyId);
  writeFileSync(record.path, updated.content);
  return { storyId, unlinked: updated.removed, key: record.jira.key, remoteIssueDeleted: false };
}

const lifecycleStatuses = new Set(['in_progress', 'in_review', 'blocked', 'done']);

export async function syncJiraLifecycle({ storyId, status, pullRequestUrl = null, merged = false, ...options } = {}) {
  requestedIds([storyId]);
  if (!lifecycleStatuses.has(status)) throw new Error('Provide a supported Jira lifecycle status');
  if (typeof merged !== 'boolean') throw new Error('Invalid merged-PR proof');
  if (status === 'done' && (merged !== true || typeof pullRequestUrl !== 'string' || !pullRequestUrl.trim())) {
    return { storyId, synced: false, warning: 'Jira Done requires a verified merged PR URL' };
  }
  if (merged && status !== 'done') throw new Error('Merged-PR proof is only valid for Jira Done');
  if (pullRequestUrl !== null && (typeof pullRequestUrl !== 'string' || !pullRequestUrl.trim())) throw new Error('Invalid pull request URL');
  if (pullRequestUrl && !['in_review', 'done'].includes(status)) throw new Error('Pull request links are valid only during review or verified delivery');

  const worktreeRoot = resolve(options.workingDirectory || process.cwd());
  const record = readIntegrationRecord(worktreeRoot, storyId);
  if (!record.jira) return { storyId, skipped: true, reason: 'Story has no Jira link' };
  const { service } = await createContext(options, { requireJira: false });
  if (!service.getIntegrationStatus().jira.enabled) {
    return { storyId, issueKey: record.jira.key, skipped: true, reason: 'Jira is disabled or incompletely configured' };
  }

  const warnings = [];
  let normalizedPullRequestUrl = pullRequestUrl;
  if (pullRequestUrl) {
    try { normalizedPullRequestUrl = service.validateJiraPullRequestUrl(pullRequestUrl); }
    catch {
      if (status === 'done') return { storyId, issueKey: record.jira.key, targetStatus: status, synced: false, warning: 'Invalid PR URL; Jira Done was not attempted' };
      warnings.push('Jira PR link failed (invalid HTTPS pull request URL)');
      normalizedPullRequestUrl = null;
    }
  }
  let pullRequestLinked = null;
  if (normalizedPullRequestUrl) {
    try {
      pullRequestLinked = (await service.linkJiraPullRequest(record.jira.key, { url: normalizedPullRequestUrl, merged: status === 'done' })).linked;
    } catch (error) {
      warnings.push(`Jira PR link failed${Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : ''}`);
    }
  }
  let transition = null;
  try {
    transition = await service.transitionJiraIssue(record.jira.key, status);
    if (transition.warning) warnings.push(transition.warning);
  } catch (error) {
    warnings.push(`Jira status transition failed${Number.isInteger(error?.status) ? ` (HTTP ${error.status})` : ''}`);
  }
  return {
    storyId,
    issueKey: record.jira.key,
    targetStatus: status,
    synced: warnings.length === 0 && !transition?.skipped,
    ...(transition ? { transition: { transitioned: transition.transitioned, ...(transition.alreadyAtTarget ? { alreadyAtTarget: true } : {}) } } : {}),
    ...(transition?.skipped ? { skipped: true, reason: transition.reason } : {}),
    ...(pullRequestUrl ? { pullRequestLinked: pullRequestLinked === true } : {}),
    ...(warnings.length ? { warnings } : {})
  };
}

export async function resolvePendingJiraImport({ storyId, confirmNotCreated = false, ...options } = {}) {
  requestedIds([storyId]);
  if (!confirmNotCreated) throw new Error('Explicit confirmation is required to resolve pending Jira state');
  const consumerRoot = options.consumerRoot ? resolve(options.consumerRoot) : resolveConsumerRoot(import.meta.url, options.workingDirectory || process.cwd());
  const path = join(consumerRoot, '.agent-workflow', 'jira-import-pending', `${storyId}.json`);
  if (!existsSync(path)) throw new Error(`No pending Jira import exists for ${storyId}`);
  unlinkSync(path);
  return { storyId, resolved: true, confirmedNotCreated: true };
}

function usage() {
  return 'Usage: node integration-cli.mjs <validate|status|preview <story-id...>|import <story-id...> --confirm|link <story-id> <jira-key>|unlink <story-id>|lifecycle <story-id> <in_progress|in_review|blocked|done> [--pr-url <url>] [--merged]|resolve-pending <story-id> --confirm-not-created>';
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action, ...args] = process.argv.slice(2);
  const run = async () => {
    if (action === 'validate') return validateJira();
    if (action === 'status') return getStatus();
    if (action === 'preview') return previewJiraImport({ storyIds: args });
    if (action === 'import') return importJiraStories({ storyIds: args.filter(arg => arg !== '--confirm'), confirm: args.includes('--confirm') });
    if (action === 'link' && args.length === 2) return linkJiraStory({ storyId: args[0], issueKey: args[1] });
    if (action === 'unlink' && args.length === 1) return unlinkJiraStory({ storyId: args[0] });
    if (action === 'resolve-pending' && args.length === 2) return resolvePendingJiraImport({ storyId: args[0], confirmNotCreated: args.includes('--confirm-not-created') });
    if (action === 'lifecycle' && args.length >= 2) {
      const [storyId, status, ...flags] = args;
      let pullRequestUrl = null;
      let merged = false;
      for (let index = 0; index < flags.length; index++) {
        if (flags[index] === '--pr-url' && flags[index + 1] && pullRequestUrl === null) pullRequestUrl = flags[++index];
        else if (flags[index] === '--merged' && !merged) merged = true;
        else throw new Error(usage());
      }
      return syncJiraLifecycle({ storyId, status, pullRequestUrl, merged });
    }
    throw new Error(usage());
  };
  run().then(result => {
    if (action === 'validate') console.log(`Jira validation succeeded for project ${result.projectKey} and issue type ${result.issueType}`);
    else console.log(JSON.stringify(result, null, 2));
    if (result?.failures?.length || result?.dependencyFailures?.length || result?.epicWarnings?.length) process.exitCode = 1;
  }).catch(error => { console.error(error.message); process.exitCode = 1; });
}
