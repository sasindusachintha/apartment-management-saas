import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { ReceiptPdfService } from './receipt-pdf.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ReceiptPdfService],
  exports: [PaymentsService, ReceiptPdfService],
})
export class PaymentsModule {}
