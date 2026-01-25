import type { ScalarInput, ScalarMetadataRegistry } from '../scalar/types';
import type { DecoratorMeta, OpenApiDocument, OpenApiRecord, OpenApiSchema } from './interfaces';

import { isRecord } from '../common';
import { extractDecorators, getDecorator } from './utils';

function schemaRef(name: string): OpenApiSchema {
  return { $ref: `#/components/schemas/${name}` };
}

function normalizeTypeName(typeName: ScalarInput | undefined): string | null {
  if (typeName === undefined || typeName === null) {
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

function findTypeMeta(registry: ScalarMetadataRegistry, typeName: ScalarInput | undefined): OpenApiRecord | null {
  const normalized = normalizeTypeName(typeName);
  const normalizedName = normalized?.length !== undefined && normalized.length > 0 ? normalized : null;

  for (const [target, meta] of registry.entries()) {
    if (isRecord(meta) && meta.className === normalized) {
      return meta;
    }

    if (typeof target === 'function') {
      const targetName = target.name;

      if (normalizedName !== null && targetName === normalizedName) {
        return isRecord(meta) ? meta : null;
      }
    }

    if (target === typeName) {
      return isRecord(meta) ? meta : null;
    }
  }

  return null;
}

function buildPropertySchema(registry: ScalarMetadataRegistry, doc: OpenApiDocument, prop: ScalarInput): OpenApiSchema {
  let propSchema: OpenApiSchema;
  const isArrayValue = isRecord(prop) ? prop.isArray : undefined;

  if (isArrayValue === true) {
    const itemsValue = isRecord(prop) ? prop.items : undefined;
    const itemTypeName = isRecord(itemsValue) ? itemsValue.typeName : undefined;
    const hasItemType = itemTypeName !== undefined && itemTypeName !== null;

    propSchema = {
      type: 'array',
      items: hasItemType ? getSchemaForType(registry, doc, itemTypeName) : {},
    };

    const apiProp = getDecorator(extractDecorators(prop), ['ApiProperty', 'ApiPropertyOptional']);

    return applyApiPropertyOptions(propSchema, apiProp);
  }

  const isClassValue = isRecord(prop) ? prop.isClass : undefined;
  const typeValue = isRecord(prop) ? prop.type : undefined;

  if (isClassValue === true && typeValue !== undefined) {
    propSchema = getSchemaForType(registry, doc, typeValue);
  } else {
    const t = typeof typeValue === 'string' ? typeValue : 'string';

    propSchema = { type: t.toLowerCase() };
  }

  const apiProp = getDecorator(extractDecorators(prop), ['ApiProperty', 'ApiPropertyOptional']);

  return applyApiPropertyOptions(propSchema, apiProp);
}

function applyApiPropertyOptions(schema: OpenApiSchema, apiProp: DecoratorMeta | undefined): OpenApiSchema {
  const optsRaw = apiProp?.arguments?.[0];

  if (!isRecord(optsRaw)) {
    return schema;
  }

  const description = optsRaw.description;

  if (typeof description === 'string' && description.length > 0) {
    schema.description = description;
  }

  if (optsRaw.example !== undefined) {
    schema.example = optsRaw.example;
  }

  if (optsRaw.default !== undefined) {
    schema.default = optsRaw.default;
  }

  if (Array.isArray(optsRaw.enum)) {
    schema.enum = optsRaw.enum;
  }

  return schema;
}

export function getSchemaForType(
  registry: ScalarMetadataRegistry,
  doc: OpenApiDocument,
  typeName: ScalarInput | undefined,
): OpenApiSchema {
  const normalized = normalizeTypeName(typeName);

  if (normalized === null || normalized.length === 0) {
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

  const schemaNameValue = meta.className;
  const schemaName = typeof schemaNameValue === 'string' && schemaNameValue.length > 0 ? schemaNameValue : normalized;

  if (doc.components.schemas[schemaName]) {
    return schemaRef(schemaName);
  }

  const properties: OpenApiRecord = {};
  const schema: OpenApiSchema = { type: 'object', properties };

  doc.components.schemas[schemaName] = schema;

  const propsValue = meta.properties;
  const props = Array.isArray(propsValue) ? propsValue : [];

  for (const prop of props) {
    const propNameValue = isRecord(prop) ? prop.name : undefined;
    const propName = typeof propNameValue === 'string' && propNameValue.length > 0 ? propNameValue : undefined;

    if (propName === undefined) {
      continue;
    }

    properties[propName] = buildPropertySchema(registry, doc, prop);
  }

  return schemaRef(schemaName);
}
