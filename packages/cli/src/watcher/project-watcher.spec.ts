import { afterAll, afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { createRequire } from 'node:module';

// MUST: MUST-4 (모듈 경계 판정 deterministic)

type ParcelWatchEvent = { type: 'create' | 'update' | 'delete'; path: string };
type ParcelWatchCallback = (err: Error | null, events: Array<ParcelWatchEvent>) => void;

let parcelCallback: ParcelWatchCallback | undefined;
const unsubscribeMock = mock(async () => {});
const subscribeMock = mock(async (_rootPath: string, cb: ParcelWatchCallback, _options?: unknown) => {
  parcelCallback = cb;
  return { unsubscribe: unsubscribeMock } as any;
});

mock.module('@parcel/watcher', () => {
  return {
    subscribe: subscribeMock,
  };
});

const require = createRequire(import.meta.url);
const actualPath = require('path');

mock.module('path', () => {
  return {
    ...actualPath,
    relative: (...args: unknown[]) => actualPath.relative(...args),
  };
});

afterAll(() => {
  mock.restore();
  mock.clearAllMocks();
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const { ProjectWatcher, PROJECT_WATCHER_IGNORE_GLOBS } = require('./project-watcher');

describe('ProjectWatcher', () => {
  const rootPath = '/app/src';
  let watcher: InstanceType<typeof ProjectWatcher>;
  let consoleInfoSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    parcelCallback = undefined;

    unsubscribeMock.mockClear();
    subscribeMock.mockClear();

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
    it('should register @parcel/watcher.subscribe when start is called', async () => {
      // Arrange
      const onChange = mock(() => {});

      // Act
      await watcher.start(onChange);

      // Assert
      expect(subscribeMock).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
      expect(parcelCallback).toBeDefined();
    });

    it('should emit relative .ts changes when a .ts file is updated', async () => {
      // Arrange
      const onChange = mock(() => {});

      await watcher.start(onChange);

      // Act
      parcelCallback?.(null, [{ type: 'update', path: `${rootPath}/feature.ts` }]);

      // Assert
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ eventType: 'change', filename: 'feature.ts' });
    });

    it('should emit delete events when a .ts file is deleted', async () => {
      // Arrange
      const onChange = mock(() => {});

      await watcher.start(onChange);

      // Act
      parcelCallback?.(null, [{ type: 'delete', path: `${rootPath}/feature.ts` }]);

      // Assert
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ eventType: 'delete', filename: 'feature.ts' });
    });

    it('should ignore declaration files when path ends with .d.ts', async () => {
      // Arrange
      const onChange = mock(() => {});

      await watcher.start(onChange);

      // Act
      parcelCallback?.(null, [{ type: 'update', path: `${rootPath}/types.d.ts` }]);

      // Assert
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should ignore non-ts files when path does not end with .ts', async () => {
      // Arrange
      const onChange = mock(() => {});

      await watcher.start(onChange);

      // Act
      parcelCallback?.(null, [{ type: 'update', path: `${rootPath}/readme.md` }]);

      // Assert
      expect(onChange).not.toHaveBeenCalled();
    });

    it('should pass ignore patterns to @parcel/watcher.subscribe', async () => {
      // Arrange
      const onChange = mock(() => {});

      // Act
      await watcher.start(onChange);

      // Assert
      expect(subscribeMock).toHaveBeenCalledWith(
        rootPath,
        expect.any(Function),
        expect.objectContaining({
          ignore: expect.arrayContaining(PROJECT_WATCHER_IGNORE_GLOBS),
        }),
      );
    });
  });

  describe('close', () => {
    it('should not throw when close is called before start', () => {
      // Arrange
      const w = new ProjectWatcher(rootPath);

      // Act & Assert
      expect(() => w.close()).not.toThrow();
    });

    it('should unsubscribe the underlying watcher when close is called after start', async () => {
      // Arrange
      const onChange = mock(() => {});

      await watcher.start(onChange);

      // Act
      await watcher.close();

      // Assert
      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });
});
