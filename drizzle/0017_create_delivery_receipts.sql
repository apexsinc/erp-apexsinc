CREATE TABLE IF NOT EXISTS `delivery_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`dr_number` text NOT NULL,
	`sales_order_id` text NOT NULL,
	`invoice_id` text,
	`received_by` text,
	`notes` text,
	`delivered_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS `delivery_receipts_dr_number_unique` ON `delivery_receipts` (`dr_number`);

CREATE TABLE IF NOT EXISTS `delivery_receipt_items` (
	`id` text PRIMARY KEY NOT NULL,
	`delivery_receipt_id` text NOT NULL,
	`sales_order_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	FOREIGN KEY (`delivery_receipt_id`) REFERENCES `delivery_receipts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sales_order_item_id`) REFERENCES `sales_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
