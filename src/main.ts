import { Logger } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from '@packages/interceptor/response.interceptor';
import { ErrorInterceptor, LoggerInterceptor } from '@packages/interceptor';
import { HttpExceptionFilter, RpcExceptionFilter } from '@packages/filters';
import { TraceContextInterceptor } from '@packages/interceptor';
import { ensureKafkaTopics } from './features/kafka/kafka.admin';
import { ALL_KAFKA_TOPICS } from './features/kafka/kafka.constants';

async function bootstrap() {
  // Must run before `NestFactory.create()`: the Kafka microservice binds its listeners as soon
  // as the module tree is instantiated, so topics have to exist before that point or the
  // consumer races the broker's own auto-create.
  await ensureKafkaTopics(ALL_KAFKA_TOPICS);

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.enableCors({ origin: true, credentials: true });
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalInterceptors(new ErrorInterceptor(), new LoggerInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // `deferInitialization: true` is required: by default `connectMicroservice()` synchronously
  // calls `registerListeners()` before returning, which binds every @MessagePattern handler to
  // whatever global filters exist *at that moment* (none) — a `useGlobalFilters()` call after
  // that point is silently too late (Nest logs "Cannot apply global exception filters:
  // registration must occur before initialization" and the base `BaseRpcExceptionFilter`
  // fallback keeps handling errors instead). Deferring means listener registration happens
  // inside `startAllMicroservices()` → `listen()`, after our filter is already in place.
  //
  // RMQ removed (2026-09-19): tutor-service no longer connects a RabbitMQ microservice — the
  // gateway's RMQ call sites for this service were already disabled mid-Kafka-migration (see
  // gateway's `nestjs-feature-pattern.md`), so the RMQ listener here was pure dead weight that
  // also hard-required a RabbitMQ broker this environment doesn't run. Every `@MessagePattern`
  // in this service is now reachable over Kafka only.
  const kafkaMicroservice = app.connectMicroservice<MicroserviceOptions>(
    {
      transport: Transport.KAFKA,
      options: {
        client: {
          clientId: process.env.KAFKA_CLIENT_ID ?? 'tutor-service',
          brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
        },
        consumer: {
          groupId: process.env.KAFKA_GROUP_ID ?? 'tutor-service',
        },
      },
    },
    { deferInitialization: true },
  );

  // Global for this microservice only — every @MessagePattern handler gets it for free, no
  // per-controller @UseFilters(RpcExceptionFilter) needed. Kept off the HTTP `app` global
  // filters (RpcExceptionFilter expects an RPC context, not an Express Response).
  kafkaMicroservice.useGlobalFilters(new RpcExceptionFilter());
  // Opens the correlationId/traceId/serviceName RequestContext for every @MessagePattern
  // handler — see [[kafka-rpc-plumbing]] memory.
  kafkaMicroservice.useGlobalInterceptors(new TraceContextInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Backends API')
    .setDescription('API documentation for the Backends financial management system')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT access token',
      },
      'access-token',
    )
    // ── Tutor Management ─────────────────────────────
    .addTag('Users')
    .addTag('Auth')
    .addTag('Students')
    .addTag('Curriculum')
    .addTag('Chapter')
    .addTag('Lesson')
    .addTag('Classes')
    .addTag('Schedules')
    .addTag('Sessions')
    .addTag('Exercises')
    .addTag('Tuitions')
    .addTag('Notifications')
    // ── Finance Management ────────────────────────────
    .addTag('Categories')
    .addTag('Wallets')
    .addTag('Transactions')
    .addTag('Reports')
    // ── System ────────────────────────────────────────
    .addTag('Upload')
    .addTag('Cloudinary')
    .addTag('Health')
    .addTag('Redis')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.startAllMicroservices();
  Logger.log(`[TUTOR] Kafka listener bound (groupId "tutor-service")`, 'Bootstrap');

  const port = process.env.PORT ?? 8888;
  await app.listen(port);
  Logger.log(`[TUTOR] listening on port ${port}`, 'Bootstrap');
}
void bootstrap();
