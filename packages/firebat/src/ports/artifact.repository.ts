export interface GetArtifactInput {
  readonly projectKey: string;
  readonly kind: string;
  readonly artifactKey: string;
  readonly inputsDigest: string;
}

export interface SetArtifactInput<T> {
  readonly projectKey: string;
  readonly kind: string;
  readonly artifactKey: string;
  readonly inputsDigest: string;
  readonly value: T;
}

export interface ArtifactRepository {
  getArtifact<T>(input: GetArtifactInput): Promise<T | null>;
  setArtifact<T>(input: SetArtifactInput<T>): Promise<void>;
}
