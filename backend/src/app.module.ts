import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { GatewayModule } from './gateway/gateway.module';
import { MetricsModule } from './metrics/metrics.module';
import { OperativesModule } from './operatives/operatives.module';
import { DirectivesModule } from './directives/directives.module';
import { SimulatorModule } from './simulator/simulator.module';
import { SlaModule } from './sla/sla.module';
import { ResetModule } from './reset/reset.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    RabbitmqModule,
    GatewayModule,
    MetricsModule,
    OperativesModule,
    DirectivesModule,
    ResetModule,
    SimulatorModule,
    SlaModule,
  ],
})
export class AppModule {}
