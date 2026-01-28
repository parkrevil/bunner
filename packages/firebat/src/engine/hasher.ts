import xxhash, { type XXHashAPI } from 'xxhash-wasm';

let hasherInstance: XXHashAPI | null = null;
const hasherPromise: Promise<XXHashAPI> = xxhash();

const initHasher = async (): Promise<void> => {
  hasherInstance ??= await hasherPromise;
};

const hashString = (input: string): string => {
  if (!hasherInstance) {
    throw new Error('Hasher not initialized. Call initHasher() first.');
  }

  return hasherInstance.h64ToString(input);
};

// Firebat's detectors are currently synchronous (tests call them synchronously).
// Ensure the wasm hasher is initialized at module-load time so callers don't need
// to remember to call initHasher().
await initHasher();

export { initHasher, hashString };
