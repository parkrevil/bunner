export const CompressionAlgorithm = {
  Gzip: 'gzip',
  Deflate: 'deflate',
  Brotli: 'br',
  Zstd: 'zstd',
} as const;

export const ETagAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
} as const;