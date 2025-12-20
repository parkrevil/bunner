import { MetadataStorage } from '../metadata/metadata-storage';

export function Hidden() {
  return function (target: object, propertyKey: string | symbol) {
    MetadataStorage.addDecoratorMetadata(target, propertyKey, {
      name: 'Hidden',
      arguments: [],
    });
  };
}

export function Transform(transformFn: (params: { value: any; key: string; obj: any; type: any }) => any) {
  return function (target: object, propertyKey: string | symbol) {
    MetadataStorage.addDecoratorMetadata(target, propertyKey, {
      name: 'Transform',
      arguments: [transformFn],
    });
  };
}
