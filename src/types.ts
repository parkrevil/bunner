import { BunnerRequest } from './web-application/request';
import { BunnerResponse } from './web-application/response';


export type BunnerApplicationType = 'web' | 'standalone';

export type RouteHandler = ((req: BunnerRequest, res: BunnerResponse) => any | Promise<any>) | Response;
export type MiddlewareFn = (req: BunnerRequest, res: BunnerResponse, next: () => any) => any | Promise<any>;


export type ClassType<T> = new (...args: any[]) => T;