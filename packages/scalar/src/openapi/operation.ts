import { isRecord } from '../common';

import type { DecoratorMeta, OpenApiDocument, OpenApiOperation } from './interfaces';
import { getSchemaForType } from './schema';
import { getDecorator } from './utils';

function getDecorators(value: unknown): DecoratorMeta[] {
  if (!isRecord(value)) {
    return [];
  }

  const decoratorsValue = value['decorators'];

  if (!Array.isArray(decoratorsValue)) {
    return [];
  }

  return decoratorsValue as DecoratorMeta[];
}

function getParameters(value: unknown): unknown[] {
  if (!isRecord(value)) {
    return [];
  }

  const parametersValue = value['parameters'];

  if (!Array.isArray(parametersValue)) {
    return [];
  }

  return parametersValue;
}

function getStringProperty(value: unknown, name: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const raw = value[name];

  if (typeof raw !== 'string' || raw.length === 0) {
    return undefined;
  }

  return raw;
}

function getDecoratorOptions(dec: DecoratorMeta | undefined): Record<string, unknown> | undefined {
  const raw = dec?.arguments?.[0];

  if (!isRecord(raw)) {
    return undefined;
  }

  return raw;
}

export function addOperationMetadata(operation: OpenApiOperation, method: unknown): void {
  const op = getDecorator(getDecorators(method), ['ApiOperation']);
  const opts = getDecoratorOptions(op);

  if (!opts) {
    return;
  }

  if (typeof opts['summary'] === 'string' && opts['summary'].length > 0) {
    operation['summary'] = opts['summary'];
  }

  if (typeof opts['description'] === 'string' && opts['description'].length > 0) {
    operation['description'] = opts['description'];
  }
}

export function addOperationParameters(operation: OpenApiOperation, method: unknown): void {
  const params = getParameters(method);

  for (const param of params) {
    const dec = getDecorator(getDecorators(param), ['Param', 'Params', 'Query']);

    if (!dec) {
      continue;
    }

    const inType = dec.name === 'Query' ? 'query' : 'path';
    const argNameCandidate = dec.arguments?.[0];
    const paramName = getStringProperty(param, 'name');
    const argName =
      typeof argNameCandidate === 'string' && argNameCandidate.length > 0 ? argNameCandidate : (paramName ?? 'param');

    operation.parameters.push({
      name: argName,
      in: inType,
      required: inType === 'path',
      schema: { type: 'string' },
    });
  }
}

export function addOperationRequestBody(
  operation: OpenApiOperation,
  method: unknown,
  registry: Map<unknown, unknown>,
  doc: OpenApiDocument,
): void {
  const params = getParameters(method);

  for (const param of params) {
    const dec = getDecorator(getDecorators(param), ['Body']);

    if (!dec) {
      continue;
    }

    const typeValue = isRecord(param) ? param['type'] : undefined;
    const schema = getSchemaForType(registry, doc, typeValue);

    operation['requestBody'] = {
      content: {
        'application/json': { schema },
      },
    };

    return;
  }
}

export function addOperationResponses(
  operation: OpenApiOperation,
  method: unknown,
  registry: Map<unknown, unknown>,
  doc: OpenApiDocument,
): void {
  const decorators = getDecorators(method);
  const responseDecs: DecoratorMeta[] = decorators.filter(
    (d: DecoratorMeta) => d.name === 'ApiResponse' || d.name.endsWith('Response'),
  );

  if (responseDecs.length === 0) {
    operation['responses'] = { '200': { description: 'Success' } };

    return;
  }

  operation['responses'] = {};

  for (const d of responseDecs) {
    const optsRaw = d.arguments?.[0] ?? {};
    const opts = isRecord(optsRaw) ? optsRaw : {};
    let status: number | undefined;

    if (d.name === 'ApiResponse' && typeof opts['status'] === 'number') {
      status = opts['status'];
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

    if (!status) {
      continue;
    }

    const entry: Record<string, unknown> = {
      description: typeof opts['description'] === 'string' ? opts['description'] : 'Success',
    };

    if (opts['type']) {
      entry.content = {
        'application/json': {
          schema: getSchemaForType(registry, doc, opts['type']),
        },
      };
    }

    const responses = operation['responses'];

    if (isRecord(responses)) {
      responses[String(status)] = entry;
    }
  }

  const finalResponses = operation['responses'];

  if (isRecord(finalResponses) && Object.keys(finalResponses).length === 0) {
    operation['responses'] = { '200': { description: 'Success' } };
  }
}
