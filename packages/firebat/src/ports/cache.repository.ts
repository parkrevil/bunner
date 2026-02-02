import type { FirebatReport } from '../types';

export interface CacheRepository {
  getReport(input: { projectKey: string; reportKey: string }): Promise<FirebatReport | null>;
  setReport(input: { projectKey: string; reportKey: string; report: FirebatReport }): Promise<void>;
}
