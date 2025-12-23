import {} from '@bunner/core';

export class OpenApiFactory {
  static create(registry: Map<any, any>, config: { title: string; version: string }) {
    const openApi: any = {
      openapi: '3.0.0',
      info: {
        title: config.title,
        version: config.version,
      },
      paths: {},
      components: {
        schemas: {},
      },
    };

    for (const [target, meta] of registry.entries()) {
      const metatype = meta;

      const controllerDec = metatype.decorators.find((d: any) => d.name === 'Controller' || d.name === 'RestController');

      if (controllerDec) {
        this.processController(openApi, target, metatype, registry);
      }
    }

    return openApi;
  }

  private static processController(doc: any, _target: any, meta: any, registry: Map<any, any>) {
    let basePath = '/';
    const controllerDec = meta.decorators.find((d: any) => d.name === 'Controller' || d.name === 'RestController');
    if (controllerDec && controllerDec.arguments.length > 0) {
      basePath = controllerDec.arguments[0] || '/';
    }

    let tag = meta.className;
    const tagsDec = meta.decorators.find((d: any) => d.name === 'ApiTags');
    if (tagsDec && tagsDec.arguments.length > 0) {
      tag = tagsDec.arguments[0];
    }

    meta.methods.forEach((method: any) => {
      const httpMethodDec = method.decorators.find((d: any) =>
        ['Get', 'Post', 'Put', 'Delete', 'Patch', 'Options', 'Head'].includes(d.name),
      );

      if (httpMethodDec) {
        const methodPath = httpMethodDec.arguments[0] || '/';
        const httpMethod = httpMethodDec.name.toLowerCase();

        let fullPath = (basePath + '/' + methodPath).replace(/\/+/g, '/');
        if (fullPath.length > 1 && fullPath.endsWith('/')) {
          fullPath = fullPath.slice(0, -1);
        }

        fullPath = fullPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');

        if (!doc.paths[fullPath]) {
          doc.paths[fullPath] = {};
        }

        const operation: any = {
          tags: [tag],
          operationId: `${meta.className}_${method.name}`,
          parameters: [],
          responses: {
            '200': { description: 'Success' },
          },
        };

        const opDec = method.decorators.find((d: any) => d.name === 'ApiOperation');
        if (opDec) {
          const opts = opDec.arguments[0];
          if (opts.summary) {
            operation.summary = opts.summary;
          }
          if (opts.description) {
            operation.description = opts.description;
          }
        }

        method.parameters.forEach((param: any) => {
          const paramDec = param.decorators.find((d: any) => d.name === 'Param' || d.name === 'Params' || d.name === 'Query');
          if (paramDec) {
            const inType = paramDec.name === 'Query' ? 'query' : 'path';
            const argName = paramDec.arguments[0] || param.name;

            operation.parameters.push({
              name: argName,
              in: inType,
              required: inType === 'path',
              schema: { type: 'string' },
            });
          }

          const bodyDec = param.decorators.find((d: any) => d.name === 'Body');
          if (bodyDec) {
            const schema = this.getSchemaForType(param.type, param.typeArgs, registry, doc);
            operation.requestBody = {
              content: {
                'application/json': {
                  schema: schema,
                },
              },
            };
          }
        });

        const resDecs = method.decorators.filter((d: any) => d.name === 'ApiResponse' || d.name.endsWith('Response'));
        resDecs.forEach((_d: any) => {});

        doc.paths[fullPath][httpMethod] = operation;
      }
    });
  }

  private static getSchemaForType(typeName: any, _typeArgs: string[] | undefined, registry: Map<any, any>, doc: any): any {
    if (!typeName) {
      return { type: 'object' };
    }

    let targetName = typeName;
    if (typeof typeName === 'function') {
      targetName = typeName.name;
    }

    if (typeof targetName === 'string' && ['string', 'number', 'boolean'].includes(targetName.toLowerCase())) {
      return { type: targetName.toLowerCase() };
    }

    if (doc.components.schemas[targetName]) {
      return { $ref: `#/components/schemas/${targetName}` };
    }

    let targetMeta: any = null;

    // If it's a reference (Function or String), find it in registry
    for (const [target, meta] of registry.entries()) {
      if (meta.className === targetName || target.name === targetName || target === typeName) {
        targetMeta = meta;
        targetName = meta.className; // Ensure we use the canonical class name for schema key
        break;
      }
    }

    if (!targetMeta) {
      return { type: 'object' };
    }

    const schema: any = { type: 'object', properties: {} };
    doc.components.schemas[targetName] = schema;

    targetMeta.properties.forEach((prop: any) => {
      let propSchema: any = {};

      if (prop.isClass && prop.type) {
        const childName = typeof prop.type === 'function' ? prop.type.name : prop.type;
        propSchema = this.getSchemaForType(childName, prop.typeArgs, registry, doc);
      } else if (prop.isArray) {
        propSchema = { type: 'array', items: {} };
        if (prop.items && prop.items.typeName) {
          const itemType = typeof prop.items.typeName === 'function' ? prop.items.typeName.name : prop.items.typeName;
          propSchema.items = this.getSchemaForType(itemType, undefined, registry, doc);
        }
      } else {
        propSchema = { type: (prop.type || 'string').toLowerCase() };
      }

      const apiProp = prop.decorators.find((d: any) => d.name === 'ApiProperty');
      if (apiProp) {
        const opts = apiProp.arguments[0] || {};
        if (opts.description) {
          propSchema.description = opts.description;
        }
        if (opts.example) {
          propSchema.example = opts.example;
        }
      }
      schema.properties[prop.name] = propSchema;
    });

    return { $ref: `#/components/schemas/${targetName}` };
  }
}
