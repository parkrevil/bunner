import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// MUST: MUST-1

import { createDb } from './db';
import { readEnv } from './env';

const listPackagesInput = z.object({});
const searchInput = z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(50).default(10) });
const describeInput = z.object({ entityKey: z.string().min(1) });
const relationsInput = z.object({
  entityKey: z.string().min(1),
  limit: z.number().int().min(1).max(200).default(50),
});

const server = new Server(
  {
    name: 'bunner',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'list_packages',
        description: 'List known packages.',
        inputSchema: listPackagesInput,
      },
      {
        name: 'search',
        description: 'Hybrid search over chunks (lexical + optional vector).',
        inputSchema: searchInput,
      },
      {
        name: 'describe',
        description: 'Describe a single entity by key; includes pointer and summary.',
        inputSchema: describeInput,
      },
      {
        name: 'relations',
        description: 'List edges adjacent to an entity key.',
        inputSchema: relationsInput,
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  const env = readEnv(process.env);
  const db = await createDb(env.BUNNER_KB_DATABASE_URL);

  switch (request.params.name) {
    case 'list_packages': {
      listPackagesInput.parse(request.params.arguments ?? {});
      const result = await db.query(
        `SELECT DISTINCT package_name
         FROM entity
         WHERE package_name IS NOT NULL
         ORDER BY package_name ASC`,
      );
      return {
        content: [
          {
            type: 'json',
            json: { packages: result.rows },
          },
        ],
      };
    }

    case 'search': {
      const { query, limit } = searchInput.parse(request.params.arguments ?? {});
      const result = await db.query(
        `SELECT
           c.id,
           e.entity_key,
           ct.name AS chunk_type,
           c.payload_text,
           c.payload_json,
           c.pointer_id
         FROM chunk c
         JOIN entity e ON e.id = c.entity_id
         JOIN chunk_type ct ON ct.id = c.chunk_type_id
         WHERE c.payload_tsv @@ plainto_tsquery('simple', $1)
         ORDER BY ts_rank_cd(c.payload_tsv, plainto_tsquery('simple', $1)) DESC
         LIMIT $2`,
        [query, limit],
      );
      return {
        content: [
          {
            type: 'json',
            json: { hits: result.rows },
          },
        ],
      };
    }

    case 'describe': {
      const { entityKey } = describeInput.parse(request.params.arguments ?? {});
      const result = await db.query(
        `SELECT
           e.entity_key,
           et.name AS entity_type,
           e.package_name,
           e.display_name,
           e.summary_text,
           e.pointer_id
         FROM entity e
         JOIN entity_type et ON et.id = e.entity_type_id
         WHERE e.entity_key = $1`,
        [entityKey],
      );
      return {
        content: [
          {
            type: 'json',
            json: { entity: result.rows[0] ?? null },
          },
        ],
      };
    }

    case 'relations': {
      const { entityKey, limit } = relationsInput.parse(request.params.arguments ?? {});
      const result = await db.query(
        `SELECT
           src.entity_key AS src_entity_key,
           dst.entity_key AS dst_entity_key,
           et.name AS edge_type,
           st.name AS strength,
           e.pointer_id,
           e.id AS edge_id
         FROM edge e
         JOIN entity src ON src.id = e.src_entity_id
         JOIN entity dst ON dst.id = e.dst_entity_id
         JOIN edge_type et ON et.id = e.edge_type_id
         JOIN strength_type st ON st.id = e.strength_type_id
         WHERE src.entity_key = $1 OR dst.entity_key = $1
         ORDER BY e.created_at DESC
         LIMIT $2`,
        [entityKey, limit],
      );
      return {
        content: [
          {
            type: 'json',
            json: { edges: result.rows },
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
