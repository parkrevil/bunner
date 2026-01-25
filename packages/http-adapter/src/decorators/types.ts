import type { Class } from '@bunner/common';

export type RouteHandlerParamType = 'body' | 'param' | 'query' | 'header' | 'cookie' | 'request' | 'response' | 'ip';

export type ControllerDecoratorTarget = Class;
