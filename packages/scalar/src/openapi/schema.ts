import { isRecord } from '../common';

import type { DecoratorMeta, OpenApiDocument } from './interfaces';
import { getDecorator } from './utils';

function schemaRef(name: string): Record<string, unknown> {
  return { $ref: `#/components/schemas/${name}` };
}

function normalizeTypeName(typeName: unknown): string | null {
  if (!typeName) {
    return null;
  }

  if (typeof typeName === 'string') {
    return typeName;
  }

  if (typeof typeName === 'function') {
    return typeName.name;
  }

  return null;
}

function isPrimitiveTypeName(name: string): boolean {
  return ['string', 'number', 'boolean'].includes(name.toLowerCase());
}

function findTypeMeta(registry: Map<unknown, unknown>, typeName: unknown): Record<string, unknown> | null {
  const normalized = normalizeTypeName(typeName);

  for (const [target, meta] of registry.entries()) {
    if (isRecord(meta) && meta['className'] === normalized) {
      return meta;
    }

    if (typeof target === 'function' && normalized && target.name === normalized) {
      return isRecord(meta) ? meta : null;
    }

    if (target === typeName) {
      return isRecord(meta) ? meta : null;
    }
  }

  return null;
}

function buildPropertySchema(registry: Map<unknown, unknown>, doc: OpenApiDocument, prop: unknown): Record<string, unknown> {
  let propSchema: Record<string, unknown>;
  const isArrayValue = isRecord(prop) ? prop['isArray'] : undefined;

  if (isArrayValue === true) {
    const itemsValue = isRecord(prop) ? prop['items'] : undefined;
    const itemTypeName = isRecord(itemsValue) ? itemsValue['typeName'] : undefined;

    propSchema = {
      type: 'array',
      items: itemTypeName ? getSchemaForType(registry, doc, itemTypeName) : {},
    };

    const apiProp = getDecorator(getDecorators(prop), ['ApiProperty', 'ApiPropertyOptional']);

    return applyApiPropertyOptions(propSchema, apiProp);
  }

  const isClassValue = isRecord(prop) ? prop['isClass'] : undefined;
  const typeValue = isRecord(prop) ? prop['type'] : undefined;

  if (isClassValue === true && typeValue) {
    propSchema = getSchemaForType(registry, doc, typeValue);
  } else {
    const t = typeof typeValue === 'string' ? typeValue : 'string';

    propSchema = { type: t.toLowerCase() };
  }

  const apiProp = getDecorator(getDecorators(prop), ['ApiProperty', 'ApiPropertyOptional']);

  return applyApiPropertyOptions(propSchema, apiProp);
}

function getDecorators(value: unknown): DecoratorMeta[] | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const decoratorsValue = value['decorators'];

  if (!Array.isArray(decoratorsValue)) {
    return undefined;
  }

  return decoratorsValue as DecoratorMeta[];
}

function applyApiPropertyOptions(schema: Record<string, unknown>, apiProp: DecoratorMeta | undefined): Record<string, unknown> {
  const optsRaw = apiProp?.arguments?.[0];

  if (!isRecord(optsRaw)) {
    return schema;
  }

  const description = optsRaw['description'];

  if (typeof description === 'string' && description.length > 0) {
    schema['description'] = description;
  }

  if (optsRaw['example'] !== undefined) {
    schema['example'] = optsRaw['example'];
  }

  if (optsRaw['default'] !== undefined) {
    schema['default'] = optsRaw['default'];
  }

  if (Array.isArray(optsRaw['enum'])) {
    schema['enum'] = optsRaw['enum'];
  }

  return schema;
}

export function getSchemaForType(
  registry: Map<unknown, unknown>,
  doc: OpenApiDocument,
  typeName: unknown,
): Record<string, unknown> {
  const normalized = normalizeTypeName(typeName);

  if (!normalized) {
    return { type: 'object' };
  }

  if (isPrimitiveTypeName(normalized)) {
    return { type: normalized.toLowerCase() };
  }

  if (doc.components.schemas[normalized]) {
    return schemaRef(normalized);
  }

  const meta = findTypeMeta(registry, typeName);

  if (!meta) {
    return { type: 'object' };
  }

  const schemaNameValue = meta['className'];
  const schemaName = typeof schemaNameValue === 'string' && schemaNameValue.length > 0 ? schemaNameValue : normalized;

  if (doc.components.schemas[schemaName]) {
    return schemaRef(schemaName);
  }

  const schema: Record<string, unknown> = { type: 'object', properties: {} };

  doc.components.schemas[schemaName] = schema;

  const propsValue = meta['properties'];
  const props = Array.isArray(propsValue) ? propsValue : [];
  const properties = schema['properties'] as Record<string, unknown>;

  for (const prop of props) {
    const propNameValue = isRecord(prop) ? prop['name'] : undefined;
    const propName = typeof propNameValue === 'string' && propNameValue.length > 0 ? propNameValue : undefined;

    if (!propName) {
      continue;
    }

    properties[propName] = buildPropertySchema(registry, doc, prop);
  }

  return schemaRef(schemaName);
}
