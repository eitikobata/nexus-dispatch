import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { PRIORITY_WEIGHT, RABBITMQ_MAX_PRIORITY, RETRY_DELAY_MS, SKILLS, SkillName } from '../common/constants';

const EXCHANGE = 'directives.topic';

export interface DirectiveMessage {
  directiveId: string;
  skill: SkillName;
  priority: keyof typeof PRIORITY_WEIGHT;
}

/**
 * Owns the RabbitMQ topology and connection.
 *
 * Topology, per skill:
 *   directive.<skill>          — main queue, x-max-priority so higher-priority
 *                                 directives are handled first (best-effort,
 *                                 that's how RabbitMQ priority queues work)
 *   directive.<skill>.retry    — parking queue with a TTL and no consumers;
 *                                 when a message's TTL expires it's dead-lettered
 *                                 straight back onto the main queue. This gives
 *                                 delayed retry without the delayed-message plugin.
 *
 * A directive lands in the retry queue when the consumer checks the DB and
 * finds no AVAILABLE operative with the matching skill yet — rather than
 * busy-looping, it parks the message for RETRY_DELAY_MS and tries again.
 */
@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitmqService.name);
  private connection?: amqp.ChannelModel;
  private channel?: amqp.Channel;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const url = this.config.get<string>('RABBITMQ_URL');
    this.connection = await amqp.connect(url as string);
    this.channel = await this.connection.createChannel();
    await this.assertTopology();
    this.logger.log('RabbitMQ topology ready');
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
  }

  private async assertTopology() {
    const ch = this.channel!;
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });

    for (const skill of SKILLS) {
      const mainQueue = `directive.${skill}`;
      const retryQueue = `directive.${skill}.retry`;

      await ch.assertQueue(mainQueue, {
        durable: true,
        arguments: {
          'x-max-priority': RABBITMQ_MAX_PRIORITY,
          'x-dead-letter-exchange': '',
        },
      });
      await ch.bindQueue(mainQueue, EXCHANGE, mainQueue);

      await ch.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-message-ttl': RETRY_DELAY_MS,
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': mainQueue,
        },
      });
    }
  }

  publishDirective(msg: DirectiveMessage) {
    const routingKey = `directive.${msg.skill}`;
    const priority = PRIORITY_WEIGHT[msg.priority] ?? 1;
    this.channel!.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(msg)), {
      persistent: true,
      priority,
    });
  }

  // Parks a message that couldn't be matched to an operative — it reappears
  // on the main skill queue after RETRY_DELAY_MS via the dead-letter chain.
  parkForRetry(msg: DirectiveMessage) {
    const retryQueue = `directive.${msg.skill}.retry`;
    this.channel!.sendToQueue(retryQueue, Buffer.from(JSON.stringify(msg)), {
      persistent: true,
    });
  }

  consumeSkillQueue(skill: SkillName, handler: (msg: DirectiveMessage) => Promise<void>) {
    const queue = `directive.${skill}`;
    this.channel!.consume(queue, async (raw) => {
      if (!raw) return;
      try {
        const msg = JSON.parse(raw.content.toString()) as DirectiveMessage;
        await handler(msg);
        this.channel!.ack(raw);
      } catch (err) {
        this.logger.error(`Failed processing message on ${queue}`, err as Error);
        this.channel!.nack(raw, false, false);
      }
    });
  }
}
