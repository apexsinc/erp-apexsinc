CREATE TABLE IF NOT EXISTS `roles` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_system` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `roles_code_unique` ON `roles` (`code`);

-- Seed standard system roles
INSERT OR IGNORE INTO `roles` (`id`, `code`, `name`, `description`, `is_system`, `created_at`, `updated_at`)
VALUES 
  ('role-admin-sys-0001', 'ADMIN', 'System Administrator', 'Full, unrestricted administrative authority across all modules and settings.', 1, datetime('now'), datetime('now')),
  ('role-manager-sys-0002', 'MANAGER', 'Operations Manager', 'Full CRUD management over daily operations, inventory, sales, purchasing, and staff.', 1, datetime('now'), datetime('now')),
  ('role-staff-sys-0003', 'STAFF', 'General Staff', 'Standard operational access for order processing, deliveries, and fulfillment.', 1, datetime('now'), datetime('now'));
