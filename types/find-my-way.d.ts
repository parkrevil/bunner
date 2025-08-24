import 'find-my-way';
import type { BunnerRequest } from '../src/web-application/request';
import type { BunnerResponse } from '../src/web-application/response';

declare module 'find-my-way' {
  namespace Router {
    type Handler<T> = (
      req: BunnerRequest,
      res: BunnerResponse,
      params: Readonly<Record<string, string>>,
      store: T,
      searchParams: { [k: string]: any },
    ) => any | Promise<any>;
  }
}