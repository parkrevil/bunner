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

  apply(key: RouteKey, params: RouteParams): void {
    if (this.behavior === 'omit') {
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
