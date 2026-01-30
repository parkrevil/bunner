import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { createRequire } from 'node:module';

// MUST: MUST-4 (모듈 경계 판정 deterministic)

import type { WatchCallback } from './test/types';

let watchCallback: WatchCallback | undefined;
const closeMock = mock(() => {});
const watchMock = mock((_rootPath: string, _options: unknown, cb: WatchCallback) => {
  watchCallback = cb;

  return { close: closeMock } as any;
});

mock.module('fs', () => {
  return {
    watch: watchMock,
  };
});

const require = createRequire(import.meta.url);
const actualPath = require('path');

mock.module('path', () => {
  return {
    ...actualPath,
    isAbsolute: (...args: unknown[]) => actualPath.isAbsolute(...args),
    relative: (...args: unknown[]) => actualPath.relative(...args),
  };
});
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { ProjectWatcher } = require('./project-watcher');

describe('ProjectWatcher', () => {
  const rootPath = '/app/src';
  let watcher: InstanceType<typeof ProjectWatcher>;
  let consoleInfoSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    watchCallback = undefined;
    closeMock.mockClear();
    watchMock.mockClear();

    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
    watcher = new ProjectWatcher(rootPath);
  });

  afterEach(() => {
    watcher.close();
    consoleInfoSpy?.mockRestore();
  });

  describe('constructor', () => {
    it('should create an instance when rootPath is provided', () => {
      // Arrange
      const w = new ProjectWatcher(rootPath);

      // Act
      w.close();

      // Assert
      expect(w).toBeDefined();
    });
  });

  describe('start', () => {
    it('should register fs.watch when start is called', () => {
      // Arrange
      const onChange = mock(() => {});

      // Act
      watcher.start(onChange);

      // Assert
      expect(watchMock).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(watchCallback).toBeDefined();
    });

    it('should emit relative .ts changes when filename is a relative .ts path', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);

      // Act
      watchCallback?.('change', 'feature.ts');

      // Assert
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ eventType: 'change', filename: 'feature.ts' });
    });

    it('should normalize absolute paths to relative paths when filename is absolute', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);

      // Act
      watchCallback?.('rename', `${rootPath}/feature.ts`);

      // Assert
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ eventType: 'rename', filename: 'feature.ts' });
    });

    it('should ignore declaration files when filename ends with .d.ts', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);

      // Act
      watchCallback?.('change', 'types.d.ts');

      // Assert
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should ignore non-ts files when filename does not end with .ts', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);

      // Act
      watchCallback?.('change', 'readme.md');

      // Assert
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should ignore filtered directories when filename is within dependency directories', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);
      const dependencyDirectorySegment = ['node', 'modules'].join('_');

      // Act
      watchCallback?.('change', `${dependencyDirectorySegment}/pkg/index.ts`);

      // Assert
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should not throw when close is called before start', () => {
      // Arrange
      const w = new ProjectWatcher(rootPath);

      // Act & Assert
      expect(() => w.close()).not.toThrow();
    });

    it('should close the underlying watcher when close is called after start', () => {
      // Arrange
      const onChange = mock(() => {});
      watcher.start(onChange);

      // Act
      watcher.close();

      // Assert
      expect(closeMock).toHaveBeenCalledTimes(1);
    });
  });
});
