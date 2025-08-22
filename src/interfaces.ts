import type { BunRequest, Server } from 'bun';

export interface BunnerRequestConstructorParams {
  req: BunRequest;
  server: Server;
  headers: Headers;
  body: any;
}

export interface StaticOptions {
  index?: string | string[] | false;
}

export interface StaticConfig extends StaticOptions {
  filePath: string;
}

export interface ApiDocumentOptions {
  useTemplate?: boolean;
}

export interface ApiDocumentBuildResult {
  spec: string;
  parsedSpec: Record<string, any>;
  fileType: 'json' | 'yaml' | undefined;
}
