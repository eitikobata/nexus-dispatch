import { Injectable, OnModuleInit } from '@nestjs/common';
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
  constructor(
    private readonly rabbitmq: RabbitmqService,
    private readonly directives: DirectivesService,
  ) {}

  onModuleInit() {
    for (const skill of SKILLS) {
      this.rabbitmq.consumeSkillQueue(skill, async (msg: DirectiveMessage) => {
        const matched = await this.directives.tryAssign(msg.directiveId, msg.skill);
        if (!matched) {
          // No AVAILABLE operative with this skill right now — park it,
          // it reappears on the main queue after the retry TTL expires.
          this.rabbitmq.parkForRetry(msg);
        }
      });
    }
  }
}
