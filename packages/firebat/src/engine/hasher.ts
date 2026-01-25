import xxhash from 'xxhash-wasm';

let hasherInstance: Awaited<ReturnType<typeof xxhash>> | null = null;
const hasherPromise = xxhash();

export const initHasher = async (): Promise<void> => {
  hasherInstance ??= await hasherPromise;
};

export const hashString = (input: string): string => {
  if (!hasherInstance) {
    throw new Error('Hasher not initialized. Call initHasher() first.');
  }

  return hasherInstance.h64ToString(input);
};

// Firebat's detectors are currently synchronous (tests call them synchronously).
// Ensure the wasm hasher is initialized at module-load time so callers don't need
// to remember to call initHasher().
await initHasher();
