import { watch } from 'fs';

import type { FileChangePayload } from './interfaces';

export class ProjectWatcher {
  private watcher: ReturnType<typeof watch> | undefined;

  constructor(private readonly rootPath: string) {}

  start(onChange: (event: FileChangePayload) => void) {
    console.info(`👁️  Watching for file changes in ${this.rootPath}...`);

    this.watcher = watch(this.rootPath, { recursive: true }, (event, filename) => {
      if (
        typeof filename !== 'string' ||
        filename.length === 0 ||
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
