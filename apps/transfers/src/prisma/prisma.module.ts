import { Global, Module } from '@nestjs/common';

import { PrismaMetricsService } from './prisma-metrics.service';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService, PrismaMetricsService],
  exports: [PrismaService],
})
export class PrismaModule {}
