import { Module } from '@nestjs/common';
import { ResetService } from './reset.service';

@Module({
  providers: [ResetService],
})
export class ResetModule {}
