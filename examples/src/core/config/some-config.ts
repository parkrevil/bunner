import type { SomeConfigValue } from './types';

export class SomeConfig {
  constructor(private readonly values: Record<string, SomeConfigValue>) {}

  public get(key: string, fallback: string): string;
  public get(key: string, fallback: number): number;
  public get(key: string, fallback: SomeConfigValue): SomeConfigValue {
    const value = this.values[key];

    if (value === undefined) {
      return fallback;
    }

    if (typeof value === typeof fallback) {
      return value;
    }

    return fallback;
  }
}
