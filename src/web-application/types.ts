import { ContentType, HttpMethod } from './constants';
import type { BunnerRequest } from './request';
import type { BunnerResponse } from './response';

export type HttpMethodValue = (typeof HttpMethod)[keyof typeof HttpMethod];
export type ContentTypeValue = (typeof ContentType)[keyof typeof ContentType];
export type BunnerServerOptions = Partial<Omit<Bun.ServeOptions, 'hostname' | 'port'>>;
export type MiddlewareFn = (req: BunnerRequest, res: BunnerResponse, next: () => any) => any | Promise<any>;