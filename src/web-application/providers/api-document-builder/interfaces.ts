export interface ApiDocumentBuildResult {
  parsedSpec: Record<string, any>;
  spec: string;
  fileType: 'json' | 'yaml';
}
