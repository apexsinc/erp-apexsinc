ALTER TABLE `sales_order_items` ADD `quantity_shipped` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `packed_at` text;