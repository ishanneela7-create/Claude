import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { z, type ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new ApiError(404, 'not_found', `${what} not found`);
export const conflict = (message: string, details?: unknown) =>
  new ApiError(409, 'conflict', message, details);
export const badRequest = (message: string, details?: unknown) =>
  new ApiError(400, 'bad_request', message, details);

/** Checks data against a Zod schema; a failure becomes a 400 error with readable details. */
export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    throw new ApiError(400, 'validation_error', 'The request data is not valid', details);
  }
  return result.data;
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }
  if (error instanceof ApiError) {
    response
      .status(error.status)
      .json({ error: { code: error.code, message: error.message, details: error.details } });
  } else if (error instanceof z.ZodError) {
    response.status(400).json({ error: { code: 'validation_error', message: error.message } });
  } else if (error instanceof multer.MulterError) {
    response.status(400).json({ error: { code: 'upload_error', message: error.message } });
  } else if (error instanceof SyntaxError && 'body' in error) {
    response.status(400).json({ error: { code: 'bad_json', message: 'Body is not valid JSON' } });
  } else if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
    response.status(413).json({ error: { code: 'too_large', message: 'The upload is too big' } });
  } else {
    console.error(error);
    response.status(500).json({ error: { code: 'server_error', message: 'Something went wrong' } });
  }
};
