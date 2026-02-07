const apiKey = Bun.env.CONTEXT7_API_KEY;
if (!apiKey) {
  throw new Error('Missing CONTEXT7_API_KEY');
}

const proc = Bun.spawn(['bunx', '-y', '@upstash/context7-mcp', '--api-key', apiKey], {
  stdin: 'inherit',
  stdout: 'inherit',
  stderr: 'inherit',
});

const code = await proc.exited;
process.exit(code);
