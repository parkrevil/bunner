export type Db = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

// MUST: MUST-1

export async function createDb(databaseUrl: string): Promise<Db> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const postgresMod = await import('postgres');
    const postgres = (postgresMod as { default: (url: string, options?: unknown) => unknown }).default;

    const sqlClient = postgres(databaseUrl, {
      prepare: false,
      max: 5,
      idle_timeout: 10,
    });

    return {
      query: async (sql, params = []) => {
        const client = sqlClient as (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>;
        const resultRows = (await client([sql] as unknown as TemplateStringsArray, ...params)) as unknown[];
        return { rows: resultRows };
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Postgres client not available. Install the 'postgres' package or provide a DB adapter. Original error: ${message}`,
    );
  }
}
