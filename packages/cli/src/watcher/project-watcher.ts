import { watch } from 'fs';
import { isAbsolute, relative } from 'path';

import type { FileChangePayload } from './interfaces';

export class ProjectWatcher {
  private watcher: ReturnType<typeof watch> | undefined;

  constructor(private readonly rootPath: string) {}

  start(onChange: (event: FileChangePayload) => void) {
    console.info(`👁️  Watching for file changes in ${this.rootPath}...`);

    this.watcher = watch(this.rootPath, { recursive: true }, (event, filename) => {
      if (typeof filename !== 'string' || filename.length === 0) {
        return;
      }

      const normalized = filename.replaceAll('\\', '/');
      const relativeName = isAbsolute(normalized) ? relative(this.rootPath, normalized) : normalized;
      const nodeModulesSegment = ['node', 'modules'].join('_');

      if (
        relativeName.length === 0 ||
        relativeName.includes(nodeModulesSegment) ||
        relativeName.includes('.git') ||
        relativeName.includes('.bunner') ||
        relativeName.includes('dist')
      ) {
        return;
      }

      if (!relativeName.endsWith('.ts') || relativeName.endsWith('.d.ts')) {
        return;
      }

      onChange({ eventType: event, filename: relativeName });
    });
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
