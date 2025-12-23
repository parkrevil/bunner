// Removed unused Container import

export interface BunnerApplicationBaseOptions {
  name: string;
  logLevel: string | number;
}

export type BunnerApplicationNormalizedOptions = BunnerApplicationBaseOptions & { [key: string]: any };

export interface BunnerApplicationOptions {
  name?: string;
  logLevel?: string | number;
  [key: string]: any;
}

// Simplified Module Interface
export interface BunnerModule {
  imports?: any[];
  controllers?: any[];
  providers?: any[];
  exports?: any[];
  [key: string]: any;
}

export type EntryModuleMetadata = {
  path: string;
  className: string;
  manifestPath?: string;
};

export interface CreateApplicationOptions extends BunnerApplicationBaseOptions {
  [key: string]: any;
}

// Single definition of BunnerModule removed below

export interface DynamicModule {
  module: any;
  providers?: any[];
  controllers?: any[];
  imports?: any[];
  exports?: any[];
  global?: boolean;
}
