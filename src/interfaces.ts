
export interface BunnerApplication {
  start(options?: any): void | Promise<void>;
  shutdown(force?: boolean): void | Promise<void>;
}

export interface BunnerCreateApplicationOptions {
  name?: string;
}

export interface OnModuleInit {
  onModuleInit(): void | Promise<void>;
}

export interface OnApplicationShutdown {
  onApplicationShutdown(signal?: string | number | undefined): void | Promise<void>;
}
