import { createHttpMethodDecorator } from './helpers';

export const Get = createHttpMethodDecorator('GET');
export const Post = createHttpMethodDecorator('POST');
export const Put = createHttpMethodDecorator('PUT');
export const Delete = createHttpMethodDecorator('DELETE');
export const Patch = createHttpMethodDecorator('PATCH');
export const Options = createHttpMethodDecorator('OPTIONS');
export const Head = createHttpMethodDecorator('HEAD');
