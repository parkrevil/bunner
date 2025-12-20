export class EntryGenerator {
  generate(userMainImportPath: string, isDev: boolean): string {
    const manifestExt = isDev ? 'ts' : 'js';

    return `
import { createContainer, createMetadataRegistry, createScopedKeysMap } from "./manifest";

console.log("${isDev ? '🌟 Bunner App Started (Generated)' : '[Entry] Initializing AOT Globals...'}");

globalThis.__BUNNER_MANIFEST_PATH__ = import.meta.resolve("./manifest.${manifestExt}"); 
const container = createContainer();
const metadata = createMetadataRegistry();
const scopedKeys = createScopedKeysMap();

globalThis.__BUNNER_CONTAINER__ = container;
globalThis.__BUNNER_METADATA_REGISTRY__ = metadata;
globalThis.__BUNNER_SCOPED_KEYS__ = scopedKeys;

console.log("[Entry] Bootstrapping User Application...");

await import("${userMainImportPath}");

${isDev ? 'export { container, metadata };' : ''}
`;
  }
}