import { defineConfig } from 'drizzle-kit';

import { readEnv } from './src/env';

export default defineConfig({
  dialect: 'postgresql',
  schema: './tooling/mcp/drizzle/schema.ts',
  out: './tooling/mcp/drizzle',
  dbCredentials: {
    url: readEnv(process.env).kbDatabaseUrl,
  },
  migrations: {
    schema: 'drizzle',
    table: '__drizzle_migrations',
  },
});
