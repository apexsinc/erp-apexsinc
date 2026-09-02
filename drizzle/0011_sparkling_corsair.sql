ALTER TABLE `payment_vouchers` ADD `recipient_name` text;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `currency` text DEFAULT 'PHP' NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `items` text;--> statement-breakpoint
ALTER TABLE `payment_vouchers` ADD `signatories` text;