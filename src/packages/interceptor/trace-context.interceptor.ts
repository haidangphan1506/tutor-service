import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { KafkaContext } from '@nestjs/microservices';
import { Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  CORRELATION_ID_HEADER,
  PARENT_TRACE_ID_HEADER,
  runWithRequestContext,
  SERVICE_NAME_HEADER,
} from '@packages/context/request-context';

const SERVICE_NAME = 'tutor-service';

function readHeader(headers: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = headers?.[key];
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  return typeof value === 'string' ? value : undefined;
}

/**
 * Registered as a *microservice-scoped* global interceptor in `main.ts`
 * (`kafkaMicroservice.useGlobalInterceptors(...)`) — every `@MessagePattern`/`@EventPattern`
 * handler runs inside the `RequestContext` this opens. Reads the caller's `correlationId` (kept
 * unchanged for the whole distributed flow) and `traceId` (becomes this hop's `parentTraceId`)
 * off the raw Kafka message headers `KafkaProducer.send()`/`.emit()` attach on the sending side
 * (see `[[kafka-rpc-plumbing]]` memory), mints a fresh `traceId` for this hop, and logs
 * entry/exit the same way `LoggerInterceptor` does for HTTP requests on the gateway.
 */
@Injectable()
export class TraceContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TraceContextInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'rpc') {
      return next.handle();
    }

    const rpcContext = context.switchToRpc().getContext<KafkaContext>();
    const pattern = rpcContext?.getTopic?.() ?? context.getHandler().name;
    const headers = rpcContext?.getMessage?.()?.headers as Record<string, unknown> | undefined;

    const correlationId = readHeader(headers, CORRELATION_ID_HEADER) ?? randomUUID();
    const parentTraceId = readHeader(headers, PARENT_TRACE_ID_HEADER);
    const callerService = readHeader(headers, SERVICE_NAME_HEADER);
    const traceId = randomUUID();

    const startTime = Date.now();
    const trace = `correlationId=${correlationId} traceId=${traceId} from=${callerService ?? 'unknown'}`;
    this.logger.log(`[RPC] ${pattern} <- ${trace}`);

    return new Observable((subscriber) => {
      runWithRequestContext(
        { correlationId, traceId, parentTraceId, serviceName: SERVICE_NAME },
        () => {
          next.handle().subscribe({
            next: (value) => subscriber.next(value),
            error: (err: unknown) => {
              this.logger.error(`[RPC ERROR] ${pattern} ${trace} - ${(err as Error)?.message}`);
              subscriber.error(err);
            },
            complete: () => {
              this.logger.log(`[RPC] ${pattern} -> ${trace} - ${Date.now() - startTime}ms`);
              subscriber.complete();
            },
          });
        },
      );
    });
  }
}
