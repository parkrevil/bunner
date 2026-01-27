export interface FileChangePayload {
  eventType: 'change' | 'rename' | 'error';
  filename: string | null;
}
