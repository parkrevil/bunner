import { watch } from 'fs';

import { Logger } from '@bunner/logger';

import type { FileChangePayload } from './interfaces';

export class ProjectWatcher {
  private watcher: any;
  private readonly logger = new Logger(ProjectWatcher.name);

  constructor(private readonly rootPath: string) {}

  start(onChange: (event: FileChangePayload) => void) {
    this.logger.debug(`👁️  Watching for file changes in ${this.rootPath}... (using fs.watch as Bun.watch wrapper)`);

    this.watcher = watch(this.rootPath, { recursive: true }, (event, filename) => {
      if (
        !filename ||
        filename.includes('node_modules') ||
        filename.includes('.git') ||
        filename.includes('.bunner') ||
        filename.includes('dist')
      ) {
        return;
      }

      if (!filename.endsWith('.ts')) {
        return;
      }

      onChange({ eventType: event, filename });
    });
  }

  close() {
    if (this.watcher) {
      this.watcher.close();
    }
  }
}
