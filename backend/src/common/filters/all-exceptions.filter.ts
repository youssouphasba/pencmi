import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';

const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/** Name, code and call sites only: error messages can quote client data. */
export function describeServerError(exception: unknown) {
  const error = exception instanceof Error ? exception : undefined;
  const code = (exception as { code?: unknown } | undefined)?.code;
  const frames = (error?.stack ?? '')
    .split('\n')
    .filter((line) => line.trimStart().startsWith('at '))
    .slice(0, 8)
    .map((line) => line.trim());
  return { name: error?.name ?? typeof exception, ...(typeof code === 'string' ? { code } : {}), frames };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpErrors');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttpException ? exception.getResponse() : undefined;
    const details = typeof exceptionResponse === 'object' ? exceptionResponse : undefined;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : details && 'message' in details
          ? details.message
          : 'Une erreur est survenue.';

    const header = request.headers['x-request-id'] ?? request.headers['x-railway-request-id'];
    const requestId = typeof header === 'string' && REQUEST_ID.test(header) ? header : randomUUID();
    if (status >= 500) {
      this.logger.error({
        requestId,
        method: request.method,
        path: request.path,
        status,
        error: describeServerError(exception),
      });
    }
    if (!response.headersSent) response.setHeader('x-request-id', requestId);

    response.status(status).json({
      success: false,
      error: {
        code: this.getErrorCode(status),
        message,
        details,
        requestId,
      },
    });
  }

  private getErrorCode(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    if (status === HttpStatus.PAYLOAD_TOO_LARGE) return 'PAYLOAD_TOO_LARGE';
    if (status === HttpStatus.UNSUPPORTED_MEDIA_TYPE) return 'UNSUPPORTED_MEDIA_TYPE';
    if (status === HttpStatus.SERVICE_UNAVAILABLE) return 'SERVICE_UNAVAILABLE';
    return 'INTERNAL_ERROR';
  }
}
