import type { RunCaptureConfig } from './spawn-utils.types';

const textDecoder = new TextDecoder();

const runCapture = (config: RunCaptureConfig, cmd: string, args: readonly string[]): string | null => {
  const child = Bun.spawnSync([cmd, ...args], {
    cwd: config.cwd,
    env: config.env,
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'ignore',
  });
  const code = typeof child.exitCode === 'number' ? child.exitCode : 1;

  if (code !== 0) {
    return null;
  }

  return textDecoder.decode(child.stdout).trim();
};

export { runCapture };
