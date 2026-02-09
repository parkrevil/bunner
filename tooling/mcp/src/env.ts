import { z } from 'zod';

const DEFAULT_POOL_MAX = 26;
const DEFAULT_POOL_IDLE_TIMEOUT_SEC = 60;
const DEFAULT_POOL_CONN_TIMEOUT_SEC = 10;
const DEFAULT_POOL_MAX_LIFETIME_SEC = 3600;

// MUST: MUST-1

const envSchema = z
  .object({
    // Bunner fixed env set (requested)
    BUNNER_KB_DB_NAME: z.string().min(1),
    BUNNER_KB_DB_USER: z.string().min(1),
    BUNNER_KB_DB_PASSWORD: z.string(),
    BUNNER_KB_DB_HOST: z.string().min(1),
    BUNNER_KB_DB_PRIMARY_PORT: z.coerce.number().int().positive(),
    BUNNER_KB_DB_REPLICA1_PORT: z.coerce.number().int().positive(),
    BUNNER_KB_DB_REPLICA2_PORT: z.coerce.number().int().positive(),

		// Optional DB session timeouts (ms)
		BUNNER_KB_DB_STATEMENT_TIMEOUT_MS: z.coerce.number().int().positive().optional(),
		BUNNER_KB_DB_LOCK_TIMEOUT_MS: z.coerce.number().int().positive().optional(),

    // Optional pool configuration (seconds unless noted)
    BUNNER_KB_DB_POOL_MAX: z.coerce.number().int().positive().optional(),
    BUNNER_KB_DB_POOL_IDLE_TIMEOUT_SEC: z.coerce.number().int().positive().optional(),
    BUNNER_KB_DB_POOL_CONN_TIMEOUT_SEC: z.coerce.number().int().positive().optional(),
    BUNNER_KB_DB_POOL_MAX_LIFETIME_SEC: z.coerce.number().int().positive().optional(),
  })
  .transform((raw) => {
    const encodedUser = encodeURIComponent(raw.BUNNER_KB_DB_USER);
    const encodedPassword = encodeURIComponent(raw.BUNNER_KB_DB_PASSWORD);
    const encodedDb = encodeURIComponent(raw.BUNNER_KB_DB_NAME);

    const primaryHostRaw = raw.BUNNER_KB_DB_HOST;
    const primaryHostForAuthority =
      primaryHostRaw.startsWith('[') && primaryHostRaw.endsWith(']')
        ? primaryHostRaw
        : primaryHostRaw.includes(':')
          ? `[${primaryHostRaw}]`
          : primaryHostRaw;
    const primaryBaseUrl = new URL(
      `postgres://${encodedUser}:${encodedPassword}@${primaryHostForAuthority}:${raw.BUNNER_KB_DB_PRIMARY_PORT}/${encodedDb}`,
    );
    const primaryBase = primaryBaseUrl.toString();

    function withPgTimeoutOptions(urlString: string): string {
      const url = new URL(urlString);
      const optionParts: string[] = [];
      if (raw.BUNNER_KB_DB_STATEMENT_TIMEOUT_MS) {
        optionParts.push(`-c statement_timeout=${raw.BUNNER_KB_DB_STATEMENT_TIMEOUT_MS}`);
      }
      if (raw.BUNNER_KB_DB_LOCK_TIMEOUT_MS) {
        optionParts.push(`-c lock_timeout=${raw.BUNNER_KB_DB_LOCK_TIMEOUT_MS}`);
      }

      if (optionParts.length > 0) {
        const existing = url.searchParams.get('options');
        const merged = existing ? `${existing} ${optionParts.join(' ')}` : optionParts.join(' ');
        url.searchParams.set('options', merged);
      }

      return url.toString();
    }

    const primary = withPgTimeoutOptions(primaryBase);

		const replicas = [raw.BUNNER_KB_DB_REPLICA1_PORT, raw.BUNNER_KB_DB_REPLICA2_PORT].map((port) => {
			const url = new URL(primary);
      url.port = String(port);
      return url.toString();
    });

    return {
      kbDatabaseUrl: primary,
      kbDatabaseUrlReplicas: replicas,
      pool: {
        max: raw.BUNNER_KB_DB_POOL_MAX ?? DEFAULT_POOL_MAX,
        idleTimeoutSec: raw.BUNNER_KB_DB_POOL_IDLE_TIMEOUT_SEC ?? DEFAULT_POOL_IDLE_TIMEOUT_SEC,
        connectionTimeoutSec: raw.BUNNER_KB_DB_POOL_CONN_TIMEOUT_SEC ?? DEFAULT_POOL_CONN_TIMEOUT_SEC,
        maxLifetimeSec: raw.BUNNER_KB_DB_POOL_MAX_LIFETIME_SEC ?? DEFAULT_POOL_MAX_LIFETIME_SEC,
      },
    };
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse({
    BUNNER_KB_DB_NAME: source.BUNNER_KB_DB_NAME,
    BUNNER_KB_DB_USER: source.BUNNER_KB_DB_USER,
    BUNNER_KB_DB_PASSWORD: source.BUNNER_KB_DB_PASSWORD,
    BUNNER_KB_DB_HOST: source.BUNNER_KB_DB_HOST,
    BUNNER_KB_DB_PRIMARY_PORT: source.BUNNER_KB_DB_PRIMARY_PORT,
    BUNNER_KB_DB_REPLICA1_PORT: source.BUNNER_KB_DB_REPLICA1_PORT,
    BUNNER_KB_DB_REPLICA2_PORT: source.BUNNER_KB_DB_REPLICA2_PORT,

		BUNNER_KB_DB_STATEMENT_TIMEOUT_MS: source.BUNNER_KB_DB_STATEMENT_TIMEOUT_MS,
		BUNNER_KB_DB_LOCK_TIMEOUT_MS: source.BUNNER_KB_DB_LOCK_TIMEOUT_MS,

    BUNNER_KB_DB_POOL_MAX: source.BUNNER_KB_DB_POOL_MAX,
    BUNNER_KB_DB_POOL_IDLE_TIMEOUT_SEC: source.BUNNER_KB_DB_POOL_IDLE_TIMEOUT_SEC,
    BUNNER_KB_DB_POOL_CONN_TIMEOUT_SEC: source.BUNNER_KB_DB_POOL_CONN_TIMEOUT_SEC,
    BUNNER_KB_DB_POOL_MAX_LIFETIME_SEC: source.BUNNER_KB_DB_POOL_MAX_LIFETIME_SEC,
  });
}
