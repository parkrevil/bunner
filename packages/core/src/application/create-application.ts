import type { BunnerApplicationOptions, Provider } from '@bunner/common';

import { Bunner } from '../bunner';

import type { BunnerApplication } from './bunner-application';

/**
 * Creates a Bunner application instance without starting adapters.
 *
 * @param entry Application entry.
 * @param options Application options.
 * @returns The created application instance.
 */
export async function createApplication(
  entry: unknown,
  options?: BunnerApplicationOptions & {
    readonly container?: unknown;
    readonly providers?: readonly Provider[];
  },
): Promise<BunnerApplication> {
  const app = await Bunner.create(entry as any, options);

  return app;
}
