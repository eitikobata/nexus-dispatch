import { Module } from '@nestjs/common';
import { DirectivesModule } from '../directives/directives.module';
import { DirectiveGeneratorService } from './directive-generator.service';
import { DispatchConsumerService } from './dispatch-consumer.service';
import { OperativeSimulatorService } from './operative-simulator.service';

@Module({
  imports: [DirectivesModule],
  // OperativeSimulatorService first — its recovery pass (orphaned
  // assignments from a previous restart) should run before the dispatch
  // consumer starts matching new work and before the generator creates
  // anything new.
  providers: [OperativeSimulatorService, DispatchConsumerService, DirectiveGeneratorService],
})
export class SimulatorModule {}
