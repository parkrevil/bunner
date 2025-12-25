import { isRecord } from '../common';

import type { DecoratorMeta, OpenApiDocument } from './interfaces';

export function getDecorator(decorators: DecoratorMeta[] | undefined, names: string[]): DecoratorMeta | undefined {
  if (!decorators || decorators.length === 0) {
    return undefined;
  }

  return decorators.find(d => names.includes(d.name));
}

export function getControllerBasePath(meta: unknown): string {
  const metaDecoratorsValue = isRecord(meta) ? meta['decorators'] : undefined;
  const metaDecorators = Array.isArray(metaDecoratorsValue) ? (metaDecoratorsValue as DecoratorMeta[]) : undefined;
  const controller = getDecorator(metaDecorators, ['Controller', 'RestController']);
  const raw = controller?.arguments?.[0];

  return typeof raw === 'string' && raw.length > 0 ? raw : '/';
}

export function getControllerTag(meta: unknown): string {
  const metaDecoratorsValue = isRecord(meta) ? meta['decorators'] : undefined;
  const metaDecorators = Array.isArray(metaDecoratorsValue) ? (metaDecoratorsValue as DecoratorMeta[]) : undefined;
  const tags = getDecorator(metaDecorators, ['ApiTags']);
  const raw = tags?.arguments?.[0];
  const classNameValue = isRecord(meta) ? meta['className'] : undefined;
  const fallback = typeof classNameValue === 'string' ? classNameValue : 'Controller';

  return typeof raw === 'string' && raw.length > 0 ? raw : fallback;
}

export function normalizeFullPath(basePath: string, methodPath: string): string {
  const merged = `${basePath}/${methodPath}`.replace(/\/+/g, '/');
  const noTrailing = merged.length > 1 && merged.endsWith('/') ? merged.slice(0, -1) : merged;

  return noTrailing.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
}

export function ensurePath(doc: OpenApiDocument, fullPath: string): Record<string, unknown> {
  if (!doc.paths[fullPath]) {
    doc.paths[fullPath] = {};
  }

  return doc.paths[fullPath];
}

export function getHttpMethodDecorator(method: unknown): DecoratorMeta | undefined {
  const methodDecoratorsValue = isRecord(method) ? method['decorators'] : undefined;
  const methodDecorators = Array.isArray(methodDecoratorsValue) ? (methodDecoratorsValue as DecoratorMeta[]) : undefined;

  return getDecorator(methodDecorators, ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head']);
}
