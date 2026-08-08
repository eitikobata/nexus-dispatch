import { Module } from '@nestjs/common';
import { NexusGateway } from './nexus.gateway';

@Module({
  providers: [NexusGateway],
})
export class GatewayModule {}
