import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { ServiceUnavailableException } from '@minibank/errors';

import { PrismaService } from '@/prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException('Database');
    }

    return {
      status: 'ok',
      service: 'transfers',
      timestamp: new Date().toISOString(),
    };
  }
}
