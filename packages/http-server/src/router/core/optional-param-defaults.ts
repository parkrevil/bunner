import type { RouteKey } from '../../types';
import type { RouteParams, RouterOptions } from '../types';

export class OptionalParamDefaults {
  private readonly behavior: RouterOptions['optionalParamBehavior'];
  private readonly defaults = new Map<RouteKey, readonly string[]>();

  constructor(behavior: RouterOptions['optionalParamBehavior']) {
    this.behavior = behavior;
  }

  record(key: RouteKey, names: readonly string[]): void {
    if (!names.length) {
      return;
    }
    this.defaults.set(key, names.slice());
  }

  apply(key: RouteKey, params: RouteParams): Array<[string, string | undefined]> | null {
    if (this.behavior === 'omit') {
      return null;
    }
    const defaults = this.defaults.get(key);
    if (!defaults?.length) {
      return null;
    }
    const inserted: Array<[string, string | undefined]> = [];
    for (const name of defaults) {
      if (Object.prototype.hasOwnProperty.call(params, name)) {
        continue;
      }
      const value = this.behavior === 'setEmptyString' ? '' : undefined;
      params[name] = value;
      inserted.push([name, value]);
    }
    return inserted.length ? inserted : null;
  }
}
