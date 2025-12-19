// AOT Markers - Zero Overhead at Runtime

export function Injectable(): ClassDecorator {
  return (target: any) => target;
}

export function Controller(_prefix: string = ''): ClassDecorator {
  return (target: any) => target;
}

export function Module(_metadata: any): ClassDecorator {
  return (target: any) => target;
}

export function RootModule(_metadata: any): ClassDecorator {
  return (target: any) => target;
}
