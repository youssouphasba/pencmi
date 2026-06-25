import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
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

    response.status(status).json({
      success: false,
      error: {
        code: this.getErrorCode(status),
        message,
        details,
        requestId: request.headers['x-request-id'],
      },
    });
  }

  private getErrorCode(status: number): string {
    if (status === HttpStatus.UNAUTHORIZED) return 'UNAUTHORIZED';
    if (status === HttpStatus.FORBIDDEN) return 'FORBIDDEN';
    if (status === HttpStatus.NOT_FOUND) return 'NOT_FOUND';
    if (status === HttpStatus.BAD_REQUEST) return 'BAD_REQUEST';
    if (status === HttpStatus.CONFLICT) return 'CONFLICT';
    return 'INTERNAL_ERROR';
  }
}
