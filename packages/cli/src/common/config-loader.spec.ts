import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test';
import { join } from 'path';

// MUST: MUST-10 (config source 선택)
// MUST: MUST-11 (json/jsonc 파싱)
// MUST: MUST-12 (sourceDir/entry/module.fileName 검증)

import type { FileSetup } from '../../test/shared/interfaces';

import { createBunFileStub } from '../../test/shared/stubs';
import { ConfigLoader } from './config-loader';
import { ConfigLoadError } from './errors';

describe('ConfigLoader', () => {
  const projectRoot = '/project';
  const jsonPath = join(projectRoot, 'bunner.json');
  const jsoncPath = join(projectRoot, 'bunner.jsonc');
  let setup: FileSetup;
  let bunFileSpy: ReturnType<typeof spyOn> | undefined;
  let consoleInfoSpy: ReturnType<typeof spyOn> | undefined;
  let jsonParseSpy: ReturnType<typeof spyOn> | undefined;
  let jsoncParseSpy: ReturnType<typeof spyOn> | undefined;

  beforeEach(() => {
    setup = {
      existsByPath: new Map<string, boolean>(),
      textByPath: new Map<string, string>(),
    };

    bunFileSpy = spyOn(Bun, 'file').mockImplementation((path: string) => {
      return createBunFileStub(setup, path) as any;
    });

    consoleInfoSpy = spyOn(console, 'info').mockImplementation(() => {});
    jsonParseSpy = spyOn(JSON, 'parse');
    jsoncParseSpy = spyOn(Bun.JSONC, 'parse');
  });

  afterEach(() => {
    bunFileSpy?.mockRestore();
    consoleInfoSpy?.mockRestore();
    jsonParseSpy?.mockRestore();
    jsoncParseSpy?.mockRestore();
  });

  it('should throw when both bunner.json and bunner.jsonc exist', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, true);

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should throw when bunner config is missing', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, false);
    setup.existsByPath.set(jsoncPath, false);

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject entry outside sourceDir when entry is not within sourceDir', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
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

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject module.fileName containing a path when module.fileName is not a single filename', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
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

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should load valid json config when sourceDir and entry are valid', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
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

    // Act
    const result = await ConfigLoader.load(projectRoot);

    // Assert
    expect(result.source.format).toBe('json');
    expect(result.config.sourceDir).toBe('src');
    expect(result.config.entry).toBe('src/main.ts');
  });

  it('should load valid jsonc config when config contains comments', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, false);
    setup.existsByPath.set(jsoncPath, true);
    setup.textByPath.set(
      jsoncPath,
      [
        '{',
        '  // This is a comment',
        '  "module": { "fileName": "__module__.ts" },',
        '  "sourceDir": "src",',
        '  "entry": "src/main.ts"',
        '}',
      ].join('\n'),
    );

    // Act
    const result = await ConfigLoader.load(projectRoot);

    // Assert
    expect(result.source.format).toBe('jsonc');
    expect(result.config.module.fileName).toBe('__module__.ts');
    expect(result.config.sourceDir).toBe('src');
    expect(result.config.entry).toBe('src/main.ts');
  });

  it('should reject config missing module field when module is undefined', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
      JSON.stringify(
        {
          sourceDir: 'src',
          entry: 'src/main.ts',
        },
        null,
        2,
      ),
    );

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject config missing sourceDir field when sourceDir is undefined', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
      JSON.stringify(
        {
          module: { fileName: '__module__.ts' },
          entry: 'src/main.ts',
        },
        null,
        2,
      ),
    );

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject config missing entry field when entry is undefined', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
      JSON.stringify(
        {
          module: { fileName: '__module__.ts' },
          sourceDir: 'src',
        },
        null,
        2,
      ),
    );

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject config with empty module.fileName when module.fileName is empty', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(
      jsonPath,
      JSON.stringify(
        {
          module: { fileName: '' },
          sourceDir: 'src',
          entry: 'src/main.ts',
        },
        null,
        2,
      ),
    );

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  it('should reject malformed json when JSON.parse fails', async () => {
    // Arrange
    setup.existsByPath.set(jsonPath, true);
    setup.existsByPath.set(jsoncPath, false);
    setup.textByPath.set(jsonPath, '{ invalid json }');

    // Act & Assert
    await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
  });

  describe('mcp config', () => {
    it('should use default mcp.card.types when mcp is omitted', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
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

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.card.types).toEqual(['spec']);
    });

    it('should use default mcp.card.relations when mcp is omitted', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
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

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.card.relations).toEqual([
        'depends_on',
        'references',
        'related',
        'extends',
        'conflicts',
      ]);
    });

    it('should use custom mcp.card.types when mcp.card.types is provided', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                types: ['spec', 'system'],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.card.types).toEqual(['spec', 'system']);
    });

    it('should use custom mcp.card.relations when mcp.card.relations is provided', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                relations: ['depends_on', 'references'],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.card.relations).toEqual(['depends_on', 'references']);
    });

    it('should use default mcp.card.relations when only mcp.card.types is provided', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                types: ['spec'],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.card.relations).toEqual([
        'depends_on',
        'references',
        'related',
        'extends',
        'conflicts',
      ]);
    });

    it('should reject mcp.card.types when it is not a string array', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                types: [1, 2, 3],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });

    it('should reject mcp.card.relations when it is not a string array', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                relations: [1, 2, 3],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });

    it('should reject mcp.card.types when it is an empty array', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                types: [],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });

    it('should reject mcp.card.relations when it is an empty array', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: {
                relations: [],
              },
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });

    it('should reject mcp.card when it is not an object', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              card: 'invalid',
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });

    it('should reject mcp when it is not an object', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: 'invalid',
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });
  });

  describe('mcp.exclude config', () => {
    it('should use empty array as default when mcp.exclude is omitted', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
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

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.exclude).toEqual([]);
    });

    it('should use custom mcp.exclude patterns when mcp.exclude is provided', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              exclude: ['**/test/**', '**/fixtures/**'],
            },
          },
          null,
          2,
        ),
      );

      // Act
      const result = await ConfigLoader.load(projectRoot);

      // Assert
      expect(result.config.mcp.exclude).toEqual(['**/test/**', '**/fixtures/**']);
    });

    it('should reject mcp.exclude when it is not a string array', async () => {
      // Arrange
      setup.existsByPath.set(jsonPath, true);
      setup.existsByPath.set(jsoncPath, false);
      setup.textByPath.set(
        jsonPath,
        JSON.stringify(
          {
            module: { fileName: '__module__.ts' },
            sourceDir: 'src',
            entry: 'src/main.ts',
            mcp: {
              exclude: [1, 2, 3],
            },
          },
          null,
          2,
        ),
      );

      // Act & Assert
      await expect(ConfigLoader.load(projectRoot)).rejects.toBeInstanceOf(ConfigLoadError);
    });
  });
});