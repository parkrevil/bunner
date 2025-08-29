import { ContentType, HttpMethod, Protocol } from './constants';

export type ProtocolValue = (typeof Protocol)[keyof typeof Protocol];
export type HttpMethodValue = (typeof HttpMethod)[keyof typeof HttpMethod];
export type ContentTypeValue = (typeof ContentType)[keyof typeof ContentType];
export type BunnerServerOptions = Partial<Omit<Bun.ServeOptions, 'hostname' | 'port'>>;
