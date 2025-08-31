import { createParamDecorator } from '@bunner/core';

export const Body = () => createParamDecorator('body');
export const Query = () => createParamDecorator('query');
export const Params = () => createParamDecorator('params');
export const Request = () => createParamDecorator('request');
export const Response = () => createParamDecorator('response');
