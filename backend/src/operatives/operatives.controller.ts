import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { OperativeStatus } from '@prisma/client';
import { OperativesService } from './operatives.service';

@Controller('operatives')
export class OperativesController {
  constructor(private readonly operatives: OperativesService) {}

  @Get()
  findAll() {
    return this.operatives.findAll();
  }

  // Handler override — mark an operative off-duty/available by hand,
  // independent of the simulated lifecycle.
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body('status') status: OperativeStatus) {
    return this.operatives.setStatus(id, status, true);
  }
}
