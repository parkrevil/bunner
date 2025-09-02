import { LogType } from './constants';

export type LogLevel = (typeof LogType)[keyof typeof LogType];
