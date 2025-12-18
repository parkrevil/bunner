#!/usr/bin/env bun

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { HttpMethod } from '../src/enums.ts';
import { RadixRouterBuilder } from '../src/router/router.ts';
import type { RouterOptions } from '../src/router/types.ts';

interface RouteDefinition {
  method: string | string[] | '*';
  path: string;
}

interface RouteManifest {
  routes: RouteDefinition[];
  options?: RouterOptions;
  output?: string;
}

const METHOD_BY_NAME: Record<string, HttpMethod> = {
  get: HttpMethod.Get,
  post: HttpMethod.Post,
  put: HttpMethod.Put,
  patch: HttpMethod.Patch,
  delete: HttpMethod.Delete,
  options: HttpMethod.Options,
  head: HttpMethod.Head,
};

const parsed = parseArgs({
  options: {
    manifest: { type: 'string', short: 'm' },
    out: { type: 'string', short: 'o' },
    pretty: { type: 'boolean', default: true },
  },
});

const manifestPath = parsed.values.manifest;

if (!manifestPath) {
  console.error('[bunner] --manifest <path> is required');
  process.exit(1);
}

const resolvedManifestPath = resolve(process.cwd(), manifestPath);
let manifest: RouteManifest;
try {
  const raw = await readFile(resolvedManifestPath, 'utf8');
  manifest = JSON.parse(raw) as RouteManifest;
} catch (error) {
  console.error(`[bunner] Failed to load manifest: ${(error as Error).message}`);
  process.exit(1);
}

if (!Array.isArray(manifest.routes) || !manifest.routes.length) {
  console.error('[bunner] Manifest must declare a non-empty "routes" array');
  process.exit(1);
}

const builder = new RadixRouterBuilder(manifest.options);
for (const entry of manifest.routes) {
  if (!entry || typeof entry.path !== 'string') {
    console.error('[bunner] Each route must declare a path string');
    process.exit(1);
  }
  const methods = normalizeMethods(entry.method);
  for (const method of methods) {
    builder.add(method, entry.path);
  }
}

const router = builder.build();
const snapshot = {
  metadata: router.getMetadata(),
  layout: router.getLayoutSnapshot(),
  paramOrderSnapshot: router.exportParamOrderSnapshot(),
  generatedAt: new Date().toISOString(),
  source: resolvedManifestPath,
};

const outPath = resolve(process.cwd(), parsed.values.out ?? manifest.output ?? 'router-snapshot.json');
const space = parsed.values.pretty === false ? undefined : 2;
await writeFile(outPath, `${JSON.stringify(snapshot, null, space)}\n`, 'utf8');
console.log(`[bunner] Router snapshot written to ${outPath}`);

function normalizeMethods(input: RouteDefinition['method']): HttpMethod[] {
  if (!input) {
    throw new Error('Route entry is missing the "method" field');
  }
  if (input === '*') {
    return Object.values(HttpMethod).filter((value): value is HttpMethod => typeof value === 'number');
  }
  if (Array.isArray(input)) {
    if (!input.length) {
      throw new Error('Method array must not be empty');
    }
    return input
      .flatMap(value => normalizeMethods(value as RouteDefinition['method']))
      .filter((value, idx, arr) => arr.indexOf(value) === idx);
  }
  const method = parseMethodName(input);
  if (method === undefined) {
    throw new Error(`Unsupported HTTP method: ${input}`);
  }
  return [method];
}

function parseMethodName(input: string): HttpMethod | undefined {
  const method = METHOD_BY_NAME[input.toLowerCase() as keyof typeof METHOD_BY_NAME];
  return method;
}
