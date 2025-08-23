import { InjectableDecorator } from './constants';
import { container } from './container';

/**
 * Injectable Decorator
 * Marks a class as injectable and automatically registers it with the container
 */
export function Injectable() {
  return function (target: any) {
    Reflect.defineMetadata(InjectableDecorator, true, target);

    container.registerInjectable(target);
  };
}
