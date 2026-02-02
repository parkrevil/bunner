import { hashString } from '../../engine/hasher';

const normalizePath = (filePath: string): string => filePath.replaceAll('\\', '/');

const computeProjectKey = (input: { toolVersion: string; cwd?: string }): string => {
  const cwd = input.cwd ?? process.cwd();
  return hashString(`firebat|${input.toolVersion}|${normalizePath(cwd)}|${Bun.version}`);
};

const computeScanArtifactKey = (input: {
  detectors: ReadonlyArray<string>;
  minSize: string;
  maxForwardDepth: number;
}): string => {
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

const computeTraceArtifactKey = (input: {
  entryFile: string;
  symbol: string;
  tsconfigPath?: string;
  maxDepth?: number;
}): string => {
  const normalizedEntry = normalizePath(input.entryFile);
  const normalizedTsconfig = input.tsconfigPath ? normalizePath(input.tsconfigPath) : '';

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
