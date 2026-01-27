import type { BunnerApplication } from './bunner-application';
import type { BunnerApplicationRuntimeOptions } from './interfaces';
import type { EntryModule } from './types';

import { Bunner } from '../bunner';

/**
 * Creates a Bunner application instance without starting adapters.
 *
 * @param entry Application entry.
 * @param options Application options.
 * @returns The created application instance.
 */
export async function createApplication(
  entry: EntryModule,
  options?: BunnerApplicationRuntimeOptions,
): Promise<BunnerApplication> {
  const app = await Bunner.create(entry, options);

  return app;
}
