import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Priority } from '@prisma/client';
import { DirectivesService } from '../directives/directives.service';

const PRIORITIES: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];
// Weighted so CRITICAL stays rare — a demo where everything is on fire all
// the time stops being informative.
const PRIORITY_WEIGHTS = [0.4, 0.35, 0.2, 0.05];

function weightedPriority(): Priority {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < PRIORITIES.length; i++) {
    acc += PRIORITY_WEIGHTS[i];
    if (r <= acc) return PRIORITIES[i];
  }
  return Priority.LOW;
}

/**
 * Keeps the demo populated. Reschedules itself after each run with a random
 * delay between the configured min/max, rather than a fixed cron interval —
 * closer to real, bursty arrival patterns than a metronome.
 */
@Injectable()
export class DirectiveGeneratorService implements OnModuleInit {
  private readonly logger = new Logger(DirectiveGeneratorService.name);

  constructor(
    private readonly directives: DirectivesService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.scheduleNext();
  }

  private scheduleNext() {
    const min = Number(this.config.get('DIRECTIVE_GEN_MIN_INTERVAL_SEC') ?? 5);
    const max = Number(this.config.get('DIRECTIVE_GEN_MAX_INTERVAL_SEC') ?? 30);
    const delayMs = (min + Math.random() * (max - min)) * 1000;
    setTimeout(() => this.generateOne().finally(() => this.scheduleNext()), delayMs);
  }

  private async generateOne() {
    const skill = this.directives.randomSkill();
    const category = this.directives.randomCategory();
    const priority = weightedPriority();
    const estimatedDurationSec = 30 + Math.floor(Math.random() * 270); // 30s – 5min

    try {
      await this.directives.create({
        title: `${category} — sector ${1 + Math.floor(Math.random() * 9)}`,
        category,
        skill,
        priority,
        estimatedDurationSec,
      });
    } catch (err) {
      this.logger.error('Failed to generate directive', err as Error);
    }
  }
}
