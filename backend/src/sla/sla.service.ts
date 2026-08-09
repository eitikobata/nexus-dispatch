import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DirectiveStatus, Priority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { SkillName } from '../common/constants';

const PRIORITY_ORDER: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];

/**
 * Sweeps QUEUED directives every 10s looking for ones that have been
 * waiting past the SLA threshold. This is the one place in Nexus that
 * looks like Section 8½'s "threshold breach" — but the thing being
 * measured is queue wait time on Nexus's own pipeline, not behavior of
 * an external entity. One SlaEvent is recorded per breach (not per sweep
 * tick) via a simple "already breached" check.
 */
@Injectable()
export class SlaService {
  private readonly logger = new Logger(SlaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitmqService,
    private readonly events: EventEmitter2,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async sweep() {
    await this.publishQueueDepth();

    const thresholdSec = Number(this.config.get('SLA_BREACH_THRESHOLD_SEC') ?? 120);
    const cutoff = new Date(Date.now() - thresholdSec * 1000);

    const stuck = await this.prisma.directive.findMany({
      where: { status: DirectiveStatus.QUEUED, queuedAt: { lt: cutoff } },
      include: { requiredSkill: true, slaEvents: true },
    });

    for (const directive of stuck) {
      // Already flagged for this stretch of waiting — don't spam SlaEvents
      // every 10s, only once until it either gets assigned or waits another
      // full threshold window past the last breach.
      const lastBreach = directive.slaEvents.at(-1);
      if (lastBreach && lastBreach.breachedAt > cutoff) continue;

      const idx = PRIORITY_ORDER.indexOf(directive.priority);
      const nextPriority = PRIORITY_ORDER[Math.min(idx + 1, PRIORITY_ORDER.length - 1)];
      const waitTimeSeconds = Math.floor((Date.now() - directive.queuedAt.getTime()) / 1000);

      await this.prisma.$transaction([
        this.prisma.slaEvent.create({
          data: {
            directiveId: directive.id,
            waitTimeSeconds,
            priorityBefore: directive.priority,
            priorityAfter: nextPriority,
          },
        }),
        this.prisma.directive.update({ where: { id: directive.id }, data: { priority: nextPriority } }),
      ]);

      this.events.emit('sla.breach', { directiveId: directive.id, waitTimeSeconds, priority: nextPriority });
      this.rabbitmq.publishDirective({
        directiveId: directive.id,
        skill: directive.requiredSkill.name as SkillName,
        priority: nextPriority,
      });
      this.logger.warn(`SLA breach: directive ${directive.id} waited ${waitTimeSeconds}s, escalated to ${nextPriority}`);
    }
  }

  // All four priorities are always emitted, even at 0 — otherwise a
  // priority that just emptied out would keep showing its last non-zero
  // value forever on the Grafana panel (Prometheus gauges hold their last
  // set value until set again).
  private async publishQueueDepth() {
    const counts = await this.prisma.directive.groupBy({
      by: ['priority'],
      where: { status: DirectiveStatus.QUEUED },
      _count: true,
    });
    const byPriority = new Map(counts.map((c) => [c.priority, c._count]));
    const payload = PRIORITY_ORDER.map((priority) => ({ priority, count: byPriority.get(priority) ?? 0 }));
    this.events.emit('directives.queue.gauge', payload);
  }
}
