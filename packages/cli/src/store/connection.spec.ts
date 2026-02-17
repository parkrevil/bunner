import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';

import { createDb, SCHEMA_VERSION } from './connection';
import * as ops from './store-ops';

describe('store/connection (unit)', () => {
  let openDbSpy: ReturnType<typeof spyOn> | undefined;
  let runMigrationsSpy: ReturnType<typeof spyOn> | undefined;
  let deleteSqliteFilesSyncSpy: ReturnType<typeof spyOn> | undefined;
  let readExistingSchemaVersionSpy: ReturnType<typeof spyOn> | undefined;
  let hasAnyUserObjectsSpy: ReturnType<typeof spyOn> | undefined;
  let ensureSchemaVersionSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    openDbSpy = spyOn(ops, 'openDb').mockImplementation((_path: string) => {
      return {
        $client: { close: mock(() => {}), run: mock((_q: any) => {}) },
      } as any;
    });

    runMigrationsSpy = spyOn(ops, 'runMigrations').mockImplementation((_db: any, _folder: string) => {});
    deleteSqliteFilesSyncSpy = spyOn(ops, 'deleteSqliteFilesSync').mockImplementation((_path: string) => {});
    readExistingSchemaVersionSpy = spyOn(ops, 'readExistingSchemaVersion').mockImplementation((_db: any) => 2 as number | null);
    hasAnyUserObjectsSpy = spyOn(ops, 'hasAnyUserObjects').mockImplementation((_db: any) => false);
    ensureSchemaVersionSpy = spyOn(ops, 'ensureSchemaVersion').mockImplementation((_db: any, _v: number) => {});
  });

  afterEach(() => {
    openDbSpy?.mockRestore();
    runMigrationsSpy?.mockRestore();
    deleteSqliteFilesSyncSpy?.mockRestore();
    readExistingSchemaVersionSpy?.mockRestore();
    hasAnyUserObjectsSpy?.mockRestore();
    ensureSchemaVersionSpy?.mockRestore();
  });

  it('does not rebuild when schema_version matches', () => {
    // Arrange
    readExistingSchemaVersionSpy!.mockReturnValueOnce(SCHEMA_VERSION);

    // Act
    const db = createDb('/tmp/a.sqlite');

    // Assert
    expect(openDbSpy!).toHaveBeenCalledTimes(1);
    expect(deleteSqliteFilesSyncSpy!).toHaveBeenCalledTimes(0);
    expect(runMigrationsSpy!).toHaveBeenCalledTimes(1);
    expect(ensureSchemaVersionSpy!).toHaveBeenCalledTimes(1);
    expect(db).toBeDefined();
  });

  it('configures PRAGMA settings on open', () => {
    // Arrange
    const runSpy = mock((_q: any) => {});
    openDbSpy!.mockReturnValueOnce({ $client: { close: mock(() => {}), run: runSpy } } as any);
    readExistingSchemaVersionSpy!.mockReturnValueOnce(SCHEMA_VERSION);

    // Act
    createDb('/tmp/pragma.sqlite');

    // Assert
    expect(runSpy).toHaveBeenCalledTimes(2);
    expect(runSpy).toHaveBeenNthCalledWith(1, expect.anything());
    expect(runSpy).toHaveBeenNthCalledWith(2, expect.anything());
  });

  it('rebuilds when schema_version mismatches', () => {
    // Arrange
    readExistingSchemaVersionSpy!.mockReturnValueOnce(SCHEMA_VERSION + 1);
    const closeSpy = mock(() => {});

    openDbSpy!
      .mockReturnValueOnce({ $client: { close: closeSpy, run: mock(() => {}) } } as any)
      .mockReturnValueOnce({ $client: { close: mock(() => {}), run: mock(() => {}) } } as any);

    // Act
    createDb('/tmp/b.sqlite');

    // Assert
    expect(openDbSpy!).toHaveBeenCalledTimes(2);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(deleteSqliteFilesSyncSpy!).toHaveBeenCalledTimes(1);
    expect(runMigrationsSpy!).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when schema_version is missing but user objects exist', () => {
    // Arrange
    readExistingSchemaVersionSpy!.mockReturnValueOnce(null);
    hasAnyUserObjectsSpy!.mockReturnValueOnce(true);

    const closeSpy = mock(() => {});
    openDbSpy!
      .mockReturnValueOnce({ $client: { close: closeSpy, run: mock(() => {}) } } as any)
      .mockReturnValueOnce({ $client: { close: mock(() => {}), run: mock(() => {}) } } as any);

    // Act
    createDb('/tmp/c.sqlite');

    // Assert
    expect(openDbSpy!).toHaveBeenCalledTimes(2);
    expect(hasAnyUserObjectsSpy!).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(deleteSqliteFilesSyncSpy!).toHaveBeenCalledTimes(1);
  });

  it('rebuilds and retries when migrations fail on a file db', () => {
    // Arrange
    readExistingSchemaVersionSpy!.mockReturnValueOnce(SCHEMA_VERSION);
    const closeSpy = mock(() => {});

    openDbSpy!
      .mockReturnValueOnce({ $client: { close: closeSpy, run: mock(() => {}) } } as any)
      .mockReturnValueOnce({ $client: { close: mock(() => {}), run: mock(() => {}) } } as any);

    runMigrationsSpy!
      .mockImplementationOnce(() => {
        throw new Error('migrate failed');
      })
      .mockImplementationOnce(() => {});

    // Act
    createDb('/tmp/d.sqlite');

    // Assert
    expect(runMigrationsSpy!).toHaveBeenCalledTimes(2);
    expect(deleteSqliteFilesSyncSpy!).toHaveBeenCalledTimes(1);
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('rethrows migration failure for :memory: db (non-deletable)', () => {
    // Arrange
    readExistingSchemaVersionSpy!.mockReturnValueOnce(SCHEMA_VERSION);
    runMigrationsSpy!.mockImplementationOnce(() => {
      throw new Error('migrate failed');
    });

    // Act & Assert
    expect(() => createDb(':memory:')).toThrow();
    expect(deleteSqliteFilesSyncSpy!).toHaveBeenCalledTimes(0);
  });
});
