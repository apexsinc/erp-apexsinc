CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`sku` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`unit_of_measure` text DEFAULT 'unit' NOT NULL,
	`cost_price_cents` integer DEFAULT 0 NOT NULL,
	`selling_price_cents` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost_cents` integer DEFAULT 0 NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` text,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goods_received_note_items` (
	`id` text PRIMARY KEY NOT NULL,
	`grn_id` text NOT NULL,
	`po_item_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity_received` integer NOT NULL,
	`unit_cost_cents` integer NOT NULL,
	FOREIGN KEY (`grn_id`) REFERENCES `goods_received_notes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`po_item_id`) REFERENCES `purchase_order_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `goods_received_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`grn_number` text NOT NULL,
	`purchase_order_id` text NOT NULL,
	`received_date` text NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `goods_received_notes_grn_number_unique` ON `goods_received_notes` (`grn_number`);--> statement-breakpoint
CREATE TABLE `purchase_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`purchase_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity_ordered` integer NOT NULL,
	`quantity_received` integer DEFAULT 0 NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`subtotal_cents` integer NOT NULL,
	FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`po_number` text NOT NULL,
	`vendor_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`issue_date` text NOT NULL,
	`expected_date` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `purchase_orders_po_number_unique` ON `purchase_orders` (`po_number`);--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_code` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`tax_id` text,
	`payment_terms_days` integer DEFAULT 30 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_vendor_code_unique` ON `vendors` (`vendor_code`);--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_code` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`billing_address` text,
	`shipping_address` text,
	`tax_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_customer_code_unique` ON `customers` (`customer_code`);--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`subtotal_cents` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_number` text NOT NULL,
	`sales_order_id` text,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`issue_date` text NOT NULL,
	`due_date` text NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`paid_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE TABLE `sales_order_items` (
	`id` text PRIMARY KEY NOT NULL,
	`sales_order_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`subtotal_cents` integer NOT NULL,
	FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`so_number` text NOT NULL,
	`customer_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_amount_cents` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`order_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sales_orders_so_number_unique` ON `sales_orders` (`so_number`);--> statement-breakpoint
CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_code_unique` ON `accounts` (`code`);--> statement-breakpoint
CREATE TABLE `journal_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_type` text NOT NULL,
	`voucher_id` text NOT NULL,
	`account_id` text NOT NULL,
	`debit_cents` integer DEFAULT 0 NOT NULL,
	`credit_cents` integer DEFAULT 0 NOT NULL,
	`description` text,
	`entry_date` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `journal_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`jv_number` text NOT NULL,
	`voucher_date` text NOT NULL,
	`description` text NOT NULL,
	`reference_type` text,
	`reference_id` text,
	`status` text DEFAULT 'POSTED' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `journal_vouchers_jv_number_unique` ON `journal_vouchers` (`jv_number`);--> statement-breakpoint
CREATE TABLE `payment_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_number` text NOT NULL,
	`voucher_date` text NOT NULL,
	`recipient_type` text NOT NULL,
	`recipient_id` text,
	`amount_cents` integer NOT NULL,
	`payment_method` text DEFAULT 'BANK_TRANSFER' NOT NULL,
	`reference_type` text NOT NULL,
	`reference_id` text,
	`notes` text,
	`status` text DEFAULT 'POSTED' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_vouchers_voucher_number_unique` ON `payment_vouchers` (`voucher_number`);--> statement-breakpoint
CREATE TABLE `receipt_vouchers` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_number` text NOT NULL,
	`voucher_date` text NOT NULL,
	`customer_id` text,
	`invoice_id` text,
	`amount_cents` integer NOT NULL,
	`payment_method` text DEFAULT 'BANK_TRANSFER' NOT NULL,
	`notes` text,
	`status` text DEFAULT 'POSTED' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `receipt_vouchers_voucher_number_unique` ON `receipt_vouchers` (`voucher_number`);--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_code` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`department` text NOT NULL,
	`position` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`hire_date` text NOT NULL,
	`bank_account_number` text,
	`bank_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `employees_employee_code_unique` ON `employees` (`employee_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `employees_email_unique` ON `employees` (`email`);--> statement-breakpoint
CREATE TABLE `payroll_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`run_number` text NOT NULL,
	`period_start_date` text NOT NULL,
	`period_end_date` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`total_gross_cents` integer DEFAULT 0 NOT NULL,
	`total_deductions_cents` integer DEFAULT 0 NOT NULL,
	`total_net_cents` integer DEFAULT 0 NOT NULL,
	`payment_voucher_id` text,
	`finalized_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`payment_voucher_id`) REFERENCES `payment_vouchers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payroll_runs_run_number_unique` ON `payroll_runs` (`run_number`);--> statement-breakpoint
CREATE TABLE `payslips` (
	`id` text PRIMARY KEY NOT NULL,
	`payroll_run_id` text NOT NULL,
	`employee_id` text NOT NULL,
	`base_salary_cents` integer NOT NULL,
	`allowances_cents` integer DEFAULT 0 NOT NULL,
	`deductions_cents` integer DEFAULT 0 NOT NULL,
	`net_salary_cents` integer NOT NULL,
	`status` text DEFAULT 'GENERATED' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `salary_structures` (
	`id` text PRIMARY KEY NOT NULL,
	`employee_id` text NOT NULL,
	`base_salary_cents` integer NOT NULL,
	`allowances_cents` integer DEFAULT 0 NOT NULL,
	`deductions_cents` integer DEFAULT 0 NOT NULL,
	`net_salary_cents` integer NOT NULL,
	`effective_date` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON UPDATE no action ON DELETE cascade
);
