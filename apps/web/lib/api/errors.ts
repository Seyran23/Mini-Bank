export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  path: string;
  timestamp: string;
}

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static async fromResponse(res: Response): Promise<ApiError> {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    return new ApiError(
      body?.statusCode ?? res.status,
      body?.code ?? 'HTTP_ERROR',
      body?.message ?? 'An unexpected error occurred',
    );
  }
}
