export interface FileChangePayload {
  eventType: 'change' | 'rename' | 'delete' | 'error';
  filename: string | null;
}
