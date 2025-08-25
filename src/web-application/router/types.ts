import type { BunnerRequest } from '../request';
import type { BunnerResponse } from '../response';

export type RouteHandler = (req: BunnerRequest, res: BunnerResponse) => any | Promise<any>;
