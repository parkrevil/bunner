import { BunRequest, Server } from 'bun';

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
