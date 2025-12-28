import type { ConfigService } from '@bunner/common';

import { SomeConfig } from './some-config';

export class ExampleConfigService implements ConfigService {
  private readonly namespaces: Map<string | symbol, unknown>;

  constructor(namespaces: ReadonlyMap<string | symbol, unknown>) {
    this.namespaces = new Map(namespaces);
  }

  public static withHttpDefaults(params: {
    readonly userHttp: { readonly port: number; readonly host: string };
    readonly adminHttp: { readonly port: number; readonly host: string };
  }): ExampleConfigService {
    const { userHttp, adminHttp } = params;

    return new ExampleConfigService(
      new Map<string, unknown>([
        ['user.http', new SomeConfig({ port: userHttp.port, host: userHttp.host })],
        ['admin.http', new SomeConfig({ port: adminHttp.port, host: adminHttp.host })],
      ]),
    );
  }

  public get<T = unknown>(namespace: string | symbol): T {
    const value = this.namespaces.get(namespace);

    if (value === undefined) {
      throw new Error(`Config namespace not found: ${String(namespace)}`);
    }

    return value as T;
  }
}
