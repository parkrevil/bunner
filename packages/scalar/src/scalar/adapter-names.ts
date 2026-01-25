import type { AdapterCollectionLike, DocumentTargets, HttpTargets, ScalarInput } from './types';

import { hasFunctionProperty, isMap } from '../common';

type GroupWithForEachName = {
  forEach: (cb: (adapter: unknown, name: unknown) => void) => void;
};

function hasForEachWithName(value: ScalarInput): value is GroupWithForEachName {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;

  return typeof record.forEach === 'function';
}

function listAdapterNames(group: ScalarInput): string[] {
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

  if (hasFunctionProperty(group, 'all')) {
    return [];
  }

  return names;
}

export function resolveHttpNamesForDocuments(adapters: AdapterCollectionLike, documentTargets: DocumentTargets): string[] {
  const httpGroup = adapters.http;
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
  const httpGroup = adapters.http;
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
