import type { FirebatReport } from '../types';

export interface GetReportInput {
  readonly projectKey: string;
  readonly reportKey: string;
}

export interface SetReportInput {
  readonly projectKey: string;
  readonly reportKey: string;
  readonly report: FirebatReport;
}

export interface CacheRepository {
  getReport(input: GetReportInput): Promise<FirebatReport | null>;
  setReport(input: SetReportInput): Promise<void>;
}
