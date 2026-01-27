import { describe, expect, it } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';

import type { FileAnalysis } from '../analyzer/graph/interfaces';
import type { AnalyzerValue, AnalyzerValueRecord } from '../analyzer/types';
import type { DeepFreezeModule, GeneratedBlockParams, MetadataRegistryModule, ScopedKeysMapModule } from './types';

import { ModuleGraph } from '../analyzer/graph/module-graph';
import { ManifestGenerator } from './manifest';

const isAnalyzerValueRecord = (value: AnalyzerValue): value is AnalyzerValueRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isAnalyzerValueArray = (value: AnalyzerValue): value is AnalyzerValue[] => {
  return Array.isArray(value);
};

const assertRecordValue = (value: AnalyzerValue): AnalyzerValueRecord => {
  if (isAnalyzerValueRecord(value)) {
    return value;
  }

  throw new Error('Expected a record value.');
};

const assertArrayValue = (value: AnalyzerValue): AnalyzerValue[] => {
  if (isAnalyzerValueArray(value)) {
    return value;
  }

  throw new Error('Expected an array value.');
};

function executeModule<TModule>(jsCode: string, initialExports: TModule): TModule {
  const moduleContainer = { exports: initialExports };
  const context = { module: moduleContainer, exports: moduleContainer.exports };

  runInNewContext(jsCode, context);

  return moduleContainer.exports;
}

function createSingleModuleGraph(): ModuleGraph {
  const modulePath = '/app/src/app/__module__.ts';
  const fileMap = new Map<string, FileAnalysis>();

  fileMap.set(modulePath, {
    filePath: modulePath,
    classes: [],
    reExports: [],
    exports: [],
    imports: {},
    moduleDefinition: {
      name: 'AppModule',
      providers: [],
      imports: {},
    },
  });

  const graph = new ModuleGraph(fileMap, '__module__.ts');

  graph.build();

  return graph;
}

function extractGeneratedBlock(params: GeneratedBlockParams): string {
  const { code, matcher, name } = params;
  const match = code.match(matcher);

  if (!match) {
    throw new Error(`Failed to extract ${name}`);
  }

  return match[0];
}

function transpileTsModule(tsSnippet: string): string {
  return transpileModule(tsSnippet, {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2020,
    },
  }).outputText;
}

describe('manifest', () => {
  it('should export a sealed metadata registry when generator runs', () => {
    // Arrange
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const code = gen.generate(graph, [], '/out');
    const deepFreezeBlock = extractGeneratedBlock({
      code,
      matcher: /const deepFreeze = \([\s\S]*?\n};/,
      name: 'deepFreeze block',
    });
    const sealMapBlock = extractGeneratedBlock({
      code,
      matcher: /const sealMap = <K, V>\([\s\S]*?\n};/,
      name: 'sealMap block',
    });
    const createMetadataRegistryBlock = extractGeneratedBlock({
      code,
      matcher: /export function createMetadataRegistry\(\)\s*\{[\s\S]*?\n\}/,
      name: 'createMetadataRegistry block',
    });
    const tsSnippet = `${deepFreezeBlock}\n${sealMapBlock}\n${createMetadataRegistryBlock}\nexport const metadataRegistry = createMetadataRegistry();`;
    // Act
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = executeModule<MetadataRegistryModule>(jsSnippet, { metadataRegistry: new Map() });
    const registry = mod.metadataRegistry;

    // Assert
    expect(Object.isFrozen(registry)).toBe(true);
    expect(() => registry.set('k', 'v')).toThrow(/immutable/i);
    expect(() => registry.delete('k')).toThrow(/immutable/i);
    expect(() => {
      registry.clear();
    }).toThrow(/immutable/i);
  });

  it('should export a scoped keys map when generator runs', () => {
    // Arrange
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const code = gen.generate(graph, [], '/out');
    const deepFreezeBlock = extractGeneratedBlock({
      code,
      matcher: /const deepFreeze = \([\s\S]*?\n};/,
      name: 'deepFreeze block',
    });
    const sealMapBlock = extractGeneratedBlock({
      code,
      matcher: /const sealMap = <K, V>\([\s\S]*?\n};/,
      name: 'sealMap block',
    });
    const createScopedKeysMapBlock = extractGeneratedBlock({
      code,
      matcher: /export function createScopedKeysMap\(\)\s*\{[\s\S]*?\n\}/,
      name: 'createScopedKeysMap block',
    });
    const tsSnippet = `${deepFreezeBlock}\n${sealMapBlock}\n${createScopedKeysMapBlock}\nexport const scopedKeysMap = createScopedKeysMap();`;
    // Act
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = executeModule<ScopedKeysMapModule>(jsSnippet, { scopedKeysMap: new Map() });
    const map = mod.scopedKeysMap;

    // Assert
    expect(Object.isFrozen(map)).toBe(true);
    expect(() => map.set('k', 'v')).toThrow(/immutable/i);
    expect(() => map.delete('k')).toThrow(/immutable/i);
    expect(() => {
      map.clear();
    }).toThrow(/immutable/i);
  });

  it('should deep-freeze nested metadata-like objects when invoked', () => {
    // Arrange
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const code = gen.generate(graph, [], '/out');
    const deepFreezeBlock = extractGeneratedBlock({
      code,
      matcher: /const deepFreeze = \([\s\S]*?\n};/,
      name: 'deepFreeze block',
    });
    const tsSnippet = `${deepFreezeBlock}\nexport { deepFreeze };`;
    const sample: AnalyzerValueRecord = {
      className: 'A',
      decorators: [{ name: 'X', arguments: [] }],
      constructorParams: [],
      methods: [],
      properties: [],
    };
    // Act
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = executeModule<DeepFreezeModule>(jsSnippet, {
      deepFreeze: (obj: AnalyzerValue) => obj,
    });
    const deepFreeze = mod.deepFreeze;
    const decorators = assertArrayValue(sample.decorators);

    deepFreeze(sample);
    // Assert
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample.decorators)).toBe(true);
    expect(() => {
      decorators.push({ name: 'Y', arguments: [] });
    }).toThrow();
  });

  it('should include adapterStaticSpecs and handlerIndex in JSON output when generated', () => {
    // Arrange
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const json = gen.generateJson({
      graph,
      projectRoot: '/app',
      source: { path: '/app/bunner.config.ts', format: 'ts' },
      resolvedConfig: { module: { fileName: '__module__.ts' } },
      adapterStaticSpecs: {
        test: {
          pipeline: {
            middlewares: ['dispatchBefore'],
            guards: [],
            pipes: [],
            handler: 'dispatchHandler',
          },
          middlewarePhaseOrder: ['Before'],
          supportedMiddlewarePhases: { Before: true },
          entryDecorators: { controller: 'Controller', handler: ['Get'] },
          runtime: { start: 'startAdapter', stop: 'stopAdapter' },
        },
      },
      handlerIndex: [{ id: 'test:src/controllers.ts#SampleController.handle' }],
    });
    // Act
    const parsed = JSON.parse(json);
    const parsedRecord = assertRecordValue(parsed);
    const adapterSpecs = assertRecordValue(parsedRecord.adapterStaticSpecs);
    const handlerIndex = assertArrayValue(parsedRecord.handlerIndex);

    // Assert
    expect(adapterSpecs.test).toBeDefined();
    expect(handlerIndex).toEqual([{ id: 'test:src/controllers.ts#SampleController.handle' }]);
  });
});
