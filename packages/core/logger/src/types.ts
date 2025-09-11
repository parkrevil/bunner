import { LogLevel } from './enums';

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];
