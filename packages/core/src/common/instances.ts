/**\
 * Finalization Registry
 * @description The finalization registry instance
 */
export const finalizationRegistry = new FinalizationRegistry(heldValue => {
  console.log(`${heldValue} has been GC'd`);
});

/**
 * Text Encoder
 * @description The text encoder instance
 */
export const textEncoder = new TextEncoder();
