import { Module } from '@nestjs/common';
import { OperativesModule } from '../operatives/operatives.module';
import { SlaService } from './sla.service';

@Module({
  imports: [OperativesModule],
  providers: [SlaService],
})
export class SlaModule {}
