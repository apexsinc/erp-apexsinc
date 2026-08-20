import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { products } from './inventory';

/**
 * Customers Master Table
 */
export const customers = sqliteTable('customers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  customerCode: text('customer_code').notNull().unique(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  billingAddress: text('billing_address'),
  shippingAddress: text('shipping_address'),
  taxId: text('tax_id'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Sales Orders (O2C Sales Fulfillment)
 */
export const salesOrders = sqliteTable('sales_orders', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  soNumber: text('so_number').notNull().unique(),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  status: text('status', {
    enum: ['DRAFT', 'CONFIRMED', 'FULFILLED', 'CANCELLED'],
  })
    .notNull()
    .default('DRAFT'),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  notes: text('notes'),
  orderDate: text('order_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Sales Order Line Items
 */
export const salesOrderItems = sqliteTable('sales_order_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  salesOrderId: text('sales_order_id')
    .notNull()
    .references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
});

/**
 * Invoices
 */
export const invoices = sqliteTable('invoices', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  invoiceNumber: text('invoice_number').notNull().unique(),
  salesOrderId: text('sales_order_id').references(() => salesOrders.id),
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  status: text('status', {
    enum: ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED'],
  })
    .notNull()
    .default('DRAFT'),
  issueDate: text('issue_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  dueDate: text('due_date').notNull(),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  paidAmountCents: integer('paid_amount_cents').notNull().default(0),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Invoice Line Items
 */
export const invoiceItems = sqliteTable('invoice_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  invoiceId: text('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
});

export const customersRelations = relations(customers, ({ many }) => ({
  salesOrders: many(salesOrders),
  invoices: many(invoices),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  customer: one(customers, {
    fields: [salesOrders.customerId],
    references: [customers.id],
  }),
  items: many(salesOrderItems),
  invoices: many(invoices),
}));

export const salesOrderItemsRelations = relations(salesOrderItems, ({ one }) => ({
  salesOrder: one(salesOrders, {
    fields: [salesOrderItems.salesOrderId],
    references: [salesOrders.id],
  }),
  product: one(products, {
    fields: [salesOrderItems.productId],
    references: [products.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  customer: one(customers, {
    fields: [invoices.customerId],
    references: [customers.id],
  }),
  salesOrder: one(salesOrders, {
    fields: [invoices.salesOrderId],
    references: [salesOrders.id],
  }),
  items: many(invoiceItems),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceItems.invoiceId],
    references: [invoices.id],
  }),
  product: one(products, {
    fields: [invoiceItems.productId],
    references: [products.id],
  }),
}));

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type NewSalesOrder = typeof salesOrders.$inferInsert;
export type SalesOrderItem = typeof salesOrderItems.$inferSelect;
export type NewSalesOrderItem = typeof salesOrderItems.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceItem = typeof invoiceItems.$inferSelect;
export type NewInvoiceItem = typeof invoiceItems.$inferInsert;
