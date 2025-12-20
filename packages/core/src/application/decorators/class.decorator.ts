export function Injectable() {
  return (_target: Function) => {};
}

export function Controller(_prefix: string = '') {
  return (_target: Function) => {};
}

export function Module(_metadata: any) {
  return (_target: Function) => {};
}

export function RootModule(_metadata: any) {
  return (_target: Function) => {};
}
