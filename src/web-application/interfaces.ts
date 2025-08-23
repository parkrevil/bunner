import type { ServeOptions } from 'bun';

export interface BunnerWebServerStartOptions extends Omit<ServeOptions, 'fetch'> { }
