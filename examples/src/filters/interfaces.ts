export interface HttpErrorPayload {
  status?: number;
  message?: string;
}

export interface HttpErrorResponse extends HttpErrorPayload {
  statusCode: number;
  path: string;
}
