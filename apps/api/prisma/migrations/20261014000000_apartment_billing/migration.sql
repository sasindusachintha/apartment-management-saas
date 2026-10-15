-- CreateTable
CREATE TABLE `apartments` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `unit_number` VARCHAR(191) NOT NULL,
    `floor` INTEGER NOT NULL DEFAULT 1,
    `area_sqft` DECIMAL(10, 2) NOT NULL,
    `status` ENUM('ACTIVE', 'OCCUPIED', 'VACANT', 'MAINTENANCE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `owner_id` VARCHAR(191) NULL,
    `resident_id` VARCHAR(191) NULL,
    `owner_name` VARCHAR(191) NULL,
    `owner_email` VARCHAR(191) NULL,
    `owner_phone` VARCHAR(191) NULL,
    `resident_name` VARCHAR(191) NULL,
    `resident_email` VARCHAR(191) NULL,
    `resident_phone` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `apartments_organization_id_idx`(`organization_id`),
    INDEX `apartments_building_id_idx`(`building_id`),
    INDEX `apartments_owner_id_idx`(`owner_id`),
    INDEX `apartments_resident_id_idx`(`resident_id`),
    UNIQUE INDEX `apartments_building_id_unit_number_key`(`building_id`, `unit_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_settings` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NULL,
    `maintenance_rate_per_sqft` DECIMAL(10, 2) NOT NULL DEFAULT 10.00,
    `default_due_days` INTEGER NOT NULL DEFAULT 15,
    `late_payment_penalty_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    `late_payment_grace_days` INTEGER NOT NULL DEFAULT 5,
    `water_tariff_per_unit` DECIMAL(10, 2) NOT NULL DEFAULT 100.00,
    `water_fixed_charge` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `bank_name` VARCHAR(191) NULL,
    `bank_account_name` VARCHAR(191) NULL,
    `bank_account_number` VARCHAR(191) NULL,
    `bank_branch` VARCHAR(191) NULL,
    `payment_instructions` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `billing_settings_building_id_key`(`building_id`),
    INDEX `billing_settings_organization_id_idx`(`organization_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `billing_periods` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `period_code` VARCHAR(191) NOT NULL,
    `start_date` DATETIME(3) NOT NULL,
    `end_date` DATETIME(3) NOT NULL,
    `due_date` DATETIME(3) NOT NULL,
    `is_closed` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `billing_periods_organization_id_idx`(`organization_id`),
    INDEX `billing_periods_building_id_idx`(`building_id`),
    UNIQUE INDEX `billing_periods_building_id_period_code_key`(`building_id`, `period_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `water_readings` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `apartment_id` VARCHAR(191) NOT NULL,
    `billing_period_id` VARCHAR(191) NULL,
    `period_code` VARCHAR(191) NOT NULL,
    `previous_reading` DECIMAL(10, 2) NOT NULL,
    `current_reading` DECIMAL(10, 2) NOT NULL,
    `consumption` DECIMAL(10, 2) NOT NULL,
    `rate_per_unit` DECIMAL(10, 2) NOT NULL,
    `fixed_charge` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `total_amount` DECIMAL(10, 2) NOT NULL,
    `reading_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recorded_by_user_id` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `water_readings_organization_id_idx`(`organization_id`),
    INDEX `water_readings_building_id_idx`(`building_id`),
    INDEX `water_readings_billing_period_id_idx`(`billing_period_id`),
    UNIQUE INDEX `water_readings_apartment_id_period_code_key`(`apartment_id`, `period_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apartment_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `apartment_id` VARCHAR(191) NOT NULL,
    `billing_period_id` VARCHAR(191) NULL,
    `period_code` VARCHAR(191) NOT NULL,
    `invoice_number` VARCHAR(191) NOT NULL,
    `issue_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `due_date` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID') NOT NULL DEFAULT 'DRAFT',
    `apartment_area_sqft` DECIMAL(10, 2) NOT NULL,
    `maintenance_rate` DECIMAL(10, 2) NOT NULL,
    `maintenance_amount` DECIMAL(12, 2) NOT NULL,
    `water_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `other_charges_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `penalty_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `discount_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `current_charges_total` DECIMAL(12, 2) NOT NULL,
    `previous_arrears` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `total_due` DECIMAL(12, 2) NOT NULL,
    `paid_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `balance_due` DECIMAL(12, 2) NOT NULL,
    `notes` TEXT NULL,
    `finalized_at` DATETIME(3) NULL,
    `finalized_by_user_id` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `apartment_invoices_invoice_number_key`(`invoice_number`),
    INDEX `apartment_invoices_organization_id_idx`(`organization_id`),
    INDEX `apartment_invoices_building_id_idx`(`building_id`),
    INDEX `apartment_invoices_apartment_id_idx`(`apartment_id`),
    INDEX `apartment_invoices_status_idx`(`status`),
    INDEX `apartment_invoices_due_date_idx`(`due_date`),
    UNIQUE INDEX `apartment_invoices_apartment_id_period_code_key`(`apartment_id`, `period_code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_items` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `item_type` ENUM('MAINTENANCE', 'WATER', 'UTILITY', 'SINKING_FUND', 'REPAIR', 'PENALTY', 'DISCOUNT', 'ADJUSTMENT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `description` VARCHAR(191) NOT NULL,
    `quantity` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
    `unit_rate` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    `amount` DECIMAL(12, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_items_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apartment_payments` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `apartment_id` VARCHAR(191) NOT NULL,
    `receipt_number` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE') NOT NULL DEFAULT 'CASH',
    `payment_reference` VARCHAR(191) NOT NULL,
    `payment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recorded_by_user_id` VARCHAR(191) NULL,
    `status` ENUM('COMPLETED', 'PENDING', 'REVERSED') NOT NULL DEFAULT 'COMPLETED',
    `notes` TEXT NULL,
    `is_online` BOOLEAN NOT NULL DEFAULT false,
    `gateway_status` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `apartment_payments_receipt_number_key`(`receipt_number`),
    INDEX `apartment_payments_apartment_id_idx`(`apartment_id`),
    INDEX `apartment_payments_building_id_idx`(`building_id`),
    INDEX `apartment_payments_payment_date_idx`(`payment_date`),
    UNIQUE INDEX `apartment_payments_organization_id_payment_reference_key`(`organization_id`, `payment_reference`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_allocations` (
    `id` VARCHAR(191) NOT NULL,
    `payment_id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `allocated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `payment_allocations_payment_id_idx`(`payment_id`),
    INDEX `payment_allocations_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invoice_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `invoice_id` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `adjustment_type` ENUM('CREDIT', 'DEBIT', 'WAIVER', 'CORRECTION') NOT NULL,
    `reason` TEXT NOT NULL,
    `authorized_by_user_id` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `invoice_adjustments_invoice_id_idx`(`invoice_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_owner_id_fkey` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_resident_id_fkey` FOREIGN KEY (`resident_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_settings` ADD CONSTRAINT `billing_settings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_settings` ADD CONSTRAINT `billing_settings_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_periods` ADD CONSTRAINT `billing_periods_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `billing_periods` ADD CONSTRAINT `billing_periods_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_apartment_id_fkey` FOREIGN KEY (`apartment_id`) REFERENCES `apartments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_billing_period_id_fkey` FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `water_readings` ADD CONSTRAINT `water_readings_recorded_by_user_id_fkey` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_invoices` ADD CONSTRAINT `apartment_invoices_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_invoices` ADD CONSTRAINT `apartment_invoices_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_invoices` ADD CONSTRAINT `apartment_invoices_apartment_id_fkey` FOREIGN KEY (`apartment_id`) REFERENCES `apartments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_invoices` ADD CONSTRAINT `apartment_invoices_billing_period_id_fkey` FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_invoices` ADD CONSTRAINT `apartment_invoices_finalized_by_user_id_fkey` FOREIGN KEY (`finalized_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `apartment_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_payments` ADD CONSTRAINT `apartment_payments_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_payments` ADD CONSTRAINT `apartment_payments_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_payments` ADD CONSTRAINT `apartment_payments_apartment_id_fkey` FOREIGN KEY (`apartment_id`) REFERENCES `apartments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_payments` ADD CONSTRAINT `apartment_payments_recorded_by_user_id_fkey` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `apartment_payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `apartment_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_adjustments` ADD CONSTRAINT `invoice_adjustments_invoice_id_fkey` FOREIGN KEY (`invoice_id`) REFERENCES `apartment_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_adjustments` ADD CONSTRAINT `invoice_adjustments_authorized_by_user_id_fkey` FOREIGN KEY (`authorized_by_user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

