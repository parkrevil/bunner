import type { StoreDb } from './connection';

export interface StorePort {
  createDb(path: string): StoreDb;
  closeDb(db: StoreDb): void;
  readonly schemaVersion: number;
}
