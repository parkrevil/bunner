export interface ValidatorOptions {
  message?: string;
  groups?: string[];
  always?: boolean;
  each?: boolean;
  [key: string]: any;
}