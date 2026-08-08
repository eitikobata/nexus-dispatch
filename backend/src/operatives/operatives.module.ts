import { Module } from '@nestjs/common';
import { OperativesController } from './operatives.controller';
import { OperativesService } from './operatives.service';

@Module({
  controllers: [OperativesController],
  providers: [OperativesService],
  exports: [OperativesService],
})
export class OperativesModule {}
