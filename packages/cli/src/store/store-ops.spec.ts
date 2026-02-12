import { afterAll, beforeEach, describe, expect, it, mock } from 'bun:test';
import { createRequire } from 'node:module';

const rmSyncMock = mock((_path: string, _opts?: unknown) => {});
const drizzleMock = mock((..._args: any[]) => ({ __db: true }));
const migrateMock = mock((_db: any, _opts: any) => {});

mock.module('node:fs', () => {
  return { rmSync: rmSyncMock };
});

mock.module('drizzle-orm/bun-sqlite', () => {
  return { drizzle: drizzleMock };
});

mock.module('drizzle-orm/bun-sqlite/migrator', () => {
  return { migrate: migrateMock };
});

afterAll(() => {
  mock.restore();
  mock.clearAllMocks();
});

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
const ops = require('./store-ops') as typeof import('./store-ops');

describe('store/store-ops (unit)', () => {
  beforeEach(() => {
    rmSyncMock.mockClear();
    drizzleMock.mockClear();
    migrateMock.mockClear();
  });

  describe('deleteSqliteFilesSync', () => {
    it('deletes base, -wal, -shm files with force: true', () => {
      const path = '/tmp/a.sqlite';

      ops.deleteSqliteFilesSync(path);

      expect(rmSyncMock).toHaveBeenCalledTimes(3);
      expect(rmSyncMock).toHaveBeenNthCalledWith(1, path, { force: true });
      expect(rmSyncMock).toHaveBeenNthCalledWith(2, `${path}-wal`, { force: true });
      expect(rmSyncMock).toHaveBeenNthCalledWith(3, `${path}-shm`, { force: true });
    });
  });

  describe('openDb', () => {
    it('opens in-memory db via drizzle({ schema })', () => {
      ops.openDb(':memory:');

      expect(drizzleMock).toHaveBeenCalledTimes(1);
      const call = drizzleMock.mock.calls[0]!;
      expect(call).toHaveLength(1);
      expect(typeof call[0]).toBe('object');
      expect(call[0]).toHaveProperty('schema');
    });

    it('opens file db via drizzle(path, { schema })', () => {
      ops.openDb('/tmp/x.sqlite');

      expect(drizzleMock).toHaveBeenCalledTimes(1);
      const call = drizzleMock.mock.calls[0]!;
      expect(call).toHaveLength(2);
      expect(call[0]).toBe('/tmp/x.sqlite');
      expect(call[1]).toHaveProperty('schema');
    });
  });

  describe('runMigrations', () => {
    it('forwards to migrate(db, { migrationsFolder })', () => {
      const db = { __db: true };
      ops.runMigrations(db, '/migrations');

      expect(migrateMock).toHaveBeenCalledTimes(1);
      expect(migrateMock).toHaveBeenCalledWith(db, { migrationsFolder: '/migrations' });
    });
  });

  describe('readExistingSchemaVersion', () => {
    it('returns null when row missing', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              get: () => undefined,
            }),
          }),
        }),
      };

      expect(ops.readExistingSchemaVersion(db)).toBe(null);
    });

    it('returns null when value is not a string', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              get: () => ({ value: 123 }),
            }),
          }),
        }),
      };

      expect(ops.readExistingSchemaVersion(db)).toBe(null);
    });

    it('returns null when value is not finite number', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              get: () => ({ value: 'NaN' }),
            }),
          }),
        }),
      };

      expect(ops.readExistingSchemaVersion(db)).toBe(null);
    });

    it('returns parsed number when value is numeric string', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              get: () => ({ value: '2' }),
            }),
          }),
        }),
      };

      expect(ops.readExistingSchemaVersion(db)).toBe(2);
    });

    it('returns null when underlying query throws', () => {
      const db = {
        select: () => {
          throw new Error('no table');
        },
      };

      expect(ops.readExistingSchemaVersion(db)).toBe(null);
    });
  });

  describe('hasAnyUserObjects', () => {
    it('returns true when sqlite_master has a non sqlite_% object', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                get: () => ({ name: 'card' }),
              }),
            }),
          }),
        }),
      };

      expect(ops.hasAnyUserObjects(db)).toBe(true);
    });

    it('returns false when sqlite_master returns no row', () => {
      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => ({
                get: () => undefined,
              }),
            }),
          }),
        }),
      };

      expect(ops.hasAnyUserObjects(db)).toBe(false);
    });
  });

  describe('ensureSchemaVersion', () => {
    it('does nothing when schema_version already exists', () => {
      const insertMock = mock(() => ({
        values: mock(() => ({
          run: mock(() => {}),
        })),
      }));

      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              all: () => [{ key: 'schema_version', value: '2' }],
            }),
          }),
        }),
        insert: insertMock,
      };

      ops.ensureSchemaVersion(db, 2);
      expect(insertMock).toHaveBeenCalledTimes(0);
    });

    it('inserts schema_version when missing', () => {
      const runMock = mock(() => {});
      const valuesMock = mock((_v: any) => ({ run: runMock }));
      const insertMock = mock((_t: any) => ({ values: valuesMock }));

      const db = {
        select: () => ({
          from: () => ({
            where: () => ({
              all: () => [],
            }),
          }),
        }),
        insert: insertMock,
      };

      ops.ensureSchemaVersion(db, 7);

      expect(insertMock).toHaveBeenCalledTimes(1);
      expect(valuesMock).toHaveBeenCalledTimes(1);
      expect(valuesMock.mock.calls[0]![0]).toEqual({ key: 'schema_version', value: '7' });
      expect(runMock).toHaveBeenCalledTimes(1);
    });
  });
});
