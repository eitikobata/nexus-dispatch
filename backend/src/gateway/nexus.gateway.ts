import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

/**
 * Pure transport layer — never contains domain logic. It listens to domain
 * events emitted by DirectivesService/OperativesService/SlaService and
 * rebroadcasts them over WebSocket. This mirrors the ingestion/correlation
 * separation from Section 8½: services that change state don't know or care
 * who's listening.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class NexusGateway {
  private readonly logger = new Logger(NexusGateway.name);

  @WebSocketServer()
  server!: Server;

  @OnEvent('directive.queued')
  onDirectiveQueued(payload: unknown) {
    this.server?.emit('directive:queued', payload);
  }

  @OnEvent('directive.assigned')
  onDirectiveAssigned(payload: unknown) {
    this.server?.emit('directive:assigned', payload);
  }

  @OnEvent('directive.completed')
  onDirectiveCompleted(payload: unknown) {
    this.server?.emit('directive:completed', payload);
  }

  @OnEvent('directive.failed')
  onDirectiveFailed(payload: unknown) {
    this.server?.emit('directive:failed', payload);
  }

  @OnEvent('operative.status')
  onOperativeStatus(payload: unknown) {
    this.server?.emit('operative:status', payload);
  }

  @OnEvent('sla.breach')
  onSlaBreach(payload: unknown) {
    this.server?.emit('sla:breach', payload);
  }
}
