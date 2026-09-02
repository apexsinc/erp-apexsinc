CREATE TABLE IF NOT EXISTS `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text NOT NULL,
	`updated_by` text
);
