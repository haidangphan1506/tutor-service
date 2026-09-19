import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KAFKA_PRODUCER } from './kafka.constants';
import { KafkaProducer } from './kafka.producer';
import { KafkaConsumer } from './kafka.consumer';

@Global()
@Module({
  imports: [
    ClientsModule.register([
      {
        name: KAFKA_PRODUCER,

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
    ]),
  ],

  providers: [KafkaProducer, KafkaConsumer],

  exports: [KafkaProducer, KafkaConsumer],
})
export class KafkaModule {}
