import { describe, test, expect, beforeAll } from 'bun:test';

import { Logger } from '../src/logger';

process.env.RUST_LOG = process.env.RUST_LOG || 'trace';

async function runChild() {
  let timedOut = false;
  const childPath = new URL('./src/child.ts', import.meta.url).pathname;
  const proc = Bun.spawn(['bun', 'run', childPath], {
    cwd: process.cwd(),
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      RUST_LOG: 'trace',
      NODE_ENV: 'test',
    },
  });
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      proc.kill(9);
    } catch {}
  }, 8000);
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text().catch(() => ''),
    new Response(proc.stderr).text().catch(() => ''),
  ]);

  clearTimeout(timer);

  return {
    timedOut,
    combined: `${out}\n${err}`,
  };
}

describe('Logger (integration)', () => {
  let logger: Logger;

  beforeAll(() => {
    logger = Logger.getInstance();
    logger.init();
  });

  describe('Encoding', () => {
    test('utf8 cstring encoding echoes exact strings', async () => {
      const { timedOut, combined } = await runChild();
      expect(timedOut).toBe(false);

      const unicodeMsg = '한글✓🙂 UTF-8 message';
      const longMsg = 'x'.repeat(100);
      const emptyMsg = '';

      expect(combined).toContain(`UTF8_EMPTY:${emptyMsg}`);
      expect(combined).toContain(`UTF8_UNICODE:${unicodeMsg}`);
      expect(combined).toContain(`UTF8_LONG:${longMsg}`);
    });
  });

  describe('Singleton', () => {
    test('parallel init prints init message exactly once', async () => {
      const { timedOut, combined } = await runChild();
      expect(timedOut).toBe(false);

      const initMsg = 'Bunner Rust Logger initialized.';
      const occurrences = combined.split(initMsg).length - 1;
      expect(occurrences).toBe(1);
    });

    test('each log level prints once', async () => {
      const { timedOut, combined } = await runChild();
      expect(timedOut).toBe(false);

      expect(combined).toContain('TRACE_OK_FFI_SINGLETON');
      expect(combined).toContain('DEBUG_OK_FFI_SINGLETON');
      expect(combined).toContain('INFO_OK_FFI_SINGLETON');
      expect(combined).toContain('WARN_OK_FFI_SINGLETON');
      expect(combined).toContain('ERROR_OK_FFI_SINGLETON');
    });
  });
});
