import type { Server } from 'bun';
import type { BunnerValue } from '@bunner/common';

export interface ClientIpOptions {
  trustProxy?: boolean;
}

export interface ClientIpsResult {
  ip: string | undefined;
  ips: string[] | undefined;
}

export interface MockServerCalls {
  request: number;
}

export interface MockServerResult {
  server: Pick<Server<BunnerValue>, 'requestIP'>;
  calls: MockServerCalls;
}
