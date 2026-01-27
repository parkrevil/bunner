declare module 'oxc-parser' {
  export type AstNodeValue = import('../types').AstNodeValue;

  export interface ParseSyncResult {
    program: AstNodeValue | null;
  }

  export function parseSync(filename: string, code: string): ParseSyncResult;
}
