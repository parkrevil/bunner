import { describe, expect, it, mock } from 'bun:test';
import { createRequire } from 'node:module';

// MUST: MUST-1 (createApplication 식별)
// MUST: MUST-5 (DI cycle 존재 시 build failure)

import type { FileAnalysis } from '../analyzer/graph/interfaces';

import { ModuleGraph } from '../analyzer/graph/module-graph';
import { ImportRegistry } from './import-registry';

const require = createRequire(import.meta.url);
const actualAnalyzer = require('../analyzer');
const actualCommon = require('../common');

mock.module('../analyzer', () => {
  return {
    ...actualAnalyzer,
  };
});

mock.module('../common', () => {
  return {
    ...actualCommon,
    compareCodePoint: (...args: unknown[]) => actualCommon.compareCodePoint(...args),
  };
});

const { InjectorGenerator } = require('./injector');

function createEmptyGraph(): ModuleGraph {
  const fileMap = new Map<string, FileAnalysis>();
  const graph = new ModuleGraph(fileMap, '__module__.ts');

  return graph;
}

function createSingleModuleGraph(): ModuleGraph {
  const modulePath = '/app/src/app/__module__.ts';
  const fileMap = new Map<string, FileAnalysis>();

  fileMap.set(modulePath, {
    filePath: modulePath,
    classes: [],
    reExports: [],
    exports: [],
    defineModuleCalls: [
      {
        callee: 'defineModule',
        importSource: '@bunner/core',
        args: [],
        exportedName: 'appModule',
      },
    ],
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

describe('InjectorGenerator', () => {
  describe('generate', () => {
    it('should generate a container factory when graph has no modules', () => {
      // Arrange
      const graph = createEmptyGraph();
      const registry = new ImportRegistry('/app/src');
      const generator = new InjectorGenerator();
      // Act
      const result = generator.generate(graph, registry);

      // Assert
      expect(result).toContain('export function createContainer()');
      expect(result).toContain('const container = new Container()');
    });

    it('should include adapterConfig export when generating injector code', () => {
      // Arrange
      const graph = createSingleModuleGraph();
      const registry = new ImportRegistry('/app/src');
      const generator = new InjectorGenerator();
      // Act
      const result = generator.generate(graph, registry);

      // Assert
      expect(result).toContain('adapterConfig');
      expect(result).toContain('deepFreeze');
    });

    it('should not duplicate identical import statements when generating injector code', () => {
      // Arrange
      const graph = createSingleModuleGraph();
      const registry = new ImportRegistry('/app/src');
      const generator = new InjectorGenerator();
      // Act
      const result = generator.generate(graph, registry);
      const importLines = result
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.startsWith('import '));

      // Assert
      expect(new Set(importLines).size).toBe(importLines.length);
    });

    it('should be deterministic when generating with the same graph twice', () => {
      // Arrange
      const graph = createSingleModuleGraph();
      const registry = new ImportRegistry('/app/src');
      const generator = new InjectorGenerator();
      // Act
      const result1 = generator.generate(graph, registry);
      const result2 = generator.generate(graph, registry);

      // Assert
      expect(result1).toBe(result2);
    });

    it('should not throw when registry root differs from project root', () => {
      // Arrange
      const graph = createSingleModuleGraph();
      const registry = new ImportRegistry('/other/root');
      const generator = new InjectorGenerator();

      // Act & Assert
      expect(() => generator.generate(graph, registry)).not.toThrow();
    });
  });
});
