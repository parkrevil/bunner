import { describe, expect, it } from 'bun:test';

import type { ClassMetadata } from '../interfaces';
import type { FileAnalysis } from './interfaces';

import { ModuleGraph } from './module-graph';

function createInjectableClassMetadata(params: {
  readonly className: string;
  readonly injectedTokens?: readonly string[];
}): ClassMetadata {
  const { className, injectedTokens } = params;
  const constructorParams = (injectedTokens ?? []).map((token, index) => {
    return {
      name: `p${index}`,
      type: { __bunner_ref: token },
      typeArgs: undefined,
      decorators: [],
    };
  });

  return {
    className,
    heritage: undefined,
    decorators: [
      {
        name: 'Injectable',
        arguments: [{ visibility: 'exported', lifetime: 'singleton' }],
      },
    ],
    constructorParams,
    methods: [],
    properties: [],
    imports: {},
    middlewares: undefined,
    errorFilters: undefined,
  };
}

function createModuleFileAnalysis(params: { readonly filePath: string; readonly name: string }): FileAnalysis {
  const { filePath, name } = params;

  return {
    filePath,
    classes: [],
    reExports: [],
    exports: [],
    imports: {},
    moduleDefinition: {
      name,
      providers: [],
      imports: {},
      adapters: undefined,
    },
  };
}

function createClassFileAnalysis(params: { readonly filePath: string; readonly classes: ClassMetadata[] }): FileAnalysis {
  const { filePath, classes } = params;

  return {
    filePath,
    classes,
    reExports: [],
    exports: [],
    imports: {},
    moduleDefinition: undefined,
  };
}

describe('ModuleGraph.build', () => {
  it('should be deterministic regardless of fileMap insertion order', () => {
    const modulePath = '/app/src/a/__module__.ts';
    const servicePath = '/app/src/a/a.service.ts';
    const moduleFile = createModuleFileAnalysis({ filePath: modulePath, name: 'AModule' });
    const serviceFile = createClassFileAnalysis({
      filePath: servicePath,
      classes: [createInjectableClassMetadata({ className: 'AService' })],
    });
    const fileMap1 = new Map<string, FileAnalysis>();

    fileMap1.set(servicePath, serviceFile);
    fileMap1.set(modulePath, moduleFile);

    const fileMap2 = new Map<string, FileAnalysis>();

    fileMap2.set(modulePath, moduleFile);
    fileMap2.set(servicePath, serviceFile);

    const graph1 = new ModuleGraph(fileMap1, '__module__.ts');
    const graph2 = new ModuleGraph(fileMap2, '__module__.ts');
    const modules1 = graph1.build();
    const modules2 = graph2.build();

    expect(Array.from(modules1.keys())).toEqual(Array.from(modules2.keys()));

    const node1 = modules1.get(modulePath);
    const node2 = modules2.get(modulePath);

    expect(node1?.name).toBe('AModule');
    expect(node2?.name).toBe('AModule');
    expect(Array.from(node1?.providers.keys() ?? [])).toEqual(['AService']);
    expect(Array.from(node2?.providers.keys() ?? [])).toEqual(['AService']);
  });

  it('should throw when a circular dependency exists between modules', () => {
    const moduleAPath = '/app/src/a/__module__.ts';
    const moduleBPath = '/app/src/b/__module__.ts';
    const serviceAPath = '/app/src/a/a.service.ts';
    const serviceBPath = '/app/src/b/b.service.ts';
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(moduleAPath, createModuleFileAnalysis({ filePath: moduleAPath, name: 'AModule' }));
    fileMap.set(moduleBPath, createModuleFileAnalysis({ filePath: moduleBPath, name: 'BModule' }));
    fileMap.set(
      serviceAPath,
      createClassFileAnalysis({
        filePath: serviceAPath,
        classes: [createInjectableClassMetadata({ className: 'AService', injectedTokens: ['BService'] })],
      }),
    );
    fileMap.set(
      serviceBPath,
      createClassFileAnalysis({
        filePath: serviceBPath,
        classes: [createInjectableClassMetadata({ className: 'BService', injectedTokens: ['AService'] })],
      }),
    );

    const graph = new ModuleGraph(fileMap, '__module__.ts');

    expect(() => graph.build()).toThrow(/Circular dependency detected/);
  });
});
