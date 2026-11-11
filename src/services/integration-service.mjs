/**
 * Integration Service
 * Centralized service for managing JIRA, GitHub, and Telegram integrations
 * for agent-workflow pipeline
 */

import { join, dirname } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolveConsumerRoot } from './project-root.mjs';
import { requireApprovedJiraBaseUrl } from './jira-url.mjs';
function safeProviderError(provider, error) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  const guidance = provider === 'Jira' ? '; check credentials and project permissions' : '';
  const safe = new Error(`${provider} request failed${status === null ? '' : ` with HTTP ${status}`}${guidance}`);
  if (status !== null) safe.status = status;
  return safe;
}


class IntegrationService {
  constructor(configPath = null, options = {}) {
    this.projectRoot = options.projectRoot || resolveConsumerRoot(import.meta.url);
    this.configPath = configPath || join(this.projectRoot, '.agent-workflow/integrations.yaml');
    this.fetch = options.fetch || globalThis.fetch;
    this.environment = options.environment || process.env;
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
      api_token: this.environment.JIRA_API_TOKEN }, this.fetch);
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

  /**
   * Create JIRA ticket
   */
  async createJiraTicket(ticketType, data) {
    if (!this.jiraService) {
      throw new Error('JIRA integration is not enabled');
    }

    try {
      return await this.jiraService.createTicket(ticketType, data);
    } catch (error) {
      const safe = safeProviderError('Jira', error);
      this.log('error', safe.message, safe.status === undefined ? {} : { statusCode: safe.status });
      throw safe;
    }
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
class JIRAService {
  constructor(config, fetchImpl = globalThis.fetch) {
    this.config = config;
    this.fetch = fetchImpl;
    this.apiConfig = {
      url: config.api_url,
      token: config.api_token,
      email: config.email,
      projectKey: config.project_key,
      epicPrefix: config.epic_prefix,
      requirementPrefix: config.requirement_prefix,
      taskPrefix: config.task_prefix
    };
    this.retryAttempts = config.retry_attempts || 3;
    this.retryDelay = config.retry_delay || 1000;
  }

  /**
   * Create JIRA ticket
   */
  async createTicket(ticketType, data) {
    const { apiConfig, retryAttempts, retryDelay } = this;
    const baseUrl = requireApprovedJiraBaseUrl(apiConfig.url);
    const endpoint = `${baseUrl}/rest/api/${apiConfig.apiVersion || '3'}/issue`;
    const payload = this.buildTicketPayload(ticketType, data);

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const response = await this.fetch(endpoint, {
          redirect: 'error',
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${apiConfig.email}:${apiConfig.token}`)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (response.ok) return (await response.json()).key;
        const error = new Error('Jira request failed');
        error.status = response.status;
        throw error;
      } catch (error) {
        this.log('warn', `Jira request attempt ${attempt}/${retryAttempts} failed`,
          Number.isInteger(error?.status) ? { statusCode: error.status } : {});
        if (attempt === retryAttempts) throw safeProviderError('Jira', error);
        await this.sleep(retryDelay);
      }
    }
  }

  /**
   * Build ticket payload
   */
  buildTicketPayload(ticketType, data) {
    const { apiConfig } = this;
    const issueTypeMap = {
      epic: 'Epic',
      requirement: 'Story',
      task: 'Task'
    };

    return {
      fields: {
        project: { key: apiConfig.projectKey },
        issuetype: { name: issueTypeMap[ticketType] || 'Task' },
        summary: data.summary || 'Untitled ticket',
        description: data.description || '',
        labels: data.labels || [`${ticketType}`]
      }
    };
  }

  /**
   * Sync story with JIRA
   */
  async syncStory(storyId) {
    this.log('info', `Syncing story ${storyId} with JIRA`, { storyId });
    // Implementation depends on story content
    // This will be detailed in the implementation phase
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
    console.log(`[JIRAService ${level.toUpperCase()}] ${message}`, meta ? JSON.stringify(meta) : '');
  }
}

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