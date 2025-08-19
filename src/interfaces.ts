import { BunRequest, Server } from 'bun';

export interface BunnerRequestConstructorParams {
  req: BunRequest;
  server: Server;
  headers: Headers;
  body: any;
}