import { Module } from '@nestjs/common';
import { DirectivesController } from './directives.controller';
import { DirectivesService } from './directives.service';

@Module({
  controllers: [DirectivesController],
  providers: [DirectivesService],
  exports: [DirectivesService],
})
export class DirectivesModule {}
