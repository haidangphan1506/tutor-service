import { BadRequestException, Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { AppService } from './app.service';
import { MessagePattern, Payload } from '@nestjs/microservices';

interface KafkaTestResponse {
  message: string;
  receivedAt: string;
}

@ApiTags('Health')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns a simple health check response' })
  @SwaggerResponse({
    status: 200,
    description: 'Server is running',
    schema: { type: 'string', example: 'Hello World!' },
  })
  getHello(): string {
    return this.appService.getHello();
  }

  @MessagePattern('tutor.test')
  testFromKafka(@Payload() data: unknown): KafkaTestResponse {
    this.logger.log(`[SEND] tutor.test <- user, payload=${JSON.stringify(data)}`);
    const result = { message: 'Hello from tutor-service', receivedAt: new Date().toISOString() };
    this.logger.log(`[SEND] tutor.test -> user reply, result=${JSON.stringify(result)}`);
    return result;
  }

  @MessagePattern('kafka.tutor')
  receivedMsgError(@Payload() data: unknown): void {
    this.logger.log(`[SEND] kafka.ping <- gateway, payload=${JSON.stringify(data)}`);
    throw new BadRequestException('data from tutor failed ...');
  }
}
