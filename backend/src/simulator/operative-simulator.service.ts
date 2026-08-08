import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OnEvent } from '@nestjs/event-emitter';
import { AssignmentOutcome } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DirectivesService } from '../directives/directives.service';

interface DirectiveAssignedPayload {
  directiveId: string;
  operativeId: string;
  assignmentId: string;
}

/**
 * Stands in for a real Operative client. Reacts to `directive.assigned`
 * events: waits a short "confirming receipt" delay, then runs for the
 * directive's estimated duration, then resolves to success or — with a
 * configurable small chance — failure (lost contact), which sends the
 * directive back through DirectivesService.finish() to requeue it.
 */
@Injectable()
export class OperativeSimulatorService {
  private readonly logger = new Logger(OperativeSimulatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directives: DirectivesService,
    private readonly config: ConfigService,
  ) {}

  @OnEvent('directive.assigned')
  async onAssigned(payload: DirectiveAssignedPayload) {
    const acceptDelayMs = (2 + Math.random() * 8) * 1000; // 2–10s
    setTimeout(() => this.accept(payload).catch((e) => this.logger.error(e)), acceptDelayMs);
  }

  private async accept(payload: DirectiveAssignedPayload) {
    await this.directives.confirmAcceptance(payload.assignmentId);

    const directive = await this.prisma.directive.findUniqueOrThrow({ where: { id: payload.directiveId } });
    const runMs = directive.estimatedDurationSec * 1000;

    setTimeout(() => this.resolve(payload).catch((e) => this.logger.error(e)), runMs);
  }

  private async resolve(payload: DirectiveAssignedPayload) {
    const abortChancePct = Number(this.config.get('OPERATIVE_ABORT_CHANCE_PCT') ?? 8);
    const aborted = Math.random() * 100 < abortChancePct;
    const outcome = aborted ? AssignmentOutcome.FAILED : AssignmentOutcome.SUCCESS;
    await this.directives.finish(payload.assignmentId, outcome);
  }
}
