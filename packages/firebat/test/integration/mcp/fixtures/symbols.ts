/* oxlint-disable import/exports-last, firebat/single-exported-class, firebat/no-inline-object-type */

export interface IFoo {
  x: number;
}

export type Foo = {
  y: string;
};

export enum Color {
  Red,
  Blue,
}

export class Greeter {
  greet(name: string): string {
    return `hi ${name}`;
  }
}

export function topLevel(): number {
  return 1;
}

export const arrow = () => 2;

const internal = function () {
  return 3;
};

void internal;
