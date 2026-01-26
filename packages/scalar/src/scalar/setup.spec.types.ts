export interface InternalRouteRequest {
  path?: string;
}

export type InternalRouteHandler = (req?: InternalRouteRequest) => Response;

export interface InternalRouteCall {
  path: string;
  handler: InternalRouteHandler;
}

export interface HttpAdapterInternal {
  get(path: string, handler: InternalRouteHandler): void;
}

export type HttpAdapter = Record<PropertyKey, HttpAdapterInternal>;

export interface HttpAdapterSpy {
  adapter: HttpAdapter;
  calls: InternalRouteCall[];
}

export interface InternalRouteHandlerParams {
  calls: InternalRouteCall[];
  path: string;
}
