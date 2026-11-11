import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const hook = resolve('src/hooks/pre-integrate/00-integration-check.sh');
for (const [label, config] of [['missing', null], ['disabled', 'integrations:\n  jira:\n    enabled: false\n'], ['incomplete', 'integrations:\n  jira:\n    enabled: true\n']]) {
  test(`${label} Jira leaves ordinary project untouched`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'aw-hook-'));
    try {
      if (config !== null) { const target = join(dir, '.agent-workflow'); mkdirSync(target); writeFileSync(join(target, 'integrations.yaml'), config); }
      const before = readdirSync(dir);
      const result = spawnSync(shell, [hook], { cwd: dir, env: { ...process.env, JIRA_API_URL: '', JIRA_PROJECT_KEY: '', JIRA_EMAIL: '', JIRA_API_TOKEN: '' } });
      assert.equal(result.status, 0);
      assert.deepEqual(readdirSync(dir), before);
    } finally { try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } }
  });
}
test('enabled GitHub keeps its missing-token precondition', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aw-hook-gh-'));
  try {
    mkdirSync(join(dir, '.agent-workflow'));
    writeFileSync(join(dir, '.agent-workflow/integrations.yaml'), 'integrations:\n  github:\n    enabled: true\n');
    const result = spawnSync(shell, [hook], { cwd: dir, env: { ...process.env, GITHUB_TOKEN: '' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr.toString(), /GITHUB_TOKEN/);
  } finally { try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } }
});

test('enabled Telegram keeps its missing-credentials precondition', () => {
  const dir = mkdtempSync(join(tmpdir(), 'aw-hook-tg-'));
  try {
    mkdirSync(join(dir, '.agent-workflow'));
    writeFileSync(join(dir, '.agent-workflow/integrations.yaml'), 'integrations:\n  telegram:\n    enabled: true\n');
    const result = spawnSync(shell, [hook], { cwd: dir, env: { ...process.env, TELEGRAM_BOT_TOKEN: '', TELEGRAM_USER_ID: '' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr.toString(), /TELEGRAM_BOT_TOKEN\s+TELEGRAM_USER_ID/);
  } finally { try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } }
});
test('worktree hook finds shared consumer config for GitHub checks', () => {
  const root = mkdtempSync(join(tmpdir(), 'aw-hook-worktree-'));
  const worktree = join(root, '.worktrees', 'story');
  try {
    mkdirSync(join(root, '.agent-workflow'), { recursive: true });
    mkdirSync(worktree, { recursive: true });
    writeFileSync(join(root, '.agent-workflow/integrations.yaml'), 'integrations:\n  github:\n    enabled: true\n');
    const result = spawnSync(shell, [hook], { cwd: worktree, env: { ...process.env, GITHUB_TOKEN: '' } });
    assert.equal(result.status, 1);
    assert.match(result.stderr.toString(), /GITHUB_TOKEN/);
  } finally { try { rmSync(root, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } }
});
for (const [provider, env, expected] of [
  ['github', { GITHUB_TOKEN: '' }, /GITHUB_TOKEN/],
  ['telegram', { TELEGRAM_BOT_TOKEN: '', TELEGRAM_USER_ID: '' }, /TELEGRAM_BOT_TOKEN\s+TELEGRAM_USER_ID/]
]) {
  test(`CRLF ${provider} config retains missing credential check`, () => {
    const dir = mkdtempSync(join(tmpdir(), `aw-hook-crlf-${provider}-`));
    try {
      mkdirSync(join(dir, '.agent-workflow'));
      writeFileSync(join(dir, '.agent-workflow/integrations.yaml'), `integrations:\r\n  ${provider}:\r\n    enabled: true\r\n`, 'utf8');
      const result = spawnSync(shell, [hook], { cwd: dir, env: { ...process.env, ...env } });
      assert.equal(result.status, 1);
      assert.match(result.stderr.toString(), expected);
    } finally { try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } }
  });
}
