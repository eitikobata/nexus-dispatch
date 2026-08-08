import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as client from 'prom-client';

/**
 * Prometheus metrics for the dispatch pipeline itself — queue wait time,
 * directive duration, breach counts, operative utilization. This is the
 * key difference from Section 8½'s use of observability: there, metrics
 * would describe external entities crossing a threshold. Here, they
 * describe the health of Nexus's own dispatch pipeline.
 */
@Injectable()
export class MetricsService {
  private readonly registry = new client.Registry();

  private readonly waitTime = new client.Histogram({
    name: 'nexus_directive_wait_seconds',
    help: 'Time a directive spent queued before being assigned',
    buckets: [1, 5, 10, 30, 60, 120, 300],
    registers: [this.registry],
  });

  private readonly duration = new client.Histogram({
    name: 'nexus_directive_duration_seconds',
    help: 'Time an operative spent working an assigned directive',
    buckets: [10, 30, 60, 120, 300, 600],
    registers: [this.registry],
  });

  private readonly completed = new client.Counter({
    name: 'nexus_directives_completed_total',
    help: 'Total directives completed successfully',
    registers: [this.registry],
  });

  private readonly failed = new client.Counter({
    name: 'nexus_directives_failed_total',
    help: 'Total directives that failed or were aborted',
    registers: [this.registry],
  });

  private readonly slaBreaches = new client.Counter({
    name: 'nexus_sla_breaches_total',
    help: 'Total SLA breach events',
    registers: [this.registry],
  });

  private readonly operativesAvailable = new client.Gauge({
    name: 'nexus_operatives_available',
    help: 'Current count of available operatives',
    registers: [this.registry],
  });

  private readonly operativesBusy = new client.Gauge({
    name: 'nexus_operatives_busy',
    help: 'Current count of busy/assigned operatives',
    registers: [this.registry],
  });

  constructor() {
    client.collectDefaultMetrics({ register: this.registry });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  @OnEvent('directive.assigned')
  onAssigned(payload: { waitSeconds: number }) {
    this.waitTime.observe(payload.waitSeconds);
  }

  @OnEvent('directive.completed')
  onCompleted(payload: { durationSeconds: number }) {
    this.duration.observe(payload.durationSeconds);
    this.completed.inc();
  }

  @OnEvent('directive.failed')
  onFailed() {
    this.failed.inc();
  }

  @OnEvent('sla.breach')
  onBreach() {
    this.slaBreaches.inc();
  }

  @OnEvent('operatives.gauge')
  onGauge(payload: { available: number; busy: number }) {
    this.operativesAvailable.set(payload.available);
    this.operativesBusy.set(payload.busy);
  }
}
