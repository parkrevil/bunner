import { hasFunctionProperty } from '../common';

import type { AdapterCollectionLike, DocumentTargets, HttpTargets } from './types';

function listAdapterNames(group: unknown): string[] {
  const names: string[] = [];

  if (!group) {
    return names;
  }

  if (hasFunctionProperty(group, 'forEach')) {
    (group as Map<unknown, unknown>).forEach((_adapter: unknown, name: unknown) => {
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
  const adaptersRecord = adapters as unknown as Record<string, unknown>;
  const httpGroup = adaptersRecord['http'];
  const allHttpNames = listAdapterNames(httpGroup);

  if (documentTargets === 'all') {
    return allHttpNames;
  }

  const rules = documentTargets.filter(target => target && typeof target.protocol === 'string' && target.protocol === 'http');

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
  const adaptersRecord = adapters as unknown as Record<string, unknown>;
  const httpGroup = adaptersRecord['http'];
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
