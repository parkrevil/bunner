import { describe, expect, it } from 'bun:test';

import type { FileAnalysis } from '../analyzer/graph/interfaces';
import { ModuleGraph } from '../analyzer/graph/module-graph';

import { ManifestGenerator } from './manifest';

async function importDataModule<TModule extends Record<string, unknown>>(jsCode: string): Promise<TModule> {
  const base64 = Buffer.from(jsCode).toString('base64');
  const moduleUrl = `data:text/javascript;base64,${base64}`;

  return (await import(moduleUrl)) as TModule;
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
      adapters: undefined,
    },
  });

  const graph = new ModuleGraph(fileMap, '__module__.ts');

  graph.build();

  return graph;
}

function extractGeneratedBlock(params: { readonly code: string; readonly matcher: RegExp; readonly name: string }): string {
  const { code, matcher, name } = params;
  const match = code.match(matcher);

  if (!match) {
    throw new Error(`Failed to extract ${name}`);
  }

  return match[0];
}

function transpileTsModule(tsSnippet: string): string {
  const transpiler = new Bun.Transpiler({ loader: 'ts' });

  return transpiler.transformSync(tsSnippet);
}

describe('ManifestGenerator.generate', () => {
  it('should export a sealed metadata registry', async () => {
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
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = await importDataModule<{ metadataRegistry: Map<unknown, unknown> }>(jsSnippet);
    const registry = mod.metadataRegistry;

    expect(Object.isFrozen(registry)).toBe(true);
    expect(() => registry.set('k', 'v')).toThrow(/immutable/i);
    expect(() => registry.delete('k')).toThrow(/immutable/i);
    expect(() => registry.clear()).toThrow(/immutable/i);
  });

  it('should export a scoped keys map that throws on mutation', async () => {
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
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = await importDataModule<{ scopedKeysMap: Map<unknown, unknown> }>(jsSnippet);
    const map = mod.scopedKeysMap;

    expect(Object.isFrozen(map)).toBe(true);
    expect(() => map.set('k', 'v')).toThrow(/immutable/i);
    expect(() => map.delete('k')).toThrow(/immutable/i);
    expect(() => map.clear()).toThrow(/immutable/i);
  });

  it('should deep-freeze nested metadata-like objects', async () => {
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const code = gen.generate(graph, [], '/out');
    const deepFreezeBlock = extractGeneratedBlock({
      code,
      matcher: /const deepFreeze = \([\s\S]*?\n};/,
      name: 'deepFreeze block',
    });
    const tsSnippet = `${deepFreezeBlock}\nexport { deepFreeze };`;
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = await importDataModule<{ deepFreeze: (obj: unknown) => unknown }>(jsSnippet);
    const deepFreeze = mod.deepFreeze;
    const sample = {
      className: 'A',
      decorators: [{ name: 'X', arguments: [] }],
      constructorParams: [],
      methods: [],
      properties: [],
    };

    deepFreeze(sample);
    expect(Object.isFrozen(sample)).toBe(true);
    expect(Object.isFrozen(sample.decorators)).toBe(true);
    expect(() => {
      (sample.decorators as Array<unknown>).push({ name: 'Y', arguments: [] });
    }).toThrow();
  });
});
