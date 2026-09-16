CREATE TABLE IF NOT EXISTS `quotations` (
	`id` text PRIMARY KEY NOT NULL,
	`quote_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`currency` text DEFAULT 'PHP' NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`quote_date` text NOT NULL,
	`valid_until` text,
	`payment_terms` text DEFAULT '100% Advance Payment' NOT NULL,
	`bank_info` text,
	`authorized_signatory_name` text DEFAULT 'Jeneviev Manatad' NOT NULL,
	`authorized_signatory_title` text DEFAULT 'General Manager' NOT NULL,
	`notes` text,
	`sales_order_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE UNIQUE INDEX IF NOT EXISTS `quotations_quote_number_unique` ON `quotations` (`quote_number`);

CREATE TABLE IF NOT EXISTS `quotation_items` (
	`id` text PRIMARY KEY NOT NULL,
	`quotation_id` text NOT NULL,
	`product_id` text,
	`part_number` text,
	`description` text NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	`unit_price_cents` integer DEFAULT 0 NOT NULL,
	`subtotal_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	FOREIGN KEY (`quotation_id`) REFERENCES `quotations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
