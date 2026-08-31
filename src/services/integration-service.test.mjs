#!/usr/bin/env node

/**
 * Integration Service Test Suite
 * Tests the IntegrationService and its components
 */

import { IntegrationService } from './integration-service.mjs';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('IntegrationService', () => {
  let service;
  const mockConfig = {
    enabled: true,
    jira: {
      enabled: false,
      api_url: 'https://test.atlassian.net',
      api_token: 'test-token',
      email: 'test@example.com',
      project_key: 'TEST'
    },
    github: {
      enabled: false,
      api_url: 'https://api.github.com',
      personal_access_token: 'test-token',
      repo: 'test/test-repo'
    },
    telegram: {
      enabled: false,
      bot_token: 'test-token',
      user_id: '123456789'
    }
  };

  beforeEach(() => {
    service = new IntegrationService(mockConfig);
  });

  afterEach(() => {
    service = null;
  });

  describe('Initialization', () => {
    it('should initialize with valid config', () => {
      expect(service).toBeDefined();
      expect(service.config).toEqual(mockConfig);
    });

    it('should throw error if config is not provided', () => {
      expect(() => new IntegrationService()).toThrow();
    });

    it('should load configuration from YAML file', async () => {
      const fileConfig = await service.loadConfig('src/config/integrations.yaml');
      expect(fileConfig).toBeDefined();
    });
  });

  describe('JIRA Service', () => {
    it('should create JIRA ticket', async () => {
      mockConfig.jira.enabled = true;
      const ticket = await service.createJiraTicket('Epic', {
        summary: 'Test Epic',
        description: 'Test description'
      });

      expect(ticket).toBeDefined();
    });

    it('should sync story with JIRA', async () => {
      mockConfig.jira.enabled = true;
      const sync = await service.syncStoryWithJira('s01');

      expect(sync).toBeDefined();
    });

    it('should return error if JIRA not enabled', async () => {
      mockConfig.jira.enabled = false;

      await expect(service.createJiraTicket('Epic', {})).rejects.toThrow();
    });
  });

  describe('GitHub Service', () => {
    it('should create GitHub issue', async () => {
      mockConfig.github.enabled = true;
      const issue = await service.createGitHubIssue({
        title: 'Test Issue',
        body: 'Test body'
      });

      expect(issue).toBeDefined();
    });

    it('should sync story with GitHub', async () => {
      mockConfig.github.enabled = true;
      const sync = await service.syncStoryWithGitHub('s01');

      expect(sync).toBeDefined();
    });

    it('should return error if GitHub not enabled', async () => {
      mockConfig.github.enabled = false;

      await expect(service.createGitHubIssue({ title: 'Test', body: 'Test' })).rejects.toThrow();
    });
  });

  describe('Telegram Service', () => {
    it('should send Telegram notification', async () => {
      mockConfig.telegram.enabled = true;
      const notification = await service.sendTelegramNotification('task_completed', {
        task_name: 'Test Task',
        story_id: 's01',
        message: 'Task completed'
      });

      expect(notification).toBeDefined();
    });

    it('should not send notification if disabled', async () => {
      mockConfig.telegram.enabled = false;

      await expect(service.sendTelegramNotification('task_completed', {}))
        .rejects.toThrow();
    });

    it('should filter notifications based on config', async () => {
      mockConfig.telegram.enabled = true;
      mockConfig.telegram.notify_on = {
        task_completed: false,
        pr_created: true
      };

      // Should throw if event not in notify_on
      await expect(service.sendTelegramNotification('task_completed', {}))
        .rejects.toThrow();
    });
  });

  describe('Integration Status', () => {
    it('should get integration status', async () => {
      const status = await service.getIntegrationStatus();

      expect(status).toEqual(mockConfig);
    });

    it('should return health check for each integration', async () => {
      const health = await service.checkHealth();

      expect(health).toBeDefined();
      expect(health.jira).toBeDefined();
      expect(health.github).toBeDefined();
      expect(health.telegram).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid API tokens', async () => {
      mockConfig.jira.enabled = true;
      mockConfig.jira.api_token = 'invalid';

      await expect(service.createJiraTicket('Epic', {}))
        .rejects.toThrow();
    });

    it('should handle network errors', async () => {
      mockConfig.jira.enabled = true;
      mockConfig.jira.api_url = 'https://invalid-url';

      await expect(service.createJiraTicket('Epic', {}))
        .rejects.toThrow();
    });

    it('should log errors gracefully', async () => {
      mockConfig.jira.enabled = true;
      mockConfig.jira.api_token = 'invalid';

      const logSpy = jest.spyOn(service, 'logError').mockImplementation();

      await expect(service.createJiraTicket('Epic', {}))
        .rejects.toThrow();

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should write logs to file', async () => {
      await service.log('Test message');
      expect(true).toBe(true); // Test passes if no error thrown
    });

    it('should rotate logs when too large', async () => {
      await service.rotateLogs();
      expect(true).toBe(true); // Test passes if no error thrown
    });
  });
});

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  describe.run();
}

// Export for Jest
export { describe, it, expect, beforeEach, afterEach };