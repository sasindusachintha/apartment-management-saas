-- AlterTable
ALTER TABLE `apartments` ADD COLUMN `tower_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `billing_settings` ADD COLUMN `contact_email` VARCHAR(191) NULL,
    ADD COLUMN `contact_person` VARCHAR(191) NULL,
    ADD COLUMN `contact_phone` VARCHAR(191) NULL,
    ADD COLUMN `notice_text` TEXT NULL;

-- AlterTable
ALTER TABLE `invoice_items` ADD COLUMN `room_id` VARCHAR(191) NULL,
    ADD COLUMN `room_name` VARCHAR(191) NULL,
    ADD COLUMN `room_type` ENUM('BEDROOM', 'LIVING_ROOM', 'KITCHEN', 'BATHROOM', 'BALCONY', 'STORAGE', 'OTHER') NULL,
    MODIFY `item_type` ENUM('MAINTENANCE', 'ROOM_MAINTENANCE', 'WATER', 'UTILITY', 'SINKING_FUND', 'REPAIR', 'PENALTY', 'DISCOUNT', 'ADJUSTMENT', 'OTHER') NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE `towers` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `total_floors` INTEGER NOT NULL DEFAULT 1,
    `description` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `towers_organization_id_idx`(`organization_id`),
    INDEX `towers_building_id_idx`(`building_id`),
    UNIQUE INDEX `towers_building_id_name_key`(`building_id`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `apartment_rooms` (
    `id` VARCHAR(191) NOT NULL,
    `organization_id` VARCHAR(191) NOT NULL,
    `building_id` VARCHAR(191) NOT NULL,
    `apartment_id` VARCHAR(191) NOT NULL,
    `room_number` VARCHAR(191) NOT NULL,
    `room_type` ENUM('BEDROOM', 'LIVING_ROOM', 'KITCHEN', 'BATHROOM', 'BALCONY', 'STORAGE', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `area_sqft` DECIMAL(10, 2) NOT NULL,
    `maintenance_rate` DECIMAL(10, 2) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `notes` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `apartment_rooms_organization_id_idx`(`organization_id`),
    INDEX `apartment_rooms_building_id_idx`(`building_id`),
    INDEX `apartment_rooms_apartment_id_idx`(`apartment_id`),
    INDEX `apartment_rooms_room_type_idx`(`room_type`),
    UNIQUE INDEX `apartment_rooms_apartment_id_room_number_key`(`apartment_id`, `room_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `apartments_tower_id_idx` ON `apartments`(`tower_id`);

-- CreateIndex
CREATE INDEX `invoice_items_room_id_idx` ON `invoice_items`(`room_id`);

-- AddForeignKey
ALTER TABLE `towers` ADD CONSTRAINT `towers_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `towers` ADD CONSTRAINT `towers_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartments` ADD CONSTRAINT `apartments_tower_id_fkey` FOREIGN KEY (`tower_id`) REFERENCES `towers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_rooms` ADD CONSTRAINT `apartment_rooms_organization_id_fkey` FOREIGN KEY (`organization_id`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_rooms` ADD CONSTRAINT `apartment_rooms_building_id_fkey` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apartment_rooms` ADD CONSTRAINT `apartment_rooms_apartment_id_fkey` FOREIGN KEY (`apartment_id`) REFERENCES `apartments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `apartment_rooms`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
