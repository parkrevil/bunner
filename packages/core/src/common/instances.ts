import { Logger } from '@bunner/logger';

const logger = new Logger('FinalizationRegistry');

export const finalizationRegistry = new FinalizationRegistry(heldValue => {
  logger.debug(`${heldValue} has been GC'd`);
});

export const textEncoder = new TextEncoder();