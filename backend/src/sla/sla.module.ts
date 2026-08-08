import { Module } from '@nestjs/common';
import { SlaService } from './sla.service';

@Module({
  providers: [SlaService],
})
export class SlaModule {}
