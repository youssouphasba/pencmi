import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { apiSuccess } from '../responses/api-response';

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((value) => {
        if (value && typeof value === 'object' && 'success' in value) {
          return value;
        }
        if (value && typeof value === 'object' && 'data' in value && 'meta' in value) {
          const payload = value as { data: unknown; meta?: Record<string, unknown> };
          return apiSuccess(payload.data, payload.meta);
        }
        return apiSuccess(value ?? null);
      }),
    );
  }
}
