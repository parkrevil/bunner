import type { Server } from 'bun';

/**
 * Bunner Request Constructor Params
 */
export interface BunnerRequestConstructorParams {
  request: Request;
  server: Server;
  params: Record<string, any>;
  queryParams: Record<string, any>;
}
