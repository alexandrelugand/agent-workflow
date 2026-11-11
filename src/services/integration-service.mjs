/**
 * Integration Service
 * Centralized service for managing JIRA, GitHub, and Telegram integrations
 * for agent-workflow pipeline
 */

import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync, unlinkSync, openSync, fsyncSync, closeSync } from 'node:fs';
import { resolveConsumerRoot } from './project-root.mjs';
import { requireApprovedJiraBaseUrl } from './jira-url.mjs';
function safeProviderError(provider, error) {
  if (error?.safe === true) return error;
  const status = Number.isInteger(error?.status) ? error.status : null;
  const guidance = provider === 'Jira' ? '; check credentials and project permissions' : '';
  const safe = new Error(`${provider} request failed${status === null ? '' : ` with HTTP ${status}`}${guidance}`);
  if (status !== null) safe.status = status;
  return safe;
}

function safeJiraError(message, status = null, details = {}) {
  const error = new Error(message);
  error.safe = true;
  if (Number.isInteger(status)) error.status = status;
  Object.assign(error, details);
  return error;
}

const storyIdPattern = /^s\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const issueKeyPattern = /^[A-Z][A-Z0-9_]*-\d+$/;

function requireStoryId(storyId) {
  if (typeof storyId !== 'string' || !storyIdPattern.test(storyId)) throw safeJiraError('Invalid story ID');
  return storyId;
}

function requireIssueKey(issueKey) {
  if (typeof issueKey !== 'string' || !issueKeyPattern.test(issueKey)) throw safeJiraError('Invalid Jira issue key');
  return issueKey;
}

function escapeJql(value) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function retryAfterMilliseconds(response, fallback) {
  const value = response.headers?.get?.('Retry-After');
  if (value === null || value === undefined) return fallback;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : fallback;
}

function textNode(text) { return { type: 'text', text }; }
function paragraph(text) { return { type: 'paragraph', content: [textNode(text)] }; }
function heading(text) { return { type: 'heading', attrs: { level: 2 }, content: [textNode(text)] }; }
function bulletList(values) {
  return { type: 'bulletList', content: values.map(value => ({ type: 'listItem', content: [paragraph(value)] })) };
}

function buildStoryDescription(data) {
  const content = [];
  if (data.userStory) {
    content.push(heading('User story'), paragraph(data.userStory.trim()));
  }
  const criteria = (Array.isArray(data.acceptanceCriteria) ? data.acceptanceCriteria : [])
    .map(value => String(value).replace(/^\s*(?:[-*]\s*)?\[[ xX]\]\s*/, '').trim()).filter(Boolean);
  if (criteria.length) content.push(heading('Acceptance criteria'), bulletList(criteria));
  const dependencies = (Array.isArray(data.dependencies) ? data.dependencies : []).map(String).filter(Boolean);
  if (dependencies.length) content.push(heading('Dependencies'), bulletList(dependencies));
  return { version: 1, type: 'doc', content };
}
class JIRAService {
  constructor(config, fetchImpl = globalThis.fetch, options = {}) {
    this.config = config;
    this.fetch = fetchImpl;
    this.projectRoot = options.projectRoot;
    this.sleep = options.sleep || (ms => new Promise(resolve => setTimeout(resolve, ms)));
    this.apiConfig = {
      url: config.api_url,
      token: config.api_token,
      email: config.email,
      projectKey: config.project_key,
      issueType: config.issue_type,
      browseBaseUrl: config.browse_base_url,
      epicKey: config.epic_key
    };
    this.retryAttempts = Number.isInteger(config.retry_attempts) && config.retry_attempts > 0 ? config.retry_attempts : 3;
    this.retryDelay = Number.isFinite(config.retry_delay) && config.retry_delay >= 0 ? config.retry_delay : 1000;
  }

  pendingPath(storyId) {
    requireStoryId(storyId);
    return join(this.projectRoot, '.agent-workflow', 'jira-import-pending', `${storyId}.json`);
  }

