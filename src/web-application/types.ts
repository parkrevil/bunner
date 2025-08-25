import { ContentType, HttpMethod } from './constants';


export type HttpMethodType = typeof HttpMethod[keyof typeof HttpMethod];
export type ContentTypeType = keyof typeof ContentType;
export type BunnerServerOptions = Partial<Omit<Bun.ServeOptions, 'hostname' | 'port'>>;
