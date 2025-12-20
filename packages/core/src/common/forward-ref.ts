export interface ForwardReference {
  forwardRef: () => any;
}

export function forwardRef(fn: () => any): ForwardReference {
  return { forwardRef: fn };
}
