export function isConstructor(cls: any): cls is new (...args: any[]) => any {
  return typeof cls === 'function' && !!cls.prototype;
}
