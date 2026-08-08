import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { OperativeStatus } from '@prisma/client';
import { SKILLS } from '../common/constants';

const OPERATIVE_NAMES = [
  'Ash', 'Vega', 'Rook', 'Fen', 'Talon', 'Nyx', 'Cobalt', 'Sable',
  'Quill', 'Iris', 'Marlow', 'Dune',
];

/**
 * Self-heal: wipes accumulated demo history and reseeds a fixed operative
 * roster on a schedule, same pattern as the author's other public demos.
 * Uses a plain setInterval read from RESET_CRON's hour count rather than
 * @nestjs/schedule's cron parser, to keep this file dependency-free and
 * easy to reason about independent of the SLA sweep's cron usage.
 */
@Injectable()
export class ResetService implements OnModuleInit {
  private readonly logger = new Logger(ResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    // Runs hourly by default; adjust via RESET_INTERVAL_MS if needed.
    const intervalMs = Number(this.config.get('RESET_INTERVAL_MS') ?? 60 * 60 * 1000);
    setInterval(() => this.reset().catch((e) => this.logger.error(e)), intervalMs);
  }

  async reset() {
    this.logger.log('Running self-heal reset');
    await this.prisma.slaEvent.deleteMany({});
    await this.prisma.assignment.deleteMany({});
    await this.prisma.directive.deleteMany({});
    await this.prisma.operative.deleteMany({});

    for (const skillName of SKILLS) {
      await this.prisma.skill.upsert({ where: { name: skillName }, update: {}, create: { name: skillName } });
    }
    const skills = await this.prisma.skill.findMany();

    for (let i = 0; i < OPERATIVE_NAMES.length; i++) {
      const assignedSkills = skills
        .filter(() => Math.random() < 0.4)
        .slice(0, 3);
      const guaranteed = skills[i % skills.length];
      const skillSet = assignedSkills.some((s) => s.id === guaranteed.id)
        ? assignedSkills
        : [...assignedSkills, guaranteed];

      await this.prisma.operative.create({
        data: {
          codename: OPERATIVE_NAMES[i],
          status: Math.random() < 0.15 ? OperativeStatus.OFF_DUTY : OperativeStatus.AVAILABLE,
          skills: { connect: skillSet.map((s) => ({ id: s.id })) },
        },
      });
    }
    this.logger.log(`Reset complete — ${OPERATIVE_NAMES.length} operatives reseeded`);
  }
}
