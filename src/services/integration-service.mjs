/**
 * Integration Service
 * Centralized service for managing JIRA, GitHub, and Telegram integrations
 * for agent-workflow pipeline
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class IntegrationService {
  constructor(configPath = null) {
    this.configPath = configPath || join(__dirname, '../../src/config/integrations.yaml');
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
    if (!existsSync(this.configPath)) {
      throw new Error(`Config file not found: ${this.configPath}`);
    }

    const configContent = readFileSync(this.configPath, 'utf-8');

    // Parse YAML manually (simple implementation)
    this.config = this.parseYAML(configContent);
    this.log('debug', 'Configuration loaded');
  }

  /**
   * Parse YAML content (simple parser)
   */
  parseYAML(content) {
    const config = {
      integrations: {
        enabled: true,
        version: '1.0.0',
        jira: null,
        github: null,
        telegram: null
      }
    };

    const lines = content.split('\n');
    let currentSection = 'integrations';
    let currentSubsection = null;

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Check for section headers
      if (trimmedLine.startsWith('integrations:')) {
        currentSection = 'integrations';
        continue;
      }

      if (trimmedLine.startsWith('  jira:')) {
        currentSubsection = 'jira';
        continue;
      }

      if (trimmedLine.startsWith('  github:')) {
        currentSubsection = 'github';
        continue;
      }

      if (trimmedLine.startsWith('  telegram:')) {
        currentSubsection = 'telegram';
        continue;
      }

      // Parse key-value pairs
      const match = trimmedLine.match(/^(\w+):\s*(.*)$/);
      if (match) {
        const key = match[1];
        const value = match[2];

        // Handle environment variables
        if (value.startsWith('${') && value.endsWith('}')) {
          const envVar = value.slice(2, -1);
          const envValue = process.env[envVar];
          if (envValue !== undefined) {
            // Parse nested objects
            if (currentSubsection === 'jira' && key === 'notify_on') {
              config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
              config.integrations[currentSubsection].notify_on = this.parseYAML(value);
            } else if (currentSubsection === 'github' && key === 'default_labels') {
              config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
              config.integrations[currentSubsection].default_labels = this.parseYAML(value);
            } else if (currentSubsection === 'telegram' && key === 'notify_on') {
              config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
              config.integrations[currentSubsection].notify_on = this.parseYAML(value);
            } else {
              config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
              config.integrations[currentSubsection][key] = envValue;
            }
          }
        } else if (key === 'enabled') {
          config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
          config.integrations[currentSubsection].enabled = value === 'true';
        } else {
          config.integrations[currentSubsection] = config.integrations[currentSubsection] || {};
          config.integrations[currentSubsection][key] = value;
        }
      }
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
      const logDir = join(process.cwd(), 'logs');
      if (!existsSync(logDir)) {
        require('fs').mkdirSync(logDir, { recursive: true });
      }
    }
  }

  /**
   * Initialize JIRA service
   */
  initializeJiraService() {
    const jiraConfig = this.config.integrations?.jira;
    if (jiraConfig?.enabled) {
      this.jiraService = new JIRAService(jiraConfig);
      this.log('info', 'JIRA service initialized');
    } else {
      this.log('debug', 'JIRA integration disabled');
    }
  }

  /**
   * Initialize GitHub service
   */
  initializeGitHubService() {
    const githubConfig = this.config.integrations?.github;
    if (githubConfig?.enabled) {
      this.githubService = new GitHubService(githubConfig);
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
      this.telegramService = new TelegramService(telegramConfig);
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
    if (this.config.integrations?.logging?.enabled) {
      const logFile = join(process.cwd(), this.config.integrations.logging.log_file);
      try {
        const logContent = `${JSON.stringify(logEntry)}\n`;
        require('fs').appendFileSync(logFile, logContent);
      } catch (error) {
        console.error(`Failed to write to log file: ${error.message}`);
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
    return {
      enabled: this.areIntegrationsEnabled(),
      jira: {
        enabled: this.jiraService !== null,
        config: this.config.integrations?.jira
      },
      github: {
        enabled: this.githubService !== null,
        config: this.config.integrations?.github
      },
      telegram: {
        enabled: this.telegramService !== null,
        config: this.config.integrations?.telegram
      }
    };
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
      this.log('error', `Failed to create JIRA ticket: ${error.message}`, { ticketType, ...data });
      throw error;
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
      this.log('error', `Failed to create GitHub issue: ${error.message}`, data);
      throw error;
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
      this.log('error', `Failed to send Telegram notification: ${error.message}`, { event, ...context });
      throw error;
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
      this.log('error', `Failed to sync story with JIRA: ${error.message}`, { storyId });
      throw error;
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
      this.log('error', `Failed to sync story with GitHub: ${error.message}`, { storyId });
      throw error;
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
  constructor(config) {
    this.config = config;
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
    const endpoint = `${apiConfig.url}/rest/api/${apiConfig.apiVersion || '3'}/issue`;

    const payload = this.buildTicketPayload(ticketType, data);

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(`${apiConfig.email}:${apiConfig.token}`)}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          const result = await response.json();
          const ticketKey = result.key;
          this.log('info', `Created ${ticketType} ticket: ${ticketKey}`, { ticketKey, ticketType });
          return ticketKey;
        } else {
          const error = await response.text();
          this.log('warn', `Failed to create ${ticketType} ticket (attempt ${attempt}/${retryAttempts}): ${error}`, { ticketType });
          if (attempt === retryAttempts) throw new Error(`Failed to create ${ticketType} ticket: ${error}`);
        }
      } catch (error) {
        this.log('warn', `Error creating ${ticketType} ticket (attempt ${attempt}/${retryAttempts}): ${error.message}`, { ticketType });
        if (attempt === retryAttempts) throw error;
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
  constructor(config) {
    this.config = config;
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
        const response = await fetch(endpoint, {
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
        } else {
          const error = await response.text();
          this.log('warn', `Failed to create GitHub issue (attempt ${attempt}/${retryAttempts}): ${error}`, data);
          if (attempt === retryAttempts) throw new Error(`Failed to create GitHub issue: ${error}`);
        }
      } catch (error) {
        this.log('warn', `Error creating GitHub issue (attempt ${attempt}/${retryAttempts}): ${error.message}`, data);
        if (attempt === retryAttempts) throw error;
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
  constructor(config) {
    this.config = config;
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
      const response = await fetch(endpoint, {
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
        this.log('info', `Telegram notification sent successfully`, { messageId: result.message_id });
        return result.message_id;
      } else {
        const error = await response.text();
        throw new Error(`Telegram API error: ${error}`);
      }
    } catch (error) {
      this.log('error', `Failed to send Telegram notification: ${error.message}`, { event });
      throw error;
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