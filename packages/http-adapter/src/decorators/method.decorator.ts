import type { DecoratorPropertyKey, DecoratorTarget, RouteDecoratorArgument } from '../types';

export const Get =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Post =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Put =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Delete =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Patch =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Options =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
export const Head =
  (_pathOrOptions?: RouteDecoratorArgument, _options?: RouteDecoratorArgument) =>
  (_target: DecoratorTarget, _propertyKey: DecoratorPropertyKey, _descriptor: PropertyDescriptor) => {};
