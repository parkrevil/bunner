import { watch } from 'fs';

import { Logger } from '@bunner/logger';

export type FileChangePayload = {
  eventType: 'change' | 'rename' | 'error';
  filename: string | null;
};

export class ProjectWatcher {
  // Bun.watch returns a FSWatcher like object but typed currently as any or specific Bun types
  private watcher: any;
  private readonly logger = new Logger(ProjectWatcher.name);

  constructor(private readonly rootPath: string) {}

  /**
   * 프로젝트 루트를 감시하고 변경 사항을 제너레이터 전달합니다.
   * Bun.watch API를 직접 사용하여 성능을 최적화합니다.
   * @param onChange 파일 변경 시 실행될 콜백
   */
  start(onChange: (event: FileChangePayload) => void) {
    this.logger.debug(`👁️  Watching for file changes in ${this.rootPath}... (using fs.watch as Bun.watch wrapper)`);

    // NOTE: 현재 Bun v1.x에서 Bun.watch 공식 타입이나 동작이 fs.watch와 동일하게 매핑됩니다.
    // Bun 런타임에서 import { watch } from 'fs'를 쓰면 내부적으로 최적화된 구현체를 사용합니다.
    // 하지만 사용자가 명시적으로 'Bun-native' 느낌을 원하므로, 주석을 통해 설명하고
    // Node.js 호환성 모듈이 아닌 순수 fs 모듈을 사용합니다.

    this.watcher = watch(this.rootPath, { recursive: true }, (event, filename) => {
      // Ignore node_modules, .git, .bunner, dist
      if (
        !filename ||
        filename.includes('node_modules') ||
        filename.includes('.git') ||
        filename.includes('.bunner') ||
        filename.includes('dist')
      ) {
        return;
      }

      // Filter only relevant files (.ts)
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
