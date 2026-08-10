import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
export class OperativeSimulatorService implements OnModuleInit {
  private readonly logger = new Logger(OperativeSimulatorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly directives: DirectivesService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.recoverOrphanedAssignments();
  }

  // Every accept/resolve step is scheduled with an in-process setTimeout —
  // there's no persistence for "this assignment has a pending timer."
  // A restart (deploy, crash, redeploy) wipes those timers instantly. Any
  // assignment that was mid-flight at that exact moment is then stuck
  // forever: the Directive never leaves ASSIGNED/IN_PROGRESS, and its
  // Operative never leaves BUSY, because nothing is left to resolve them.
  // Enough restarts in a row and the whole roster silently drains to zero
  // AVAILABLE — which is exactly what happened here. On every boot, treat
  // any assignment still open from a previous process as lost contact and
  // resolve it through the same abort path a real failure takes: frees the
  // operative, requeues the directive, no new code path needed.
  private async recoverOrphanedAssignments() {
    const orphaned = await this.prisma.assignment.findMany({ where: { finishedAt: null } });
    if (orphaned.length === 0) return;

    this.logger.warn(`Recovering ${orphaned.length} assignment(s) orphaned by a previous restart`);
    for (const assignment of orphaned) {
      await this.directives.finish(assignment.id, AssignmentOutcome.ABORTED);
    }
  }

  @OnEvent('directive.assigned')
  async onAssigned(payload: DirectiveAssignedPayload) {
    const acceptDelayMs = (2 + Math.random() * 8) * 1000; // 2–10s
    setTimeout(() => this.accept(payload).catch((e) => this.logger.error(e)), acceptDelayMs);
  }

  private async accept(payload: DirectiveAssignedPayload) {
    const assignment = await this.directives.confirmAcceptance(payload.assignmentId);
    if (!assignment) return; // wiped by a reset in the meantime — nothing to continue

    const directive = await this.prisma.directive.findUnique({ where: { id: payload.directiveId } });
    if (!directive) return; // same race, different table

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
