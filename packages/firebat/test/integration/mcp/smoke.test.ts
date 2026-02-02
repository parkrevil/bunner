import * as path from 'node:path';

import { expect, test } from 'bun:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

test('firebat MCP smoke: tools/resources/prompts', async () => {
  const client = new Client({ name: 'firebat-smoke', version: '0.0.0' });

  const serverEntry = path.resolve(import.meta.dir, '../../../index.ts');
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [serverEntry, 'mcp'],
  });

  await client.connect(transport);

  try {
    const tools = await client.listTools();
    const toolNames = new Set(tools.tools.map(t => t.name));

    expect(toolNames.has('firebat.scan')).toBe(true);
    expect(toolNames.has('firebat.findPattern')).toBe(true);
    expect(toolNames.has('firebat.traceSymbol')).toBe(true);
    expect(toolNames.has('firebat.lint')).toBe(true);

    const fixture = path.resolve(import.meta.dir, 'fixtures/sample.ts');

    const scanResult: any = await client.callTool({
      name: 'firebat.scan',
      arguments: { targets: [fixture], detectors: ['duplicates', 'waste'], minSize: 'auto', maxForwardDepth: 0 },
    });

    const scanStructured = scanResult.structuredContent ?? JSON.parse(scanResult.content?.[0]?.text ?? '{}');
    expect(scanStructured.report).toBeTruthy();

    const findResult: any = await client.callTool({
      name: 'firebat.findPattern',
      arguments: {
        targets: [fixture],
        ruleName: 'inline',
        rule: { pattern: 'console.log($$$ARGS)' },
      },
    });

    const findStructured = findResult.structuredContent ?? JSON.parse(findResult.content?.[0]?.text ?? '{}');
    expect(Array.isArray(findStructured.matches)).toBe(true);

    const resources = await client.listResources();
    const uris = new Set(resources.resources.map(r => r.uri));

    expect(uris.has('firebat://report/last')).toBe(true);

    const lastReport = await client.readResource({ uri: 'firebat://report/last' });
    const firstContent = lastReport.contents[0];
    const firstText = firstContent && 'text' in firstContent ? firstContent.text : undefined;
    expect(firstText).toBeDefined();

    const prompts = await client.listPrompts();
    const promptNames = new Set(prompts.prompts.map(p => p.name));
    expect(promptNames.has('firebat.review')).toBe(true);

    const prompt = await client.getPrompt({
      name: 'firebat.review',
      arguments: { reportJson: JSON.stringify(scanStructured.report) },
    });

    expect(prompt.messages.length).toBeGreaterThan(0);
  } finally {
    await client.close();
  }
});
