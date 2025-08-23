import { container } from '../../core/container';
import type { Route } from './interfaces';

export class Router {
  private routes: Route[] = [];

  constructor() {
    this.routes = [];

    this.build();
  }

  build() {
    console.log('dddddddd');
    const controllers = container.getControllers();

    console.log(controllers);
  }
}