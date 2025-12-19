import { type ClassMetadata } from '../analyzer/ast-parser';

import { InjectorGenerator } from './injector';
import { ValidatorGenerator } from './validator';

export class ManifestGenerator {
  private injectorGen = new InjectorGenerator();
  private validatorGen = new ValidatorGenerator();

  generate(classes: { metadata: ClassMetadata; filePath: string }[], outputDir: string): string {
    const injectorCode = this.injectorGen.generate(classes, outputDir);
    const validatorCode = this.validatorGen.generate();

    return `
// @bunner/generated
// This file is auto-generated. Do not edit.

${injectorCode}

${validatorCode}
`;
  }
}
