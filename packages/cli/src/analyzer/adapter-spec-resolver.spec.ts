import { mkdir, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import { describe, expect, it } from 'bun:test';

import { AdapterSpecResolver, AstParser } from './index';
import { PathResolver } from '../common';
import type { FileAnalysis } from './graph/interfaces';

async function createTempDir(): Promise<string> {
  const base = join(process.cwd(), '.tmp-adapter-spec');

  await rm(base, { recursive: true, force: true });
  await mkdir(base, { recursive: true });

  return base;
}

async function writeFileContent(filePath: string, content: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf-8');
}

describe('AdapterSpecResolver', () => {
  it('resolves adapterStaticSpecs and handlerIndex from entry files', async () => {
    const projectRoot = await createTempDir();
    const srcDir = join(projectRoot, 'src');
    const adapterDir = join(projectRoot, 'adapters', 'test-adapter');
    const controllerFile = join(srcDir, 'controllers.ts');
    const entryFile = join(adapterDir, 'index.ts');

    await mkdir(srcDir, { recursive: true });
    await mkdir(adapterDir, { recursive: true });

    await writeFileContent(
      entryFile,
      [
        'function Controller() { return () => {}; }',
        'function Get() { return () => {}; }',
        'function startAdapter() {}',
        'function stopAdapter() {}',
        'function dispatchBefore() {}',
        'function dispatchHandler() {}',
        '',
        'export class TestAdapter {',
        "  static adapterId = 'test';",
        "  static middlewarePhaseOrder = ['Before'];",
        "  static supportedMiddlewarePhases = { Before: true };",
        '  static entryDecorators = { controller: Controller, handler: [Get] };',
        '  static runtime = { start: startAdapter, stop: stopAdapter };',
        '  static pipeline = { middlewares: [dispatchBefore], guards: [], pipes: [], handler: dispatchHandler };',
        '}',
        '',
        'export const adapterSpec = defineAdapter(TestAdapter);',
        '',
      ].join('\n'),
    );

    await writeFileContent(
      controllerFile,
      [
        'function Controller() { return () => {}; }',
        'function Get() { return () => {}; }',
        'function Middlewares() { return () => {}; }',
        'function mwOne() {}',
        '',
        '@Controller()',
        'class SampleController {',
        '  @Get()',
        "  @Middlewares('Before', [mwOne])",
        '  handle() {}',
        '}',
      ].join('\n'),
    );

    const parser = new AstParser();
    const controllerContent = await Bun.file(controllerFile).text();
    const controllerParse = parser.parse(controllerFile, controllerContent);
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(controllerFile, {
      filePath: controllerFile,
      classes: controllerParse.classes,
      reExports: controllerParse.reExports,
      exports: controllerParse.exports,
      imports: controllerParse.imports,
      importEntries: [
        {
          source: '@test/adapter',
          resolvedSource: entryFile,
          isRelative: false,
        },
      ],
      exportedValues: controllerParse.exportedValues,
      localValues: controllerParse.localValues,
      moduleDefinition: controllerParse.moduleDefinition,
    });

    const resolver = new AdapterSpecResolver();
    const result = await resolver.resolve({ fileMap, projectRoot });

    expect(Object.keys(result.adapterStaticSpecs)).toEqual(['test']);

    const expectedFile = PathResolver.normalize('src/controllers.ts');
    const expectedId = `test:${expectedFile}#SampleController.handle`;

    expect(result.handlerIndex.map(entry => entry.id)).toEqual([expectedId]);

    await rm(projectRoot, { recursive: true, force: true });
  });

  it('fails when adapterSpec is missing', async () => {
    const projectRoot = await createTempDir();
    const srcDir = join(projectRoot, 'src');
    const adapterDir = join(projectRoot, 'adapters', 'missing-adapter');
    const controllerFile = join(srcDir, 'controllers.ts');
    const entryFile = join(adapterDir, 'index.ts');

    await mkdir(srcDir, { recursive: true });
    await mkdir(adapterDir, { recursive: true });

    await writeFileContent(entryFile, 'export const notAdapterSpec = 123;');
    await writeFileContent(controllerFile, 'class SampleController {}');

    const parser = new AstParser();
    const controllerContent = await Bun.file(controllerFile).text();
    const controllerParse = parser.parse(controllerFile, controllerContent);
    const fileMap = new Map<string, FileAnalysis>();

    fileMap.set(controllerFile, {
      filePath: controllerFile,
      classes: controllerParse.classes,
      reExports: controllerParse.reExports,
      exports: controllerParse.exports,
      imports: controllerParse.imports,
      importEntries: [
        {
          source: '@test/missing',
          resolvedSource: entryFile,
          isRelative: false,
        },
      ],
      exportedValues: controllerParse.exportedValues,
      localValues: controllerParse.localValues,
      moduleDefinition: controllerParse.moduleDefinition,
    });

    const resolver = new AdapterSpecResolver();

    await expect(resolver.resolve({ fileMap, projectRoot })).rejects.toThrow('No adapterSpec exports found');

    await rm(projectRoot, { recursive: true, force: true });
  });
});
