import { hashString } from '../../engine/hasher';

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

interface ComputeProjectKeyInput {
  readonly toolVersion: string;
  readonly cwd?: string;
}

const computeProjectKey = (input: ComputeProjectKeyInput): string => {
  const cwd = input.cwd ?? process.cwd();

  return hashString(`firebat|${input.toolVersion}|${normalizePath(cwd)}|${Bun.version}`);
};

interface ComputeScanArtifactKeyInput {
  readonly detectors: ReadonlyArray<string>;
  readonly minSize: string;
  readonly maxForwardDepth: number;
}

const computeScanArtifactKey = (input: ComputeScanArtifactKeyInput): string => {
  const normalizedDetectors = [...input.detectors].sort();

  return hashString(
    [
      'scan',
      `detectors=${normalizedDetectors.join(',')}`,
      `minSize=${input.minSize}`,
      `maxForwardDepth=${String(input.maxForwardDepth)}`,
    ].join('|'),
  );
};

interface ComputeTraceArtifactKeyInput {
  readonly entryFile: string;
  readonly symbol: string;
  readonly tsconfigPath?: string;
  readonly maxDepth?: number;
}

const computeTraceArtifactKey = (input: ComputeTraceArtifactKeyInput): string => {
  const normalizedEntry = normalizePath(input.entryFile);
  const normalizedTsconfig = input.tsconfigPath !== undefined ? normalizePath(input.tsconfigPath) : '';

  return hashString(
    [
      'traceSymbol',
      `entryFile=${normalizedEntry}`,
      `symbol=${input.symbol}`,
      `tsconfigPath=${normalizedTsconfig}`,
      `maxDepth=${String(input.maxDepth ?? '')}`,
    ].join('|'),
  );
};

export { computeProjectKey, computeScanArtifactKey, computeTraceArtifactKey };
