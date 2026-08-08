import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OperativeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SkillName } from '../common/constants';

@Injectable()
export class OperativesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  findAll() {
    return this.prisma.operative.findMany({
      include: { skills: true },
      orderBy: { codename: 'asc' },
    });
  }

  // Picks one AVAILABLE operative with the given skill. Not transactional
  // by itself — the caller (DirectivesService.tryAssign) wraps the whole
  // match-and-assign sequence in a single Prisma transaction so two
  // concurrent skill-queue consumers can't double-book the same operative.
  findAvailableWithSkill(tx: PrismaService, skill: SkillName) {
    return tx.operative.findFirst({
      where: { status: OperativeStatus.AVAILABLE, skills: { some: { name: skill } } },
    });
  }

  async setStatus(operativeId: string, status: OperativeStatus, manual = false) {
    const operative = await this.prisma.operative.update({
      where: { id: operativeId },
      data: { status },
    });
    this.events.emit('operative.status', { operativeId, status, manual });
    await this.publishGauge();
    return operative;
  }

  async publishGauge() {
    const [available, busy] = await Promise.all([
      this.prisma.operative.count({ where: { status: OperativeStatus.AVAILABLE } }),
      this.prisma.operative.count({
        where: { status: { in: [OperativeStatus.ASSIGNED, OperativeStatus.BUSY] } },
      }),
    ]);
    this.events.emit('operatives.gauge', { available, busy });
  }
}
