ALTER TABLE `invoices` ADD `currency` text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD `currency` text DEFAULT 'USD' NOT NULL;