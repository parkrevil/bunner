import { type ClassMetadata } from '../analyzer/ast-parser';

import { InjectorGenerator } from './injector';
import { MetadataGenerator } from './metadata';
import { ValidatorGenerator } from './validator';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();
  private validatorGen = new ValidatorGenerator();
  private metadataGen = new MetadataGenerator();

  generate(classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const injectorCode = this.injectorGen.generate(classes, outputDir);
    const validatorCode = this.validatorGen.generate();
    const metadataCode = this.metadataGen.generate(classes, outputDir);

    return `
// @bunner/generated
// This file is auto-generated. Do not edit.

${injectorCode}

${metadataCode}

${validatorCode}
`;
  }
}
