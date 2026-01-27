declare module 'oxc-parser' {
  export interface ParserOptions {
    readonly sourceType?: 'script' | 'module';
    readonly comments?: boolean;
  }

  export interface Program {
    readonly type?: string;
    readonly start?: number;
    readonly end?: number;
    readonly [key: string]: import('@bunner/common').BunnerValue | undefined;
  }

  export interface ParseError {
    readonly message?: string;
    readonly start?: number;
    readonly end?: number;
  }

  export interface Comment {
    readonly type?: string;
    readonly value?: string;
    readonly start?: number;
    readonly end?: number;
  }

  export interface ParseResult {
    readonly program: Program;
    readonly errors: ReadonlyArray<ParseError>;
    readonly comments: ReadonlyArray<Comment>;
  }

  export function parseSync(filename: string, code: string, options?: ParserOptions): ParseResult;
}
