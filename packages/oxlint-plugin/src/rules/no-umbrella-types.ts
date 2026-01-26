import type { AstNode, JsonObject, JsonValue, NodeOrNull, RuleContext } from '../types';

interface NoUmbrellaTypesOptions {
  forbiddenAliases?: string[];
  forbiddenGlobals?: string[];
}

const isJsonObject = (value: JsonValue | undefined): value is JsonObject => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const toStringList = (value: JsonValue | undefined): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const out: string[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      out.push(item);
    }
  }

  return out.length > 0 ? out : null;
};

const readOptions = (raw: JsonValue | undefined): NoUmbrellaTypesOptions => {
  if (!isJsonObject(raw)) {
    return {};
  }

  const forbiddenAliases = toStringList(raw.forbiddenAliases);
  const forbiddenGlobals = toStringList(raw.forbiddenGlobals);
  const out: NoUmbrellaTypesOptions = {};

  if (forbiddenAliases) {
    out.forbiddenAliases = forbiddenAliases;
  }

  if (forbiddenGlobals) {
    out.forbiddenGlobals = forbiddenGlobals;
  }

  return out;
};

const DEFAULT_FORBIDDEN_ALIASES = ['AnyValue', 'AnyFunction', 'DeepPartial'];
const DEFAULT_FORBIDDEN_GLOBALS = ['Function', 'Object'];
const noUmbrellaTypesRule = {
  create(context: RuleContext) {
    const options = readOptions(context.options[0]);
    const forbiddenAliases = new Set(options.forbiddenAliases ?? DEFAULT_FORBIDDEN_ALIASES);
    const forbiddenGlobals = new Set(options.forbiddenGlobals ?? DEFAULT_FORBIDDEN_GLOBALS);

    const getIdentifierName = (node: NodeOrNull): string | null => (node?.type === 'Identifier' ? (node.name ?? null) : null);

    const reportIdentifier = (node: AstNode, messageId: string): void => {
      context.report({
        messageId,
        node,
      });
    };

    return {
      TSTypeAliasDeclaration(node: AstNode) {
        const name = getIdentifierName(node.id);

        if (name !== null && forbiddenAliases.has(name)) {
          reportIdentifier(node.id ?? node, 'forbiddenAlias');
        }
      },
      TSInterfaceDeclaration(node: AstNode) {
        const name = getIdentifierName(node.id);

        if (name !== null && forbiddenAliases.has(name)) {
          reportIdentifier(node.id ?? node, 'forbiddenAlias');
        }
      },
      TSTypeReference(node: AstNode) {
        const name = getIdentifierName(node.typeName);

        if (name === null) {
          return;
        }

        if (forbiddenAliases.has(name)) {
          reportIdentifier(node.typeName ?? node, 'forbiddenAlias');

          return;
        }

        if (forbiddenGlobals.has(name)) {
          reportIdentifier(node.typeName ?? node, 'forbiddenGlobal');
        }
      },
      TSObjectKeyword(node: AstNode) {
        context.report({
          messageId: 'objectKeyword',
          node,
        });
      },
    };
  },
  meta: {
    messages: {
      forbiddenAlias: 'Do not use umbrella types (e.g. `AnyValue` / `AnyFunction`). Define a concrete type.',
      forbiddenGlobal: 'Do not use overly-broad global types (e.g. `Function` / `Object`). Define a concrete type.',
      objectKeyword: 'Do not use the `object` type keyword. Define a concrete type.',
    },
    schema: [
      {
        type: 'object',
        properties: {
          forbiddenAliases: {
            type: 'array',
            items: { type: 'string' },
          },
          forbiddenGlobals: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        additionalProperties: false,
      },
    ],
    type: 'problem',
  },
};

export { noUmbrellaTypesRule };
