import type { BunnerApplication, BunnerCreateApplicationOptions } from './interfaces';
import type { BunnerCreateWebApplicationOptions, BunnerWebApplication } from './web-application';

export type ClassType<T> = new (...args: any[]) => T;
export type CreateApplicationOptions<T extends BunnerApplication> = T extends BunnerWebApplication ? BunnerCreateWebApplicationOptions : BunnerCreateApplicationOptions;
