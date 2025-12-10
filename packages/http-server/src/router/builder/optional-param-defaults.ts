import type { OptionalParamBehavior, RouteParams } from '../types';

export class OptionalParamDefaults {
  private readonly behavior: OptionalParamBehavior;
  private readonly defaults = new Map<number, readonly string[]>();

  constructor(behavior: OptionalParamBehavior = 'setUndefined') {
    this.behavior = behavior;
  }

  record(key: number, names: readonly string[]): void {
    if (this.behavior === 'omit') {
      return;
    }
    this.defaults.set(key, names);
  }

  apply(key: number, params: RouteParams): void {
    if (this.behavior === 'omit' || !this.behavior) {
      return;
    }
    const defaults = this.defaults.get(key);
    if (!defaults?.length) {
      return;
    }
    for (const name of defaults) {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        continue;
      }
      params[name] = this.behavior === 'setEmptyString' ? '' : undefined;
    }
  }
}
