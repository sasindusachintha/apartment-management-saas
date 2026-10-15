import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaHealthIndicator } from './prisma-health.indicator';

@ApiTags('Health')
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  /**
   * GET /health
   * Simple liveness probe — no DB check required.
   */
  @Get('health')
  @ApiOperation({ summary: 'Liveness probe' })
  liveness(): object {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'apartment-saas-api',
    };
  }

  /**
   * GET /api/v1/health
   * Readiness probe — includes DB connectivity check.
   */
  @Get()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe with DB check' })
  readiness() {
    return this.health.check([() => this.prismaHealth.isHealthy('database')]);
  }
}
