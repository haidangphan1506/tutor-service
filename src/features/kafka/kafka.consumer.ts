import { Injectable } from '@nestjs/common';

@Injectable()
export class KafkaConsumer {
  getGroupId() {
    return process.env.KAFKA_GROUP_ID ?? 'tutor-service';
  }
}
