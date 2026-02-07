import { z } from 'zod';

// MUST: MUST-1

const envSchema = z
  .object({
    // Bunner fixed env set (requested)
    BUNNER_KB_DB: z.string().min(1),
    BUNNER_KB_USER: z.string().min(1),
    BUNNER_KB_PASSWORD: z.string(),
    BUNNER_KB_PRIMARY_PORT: z.coerce.number().int().positive(),
    BUNNER_KB_REPLICA1_PORT: z.coerce.number().int().positive(),
    BUNNER_KB_REPLICA2_PORT: z.coerce.number().int().positive(),
  })
  .transform((raw) => {
    const encodedUser = encodeURIComponent(raw.BUNNER_KB_USER);
    const encodedPassword = encodeURIComponent(raw.BUNNER_KB_PASSWORD);
    const encodedDb = encodeURIComponent(raw.BUNNER_KB_DB);

    const primary = `postgres://${encodedUser}:${encodedPassword}@localhost:${raw.BUNNER_KB_PRIMARY_PORT}/${encodedDb}`;

    const replicas = [raw.BUNNER_KB_REPLICA1_PORT, raw.BUNNER_KB_REPLICA2_PORT].map((port) => {
      const url = new URL(primary);
      url.port = String(port);
      return url.toString();
    });

    return { kbDatabaseUrl: primary, kbDatabaseUrlReplicas: replicas };
  });

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse({
    BUNNER_KB_DB: source.BUNNER_KB_DB,
    BUNNER_KB_USER: source.BUNNER_KB_USER,
    BUNNER_KB_PASSWORD: source.BUNNER_KB_PASSWORD,
    BUNNER_KB_PRIMARY_PORT: source.BUNNER_KB_PRIMARY_PORT,
    BUNNER_KB_REPLICA1_PORT: source.BUNNER_KB_REPLICA1_PORT,
    BUNNER_KB_REPLICA2_PORT: source.BUNNER_KB_REPLICA2_PORT,
  });
}
