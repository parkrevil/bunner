import type { BunFile } from 'bun';
import { getObjectFromString, isUrl } from './helpers';
import type { ApiDocumentBuildResult } from './interfaces';

/**
 * ApiDocumentBuilder class
 * @description ApiDocumentBuilder class is used to build the api document
 * @example
 * const apiDocumentBuilder = new ApiDocumentBuilder();
 * const result = await apiDocumentBuilder.build('https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml');
 * const template = await apiDocumentBuilder.getTemplate(result.parsedSpec, result.spec);
 */
export class ApiDocumentBuilder {
  /**
   * Build the spec
   * @param spec - The spec to build
   * @returns The built result
   */
  async build(spec: string): Promise<ApiDocumentBuildResult> {
    if (isUrl(spec)) {
      return this.buildWithUrl(spec);
    }

    const file = Bun.file(spec);
    const stat = await file.stat().catch(e => undefined);

    if (stat === undefined) {
      return this.buildWithText(spec);
    }

    if (stat.isDirectory()) {
      throw new Error('Spec is a directory');
    }

    return this.buildWithFile(file);
  }

  /**
   * Get the template
   * @param parsedSpec - The built spec
   * @param url - The url of the spec
   * @returns The template
   */
  async getTemplate(parsedSpec: Record<string, any>, url: string) {
    const html = (await Bun.file('../../assets/api-doc/index.tpl').text())
      .replace('{TITLE}', parsedSpec?.info?.title ?? 'Open API Specification')
      .replace('{SPEC_URL}', url);

    return html;
  }

  /**
   * Build the spec with url
   * @param url - The url of the spec
   * @returns The built spec
   */
  private async buildWithUrl(url: string): Promise<ApiDocumentBuildResult> {
    const response = await fetch(url);

    return this.buildWithText(await response.text());
  }

  /**
   * Build the spec with file
   * @param file - The file to build
   * @returns The built spec
   */
  private async buildWithFile(file: BunFile): Promise<ApiDocumentBuildResult> {
    const spec = await file.text();

    return this.buildWithText(spec);
  }

  /**
   * Build the spec with text
   * @param text - The text to build
   * @returns The built spec
   */
  private async buildWithText(text: string): Promise<ApiDocumentBuildResult> {
    const { parsed, type } = getObjectFromString(text);

    return {
      spec: text,
      parsedSpec: parsed,
      fileType: type,
    };
  }
}
