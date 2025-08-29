import type { ServeOptions, Server } from 'bun';
import type { BunnerCreateApplicationOptions } from '../interfaces';

export interface BunnerCreateWebApplicationOptions extends BunnerCreateApplicationOptions { }

export interface BunnerRequestConstructorParams {
  request: Request;
  server: Server;
  params: Record<string, any>;
  queryParams: Record<string, any>;
}

export interface RestControllerApiDocument {
  tags?: string[];
}

export interface HttpMethodApiDocument {
  summary?: string;
  description?: string;
}

export interface BunnerWebServerStartOptions extends Omit<ServeOptions, 'fetch' | 'error'> { }

// moved: see providers/middleware/interfaces.ts
