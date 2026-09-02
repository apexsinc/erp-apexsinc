import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { products } from './inventory';

/**
 * Vendors Master Table
 */
export const vendors = sqliteTable('vendors', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  vendorCode: text('vendor_code').notNull().unique(),
  name: text('name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  taxId: text('tax_id'),
  paymentTermsDays: integer('payment_terms_days').notNull().default(30),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Purchase Orders (P2P Procurement)
 */
export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  poNumber: text('po_number').notNull().unique(),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => vendors.id),
  status: text('status', {
    enum: ['DRAFT', 'APPROVED', 'DELIVERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
  })
    .notNull()
    .default('DRAFT'),
  // One currency per order - every line item is priced in it, so totalAmountCents
  // is always an unambiguous sum (never a mix of USD and PHP cents).
  currency: text('currency', { enum: ['USD', 'PHP'] }).notNull().default('USD'),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  notes: text('notes'),
  issueDate: text('issue_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  expectedDate: text('expected_date'),
  // Set by the Inbound "Mark as Delivered" step, before quantities are confirmed.
  deliveredAt: text('delivered_at'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Purchase Order Line Items
 */
export const purchaseOrderItems = sqliteTable('purchase_order_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  purchaseOrderId: text('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  quantityOrdered: integer('quantity_ordered').notNull(),
  quantityReceived: integer('quantity_received').notNull().default(0),
  unitPriceCents: integer('unit_price_cents').notNull(),
  subtotalCents: integer('subtotal_cents').notNull(),
});

/**
 * Goods Received Notes (GRN)
 * Trigger document for receiving physical inventory against a PO
 */
export const goodsReceivedNotes = sqliteTable('goods_received_notes', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  grnNumber: text('grn_number').notNull().unique(),
  purchaseOrderId: text('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id),
  receivedDate: text('received_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * GRN Line Items
 */
export const goodsReceivedNoteItems = sqliteTable('goods_received_note_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  grnId: text('grn_id')
    .notNull()
    .references(() => goodsReceivedNotes.id, { onDelete: 'cascade' }),
  poItemId: text('po_item_id')
    .notNull()
    .references(() => purchaseOrderItems.id),
  productId: text('product_id')
    .notNull()
    .references(() => products.id),
  quantityReceived: integer('quantity_received').notNull(),
  unitCostCents: integer('unit_cost_cents').notNull(),
});

export const vendorsRelations = relations(vendors, ({ many }) => ({
  purchaseOrders: many(purchaseOrders),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  vendor: one(vendors, {
    fields: [purchaseOrders.vendorId],
    references: [vendors.id],
  }),
  items: many(purchaseOrderItems),
  grns: many(goodsReceivedNotes),
}));

export const purchaseOrderItemsRelations = relations(purchaseOrderItems, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [purchaseOrderItems.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  product: one(products, {
    fields: [purchaseOrderItems.productId],
    references: [products.id],
  }),
}));

export const goodsReceivedNotesRelations = relations(goodsReceivedNotes, ({ one, many }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [goodsReceivedNotes.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  items: many(goodsReceivedNoteItems),
}));

export const goodsReceivedNoteItemsRelations = relations(goodsReceivedNoteItems, ({ one }) => ({
  grn: one(goodsReceivedNotes, {
    fields: [goodsReceivedNoteItems.grnId],
    references: [goodsReceivedNotes.id],
  }),
  poItem: one(purchaseOrderItems, {
    fields: [goodsReceivedNoteItems.poItemId],
    references: [purchaseOrderItems.id],
  }),
  product: one(products, {
    fields: [goodsReceivedNoteItems.productId],
    references: [products.id],
  }),
}));

export type Vendor = typeof vendors.$inferSelect;
export type NewVendor = typeof vendors.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect;
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert;
export type GoodsReceivedNote = typeof goodsReceivedNotes.$inferSelect;
export type NewGoodsReceivedNote = typeof goodsReceivedNotes.$inferInsert;
export type GoodsReceivedNoteItem = typeof goodsReceivedNoteItems.$inferSelect;
export type NewGoodsReceivedNoteItem = typeof goodsReceivedNoteItems.$inferInsert;
