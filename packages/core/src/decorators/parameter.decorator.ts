import { createParamDecorator } from './helpers';

export const Inject = (token?: string) => createParamDecorator('inject', token);