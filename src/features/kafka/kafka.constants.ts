export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';

/**
 * Topics used via `KafkaProducer.send()` (request-reply). `ClientKafka` only subscribes its
 * consumer to a topic's `<topic>.reply` once `subscribeToResponseOf(topic)` has been called
 * before `connect()` runs — add every request-reply topic here, or `.send()` throws "did not
 * subscribe to the corresponding reply topic". Fire-and-forget `emit()` topics don't need this.
 */
export const KAFKA_REQUEST_TOPICS: string[] = [];

/**
 * Every `@MessagePattern`/`@EventPattern` this service's own Kafka microservice consumes —
 * `ServerKafka` subscribes to these as topics on `startAllMicroservices()`, so they must exist
 * up front too (a handler without an explicit `transport` argument binds to every connected
 * microservice — both RMQ and Kafka here). Keep in sync with the actual decorators; there's no
 * way to derive this list at admin-connect time without booting the whole app first.
 */
export const KAFKA_SERVER_TOPICS: string[] = [
  'tutor.test',
  'kafka.tutor',
  'ai.chat',
  'ai.clearHistory',
  'ai.history',
  'attendance.getBySession',
  'attendance.upsert',
  'chapter.create',
  'chapter.delete',
  'chapter.getAll',
  'chapter.getById',
  'chapter.update',
  'class.addStudents',
  'class.create',
  'class.delete',
  'class.generateCode',
  'class.getAll',
  'class.getById',
  'class.getMaterials',
  'class.getStudents',
  'class.getWatch',
  'class.update',
  'curriculum.create',
  'curriculum.delete',
  'curriculum.generateCode',
  'curriculum.getAll',
  'curriculum.getById',
  'curriculum.update',
  'dashboard.overview',
  'exercise.create',
  'exercise.getAll',
  'exercise.getById',
  'exercise.grade',
  'exercise.submit',
  'lesson.create',
  'lesson.delete',
  'lesson.getAll',
  'lesson.getById',
  'lesson.update',
  'report.attendanceTrend',
  'report.classList',
  'report.summary',
  'schedule.create',
  'schedule.createBulk',
  'schedule.delete',
  'schedule.getAll',
  'schedule.getByClass',
  'schedule.getById',
  'schedule.update',
  'session.create',
  'session.createBulk',
  'session.delete',
  'session.getAll',
  'session.getByClass',
  'session.getById',
  'session.update',
  'tuition.create',
  'tuition.delete',
  'tuition.getAll',
  'tuition.getById',
  'tuition.getSummary',
  'tuition.update',
];

/**
 * Every Kafka topic this service touches, for `ensureKafkaTopics()` in `main.ts` to pre-create.
 * Covers the topics it hosts, the request topics it produces to, and their `.reply` counterparts
 * (what `subscribeToResponseOf` subscribes to).
 */
export const ALL_KAFKA_TOPICS: string[] = [
  ...KAFKA_SERVER_TOPICS,
  ...KAFKA_REQUEST_TOPICS,
  ...KAFKA_REQUEST_TOPICS.map((topic) => `${topic}.reply`),
];
