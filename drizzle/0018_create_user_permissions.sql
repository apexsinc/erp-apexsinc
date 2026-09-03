CREATE TABLE IF NOT EXISTS `user_permissions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`module` text NOT NULL,
	`can_create` integer DEFAULT 0 NOT NULL,
	`can_read` integer DEFAULT 0 NOT NULL,
	`can_update` integer DEFAULT 0 NOT NULL,
	`can_delete` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `user_permissions_user_module_unique` ON `user_permissions` (`user_id`, `module`);
