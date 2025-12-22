import { Container } from './injector/container';

export interface BunnerRuntime<Options = any> {
  boot(container: Container, options?: Options): Promise<void>;
}
