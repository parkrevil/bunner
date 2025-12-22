export type FileChangePayload = {
  eventType: 'change' | 'rename' | 'error';
  filename: string | null;
};
