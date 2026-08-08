import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { DirectiveStatus } from '@prisma/client';
import { DirectivesService } from './directives.service';

@Controller('directives')
export class DirectivesController {
  constructor(private readonly directives: DirectivesService) {}

  @Get()
  findAll(@Query('status') status?: DirectiveStatus) {
    return this.directives.findAll(status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.directives.findOne(id);
  }

  // Handler override — reassign to a specific operative, bypassing automatic routing.
  @Post(':id/reassign')
  reassign(@Param('id') id: string, @Body('operativeId') operativeId: string) {
    return this.directives.manualReassign(id, operativeId);
  }

  // Handler override — bump priority one level by hand.
  @Post(':id/escalate')
  escalate(@Param('id') id: string) {
    return this.directives.escalate(id);
  }
}
