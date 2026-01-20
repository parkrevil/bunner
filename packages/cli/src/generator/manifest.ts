import { dirname, relative } from 'path';

import { type AdapterStaticSpec, type ClassMetadata, ModuleGraph, type ModuleNode } from '../analyzer';
import { compareCodePoint, PathResolver } from '../common';

import { ImportRegistry } from './import-registry';
import { InjectorGenerator } from './injector';
import type { ManifestJsonParams } from './interfaces';
import { MetadataGenerator } from './metadata';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();

  private metadataGen = new MetadataGenerator();

  generate(graph: ModuleGraph, classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const registry = new ImportRegistry(outputDir);
    const sortedClasses = [...classes].sort((a, b) => {
      const nameDiff = compareCodePoint(a.metadata.className, b.metadata.className);

      if (nameDiff !== 0) {
        return nameDiff;
      }

      return compareCodePoint(a.filePath, b.filePath);
    });

    sortedClasses.forEach(c => {
      registry.getAlias(c.metadata.className, c.filePath);
    });

    const injectorCode = this.injectorGen.generate(graph, registry);
    const metadataCode = this.metadataGen.generate(classes, registry);
    const scopedKeysEntries: string[] = [];
    const sortedNodes = Array.from(graph.modules.values()).sort((a, b) => compareCodePoint(a.filePath, b.filePath));

    sortedNodes.forEach((node: ModuleNode) => {
      const providerTokens = Array.from(node.providers.keys()).sort(compareCodePoint);

      providerTokens.forEach((token: string) => {
        const providerDef = graph.classDefinitions.get(token);
        const alias = providerDef ? registry.getAlias(providerDef.metadata.className, providerDef.filePath) : token;

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${token}');`);
        scopedKeysEntries.push(`  map.set('${token}', '${node.name}::${token}');`);
      });

      const controllerNames = Array.from(node.controllers.values()).sort(compareCodePoint);

      controllerNames.forEach((ctrlName: string) => {
        let alias = ctrlName;
        const ctrlDef = graph.classDefinitions.get(ctrlName);

        if (ctrlDef) {
          alias = registry.getAlias(ctrlName, ctrlDef.filePath);
        }

        scopedKeysEntries.push(`  map.set(${alias}, '${node.name}::${ctrlName}');`);
        scopedKeysEntries.push(`  map.set('${ctrlName}', '${node.name}::${ctrlName}');`);
      });
    });

    const imports = registry.getImportStatements().join('\n');

    return `
${imports}

const deepFreeze = (obj: unknown, visited = new WeakSet<object>()): unknown => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (visited.has(obj)) {
    return obj;
  }

  if (!Object.isFrozen(obj)) {
    visited.add(obj);
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
      const record = obj as Record<string, unknown>;

      deepFreeze(record[prop], visited);
    });
  }

  return obj;
};

const sealMap = <K, V>(map: Map<K, V>): Map<K, V> => {
  (map as unknown as { set: (...args: unknown[]) => unknown }).set = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  (map as unknown as { delete: (...args: unknown[]) => unknown }).delete = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  (map as unknown as { clear: (...args: unknown[]) => unknown }).clear = () => {
    throw new Error("FATAL: AOT Registry is immutable.");
  };

  Object.freeze(map);
  return map;
};

const _meta = (
  className: string,
  decorators: readonly unknown[],
  params: readonly unknown[],
  methods: readonly unknown[],
  props: readonly unknown[],
): {
  className: string;
  decorators: readonly unknown[];
  constructorParams: readonly unknown[];
  methods: readonly unknown[];
  properties: readonly unknown[];
} => ({
  className,
  decorators,
  constructorParams: params,
  methods,
  properties: props
});

${injectorCode}

${metadataCode}

export function createScopedKeysMap() {
  const map = new Map();
${scopedKeysEntries.join('\n')}
  return sealMap(map);
}

export const metadataRegistry = createMetadataRegistry();
export const scopedKeysMap = createScopedKeysMap();

`;
  }

  generateJson(params: ManifestJsonParams): string {
    const manifestModel = this.buildJsonModel(params);

    return JSON.stringify(manifestModel, null, 2);
  }

  private buildJsonModel(params: ManifestJsonParams): Record<string, unknown> {
    const { graph, projectRoot, source, resolvedConfig, adapterStaticSpecs, handlerIndex } = params;
    const sortedModules = Array.from(graph.modules.values()).sort((a, b) => compareCodePoint(a.filePath, b.filePath));
    const moduleDescriptors = sortedModules.map(node => {
      const moduleRoot = dirname(node.filePath);
      const rootDir = PathResolver.normalize(relative(projectRoot, moduleRoot)) || '.';
      const file = PathResolver.normalize(relative(projectRoot, node.filePath));

      return {
        id: rootDir,
        name: node.name,
        rootDir,
        file,
      };
    });
    const sortedModuleDescriptors = moduleDescriptors.sort((left, right) => compareCodePoint(left.id, right.id));
    const diNodes: Array<Record<string, unknown>> = [];
    const extractTokenName = (token: unknown): string | undefined => {
      if (typeof token === 'string') {
        return token;
      }

      if (typeof token === 'function') {
        return token.name;
      }

      if (typeof token === 'symbol') {
        return token.description || token.toString();
      }

      if (!token || typeof token !== 'object') {
        return undefined;
      }

      const record = token as Record<string, unknown>;

      if (typeof record.__bunner_ref === 'string') {
        return record.__bunner_ref;
      }

      if (typeof record.__bunner_forward_ref === 'string') {
        return record.__bunner_forward_ref;
      }

      return undefined;
    };
    const isClassMetadata = (value: unknown): value is ClassMetadata => {
      const record = value as Record<string, unknown> | null;

      if (!record) {
        return false;
      }

      const constructorParams = record.constructorParams;

      return Array.isArray(constructorParams);
    };
    const extractDeps = (metadata: unknown): string[] => {
      if (!metadata) {
        return [];
      }

      if (isClassMetadata(metadata)) {
        return metadata.constructorParams
          .map(param => {
            const injectDec = param.decorators.find(d => d.name === 'Inject');

            if (injectDec && injectDec.arguments.length > 0) {
              return extractTokenName(injectDec.arguments[0]);
            }

            return extractTokenName(param.type);
          })
          .filter((value): value is string => typeof value === 'string');
      }

      const record = metadata as Record<string, unknown> | null;

      if (record && Array.isArray(record.inject)) {
        return record.inject.map(entry => extractTokenName(entry)).filter((value): value is string => typeof value === 'string');
      }

      return [];
    };
    const normalizeScope = (scope: string | undefined): string => {
      if (scope === 'request-context' || scope === 'request') {
        return 'request';
      }

      if (scope === 'transient') {
        return 'transient';
      }

      return 'singleton';
    };

    sortedModules.forEach(node => {
      const providerTokens = Array.from(node.providers.keys()).sort(compareCodePoint);

      providerTokens.forEach(token => {
        const provider = node.providers.get(token);

        if (!provider) {
          return;
        }

        const deps = extractDeps(provider.metadata).sort(compareCodePoint);

        diNodes.push({
          id: `${node.name}::${token}`,
          token,
          deps,
          scope: normalizeScope(provider.scope),
          provider: { token },
        });
      });
    });

    const sortedDiNodes = diNodes.sort((a, b) => compareCodePoint(String(a.id), String(b.id)));

    const sortedAdapterStaticSpecs: Record<string, AdapterStaticSpec> = {};
    const sortedAdapterIds = Object.keys(adapterStaticSpecs).sort(compareCodePoint);

    sortedAdapterIds.forEach(adapterId => {
      sortedAdapterStaticSpecs[adapterId] = adapterStaticSpecs[adapterId]!;
    });

    const sortedHandlerIndex = [...handlerIndex].sort((a, b) => compareCodePoint(a.id, b.id));

    return {
      schemaVersion: '2',
      config: {
        sourcePath: PathResolver.normalize(source.path),
        sourceFormat: source.format,
        resolvedModuleConfig: {
          fileName: resolvedConfig.module.fileName,
        },
      },
      modules: sortedModuleDescriptors,
      adapterStaticSpecs: sortedAdapterStaticSpecs,
      diGraph: {
        nodes: sortedDiNodes,
      },
      handlerIndex: sortedHandlerIndex,
    };
  }
}
