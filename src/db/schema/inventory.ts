import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Products master table
 * All monetary fields are in integer cents (e.g. $19.99 -> 1999)
 */
export const products = sqliteTable('products', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  unitOfMeasure: text('unit_of_measure').notNull().default('unit'),
  costPriceCents: integer('cost_price_cents').notNull().default(0),
  costPriceCurrency: text('cost_price_currency', { enum: ['USD', 'PHP'] }).notNull().default('PHP'),
  // Set separately from the Business Directory's Price List — not collected at product creation.
  sellingPriceCents: integer('selling_price_cents').notNull().default(0),
  sellingPriceCurrency: text('selling_price_currency', { enum: ['USD', 'PHP'] }).notNull().default('USD'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Double-entry Stock Ledger / Movement Audit Table
 * Tracks all inventory additions, subtractions, and adjustments
 */
export const stockMovements = sqliteTable('stock_movements', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  type: text('type', { enum: ['IN', 'OUT', 'ADJUST'] }).notNull(),
  quantity: integer('quantity').notNull(), // Absolute quantity moved or adjustment delta
  unitCostCents: integer('unit_cost_cents').notNull().default(0),
  referenceType: text('reference_type', {
    enum: ['INITIAL', 'PO_RECEIPT', 'SO_DELIVERY', 'ADJUSTMENT', 'RETURN', 'SCRAP'],
  }).notNull(),
  referenceId: text('reference_id'),
  notes: text('notes'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const productsRelations = relations(products, ({ many }) => ({
  stockMovements: many(stockMovements),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  product: one(products, {
    fields: [stockMovements.productId],
    references: [products.id],
  }),
}));

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type StockMovement = typeof stockMovements.$inferSelect;
export type NewStockMovement = typeof stockMovements.$inferInsert;
