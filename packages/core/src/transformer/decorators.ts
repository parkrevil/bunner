import type { TransformFunction } from './interfaces';
import type { TransformerDecoratorTarget } from './types';

export function Hidden() {
  return function (target: TransformerDecoratorTarget, propertyKey: string | symbol) {
    void target;
    void propertyKey;
  };
}

export function Transform(transformFn: TransformFunction) {
  void transformFn;

  return function (target: TransformerDecoratorTarget, propertyKey: string | symbol) {
    void target;
    void propertyKey;
  };
}
