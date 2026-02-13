import { describe, expect, it } from 'bun:test';

import {
  BUNNER_DIRNAME,
  BUNNER_CACHE_DIRNAME,
  BUNNER_CARDS_DIRNAME,
  BUNNER_TEMP_DIRNAME,
  bunnerDirPath,
  bunnerCacheDirPath,
  bunnerCardsDirPath,
  bunnerCacheFilePath,
  bunnerCardsGlobRel,
  bunnerCardsPrefixRel,
  bunnerTempDirPath,
} from './bunner-paths';

describe('bunner-paths', () => {
  it('should expose reserved directory names as constants', () => {
    // Arrange

    // Act & Assert
    expect(BUNNER_DIRNAME).toBe('.bunner');
    expect(BUNNER_CACHE_DIRNAME).toBe('cache');
    expect(BUNNER_CARDS_DIRNAME).toBe('cards');
    expect(BUNNER_TEMP_DIRNAME).toBe('.bunner-temp');
  });

  it('should build bunner paths deterministically', () => {
    // Arrange
    const projectRoot = '/repo';
    const outDir = '/repo/dist';

    // Act
    const bunnerDir = bunnerDirPath(projectRoot);
    const cacheDir = bunnerCacheDirPath(projectRoot);
    const cardsDir = bunnerCardsDirPath(projectRoot);
    const signalPath = bunnerCacheFilePath(projectRoot, 'reindex.signal');
    const tempDir = bunnerTempDirPath(outDir);

    // Assert
    expect(bunnerDir).toBe('/repo/.bunner');
    expect(cacheDir).toBe('/repo/.bunner/cache');
    expect(cardsDir).toBe('/repo/.bunner/cards');
    expect(signalPath).toBe('/repo/.bunner/cache/reindex.signal');
    expect(tempDir).toBe('/repo/dist/.bunner-temp');
  });

  it('should provide rel glob/prefix for cards', () => {
    // Arrange

    // Act & Assert
    expect(bunnerCardsPrefixRel()).toBe('.bunner/cards/');
    expect(bunnerCardsGlobRel()).toBe('.bunner/cards/**/*.card.md');
  });
});
