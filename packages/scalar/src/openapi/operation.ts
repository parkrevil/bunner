import type { ScalarInput, ScalarMetadataRegistry, ScalarRecord } from '../scalar/types';
import type { DecoratorMeta, OpenApiDocument, OpenApiOperation, OpenApiParameter, OpenApiRecord } from './interfaces';

import { isRecord } from '../common';
import { getSchemaForType } from './schema';
import { extractDecorators, getDecorator } from './utils';

function getParameters(value: ScalarInput): ScalarRecord[] {
  if (!isRecord(value)) {
    return [];
  }

  const parametersValue = value.parameters;

  if (!Array.isArray(parametersValue)) {
    return [];
  }

  const params: ScalarRecord[] = [];

  for (const param of parametersValue) {
    if (isRecord(param)) {
      params.push(param);
    }
  }

  return params;
}

function getStringProperty(value: ScalarInput, name: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const raw = value[name];

  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  return raw;
}

function getDecoratorOptions(dec: DecoratorMeta | undefined): OpenApiRecord | undefined {
  const raw = dec?.arguments?.[0];

  if (!isRecord(raw)) {
    return undefined;
  }

  return raw;
}

export function addOperationMetadata(operation: OpenApiOperation, method: ScalarInput): void {
  const op = getDecorator(extractDecorators(method), ['ApiOperation']);
  const opts = getDecoratorOptions(op);

  if (opts === undefined) {
    return;
  }

  if (typeof opts.summary === 'string' && opts.summary.length > 0) {
    operation.summary = opts.summary;
  }

  if (typeof opts.description === 'string' && opts.description.length > 0) {
    operation.description = opts.description;
  }
}

export function addOperationParameters(operation: OpenApiOperation, method: ScalarInput): void {
  const params = getParameters(method);

  for (const param of params) {
    const dec = getDecorator(extractDecorators(param), ['Param', 'Params', 'Query']);

    if (!dec) {
      continue;
    }

    const inType = dec.name === 'Query' ? 'query' : 'path';
    const argNameCandidate = dec.arguments?.[0];
    const paramName = getStringProperty(param, 'name');
    const argName =
      typeof argNameCandidate === 'string' && argNameCandidate.length > 0 ? argNameCandidate : (paramName ?? 'param');
    const parameter: OpenApiParameter = {
      name: argName,
      in: inType,
      required: inType === 'path',
      schema: { type: 'string' },
    };

    operation.parameters.push(parameter);
  }
}

export function addOperationRequestBody(
  operation: OpenApiOperation,
  method: ScalarInput,
  registry: ScalarMetadataRegistry,
  doc: OpenApiDocument,
): void {
  const params = getParameters(method);

  for (const param of params) {
    const dec = getDecorator(extractDecorators(param), ['Body']);

    if (!dec) {
      continue;
    }

    const typeValue = isRecord(param) ? param.type : undefined;
    const schema = getSchemaForType(registry, doc, typeValue);

    operation.requestBody = {
      content: {
        'application/json': { schema },
      },
    };

    return;
  }
}

export function addOperationResponses(
  operation: OpenApiOperation,
  method: ScalarInput,
  registry: ScalarMetadataRegistry,
  doc: OpenApiDocument,
): void {
  const decorators = extractDecorators(method);
  const responseDecs: DecoratorMeta[] = decorators.filter(
    (d: DecoratorMeta) => d.name === 'ApiResponse' || d.name.endsWith('Response'),
  );

  if (responseDecs.length === 0) {
    operation.responses = { '200': { description: 'Success' } };

    return;
  }

  operation.responses = {};

  for (const d of responseDecs) {
    const optsRaw = d.arguments?.[0] ?? {};
    const opts = isRecord(optsRaw) ? optsRaw : {};
    let status: number | undefined;

    if (d.name === 'ApiResponse' && typeof opts.status === 'number') {
      status = opts.status;
    }

    if (d.name === 'ApiOkResponse') {
      status = 200;
    }

    if (d.name === 'ApiCreatedResponse') {
      status = 201;
    }

    if (d.name === 'ApiNotFoundResponse') {
      status = 404;
    }

    if (status === undefined) {
      continue;
    }

    const entry: OpenApiRecord = {
      description: typeof opts.description === 'string' ? opts.description : 'Success',
    };

    if (opts.type !== undefined) {
      entry.content = {
        'application/json': {
          schema: getSchemaForType(registry, doc, opts.type),
        },
      };
    }

    const responses = operation.responses;

    if (responses !== undefined) {
      responses[String(status)] = entry;
    }
  }

  const finalResponses = operation.responses;

  if (finalResponses !== undefined && Object.keys(finalResponses).length === 0) {
    operation.responses = { '200': { description: 'Success' } };
  }
}
