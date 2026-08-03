export class ClickUpError extends Error {
  public status: number;
  public errorCode?: string;
  public isRateLimit: boolean;
  public isAuthError: boolean;

  constructor(message: string, status: number = 500, errorCode?: string) {
    super(message);
    this.name = 'ClickUpError';
    this.status = status;
    this.errorCode = errorCode;
    this.isRateLimit = status === 429;
    this.isAuthError = status === 401 || status === 403;
  }
}

export function normalizeClickUpError(error: unknown): ClickUpError {
  if (error instanceof ClickUpError) {
    return error;
  }
  if (error instanceof Error) {
    return new ClickUpError(error.message, 500);
  }
  return new ClickUpError('Terjadi kesalahan yang tidak diketahui saat menghubungi ClickUp API.', 500);
}
