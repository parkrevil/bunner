import type { AdapterCollectionLike, AdapterGroupLike, AdapterGroupWithName, DocumentTargets, HttpTargets } from './types';

import { isMap } from '../common';

function hasForEachWithName(value: AdapterGroupLike): value is AdapterGroupWithName {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (!('forEach' in value)) {
    return false;
  }

  return typeof value.forEach === 'function';
}

function hasAllMethod(value: AdapterGroupLike): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  return 'all' in value && typeof value.all === 'function';
}

function listAdapterNames(group: AdapterGroupLike | undefined): string[] {
  const names: string[] = [];

  if (group === undefined || group === null) {
    return names;
  }

  if (isMap(group)) {
    group.forEach((_adapter, name) => {
      if (typeof name !== 'string') {
        return;
      }

      names.push(name);
    });

    return names;
  }

  if (hasForEachWithName(group)) {
    group.forEach((_adapter, name) => {
      if (typeof name !== 'string') {
        return;
      }

      names.push(name);
    });

    return names;
  }

  if (hasAllMethod(group)) {
    return [];
  }

  return names;
}

export function resolveHttpNamesForDocuments(adapters: AdapterCollectionLike, documentTargets: DocumentTargets): string[] {
  const httpGroup: AdapterGroupLike | undefined = adapters.http;
  const allHttpNames = listAdapterNames(httpGroup);

  if (documentTargets === 'all') {
    return allHttpNames;
  }

  const rules = documentTargets.filter(target => target.protocol === 'http');

  if (rules.length === 0) {
    return [];
  }

  const selected = new Set<string>();

  for (const rule of rules) {
    if (!rule.names || rule.names.length === 0) {
      allHttpNames.forEach(name => selected.add(name));
    } else {
      rule.names.forEach(name => selected.add(name));
    }
  }

  return allHttpNames.filter(name => selected.has(name));
}

export function resolveHttpNamesForHosting(adapters: AdapterCollectionLike, httpTargets: HttpTargets): string[] {
  const httpGroup: AdapterGroupLike | undefined = adapters.http;
  const allHttpNames = listAdapterNames(httpGroup);

  if (httpTargets === 'all') {
    return allHttpNames;
  }

  const targets = httpTargets;
  const missing = targets.filter(name => !allHttpNames.includes(name));

  if (missing.length > 0) {
    throw new Error(`Scalar: selected httpTargets not found: ${missing.join(', ')}`);
  }

  return targets;
}
