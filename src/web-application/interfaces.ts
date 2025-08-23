import type { ServeOptions } from 'bun';
import type { StatusCodes } from 'http-status-codes';

export interface RestControllerDecoratorOptions {
  path?: string;
}

export interface WebSocketControllerDecoratorOptions {
  group?: string;
}

export interface RouteDecoratorOptions {
  summary?: string;
  description?: string;
  tags?: string[];
  status?: StatusCodes;
}

export interface BunnerWebServerStartOptions extends Omit<ServeOptions, 'fetch'> { }
