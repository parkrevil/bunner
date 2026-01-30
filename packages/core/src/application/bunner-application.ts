import type {
  ProviderToken,
} from '@bunner/common';

export class BunnerApplication {
  public get(_token: ProviderToken): void {
    //
  }

  public async start(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('Application started');
  }

  public async stop(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('Application stopped');
  }

  public attach(): void {
    //
  }
}

