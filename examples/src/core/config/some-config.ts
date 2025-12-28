export class SomeConfig {
  constructor(private readonly values: Record<string, unknown>) {}

  public get<T>(key: string, fallback: T): T {
    const value = this.values[key];

    if (value === undefined) {
      return fallback;
    }

    return value as T;
  }
}
