import { describe, expect, it } from 'bun:test';

import type { FileAnalysis } from '../analyzer/graph/interfaces';
import { ModuleGraph } from '../analyzer/graph/module-graph';

import { ManifestGenerator } from './manifest';

async function importDataModule<TModule extends Record<string, unknown>>(jsCode: string): Promise<TModule> {
  const base64 = Buffer.from(jsCode).toString('base64');
  const moduleUrl = `data:text/javascript;base64,${base64}`;

  return (await import(moduleUrl)) as TModule;
}

function stripExports(code: string): string {
  return code
    .replace(/\bexport\s+function\s+/g, 'function ')
    .replace(/\bexport\s+const\s+/g, 'const ')
    .replace(/\bexport\s*\{\s*\}\s*;?/g, '');
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

  const graph = new ModuleGraph(fileMap);

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
  it('should define __BUNNER_METADATA_REGISTRY__ as non-writable and non-configurable', () => {
    const graph = createSingleModuleGraph();
    const gen = new ManifestGenerator();
    const code = gen.generate(graph, [], '/out');

    expect(code).toContain("Object.defineProperty(globalThis, '__BUNNER_METADATA_REGISTRY__'");
    expect(code).toContain('writable: false');
    expect(code).toContain('configurable: false');
  });

  it('should generate a scoped keys map that throws on mutation', async () => {
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
    const tsSnippet = `${deepFreezeBlock}\n${sealMapBlock}\n${createScopedKeysMapBlock}`;
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = await importDataModule<{ createScopedKeysMap: () => Map<unknown, unknown> }>(jsSnippet);
    const map = mod.createScopedKeysMap();

    expect(Object.isFrozen(map)).toBe(true);
    expect(() => map.set('k', 'v')).toThrow(/immutable/i);
    expect(() => map.delete('k')).toThrow(/immutable/i);
    expect(() => map.clear()).toThrow(/immutable/i);
  });

  it('should prevent __BUNNER_METADATA_REGISTRY__ reassignment and redefinition', async () => {
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
    const registryDefineBlock = extractGeneratedBlock({
      code,
      matcher: /const registry = createMetadataRegistry\(\);[\s\S]*?export const metadataRegistry = registry;\n/,
      name: 'registry define block',
    });
    const sandbox = {} as Record<string, unknown>;
    const createMetadataRegistryInnerBlock = stripExports(createMetadataRegistryBlock);
    const registryDefineInnerBlock = stripExports(registryDefineBlock);
    const tsSnippet = `
      export function setupRegistry(sandbox: Record<string, unknown>): unknown {
        const globalThis = sandbox as unknown as Record<string, unknown>;

        ${deepFreezeBlock}

        ${sealMapBlock}

        ${createMetadataRegistryInnerBlock}

        ${registryDefineInnerBlock}

        return (sandbox as any).__BUNNER_METADATA_REGISTRY__;
      }
    `;
    const jsSnippet = transpileTsModule(tsSnippet);
    const mod = await importDataModule<{ setupRegistry: (sandbox: Record<string, unknown>) => unknown }>(jsSnippet);
    const registry = mod.setupRegistry(sandbox) as Map<unknown, unknown>;

    expect(registry).toBeInstanceOf(Map);
    expect(() => {
      (sandbox as any).__BUNNER_METADATA_REGISTRY__ = new Map();
    }).toThrow();
    expect(() => {
      Object.defineProperty(sandbox, '__BUNNER_METADATA_REGISTRY__', { value: new Map() });
    }).toThrow();
    expect((sandbox as any).__BUNNER_METADATA_REGISTRY__).toBe(registry);
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
