import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DirectiveMessage, RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { DirectivesService } from '../directives/directives.service';
import { SKILLS } from '../common/constants';

/**
 * One consumer per skill queue, started at bootstrap. This is what actually
 * uses RabbitMQ for routing — messages for "recon" only ever reach this
 * consumer's recon binding, never mixed with other skills' traffic.
 */
@Injectable()
export class DispatchConsumerService implements OnModuleInit {
  private readonly logger = new Logger(DispatchConsumerService.name);

  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly directives: DirectivesService,
  ) {}

  onModuleInit() {
    for (const skill of SKILLS) {
      this.rabbitmq.consumeSkillQueue(skill, async (msg: DirectiveMessage) => {
        const result = await this.directives.tryAssign(msg.directiveId, msg.skill);

        if (result === 'no_operative') {
          // No AVAILABLE operative with this skill right now — park it,
          // it reappears on the main queue after the retry TTL expires.
          this.rabbitmq.parkForRetry(msg);
        } else if (result === 'stale') {
          // This Directive already moved past QUEUED via a different
          // message (e.g. an SLA-escalation republish). Retrying it would
          // leak a ghost message cycling forever — drop it here instead.
          this.logger.debug(`Dropping stale message for directive ${msg.directiveId} (already resolved)`);
        }
        // 'matched' — done, nothing further to do.
      });
    }
  }
}
