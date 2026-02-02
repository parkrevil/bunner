export interface ArtifactRepository {
  getArtifact<T>(input: { projectKey: string; kind: string; artifactKey: string; inputsDigest: string }): Promise<T | null>;
  setArtifact<T>(input: {
    projectKey: string;
    kind: string;
    artifactKey: string;
    inputsDigest: string;
    value: T;
  }): Promise<void>;
}
