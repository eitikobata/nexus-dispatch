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

  // Belt-and-suspenders companion to the fix in accept()/resolve() below:
  // this covers the restart case specifically (in-process timers don't
  // survive a process exit), while accept()/resolve()'s own try/catch
  // covers the more common case actually seen in production — a transient
  // failure mid-flight, no restart involved at all. Same recovery action
  // either way: treat it as lost contact, free the operative, requeue.
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
    setTimeout(() => this.accept(payload), acceptDelayMs);
  }

  // Not atomic by nature — confirmAcceptance() flips the operative to BUSY
  // in the DB, then (separately) a directive lookup happens, then (separately
  // again) a timer gets scheduled to eventually resolve it. If anything
  // after confirmAcceptance() throws, the operative is already BUSY in the
  // DB but no timer was ever scheduled to free it — it would otherwise be
  // stuck forever with nothing but an error log to show for it. That's what
  // actually happened in production: operatives got orphaned mid-flight,
  // not from a restart losing timers, but from a transient failure in this
  // exact gap. Recovered the same way a real lost-contact case is handled.
  private async accept(payload: DirectiveAssignedPayload) {
    let confirmed = false;
    try {
      const assignment = await this.directives.confirmAcceptance(payload.assignmentId);
      if (!assignment) return; // wiped by a reset in the meantime — nothing to continue
      confirmed = true;

      const directive = await this.prisma.directive.findUnique({ where: { id: payload.directiveId } });
      if (!directive) {
        // Operative is already BUSY at this point — don't leave it stuck
        // just because the directive vanished right after.
        await this.directives.finish(payload.assignmentId, AssignmentOutcome.ABORTED);
        return;
      }

      const runMs = directive.estimatedDurationSec * 1000;
      setTimeout(() => this.resolve(payload), runMs);
    } catch (err) {
      this.logger.error(`accept() failed for assignment ${payload.assignmentId}`, err as Error);
      if (confirmed) {
        await this.recoverStuckAssignment(payload.assignmentId);
      }
    }
  }

  private async resolve(payload: DirectiveAssignedPayload) {
    try {
      const abortChancePct = Number(this.config.get('OPERATIVE_ABORT_CHANCE_PCT') ?? 8);
      const aborted = Math.random() * 100 < abortChancePct;
      const outcome = aborted ? AssignmentOutcome.FAILED : AssignmentOutcome.SUCCESS;
      await this.directives.finish(payload.assignmentId, outcome);
    } catch (err) {
      this.logger.error(`resolve() failed for assignment ${payload.assignmentId}`, err as Error);
      await this.recoverStuckAssignment(payload.assignmentId);
    }
  }

  private async recoverStuckAssignment(assignmentId: string) {
    await this.directives.finish(assignmentId, AssignmentOutcome.ABORTED).catch((e) => {
      this.logger.error(`Recovery finish() also failed for assignment ${assignmentId} — will only clear on next self-heal reset`, e);
    });
  }
}
