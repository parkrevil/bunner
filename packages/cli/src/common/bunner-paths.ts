import { join } from 'path';

export const BUNNER_DIRNAME = '.bunner' as const;
export const BUNNER_CACHE_DIRNAME = 'cache' as const;
export const BUNNER_CARDS_DIRNAME = 'cards' as const;
export const BUNNER_TEMP_DIRNAME = '.bunner-temp' as const;

export function bunnerDirPath(projectRoot: string): string {
  return join(projectRoot, BUNNER_DIRNAME);
}

export function bunnerCacheDirPath(projectRoot: string): string {
  return join(projectRoot, BUNNER_DIRNAME, BUNNER_CACHE_DIRNAME);
}

export function bunnerCacheFilePath(projectRoot: string, fileName: string): string {
  return join(projectRoot, BUNNER_DIRNAME, BUNNER_CACHE_DIRNAME, fileName);
}

export function bunnerCardsDirPath(projectRoot: string): string {
  return join(projectRoot, BUNNER_DIRNAME, BUNNER_CARDS_DIRNAME);
}

export function bunnerCardMarkdownPath(projectRoot: string, slug: string): string {
  return join(bunnerCardsDirPath(projectRoot), `${slug}.card.md`);
}

export function bunnerTempDirPath(outDir: string): string {
  return join(outDir, BUNNER_TEMP_DIRNAME);
}

export function bunnerCardsPrefixRel(): string {
  return `${BUNNER_DIRNAME}/${BUNNER_CARDS_DIRNAME}/`;
}

export function bunnerCardsGlobRel(): string {
  return `${bunnerCardsPrefixRel()}**/*.card.md`;
}
