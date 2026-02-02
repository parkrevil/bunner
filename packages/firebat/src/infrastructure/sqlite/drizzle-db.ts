import { drizzle } from 'drizzle-orm/bun-sqlite';

import type { Database } from 'bun:sqlite';

import * as schema from './schema';

const createDrizzleDb = (client: Database) => drizzle({ client, schema });

export type FirebatDrizzleDb = ReturnType<typeof createDrizzleDb>;
export { createDrizzleDb };
