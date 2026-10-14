import type { ApiErrorBody } from '@shared/types';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | undefined | null>;

export function toQueryString(query: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      params.set(key, String(value));
    }
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

async function send<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method,
    headers: body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  if (response.status === 204) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? 'error',
      error?.message ?? `Request failed (${response.status})`,
      error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query: Query = {}) => send<T>('GET', path + toQueryString(query)),
  post: <T>(path: string, body?: unknown) => send<T>('POST', path, body ?? {}),
  patch: <T>(path: string, body: unknown) => send<T>('PATCH', path, body),
  delete: (path: string) => send<void>('DELETE', path),
  upload: <T>(path: string, form: FormData) => send<T>('POST', path, form),
};

export function describeError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    const details = Array.isArray(error.details)
      ? (error.details as Array<{ path?: string; message?: string }>)
          .map((item) => [item.path, item.message].filter(Boolean).join(': '))
          .join('; ')
      : '';
    return details ? `${error.message} (${details})` : error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
