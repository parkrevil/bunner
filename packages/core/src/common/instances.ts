import { Logger } from '@bunner/logger';

const logger = new Logger('FinalizationRegistry');

/**
 * Finalization Registry
 * @description The finalization registry instance
 */
export const finalizationRegistry = new FinalizationRegistry(heldValue => {
  logger.debug(`${heldValue} has been GC'd`);
});

/**
 * Text Encoder
 * @description The text encoder instance
 */
export const textEncoder = new TextEncoder();
