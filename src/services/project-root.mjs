import { existsSync } from 'node:fs';
import { dirname, basename, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveConsumerRoot(moduleUrl, workingDirectory = process.cwd()) {
  if (process.env.AW_PROJECT_ROOT) return resolve(process.env.AW_PROJECT_ROOT);

  let directory = resolve(workingDirectory);
  let nearestWorkflowDirectory = null;
  for (;;) {
    const workflowDirectory = join(directory, '.agent-workflow');
    if (existsSync(join(workflowDirectory, 'integrations.yaml'))) return directory;
    if (nearestWorkflowDirectory === null && existsSync(workflowDirectory)) nearestWorkflowDirectory = directory;
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }

  const moduleDirectory = dirname(fileURLToPath(moduleUrl));
  if (basename(moduleDirectory) === 'runtime' && basename(dirname(moduleDirectory)) === '.agent-workflow') {
    return dirname(dirname(moduleDirectory));
  }
  if (nearestWorkflowDirectory !== null) return nearestWorkflowDirectory;
  return resolve(workingDirectory);
}
