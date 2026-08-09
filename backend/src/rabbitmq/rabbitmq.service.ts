import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import {
  FAILURE_RETRY_BACKOFF_MS,
  PRIORITY_WEIGHT,
  RABBITMQ_MAX_PRIORITY,
  RETRY_DELAY_MS,
  SKILLS,
  SkillName,
} from '../common/constants';

const EXCHANGE = 'directives.topic';

export interface DirectiveMessage {
  directiveId: string;
  skill: SkillName;
  priority: keyof typeof PRIORITY_WEIGHT;
  retryCount?: number; // only set on the handler-threw retry path, not the business one
}

/**
 * Owns the RabbitMQ topology and connection.
 *
 * Topology, per skill:
 *   directive.<skill>          — main queue, x-max-priority so higher-priority
 *                                 directives are handled first (best-effort).
 *                                 Deliberately has NO dead-letter-exchange of
 *                                 its own — see incident note below.
 *   directive.<skill>.retry    — parking queue, no consumers. A message sent
 *                                 here waits out its own per-message
 *                                 `expiration`, then is dead-lettered back
 *                                 onto the main queue. Reused by both retry
 *                                 flows below, just with a different delay.
 *   directive.<skill>.dlq      — final resting place for a message whose
 *                                 handler threw and exhausted every retry.
 *                                 No automatic consumer; inspected manually.
 *
 * Two distinct retry flows, and they must NOT be conflated:
 *   1. "No operative available yet" — a normal business outcome, not a bug.
 *      DispatchConsumerService calls parkForRetry() itself and returns
 *      normally. Retries forever at a fixed delay; that's correct, it's
 *      supposed to keep trying until someone frees up or SLA escalates it.
 *   2. "The handler threw" — an actual failure (e.g. a DB error). This is
 *      caught here, in consumeSkillQueue, and goes through
 *      parkForFailureRetry() with a bounded retry count and backoff,
 *      finishing in the DLQ if it keeps failing — never retried forever.
 *
 * Incident note (kept intentionally, don't remove without reading this):
 * the main queue used to declare its own `x-dead-letter-exchange: ''` with
 * no explicit routing key. Nacking a message with requeue=false dead-lettered
 * it to the default exchange using the message's *original* routing key —
 * which is the same string as the queue's own name. The default exchange
 * routes any message to the queue matching that name automatically, so the
 * "dead-lettered" message landed right back in the same queue it came from,
 * with zero delay. That produced a true infinite loop (indistinguishable
 * from requeue=true) that pegged the CPU and, by opening one Prisma
 * transaction per instant retry, exhausted the connection pool and caused
 * cascading `$transaction` timeouts elsewhere. Fix: the consumer here never
 * nacks anymore — it always acks the original delivery and explicitly
 * decides the message's fate in code (retry queue or DLQ), so RabbitMQ's
 * automatic dead-lettering is never in the loop for failures.
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
      const dlq = `directive.${skill}.dlq`;

      // No dead-letter-exchange here on purpose — see incident note above.
      // Failures are routed explicitly by application code, never implicitly
      // by RabbitMQ reacting to a nack.
      await ch.assertQueue(mainQueue, {
        durable: true,
        arguments: { 'x-max-priority': RABBITMQ_MAX_PRIORITY },
      });
      await ch.bindQueue(mainQueue, EXCHANGE, mainQueue);

      // No queue-level TTL — delay is set per-message (via `expiration`) so
      // the same queue can serve both the fixed-delay business retry and
      // the backing-off failure retry.
      await ch.assertQueue(retryQueue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': '',
          'x-dead-letter-routing-key': mainQueue,
        },
      });

      // Plain holding queue. No TTL, no DLX — messages here stay until a
      // human looks at them. Not consumed automatically.
      await ch.assertQueue(dlq, { durable: true });
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

  // Business retry — "no operative available yet." Retries forever at a
  // fixed delay; that's intentional, not a bug.
  parkForRetry(msg: DirectiveMessage) {
    const retryQueue = `directive.${msg.skill}.retry`;
    this.channel!.sendToQueue(retryQueue, Buffer.from(JSON.stringify(msg)), {
      persistent: true,
      expiration: String(RETRY_DELAY_MS),
    });
  }

  // Failure retry — the handler threw. Bounded, with backoff. Returns the
  // action taken so the caller can log it.
  parkForFailureRetry(msg: DirectiveMessage, error: Error): 'retried' | 'dead-lettered' {
    const attempt = msg.retryCount ?? 0;

    if (attempt >= FAILURE_RETRY_BACKOFF_MS.length) {
      const dlq = `directive.${msg.skill}.dlq`;
      this.channel!.sendToQueue(
        dlq,
        Buffer.from(
          JSON.stringify({ ...msg, failedReason: error.message, failedAt: new Date().toISOString() }),
        ),
        { persistent: true },
      );
      return 'dead-lettered';
    }

    const delayMs = FAILURE_RETRY_BACKOFF_MS[attempt];
    const retryQueue = `directive.${msg.skill}.retry`;
    this.channel!.sendToQueue(
      retryQueue,
      Buffer.from(JSON.stringify({ ...msg, retryCount: attempt + 1 })),
      { persistent: true, expiration: String(delayMs) },
    );
    return 'retried';
  }

  consumeSkillQueue(skill: SkillName, handler: (msg: DirectiveMessage) => Promise<void>) {
    const queue = `directive.${skill}`;
    this.channel!.consume(queue, async (raw) => {
      if (!raw) return;

      let msg: DirectiveMessage;
      try {
        msg = JSON.parse(raw.content.toString());
      } catch (err) {
        this.logger.error(`Malformed message on ${queue}, dropping`, err as Error);
        this.channel!.ack(raw); // can't retry something we can't even parse
        return;
      }

      try {
        await handler(msg);
        this.channel!.ack(raw);
      } catch (err) {
        // Always ack the original delivery — we're taking explicit
        // responsibility for the message's fate below, not asking
        // RabbitMQ's nack/DLX machinery to decide it for us.
        this.channel!.ack(raw);
        const outcome = this.parkForFailureRetry(msg, err as Error);
        this.logger.error(
          `Handler failed on ${queue} (attempt ${(msg.retryCount ?? 0) + 1}) — ${outcome}`,
          err as Error,
        );
      }
    });
  }
}