  browseUrl(issueKey) {
    requireIssueKey(issueKey);
    const apiBase = requireApprovedJiraBaseUrl(this.apiConfig.url);
    let browseBase = this.apiConfig.browseBaseUrl;
    if (!browseBase) {
      const apiUrl = new URL(apiBase);
      if (apiUrl.hostname.endsWith('.atlassian.net')) browseBase = apiBase;
    }
    if (!browseBase) throw safeJiraError('Configure jira.browse_base_url before Jira writes');
    let url;
    try { url = new URL(browseBase); } catch { throw safeJiraError('Configure a valid Jira browse_base_url'); }
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.atlassian\.net$/i.test(url.hostname) || url.protocol !== 'https:' || url.username || url.password || url.port || (url.pathname !== '/' && url.pathname !== '') || url.search || url.hash) {
      throw safeJiraError('Configure a valid Jira browse_base_url');
    }
    return `${url.origin}/browse/${encodeURIComponent(issueKey)}`;
  }

  async request(path, { method = 'GET', body = undefined, ambiguousOnFailure = false, expectJson = true } = {}) {
    const baseUrl = requireApprovedJiraBaseUrl(this.apiConfig.url);
    const options = {
      redirect: 'error', method,
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.apiConfig.email}:${this.apiConfig.token}`).toString('base64')}`,
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' })
      }
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    let response;
    try { response = await this.fetch(`${baseUrl}/rest/api/3${path}`, options); }
    catch {
      throw safeJiraError('Jira request failed', null, { ambiguous: ambiguousOnFailure });
    }
    if (!response.ok) {
      const ambiguous = ambiguousOnFailure && response.status >= 500;
      throw safeJiraError(`Jira request failed with HTTP ${response.status}`, response.status, { ambiguous, response });
    }
    if (response.status === 204 || !expectJson) return { response, data: null };
    try { return { response, data: await response.json() }; }
    catch { throw safeJiraError('Jira response was invalid', response.status, { ambiguous: ambiguousOnFailure }); }
  }

  async searchStoryIssues(storyId) {
    requireStoryId(storyId);
    const marker = `aw-story-${storyId}`;
    const jql = `project = "${escapeJql(this.apiConfig.projectKey)}" AND labels = "${escapeJql(marker)}"`;
    const matches = [];
    const seenTokens = new Set();
    let nextPageToken;
    for (;;) {
      const body = { jql, fields: ['key', 'labels', 'project', 'issuetype'], maxResults: 100 };
      if (nextPageToken) body.nextPageToken = nextPageToken;
      const { data } = await this.request('/search/jql', { method: 'POST', body });
      if (!Array.isArray(data?.issues)) throw safeJiraError('Jira search response was invalid');
      for (const issue of data.issues) {
        if (!Array.isArray(issue.fields?.labels) || !issue.fields.labels.includes(marker)) continue;
        const projectKey = issue.fields.project?.key;
        const issueType = issue.fields.issuetype?.name;
        if (issueKeyPattern.test(issue.key || '') && projectKey === this.apiConfig.projectKey && issueType === this.apiConfig.issueType) {
          matches.push({ key: issue.key, projectKey, issueType });
        } else {
          throw safeJiraError('Jira marker match does not use the configured project issue type');
        }
      }
      if (data.isLast === true) break;
      nextPageToken = data.nextPageToken;
      if (!nextPageToken || seenTokens.has(nextPageToken)) throw safeJiraError('Jira search pagination was invalid');
      seenTokens.add(nextPageToken);
    }
    return matches;
  }

  buildTicketPayload(data) {
    const storyId = requireStoryId(data.storyId);
    if (!this.apiConfig.issueType) throw safeJiraError('Configure jira.issue_type before importing stories');
    const fields = {
      project: { key: this.apiConfig.projectKey },
      issuetype: { name: this.apiConfig.issueType },
      summary: String(data.summary || '').trim(),
      description: buildStoryDescription(data),
      labels: [`aw-story-${storyId}`]
    };
    if (!fields.summary) throw safeJiraError('Story summary is required');
    if (this.apiConfig.epicKey) {
      const parentKey = requireIssueKey(this.apiConfig.epicKey);
      if (!parentKey.startsWith(`${this.apiConfig.projectKey}-`)) throw safeJiraError('Configured Jira Epic parent must belong to the selected project');
      fields.parent = { key: parentKey };
    }
    return { fields };
  }

  async persistPending(storyId) {
    const path = this.pendingPath(storyId);
    mkdirSync(dirname(path), { recursive: true });
    const marker = { storyId, label: `aw-story-${storyId}`, createdAt: new Date().toISOString() };
    let descriptor;
    try {
      descriptor = openSync(path, 'wx', 0o600);
      writeFileSync(descriptor, JSON.stringify(marker));
      fsyncSync(descriptor);
    } catch (error) {
      if (error.code === 'EEXIST') throw safeJiraError(`Jira import for ${storyId} is already pending; no issue was created`);
      throw safeJiraError('Unable to persist pending Jira import state');
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  }

  readPending(storyId) {
    const path = this.pendingPath(storyId);
    if (!existsSync(path)) return null;
    let marker;
    try { marker = JSON.parse(readFileSync(path, 'utf8')); }
    catch { throw safeJiraError('Pending Jira import state is unreadable; resolve it manually'); }
    if (marker?.storyId !== storyId || marker?.label !== `aw-story-${storyId}`) throw safeJiraError('Pending Jira import state does not match the requested story');
    return marker;
  }

  async createStoryIssue(data) {
    const storyId = requireStoryId(data.storyId);
    this.browseUrl('DEMO-1');
    const pending = this.readPending(storyId);
    let matches = await this.searchStoryIssues(storyId);
    if (matches.length > 1) throw safeJiraError(`Multiple Jira issues match ${storyId}; no issue was created`);
    if (matches.length === 1) return { key: matches[0].key, url: this.browseUrl(matches[0].key), reused: true };
    if (pending) throw safeJiraError(`Jira import for ${storyId} is unresolved; explicitly resolve its pending marker before another create`);
    const payload = this.buildTicketPayload(data);
    await this.persistPending(storyId);
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const { response, data: result } = await this.request('/issue', { method: 'POST', body: payload, ambiguousOnFailure: true });
        if (typeof result?.key !== 'string' || !issueKeyPattern.test(result.key)) {
          throw safeJiraError('Jira create response did not contain a valid issue key', null, { ambiguous: true });
        }
        const key = result.key;
        return { key, url: this.browseUrl(key), created: true };
      } catch (error) {
        if (error.status === 429) {
          matches = await this.searchStoryIssues(storyId);
          if (matches.length === 1) return { key: matches[0].key, url: this.browseUrl(matches[0].key), reused: true };
          if (matches.length > 1) throw safeJiraError(`Multiple Jira issues match ${storyId}; pending import was retained`);
          if (attempt < this.retryAttempts) {
            await this.sleep(retryAfterMilliseconds(error.response, this.retryDelay));
            continue;
          }
          throw safeJiraError('Jira rate limit prevented issue creation; pending import was retained', 429);
        }
        if (error.ambiguous) {
          matches = await this.searchStoryIssues(storyId);
          if (matches.length === 1) return { key: matches[0].key, url: this.browseUrl(matches[0].key), reused: true };
          if (matches.length > 1) throw safeJiraError(`Multiple Jira issues match ${storyId}; pending import was retained`);
          throw safeJiraError(`Jira issue creation for ${storyId} is ambiguous; pending import was retained`);
        }
        if (error.safe === true) throw error;
        throw safeProviderError('Jira', error);
      }
    }
    throw safeJiraError('Jira issue creation did not complete');
  }

  async getIssue(issueKey) {
    requireIssueKey(issueKey);
    const { data } = await this.request(`/issue/${encodeURIComponent(issueKey)}?fields=key,issuetype,project,issuelinks`);
    if (!data?.key || !issueKeyPattern.test(data.key) || data.fields?.project?.key !== this.apiConfig.projectKey) {
      throw safeJiraError('Jira issue is not available in the configured project');
    }
    return data;
  }

  async linkStories(blockedKey, dependencyKey) {
    requireIssueKey(blockedKey);
    requireIssueKey(dependencyKey);
    if (blockedKey === dependencyKey) return { linked: false, reason: 'A story cannot block itself' };
    let linkType;
    let issue;
    try {
      const types = (await this.request('/issueLinkType')).data?.issueLinkTypes;
      linkType = Array.isArray(types) ? types.find(type => type.name === 'Blocks') : null;
      if (!linkType) return { linked: false, reason: 'Blocks link type is unavailable' };
      issue = (await this.request(`/issue/${encodeURIComponent(blockedKey)}?fields=issuelinks`)).data;
    } catch (error) {
      return { linked: false, reason: error.status === 403 ? 'Issue-link permission denied' : 'Issue-link availability could not be checked' };
    }
    const links = Array.isArray(issue?.fields?.issuelinks) ? issue.fields.issuelinks : [];
    const existing = links.some(link => link.type?.name === 'Blocks' && link.inwardIssue?.key === dependencyKey);
    if (existing) return { linked: true, created: false };
    try {
      await this.request('/issueLink', { method: 'POST', expectJson: false, body: {
        type: { name: linkType.name },
        inwardIssue: { key: blockedKey },
        outwardIssue: { key: dependencyKey }
      } });
      return { linked: true, created: true };
    } catch (error) {
      return { linked: false, reason: error.status === 403 ? 'Issue-link permission denied' : 'Jira could not create the dependency link' };
    }
  }

  clearPending(storyId) {
    const path = this.pendingPath(storyId);
    if (existsSync(path)) unlinkSync(path);
  }

  async syncStory(storyId) {
    this.log('info', `Syncing story ${storyId} with JIRA`, { storyId });
    return { storyId, synced: true };
  }

  log(level, message, meta = {}) {
    console.log(`[JIRAService ${level.toUpperCase()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}


class IntegrationService {
  constructor(configPath = null, options = {}) {
    this.projectRoot = options.projectRoot || resolveConsumerRoot(import.meta.url);
    this.configPath = configPath || join(this.projectRoot, '.agent-workflow/integrations.yaml');
    this.fetch = options.fetch || globalThis.fetch;
    this.environment = options.environment || process.env;
    this.sleep = options.sleep;
    this.config = null;
    this.logger = null;
    this.jiraService = null;
    this.githubService = null;
    this.telegramService = null;
  }

  /**
   * Initialize the integration service
   */
  async init() {
    try {
      this.loadConfig();
      this.initializeLogger();
      this.initializeJiraService();
      this.initializeGitHubService();
      this.initializeTelegramService();
      this.log('info', 'IntegrationService initialized successfully');
      return true;
    } catch (error) {
      this.log('error', `Failed to initialize IntegrationService: ${error.message}`);
      throw error;
    }
  }

  /**
   * Load configuration from YAML file
   */
  loadConfig() {
    this.config = existsSync(this.configPath)
      ? this.parseYAML(readFileSync(this.configPath, 'utf-8'))
      : { integrations: { enabled: true, jira: null, github: null, telegram: null } };
  }

  /**
   * Parse YAML content (simple parser)
   */
  parseYAML(content) {
    const config = { integrations: { enabled: true, jira: null, github: null, telegram: null } };
    const globalEnabled = content.match(/^  enabled:[ \t]*(true|false)(?:[ \t]*#.*)?[ \t]*$/m);
    if (globalEnabled) config.integrations.enabled = globalEnabled[1] === 'true';
    let section = null;
    for (const line of content.split(/\r?\n/)) {
      const top = line.match(/^  (jira|github|telegram|logging):\s*$/);
      if (top) { section = top[1]; config.integrations[section] = {}; continue; }
      const field = line.match(/^    ([\w-]+):\s*(.*?)\s*(?:#.*)?$/);
      if (!field || !section) continue;
      if (section === 'jira' && ['api_url', 'api_token', 'email'].includes(field[1])) continue;
      let value = field[2].replace(/^['"]|['"]$/g, '');
      value = value.replace(/\$\{([A-Z_][A-Z0-9_]*)\}/g, (placeholder, name) => this.environment[name] ?? placeholder);
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+(?:\.\d+)?$/.test(value)) value = Number(value);
      config.integrations[section][field[1]] = value;
    }
    return config;
  }

  /**
   * Initialize logger
   */
  initializeLogger() {
    const logConfig = this.config.integrations?.logging || {};

    this.logger = {
      info: (message, meta = {}) => this.log('info', message, meta),
      error: (message, meta = {}) => this.log('error', message, meta),
      warn: (message, meta = {}) => this.log('warn', message, meta),
      debug: (message, meta = {}) => this.log('debug', message, meta)
    };

    // Create log file if needed
    if (logConfig.enabled) {
      const logFile = logConfig.log_file || 'logs/integration.log';
      const logPath = join(this.projectRoot, logFile);
      mkdirSync(dirname(logPath), { recursive: true });
      this.logFilePath = logPath;
    }
  }

  /**
   * Initialize JIRA service
   */
  initializeJiraService() {
    const config = this.config.integrations?.jira;
    const required = ['JIRA_API_URL', 'JIRA_PROJECT_KEY', 'JIRA_EMAIL', 'JIRA_API_TOKEN'];
    if (this.config.integrations.enabled !== true || config?.enabled !== true || required.some(name => !this.environment[name])) return;
    this.jiraService = new JIRAService({ ...config, api_url: this.environment.JIRA_API_URL,
      project_key: this.environment.JIRA_PROJECT_KEY, email: this.environment.JIRA_EMAIL,
      api_token: this.environment.JIRA_API_TOKEN }, this.fetch, { projectRoot: this.projectRoot, sleep: this.sleep });
  }

  /**
   * Initialize GitHub service
   */
  initializeGitHubService() {
    const githubConfig = this.config.integrations?.github;
    if (githubConfig?.enabled) {
      this.githubService = new GitHubService({ ...githubConfig,
        personal_access_token: this.environment.GITHUB_TOKEN ?? githubConfig.personal_access_token }, this.fetch);
      this.log('info', 'GitHub service initialized');
    } else {
      this.log('debug', 'GitHub integration disabled');
    }
  }

  /**
   * Initialize Telegram service
   */
  initializeTelegramService() {
    const telegramConfig = this.config.integrations?.telegram;
    if (telegramConfig?.enabled) {
      this.telegramService = new TelegramService({ ...telegramConfig,
        bot_token: this.environment.TELEGRAM_BOT_TOKEN ?? telegramConfig.bot_token,
        user_id: this.environment.TELEGRAM_USER_ID ?? telegramConfig.user_id }, this.fetch);
      this.log('info', 'Telegram service initialized');
    } else {
      this.log('debug', 'Telegram integration disabled');
    }
  }

  /**
   * Log a message
   */
  log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };

    console.log(`[${logEntry.level.toUpperCase()}] ${logEntry.timestamp}: ${logEntry.message}`, meta ? JSON.stringify(meta) : '');

    // Write to log file if enabled
    if (this.logFilePath) {
      try {
        appendFileSync(this.logFilePath, `${JSON.stringify(logEntry)}\n`);
      } catch {
        console.error('Failed to write integration log');
      }
    }
  }

  /**
   * Check if integrations are enabled
   */
  areIntegrationsEnabled() {
    return this.config.integrations.enabled === true;
  }

  /**
   * Get integration status
   */
  getIntegrationStatus() {
    const status = (name, service) => ({ enabled: Boolean(service), configured: Boolean(this.config.integrations?.[name]?.enabled) });
    return { enabled: this.areIntegrationsEnabled(), jira: status('jira', this.jiraService),
      github: status('github', this.githubService), telegram: status('telegram', this.telegramService) };
  }

  requireJiraService() {
    if (!this.jiraService) throw new Error('JIRA integration is not enabled');
    return this.jiraService;
  }

  async searchJiraStory(storyId) {
    return this.requireJiraService().searchStoryIssues(storyId);
  }

  async createJiraStory(data) {
    const jira = this.requireJiraService();
    try { return await jira.createStoryIssue(data); }
    catch (error) {
      const safe = safeProviderError('Jira', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  async getJiraIssue(issueKey) {
    return this.requireJiraService().getIssue(issueKey);
  }

  getJiraBrowseUrl(issueKey) {
    return this.requireJiraService().browseUrl(issueKey);
  }

  async linkJiraStories(blockedKey, dependencyKey) {
    return this.requireJiraService().linkStories(blockedKey, dependencyKey);
  }

  hasPendingJiraImport(storyId) {
    return this.requireJiraService().readPending(storyId) !== null;
  }

  clearPendingJiraImport(storyId) {
    return this.requireJiraService().clearPending(storyId);
  }

  resolvePendingJiraImport(storyId, confirmNotCreated = false) {

    const jira = this.requireJiraService();
    if (!confirmNotCreated) throw safeJiraError('Explicit confirmation is required to resolve pending Jira state');
    if (!existsSync(jira.pendingPath(storyId))) throw safeJiraError('No pending Jira import exists for this story');
    jira.clearPending(storyId);
  }

  /**
   * Create GitHub issue
   */
  async createGitHubIssue(data) {
    if (!this.githubService) {
      throw new Error('GitHub integration is not enabled');
    }

    try {
      return await this.githubService.createIssue(data);
    } catch (error) {
      const safe = safeProviderError('GitHub', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  /**
   * Send Telegram notification
   */
  async sendTelegramNotification(event, context) {
    if (!this.telegramService) {
      throw new Error('Telegram integration is not enabled');
    }

    try {
      return await this.telegramService.sendNotification(event, context);
    } catch (error) {
      const safe = safeProviderError('Telegram', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  /**
   * Sync story with JIRA
   */
  async syncStoryWithJira(storyId) {
    if (!this.jiraService) {
      throw new Error('JIRA integration is not enabled');
    }

    try {
      return await this.jiraService.syncStory(storyId);
    } catch (error) {
      const safe = safeProviderError('Jira', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  /**
   * Sync story with GitHub
   */
  async syncStoryWithGitHub(storyId) {
    if (!this.githubService) {
      throw new Error('GitHub integration is not enabled');
    }

    try {
      return await this.githubService.syncStory(storyId);
    } catch (error) {
      const safe = safeProviderError('GitHub', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  /**
   * Close integration service
   */
  async close() {
    if (this.jiraService) {
      await this.jiraService.close?.();
    }
    if (this.githubService) {
      await this.githubService.close?.();
    }
    if (this.telegramService) {
      await this.telegramService.close?.();
    }
    this.log('info', 'IntegrationService closed');
  }
}

/**
 * JIRA Service
 */

/**
 * GitHub Service
 */
class GitHubService {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.apiConfig = {
      url: config.api_url,
      token: config.personal_access_token,
      repo: config.repo,
      defaultBranch: config.default_branch,
      issuePrefix: config.issue_prefix,
      branchPrefix: config.branch_prefix
    };
    this.apiVersion = config.api_version || '2022-11-28';
    this.retryAttempts = config.retry_attempts || 3;
    this.retryDelay = config.retry_delay || 1000;
  }

  /**
   * Create GitHub issue
   */
  async createIssue(data) {
    const { apiConfig, retryAttempts, retryDelay } = this;
    const endpoint = `${apiConfig.url}/repos/${apiConfig.repo}/issues`;

    const payload = this.buildIssuePayload(data);

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const response = await this.fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiConfig.token}`,
            'Accept': `application/vnd.github.${this.apiVersion}+json`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          this.log('info', `Created GitHub issue: ${result.number}`, { number: result.number });
          return result.number;
        }
        const error = new Error('GitHub request failed');
        error.status = response.status;
        throw error;
      } catch (error) {
        this.log('warn', `GitHub request attempt ${attempt}/${retryAttempts} failed`,
          Number.isInteger(error?.status) ? { statusCode: error.status } : {});
        if (attempt === retryAttempts) throw safeProviderError('GitHub', error);
        await this.sleep(retryDelay);
      }
    }
  }

  /**
   * Build issue payload
   */
  buildIssuePayload(data) {
    const { apiConfig } = this;
    const labels = data.labels || [];

    return {
      title: data.title || 'Untitled issue',
      body: data.body || '',
      labels: labels,
      assignees: data.assignees || [],
      milestone: data.milestone
    };
  }

  /**
   * Sync story with GitHub
   */
  async syncStory(storyId) {
    this.log('info', `Syncing story ${storyId} with GitHub`, { storyId });
    // Implementation depends on story content
    return { storyId, synced: true };
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log
   */
  log(level, message, meta = {}) {
    console.log(`[GitHubService ${level.toUpperCase()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

/**
 * Telegram Service
 */
class TelegramService {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.apiConfig = {
      botToken: config.bot_token,
      userId: config.user_id,
      maxMessageLength: config.max_message_length || 500
    };
  }

  /**
   * Send Telegram notification
   */
  async sendNotification(event, context) {
    const { apiConfig } = this;
    const message = this.buildMessage(event, context);

    if (message.length > apiConfig.maxMessageLength) {
      this.log('warn', `Message exceeds max length, truncating to ${apiConfig.maxMessageLength}`, { event });
      message.truncate(apiConfig.maxMessageLength);
    }

    const endpoint = `https://api.telegram.org/bot${apiConfig.botToken}/sendMessage`;

    try {
      const response = await this.fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: apiConfig.userId,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      if (response.ok) {
        const result = await response.json();
        this.log('info', 'Telegram notification sent successfully', { messageId: result.message_id });
        return result.message_id;
      }
      const error = new Error('Telegram request failed');
      error.status = response.status;
      throw error;
    } catch (error) {
      const safe = safeProviderError('Telegram', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
  }

  /**
   * Build notification message
   */
  buildMessage(event, context) {
    const { apiConfig } = this;
    const icons = {
      pipeline_started: '🚀',
      task_progress: '🚀',
      task_completed: '✨',
      compilation_requested: '⚠️',
      compilation_succeeded: '✅',
      compilation_failed: '❌',
      code_review_passed: '✅',
      code_review_failed: '❌',
      pr_created: '🚢',
      pr_merged: '🎉',
      pr_rejected: '❌',
      review_passed: '👍',
      review_failed: '⚠️',
      errors_encountered: '❌'
    };

    const icon = icons[event] || 'ℹ️';
    let message = `${icon} **${event.replace(/_/g, ' ').toUpperCase()}**`;

    if (context.task_id) {
      message += `\n\n**Task**: ${context.task_id}`;
    }

    if (context.story) {
      message += `\n**Story**: ${context.story}`;
    }

    if (context.branch) {
      message += `\n**Branch**: ${context.branch}`;
    }

    if (context.description) {
      const desc = context.description.substring(0, 300);
      message += `\n\n${desc}`;
    }

    if (context.progress !== undefined) {
      message += `\n\n**Progress**: ${context.progress}`;
    }

    return message;
  }

  /**
   * Log
   */
  log(level, message, meta = {}) {
    console.log(`[TelegramService ${level.toUpperCase()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

// Export
export default IntegrationService;