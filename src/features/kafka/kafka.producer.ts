import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { KAFKA_PRODUCER, KAFKA_REQUEST_TOPICS } from './kafka.constants';
import { ClientKafka } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { randomUUID } from 'node:crypto';
import {
  CORRELATION_ID_HEADER,
  getRequestContext,
  PARENT_TRACE_ID_HEADER,
  SERVICE_NAME_HEADER,
  TRACE_ID_HEADER,
} from '@packages/context/request-context';

const SERVICE_NAME = 'tutor-service';

interface KafkaMessageEnvelope<T> {
  value: T;
  headers: Record<string, string>;
}

/**
 * Builds the trace headers every outbound Kafka message carries: `correlationId` is reused
 * unchanged from the current `RequestContext` (constant for the whole distributed flow), a fresh
 * `traceId` identifies this specific hop, and `parentTraceId` links it back to whichever hop
 * triggered it. Wrapping the payload as `{value, headers}` (a shape `KafkaRequestSerializer`
 * recognizes as an already-formed Kafka message) is what lets these ride as real Kafka message
 * headers without changing the payload any existing `@Payload()` handler receives — see
 * `[[kafka-rpc-plumbing]]` memory.
 */
function wrapWithTraceHeaders<T>(message: T): KafkaMessageEnvelope<T> {
  const ctx = getRequestContext();
  return {
    value: message,
    headers: {
      [CORRELATION_ID_HEADER]: ctx?.correlationId ?? randomUUID(),
      [TRACE_ID_HEADER]: randomUUID(),
      [PARENT_TRACE_ID_HEADER]: ctx?.traceId ?? '',
      [SERVICE_NAME_HEADER]: SERVICE_NAME,
    },
  };
}

interface RpcErrorPayload {
  statusCode?: number;
  message?: string | string[];
  errors?: unknown;
  serviceName?: string;
}

/**
 * `ClientKafka` never parses the `NEST_ERR` reply header for us — the responder's
 * `RpcExceptionFilter` payload arrives here as a raw `Buffer` (`assignErrorHeader` in
 * `@nestjs/microservices` does `Buffer.from(JSON.stringify(err))` on the server side, but the
 * client-side deserializer hands that `Buffer` straight through unparsed). Decode it back into
 * the `{statusCode, message, errors}` object before reading any field off it, or every RPC error
 * silently collapses into a generic 500.
 */
function toRpcErrorPayload(raw: unknown): RpcErrorPayload {
  let value: unknown = raw;
  if (Buffer.isBuffer(value)) {
    value = value.toString('utf8');
  }
  if (typeof value === 'string') {
    const raw = value;
    try {
      value = JSON.parse(raw);
    } catch {
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: raw };
    }
  }
  if (typeof value === 'object' && value !== null) {
    return value;
  }
  return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
}

@Injectable()
export class KafkaProducer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaProducer.name);

  constructor(@Inject(KAFKA_PRODUCER) private readonly client: ClientKafka) {}

  async onModuleInit() {
    KAFKA_REQUEST_TOPICS.forEach((topic) => this.client.subscribeToResponseOf(topic));
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.close();
  }

  emit<TResult = unknown, TInput = unknown>(topic: string, message: TInput): Promise<TResult> {
    const envelope = wrapWithTraceHeaders(message);
    this.logger.log(
      `[EMIT] ${topic} correlationId=${envelope.headers[CORRELATION_ID_HEADER]} traceId=${envelope.headers[TRACE_ID_HEADER]}`,
    );
    return firstValueFrom(this.client.emit<TResult, KafkaMessageEnvelope<TInput>>(topic, envelope));
  }

  /**
   * Request-reply. Rethrows whatever the responder's `RpcExceptionFilter` produced as a proper
   * `HttpException` (status + message), so callers see the same error shape a local call would
   * throw instead of a generic rejection.
   */
  async send<TResponse, TRequest>(topic: string, message: TRequest): Promise<TResponse> {
    const envelope = wrapWithTraceHeaders(message);
    const correlationId = envelope.headers[CORRELATION_ID_HEADER];
    const traceId = envelope.headers[TRACE_ID_HEADER];
    this.logger.log(`[SEND] ${topic} correlationId=${correlationId} traceId=${traceId}`);
    try {
      return await firstValueFrom(
        this.client.send<TResponse, KafkaMessageEnvelope<TRequest>>(topic, envelope),
      );
    } catch (error: unknown) {
      const payload = toRpcErrorPayload(error);
      this.logger.error(
        `[SEND FAILED] ${topic} correlationId=${correlationId} traceId=${traceId} - ${
          Array.isArray(payload.message) ? payload.message.join(', ') : payload.message
        }`,
      );
      throw new HttpException(
        {
          message: payload.message ?? 'Internal server error',
          errors: payload.errors,
          serviceName: payload.serviceName ?? SERVICE_NAME,
        },
        payload.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
