import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AssignmentOutcome, DirectiveStatus, OperativeStatus, Priority } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { DIRECTIVE_CATEGORIES, SKILLS, SkillName } from '../common/constants';

const PRIORITY_ORDER: Priority[] = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];

export interface CreateDirectiveInput {
  title: string;
  category: string;
  skill: SkillName;
  priority: Priority;
  estimatedDurationSec: number;
}

@Injectable()
export class DirectivesService {
  private readonly logger = new Logger(DirectivesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rabbitmq: RabbitmqService,
    private readonly events: EventEmitter2,
  ) {}

  findAll(status?: DirectiveStatus) {
    return this.prisma.directive.findMany({
      where: status ? { status } : undefined,
      include: { requiredSkill: true, assignments: { include: { operative: true } } },
      orderBy: { queuedAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const directive = await this.prisma.directive.findUnique({
      where: { id },
      include: { requiredSkill: true, assignments: { include: { operative: true } }, slaEvents: true },
    });
    if (!directive) throw new NotFoundException('Directive not found');
    return directive;
  }

  // Called by the directive generator (simulator) and by any future manual
  // "create directive" endpoint. Creates the row, then publishes it onto
  // the matching skill queue with a priority-mapped message.
  async create(input: CreateDirectiveInput) {
    const skillRow = await this.prisma.skill.findUniqueOrThrow({ where: { name: input.skill } });
    const directive = await this.prisma.directive.create({
      data: {
        title: input.title,
        category: input.category,
        requiredSkillId: skillRow.id,
        priority: input.priority,
        estimatedDurationSec: input.estimatedDurationSec,
      },
    });
    this.events.emit('directive.queued', { directiveId: directive.id });
    this.rabbitmq.publishDirective({ directiveId: directive.id, skill: input.skill, priority: input.priority });
    return directive;
  }

  // Core matching step, invoked by a skill-queue consumer. Wrapped in a
  // transaction so two consumers racing on the same operative can't both
  // succeed — the second one's update touches zero rows and the whole
  // transaction is treated as "no match" by the caller.
  async tryAssign(directiveId: string, skill: SkillName): Promise<boolean> {
    const result = await this.prisma.$transaction(async (tx) => {
      const directive = await tx.directive.findUnique({ where: { id: directiveId } });
      if (!directive || directive.status !== DirectiveStatus.QUEUED) {
        return null; // already handled (e.g. reassigned manually) — drop
      }

      const operative = await tx.operative.findFirst({
        where: { status: OperativeStatus.AVAILABLE, skills: { some: { name: skill } } },
      });
      if (!operative) return null;

      const updated = await tx.operative.updateMany({
        where: { id: operative.id, status: OperativeStatus.AVAILABLE },
        data: { status: OperativeStatus.ASSIGNED },
      });
      if (updated.count === 0) return null; // lost the race to another consumer

      const assignment = await tx.assignment.create({
        data: { directiveId: directive.id, operativeId: operative.id },
      });
      const now = new Date();
      await tx.directive.update({
        where: { id: directive.id },
        data: { status: DirectiveStatus.ASSIGNED, assignedAt: now },
      });

      return { directive, operative, assignment, now };
    });

    if (!result) return false;

    const waitSeconds = (result.now.getTime() - result.directive.queuedAt.getTime()) / 1000;
    this.events.emit('directive.assigned', {
      directiveId: result.directive.id,
      operativeId: result.operative.id,
      assignmentId: result.assignment.id,
      waitSeconds,
    });
    return true;
  }

  // Handler override: skip matching entirely, assign to a named operative.
  async manualReassign(directiveId: string, operativeId: string) {
    const [directive, operative] = await Promise.all([
      this.prisma.directive.findUniqueOrThrow({ where: { id: directiveId } }),
      this.prisma.operative.findUniqueOrThrow({ where: { id: operativeId } }),
    ]);
    if (operative.status !== OperativeStatus.AVAILABLE) {
      throw new Error('Operative is not available');
    }

    await this.prisma.operative.update({ where: { id: operativeId }, data: { status: OperativeStatus.ASSIGNED } });
    const assignment = await this.prisma.assignment.create({ data: { directiveId, operativeId } });
    const now = new Date();
    await this.prisma.directive.update({
      where: { id: directiveId },
      data: { status: DirectiveStatus.ASSIGNED, assignedAt: now },
    });

    const waitSeconds = (now.getTime() - directive.queuedAt.getTime()) / 1000;
    this.events.emit('directive.assigned', {
      directiveId,
      operativeId,
      assignmentId: assignment.id,
      waitSeconds,
      manual: true,
    });
    return assignment;
  }

  async confirmAcceptance(assignmentId: string) {
    const assignment = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { acceptedAt: new Date() },
      include: { directive: true, operative: true },
    });
    await this.prisma.directive.update({
      where: { id: assignment.directiveId },
      data: { status: DirectiveStatus.IN_PROGRESS },
    });
    await this.prisma.operative.update({
      where: { id: assignment.operativeId },
      data: { status: OperativeStatus.BUSY },
    });
    return assignment;
  }

  async finish(assignmentId: string, outcome: AssignmentOutcome) {
    const assignment = await this.prisma.assignment.update({
      where: { id: assignmentId },
      data: { finishedAt: new Date(), outcome },
      include: { directive: { include: { requiredSkill: true } } },
    });

    if (outcome === AssignmentOutcome.SUCCESS) {
      await this.prisma.directive.update({
        where: { id: assignment.directiveId },
        data: { status: DirectiveStatus.COMPLETED, completedAt: new Date() },
      });
      await this.prisma.operative.update({
        where: { id: assignment.operativeId },
        data: { status: OperativeStatus.AVAILABLE },
      });
      const durationSeconds = assignment.acceptedAt
        ? (assignment.finishedAt!.getTime() - assignment.acceptedAt.getTime()) / 1000
        : 0;
      this.events.emit('directive.completed', { directiveId: assignment.directiveId, durationSeconds });
      return;
    }

    // FAILED / ABORTED — the operative loses contact. Directive goes back
    // to QUEUED (not deleted) and a fresh message is published so another
    // Assignment attempt can happen. Nothing about the failed attempt is
    // overwritten — it stays in the Assignment table as history.
    await this.prisma.directive.update({
      where: { id: assignment.directiveId },
      data: { status: DirectiveStatus.QUEUED, assignedAt: null },
    });
    await this.prisma.operative.update({
      where: { id: assignment.operativeId },
      data: { status: OperativeStatus.AVAILABLE },
    });
    this.events.emit('directive.failed', { directiveId: assignment.directiveId });

    const skillName = assignment.directive.requiredSkill.name as SkillName;
    this.rabbitmq.publishDirective({
      directiveId: assignment.directiveId,
      skill: skillName,
      priority: assignment.directive.priority,
    });
  }

  // Handler override: bump priority one level manually (independent of
  // the automatic SLA escalation in SlaService).
  async escalate(directiveId: string) {
    const directive = await this.prisma.directive.findUniqueOrThrow({
      where: { id: directiveId },
      include: { requiredSkill: true },
    });
    const idx = PRIORITY_ORDER.indexOf(directive.priority);
    const next = PRIORITY_ORDER[Math.min(idx + 1, PRIORITY_ORDER.length - 1)];
    const updated = await this.prisma.directive.update({
      where: { id: directiveId },
      data: { priority: next },
    });
    if (updated.status === DirectiveStatus.QUEUED) {
      this.rabbitmq.publishDirective({
        directiveId,
        skill: directive.requiredSkill.name as SkillName,
        priority: next,
      });
    }
    return updated;
  }

  randomCategory() {
    return DIRECTIVE_CATEGORIES[Math.floor(Math.random() * DIRECTIVE_CATEGORIES.length)];
  }

  randomSkill(): SkillName {
    return SKILLS[Math.floor(Math.random() * SKILLS.length)];
  }
}
