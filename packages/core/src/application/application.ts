import type { ModuleMarker } from '@bunner/common';
import { BunnerApplication } from './bunner-application';
import type { CreateApplicationOptions } from './interfaces';

function createApplication(
  _entryModuleMarker: ModuleMarker,
  _options?: CreateApplicationOptions,
): BunnerApplication {
  return new BunnerApplication();
}

export {
  createApplication,
  type CreateApplicationOptions,
};
