import type { Server } from 'bun';
import type { ClassType } from './types';

export interface IBunnerApplication {
  start(options?: any): void | Promise<void>;
  stop(force?: boolean): void | Promise<void>;
}

export interface BunnerCreateApplicationOptions {
  name?: string;
}

export interface BunnerCreateWebApplicationOptions extends BunnerCreateApplicationOptions {
  modules?: ClassType<any>[];
}

export interface BunnerRequestConstructorParams {
  request: Request;
  server: Server;
  params: Record<string, any>;
  queryParams: Record<string, any>;
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
