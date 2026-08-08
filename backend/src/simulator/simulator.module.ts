import { Module } from '@nestjs/common';
import { DirectivesModule } from '../directives/directives.module';
import { DirectiveGeneratorService } from './directive-generator.service';
import { DispatchConsumerService } from './dispatch-consumer.service';
import { OperativeSimulatorService } from './operative-simulator.service';

@Module({
  imports: [DirectivesModule],
  providers: [DirectiveGeneratorService, DispatchConsumerService, OperativeSimulatorService],
})
export class SimulatorModule {}
