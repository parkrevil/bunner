import { describe, expect, it } from 'bun:test';
import { mkdir, rm } from 'fs/promises';
import { dirname, join } from 'path';

import { ConfigLoader } from './config-loader';
import { ConfigLoadError } from './errors';

async function createTempDir(): Promise<string> {
  const baseDir = join(process.cwd(), '.tmp-config-loader');

  await rm(baseDir, { recursive: true, force: true });
  await mkdir(baseDir, { recursive: true });

  return baseDir;
}

async function writeFileContent(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await Bun.write(filePath, content);
}

describe('ConfigLoader', () => {
  it('should throw when both bunner.json and bunner.jsonc exist', async () => {
    const projectRoot = await createTempDir();

    try {
      await writeFileContent(join(projectRoot, 'bunner.json'), '{}');
      await writeFileContent(join(projectRoot, 'bunner.jsonc'), '{}');

      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('should throw when bunner config is missing', async () => {
    const projectRoot = await createTempDir();

    try {
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('should reject entry outside sourceDir', async () => {
    const projectRoot = await createTempDir();
    const configPath = join(projectRoot, 'bunner.json');

    try {
      await writeFileContent(
        configPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'main.ts',
          },
          null,
          2,
        ),
      );

      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('should reject module.fileName containing a path', async () => {
    const projectRoot = await createTempDir();
    const configPath = join(projectRoot, 'bunner.json');

    try {
      await writeFileContent(
        configPath,
        JSON.stringify(
          {
            module: { fileName: 'modules/__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
          },
          null,
          2,
        ),
      );

      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('should load valid json config with sourceDir and entry', async () => {
    const projectRoot = await createTempDir();
    const configPath = join(projectRoot, 'bunner.json');

    try {
      await writeFileContent(
        configPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
          },
          null,
          2,
        ),
      );

      const result = await ConfigLoader.load(projectRoot);

      expect(result.source.format).toBe('json');
      expect(result.config.sourceDir).toBe('src');
      expect(result.config.entry).toBe('src/main.ts');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});