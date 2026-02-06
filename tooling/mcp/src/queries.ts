import * as path from 'node:path';

// MUST: MUST-1

export type QueryName = '001_extensions' | '010_kb_schema';

const here = import.meta.dir;
const queriesDir = path.resolve(here, '../queries');

export async function readQuery(name: QueryName): Promise<string> {
  const filePath = path.resolve(queriesDir, `${name}.sql`);
  return Bun.file(filePath).text();
}
