import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { products } from './inventory';
import { salesOrders, salesOrderItems, invoices } from './sales';

/**
 * Delivery Receipts (DR) — the record of goods actually handed to the
 * customer. Issuing one is what decrements inventory (see stockMovements
 * with referenceType 'SO_DELIVERY'); invoicing is a separate, later step
 * against a DR, not part of confirming the delivery itself.
 */
export const deliveryReceipts = sqliteTable('delivery_receipts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  drNumber: text('dr_number').notNull().unique(),
  salesOrderId: text('sales_order_id')
    .notNull()
    .references(() => salesOrders.id),
  // Null until an invoice is issued for this DR from the Sales tab.
  invoiceId: text('invoice_id').references(() => invoices.id),
  receivedBy: text('received_by'),
  notes: text('notes'),
  deliveredAt: text('delivered_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Delivery Receipt Line Items
 */
export const deliveryReceiptItems = sqliteTable('delivery_receipt_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  deliveryReceiptId: text('delivery_receipt_id')
    .notNull()
    .references(() => deliveryReceipts.id, { onDelete: 'cascade' }),
  salesOrderItemId: text('sales_order_item_id')
    .notNull()
    .references(() => salesOrderItems.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  quantity: integer('quantity').notNull(),
  unitPriceCents: integer('unit_price_cents').notNull(),
});

export const deliveryReceiptsRelations = relations(deliveryReceipts, ({ one, many }) => ({
  salesOrder: one(salesOrders, {
    fields: [deliveryReceipts.salesOrderId],
    references: [salesOrders.id],
  }),
  invoice: one(invoices, {
    fields: [deliveryReceipts.invoiceId],
    references: [invoices.id],
  }),
  items: many(deliveryReceiptItems),
}));

export const deliveryReceiptItemsRelations = relations(deliveryReceiptItems, ({ one }) => ({
  deliveryReceipt: one(deliveryReceipts, {
    fields: [deliveryReceiptItems.deliveryReceiptId],
    references: [deliveryReceipts.id],
  }),
  salesOrderItem: one(salesOrderItems, {
    fields: [deliveryReceiptItems.salesOrderItemId],
    references: [salesOrderItems.id],
  }),
  product: one(products, {
    fields: [deliveryReceiptItems.productId],
    references: [products.id],
  }),
}));

export type DeliveryReceipt = typeof deliveryReceipts.$inferSelect;
export type NewDeliveryReceipt = typeof deliveryReceipts.$inferInsert;
export type DeliveryReceiptItem = typeof deliveryReceiptItems.$inferSelect;
export type NewDeliveryReceiptItem = typeof deliveryReceiptItems.$inferInsert;
