import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, chmodSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const installer = join(root, 'install.sh');
const shell = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
function fixture() {
  const home = mkdtempSync(join(tmpdir(), 'aw-install-home-'));
  const project = mkdtempSync(join(tmpdir(), 'aw-install-project-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (cwd, script = installer, args = [], extraEnv = {}) => {
    const result = spawnSync(shell, [script, ...args], { cwd, env: { ...env, ...extraEnv }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    return result.stdout;
  };
  const clean = () => { for (const dir of [home, project]) { try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows may retain a child cwd handle briefly. */ } } };
  return { home, project, env, run, clean };
}

test('Claude and Codex project installs distribute the target-neutral runtime', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--target', 'claude']);
    for (const file of ['integration-service.mjs', 'integration-cli.mjs', 'project-root.mjs', 'jira-url.mjs']) assert.equal(existsSync(join(f.project, `.agent-workflow/runtime/${file}`)), true);
    assert.equal(existsSync(join(f.project, '.agent-workflow/integrations.yaml')), true);
    f.run(f.project, installer, ['--target', 'codex']);
    assert.equal(existsSync(join(f.project, '.codex/skills')), true);
    assert.equal(existsSync(join(f.project, '.agent-workflow/runtime/integration-cli.mjs')), true);
  } finally { f.clean(); }
});

test('all target deploys runtime and update preserves config and unmanaged files', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--target', 'all']);
    const configPath = join(f.project, '.agent-workflow/integrations.yaml');
    const config = '# user-owned config\nintegrations:\n  enabled: true\n';
    writeFileSync(configPath, config);
    const unmanaged = join(f.project, '.agent-workflow/user-file.txt');
    writeFileSync(unmanaged, 'keep');
    const managedOld = join(f.project, '.claude/commands/obsolete.md');
    const unmanagedCommand = join(f.project, '.claude/commands/user-owned.md');
    writeFileSync(managedOld, 'remove on update');
    writeFileSync(unmanagedCommand, 'preserve');
    const toolManifest = join(f.project, '.claude/.aw-manifest');
    writeFileSync(toolManifest, `${readFileSync(toolManifest, 'utf8')}commands/obsolete.md\n`);
    writeFileSync(join(f.project, '.agent-workflow/runtime/integration-cli.mjs'), 'stale');
    f.run(f.project, installer, ['update', '--target', 'all']);
    assert.equal(readFileSync(configPath, 'utf8'), config);
    assert.equal(readFileSync(unmanaged, 'utf8'), 'keep');
    assert.equal(existsSync(managedOld), false);
    assert.equal(readFileSync(unmanagedCommand, 'utf8'), 'preserve');
    assert.notEqual(readFileSync(join(f.project, '.agent-workflow/runtime/integration-cli.mjs'), 'utf8'), 'stale');
    const manifest = readFileSync(join(f.project, '.agent-workflow/.aw-manifest'), 'utf8');
    for (const file of ['integration-service.mjs', 'integration-cli.mjs', 'project-root.mjs', 'jira-url.mjs']) assert.ok(manifest.split('\n').includes(`runtime/${file}`));
    assert.doesNotMatch(manifest, /integrations\.yaml/);
  } finally { f.clean(); }
});

test('global install followed by cached init does not clone', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--global', '--target', 'claude']);
    const bin = join(f.home, 'bin');
    mkdirSync(bin);
    const gitShim = join(bin, 'git');
    writeFileSync(gitShim, '#!/usr/bin/env bash\nexit 99\n');
    chmodSync(gitShim, 0o755);
    const path = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
    const init = join(f.home, '.claude/agent-workflow/install.sh');
    f.run(f.project, init, ['init'], { PATH: path });
    assert.equal(existsSync(join(f.project, '.agent-workflow/runtime/integration-cli.mjs')), true);
    assert.equal(existsSync(join(f.project, '.agent-workflow/integrations.yaml')), true);
  } finally { f.clean(); }
});
test('global Codex install followed by cached Codex init works without clone', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--global', '--target', 'codex']);
    const bin = join(f.home, 'bin');
    mkdirSync(bin);
    const gitShim = join(bin, 'git');
    writeFileSync(gitShim, '#!/usr/bin/env bash\nexit 99\n');
    chmodSync(gitShim, 0o755);
    const path = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
    const init = join(f.home, '.claude/agent-workflow/install.sh');
    f.run(f.project, init, ['init', '--target', 'codex'], { PATH: path });
    for (const file of ['integration-service.mjs', 'integration-cli.mjs', 'project-root.mjs', 'jira-url.mjs']) assert.equal(existsSync(join(f.project, `.agent-workflow/runtime/${file}`)), true);
    assert.equal(existsSync(join(f.project, '.agent-workflow/integrations.yaml')), true);
  } finally { f.clean(); }
});
test('cached Codex update and all target use the cached builder without clone', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--global', '--target', 'codex']);
    const cache = join(f.home, '.claude/agent-workflow');
    const builder = join(cache, 'bin/aw-build.mjs');
    assert.equal(existsSync(builder), true);
    const bin = join(f.home, 'bin');
    mkdirSync(bin);
    const gitShim = join(bin, 'git');
    writeFileSync(gitShim, '#!/usr/bin/env bash\nexit 99\n');
    chmodSync(gitShim, 0o755);
    const path = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
    const cachedInstaller = join(cache, 'install.sh');
    f.run(f.project, cachedInstaller, ['update', '--target', 'codex'], { PATH: path });
    assert.equal(existsSync(join(f.project, '.codex/skills')), true);
    f.run(f.project, cachedInstaller, ['update', '--target', 'all'], { PATH: path });
    assert.equal(existsSync(join(f.project, '.claude/commands')), true);
    assert.equal(existsSync(join(f.project, '.codex/skills')), true);
    assert.equal(existsSync(builder), true);
  } finally { f.clean(); }
});
test('cached installer can repeat global install without self-copy or clone', () => {
  const f = fixture();
  try {
    f.run(f.project, installer, ['--global', '--target', 'all']);
    const cache = join(f.home, '.claude/agent-workflow');
    const bin = join(f.home, 'bin');
    mkdirSync(bin);
    const gitShim = join(bin, 'git');
    writeFileSync(gitShim, '#!/usr/bin/env bash\nexit 99\n');
    chmodSync(gitShim, 0o755);
    const path = `${bin}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
    const cachedInstaller = join(cache, 'install.sh');
    const output = f.run(f.project, cachedInstaller, ['--global', '--target', 'all'], { PATH: path });
    assert.match(output, /Tooling installed \(global Claude \+ Codex/);
    assert.doesNotMatch(output, /same file|cannot copy|failed to cache/i);
    assert.equal(existsSync(join(f.home, '.claude/commands')), true);
    assert.equal(existsSync(join(f.home, '.codex/skills')), true);
    assert.equal(existsSync(join(cache, 'bin/aw-build.mjs')), true);
  } finally { f.clean(); }
});
