import { Module } from '@nestjs/common';
import { WaterReadingsController } from './water-readings.controller';
import { WaterReadingsService } from './water-readings.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [WaterReadingsController],
  providers: [WaterReadingsService],
  exports: [WaterReadingsService],
})
export class WaterReadingsModule {}
