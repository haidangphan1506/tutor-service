import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { throwError } from 'rxjs';

export interface RpcErrorPayload {
  statusCode: number;
  message: string | string[];
  errors?: unknown;
}

/**
 * Bound per-controller (`@UseFilters(RpcExceptionFilter)`) on the `*.rpc.controller.ts` classes
 * only — never registered globally, so the HTTP side keeps using `HttpExceptionFilter` untouched.
 * `ClientProxy.send()` on the gateway side has no notion of `HttpException`; this normalizes
 * whatever a message-pattern handler throws into a plain, JSON-serializable error object the
 * gateway's `sendRpc` helper can turn back into the right `HttpException`.
 */
@Catch()
export class RpcExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] })?.message ?? exception.message);
      const errors = typeof response === 'object' ? (response as { errors?: unknown }).errors : undefined;

      return throwError(() => ({ statusCode: status, message, errors } satisfies RpcErrorPayload));
    }

    const message = exception instanceof Error ? exception.message : 'Internal server error';
    return throwError(
      () =>
        ({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
          message,
        }) satisfies RpcErrorPayload,
    );
  }
}
