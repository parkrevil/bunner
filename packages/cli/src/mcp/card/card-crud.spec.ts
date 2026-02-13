import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';

import type { ResolvedBunnerConfig } from '../../common/interfaces';
import type { CardFile } from './types';

import * as fsp from 'node:fs/promises';

import * as crud from './card-crud';
import * as fs from './card-fs';
import { bunnerCardMarkdownPath } from '../../common/bunner-paths';

describe('mcp/card — card CRUD (unit)', () => {
  const config: ResolvedBunnerConfig = {
    module: { fileName: 'module.ts' },
    sourceDir: './src',
    entry: './src/main.ts',
    mcp: {
      card: { types: ['spec'], relations: ['depends_on', 'references', 'related', 'extends', 'conflicts'] },
      exclude: [],
    },
  };

  let bunFileSpy: ReturnType<typeof spyOn> | undefined;
  let mkdirSpy: ReturnType<typeof spyOn> | undefined;
  let renameSpy: ReturnType<typeof spyOn> | undefined;
  let readCardFileSpy: ReturnType<typeof spyOn> | undefined;
  let writeCardFileSpy: ReturnType<typeof spyOn> | undefined;

  type FakeBunFile = {
    exists: () => Promise<boolean>;
    delete: () => Promise<void>;
  };

  const fakeExists = new Map<string, boolean>();

  function setExists(path: string, exists: boolean) {
    fakeExists.set(path, exists);
  }

  function makeFakeBunFile(path: string): FakeBunFile {
    return {
      exists: async () => fakeExists.get(path) ?? false,
      delete: async () => {
        setExists(path, false);
      },
    };
  }

  beforeEach(() => {
    fakeExists.clear();
    bunFileSpy = spyOn(Bun as any, 'file').mockImplementation((path: string) => makeFakeBunFile(path));
    mkdirSpy = spyOn(fsp, 'mkdir').mockResolvedValue(undefined as any);
    renameSpy = spyOn(fsp, 'rename').mockResolvedValue(undefined as any);

    readCardFileSpy = spyOn(fs, 'readCardFile').mockResolvedValue({
      filePath: bunnerCardMarkdownPath('/repo', 'auth/login'),
      frontmatter: {
        key: 'spec::auth/login',
        type: 'spec',
        summary: 'S',
        status: 'draft',
      },
      body: 'Body\n',
    } satisfies CardFile);

    writeCardFileSpy = spyOn(fs, 'writeCardFile').mockResolvedValue();
  });

  afterEach(() => {
    bunFileSpy?.mockRestore();
    mkdirSpy?.mockRestore();
    renameSpy?.mockRestore();
    readCardFileSpy?.mockRestore();
    writeCardFileSpy?.mockRestore();
  });

  it('cardCreate validates type and writes file', async () => {
    // Arrange
    setExists(bunnerCardMarkdownPath('/repo', 'auth/login'), false);

    // Act
    const out = await crud.cardCreate({
      projectRoot: '/repo',
      config,
      type: 'spec',
      slug: 'auth/login',
      summary: 'Login',
      body: 'B\n',
      keywords: ['auth'],
    });

    // Assert
    expect(out.fullKey).toBe('spec::auth/login');
    expect(out.filePath).toBe(bunnerCardMarkdownPath('/repo', 'auth/login'));
    expect(mkdirSpy!).toHaveBeenCalledTimes(1);
    expect(writeCardFileSpy!).toHaveBeenCalledTimes(1);
  });

  it('cardCreate rejects unknown types', async () => {
    await expect(() =>
      crud.cardCreate({
        projectRoot: '/repo',
        config,
        type: 'unknown',
        slug: 'a',
        summary: 'S',
        body: '',
      }),
    ).toThrow();
  });

  it('cardUpdate updates summary/body/keywords', async () => {
    // Arrange
    readCardFileSpy!.mockResolvedValueOnce({
      filePath: bunnerCardMarkdownPath('/repo', 'auth/login'),
      frontmatter: { key: 'spec::auth/login', type: 'spec', summary: 'Old', status: 'draft' },
      body: 'OldBody\n',
    });

    // Act
    const out = await crud.cardUpdate('/repo', 'spec::auth/login', {
      summary: 'New',
      body: 'NewBody\n',
      keywords: ['k1', 'k2'],
    });

    // Assert
    expect(out.card.frontmatter.summary).toBe('New');
    expect(out.card.frontmatter.keywords).toEqual(['k1', 'k2']);
    expect(out.card.body).toBe('NewBody\n');
    expect(writeCardFileSpy!).toHaveBeenCalledTimes(1);
  });

  it('cardDelete deletes when exists', async () => {
    // Arrange
    setExists(bunnerCardMarkdownPath('/repo', 'auth/login'), true);

    // Act
    const out = await crud.cardDelete('/repo', 'spec::auth/login');

    // Assert
    expect(out.filePath).toBe(bunnerCardMarkdownPath('/repo', 'auth/login'));
    expect(bunFileSpy!).toHaveBeenCalledWith(bunnerCardMarkdownPath('/repo', 'auth/login'));
    expect(await Bun.file(bunnerCardMarkdownPath('/repo', 'auth/login')).exists()).toBe(false);
  });

  it('cardRename renames file and updates key', async () => {
    // Arrange
    setExists(bunnerCardMarkdownPath('/repo', 'auth/login'), true);
    setExists(bunnerCardMarkdownPath('/repo', 'auth/new'), false);

    readCardFileSpy!.mockResolvedValueOnce({
      filePath: bunnerCardMarkdownPath('/repo', 'auth/new'),
      frontmatter: { key: 'spec::auth/login', type: 'spec', summary: 'S', status: 'draft' },
      body: 'Body\n',
    });

    // Act
    const out = await crud.cardRename('/repo', 'spec::auth/login', 'auth/new');

    // Assert
    expect(out.newFullKey).toBe('spec::auth/new');
    expect(renameSpy!).toHaveBeenCalledTimes(1);
    expect(writeCardFileSpy!).toHaveBeenCalledTimes(1);
    expect(out.card.frontmatter.key).toBe('spec::auth/new');
  });
});
