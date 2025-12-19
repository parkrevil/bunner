// AOT Markers - Zero Overhead at Runtime

export function Injectable(): ClassDecorator {
  return (target: any) => target;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Controller(prefix: string = ''): ClassDecorator {
  return (target: any) => target;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Module(metadata: any): ClassDecorator {
  return (target: any) => target;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function RootModule(metadata: any): ClassDecorator {
  return (target: any) => target;
}
