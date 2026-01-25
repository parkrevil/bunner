import type { ScalarInput, ScalarNode } from '../scalar/types';
import type { DecoratorMeta, OpenApiDocument, OpenApiPathItem } from './interfaces';

import { isRecord } from '../common';

function getDecorator(decorators: DecoratorMeta[] | undefined, names: string[]): DecoratorMeta | undefined {
  if (!decorators || decorators.length === 0) {
    return undefined;
  }

  return decorators.find(d => names.includes(d.name));
}

function extractDecorators(value: ScalarInput): DecoratorMeta[] {
  if (!isRecord(value)) {
    return [];
  }

  const decoratorsValue = value.decorators;

  if (!Array.isArray(decoratorsValue)) {
    return [];
  }

  const result: DecoratorMeta[] = [];

  for (const candidate of decoratorsValue) {
    if (!isRecord(candidate)) {
      continue;
    }

    const nameValue = candidate.name;
    const argsValue = candidate.arguments;

    if (typeof nameValue !== 'string' || !Array.isArray(argsValue)) {
      continue;
    }

    const args: ScalarNode[] = argsValue.filter(valueItem => typeof valueItem !== 'function');

    result.push({ name: nameValue, arguments: args });
  }

  return result;
}

function getControllerBasePath(meta: ScalarInput): string {
  const controller = getDecorator(extractDecorators(meta), ['Controller', 'RestController']);
  const raw = controller?.arguments?.[0];

  return typeof raw === 'string' && raw.length > 0 ? raw : '/';
}

function getControllerTag(meta: ScalarInput): string {
  const tags = getDecorator(extractDecorators(meta), ['ApiTags']);
  const raw = tags?.arguments?.[0];
  const classNameValue = isRecord(meta) ? meta.className : undefined;
  const fallback = typeof classNameValue === 'string' ? classNameValue : 'Controller';

  return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
}

function normalizeFullPath(basePath: string, methodPath: string): string {
  const merged = `${basePath}/${methodPath}`.replace(/\/+/g, '/');
  const noTrailing = merged.length > 1 && merged.endsWith('/') ? merged.slice(0, -1) : merged;

  return noTrailing.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

function ensurePath(doc: OpenApiDocument, fullPath: string): OpenApiPathItem {
  doc.paths[fullPath] ??= {};

  return doc.paths[fullPath];
}

function getHttpMethodDecorator(method: ScalarInput): DecoratorMeta | undefined {
  return getDecorator(extractDecorators(method), ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head']);
}

export {
  ensurePath,
  extractDecorators,
  getControllerBasePath,
  getControllerTag,
  getDecorator,
  getHttpMethodDecorator,
  normalizeFullPath,
};
