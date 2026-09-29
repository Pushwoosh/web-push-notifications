// `statusCode` is the Pushwoosh application code from the response body, not
// the HTTP one: callers react to the former, the latter is left in the message.
export class ApiRequestError extends Error {
  public readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);

    this.name = 'ApiRequestError';
    this.statusCode = statusCode;
  }
}

// Shape-checked on purpose: the widget bundles carry their own copy of this
// class, so `instanceof` fails on an error thrown by another bundle.
export function getApiStatusCode(error: unknown): number | undefined {
  const statusCode = (error as { statusCode?: unknown } | null | undefined)?.statusCode;

  return typeof statusCode === 'number' ? statusCode : undefined;
}
