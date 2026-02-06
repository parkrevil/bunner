import { z } from 'zod';

// MUST: MUST-1

const envSchema = z.object({
  BUNNER_KB_DATABASE_URL: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

export function readEnv(source: Record<string, string | undefined>): Env {
  return envSchema.parse({
    BUNNER_KB_DATABASE_URL: source.BUNNER_KB_DATABASE_URL,
  });
}
