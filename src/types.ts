import type { BunnerApplication } from './bunner-application';
import type { BunnerCreateApplicationOptions } from './interfaces';
import type { BunnerCreateWebApplicationOptions, BunnerWebApplication } from './web-application';

export type ClassType<T = any> = new (...args: any[]) => T;
export type CreateApplicationOptions<T extends BunnerApplication> = T extends BunnerWebApplication ? BunnerCreateWebApplicationOptions : BunnerCreateApplicationOptions;
