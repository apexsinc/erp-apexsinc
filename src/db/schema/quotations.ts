import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { customers, salesOrders } from './sales';
import { products } from './inventory';

/**
 * Quotations Master Table
 * Stores formal price quotations issued to clients/customers.
 */
export const quotations = sqliteTable('quotations', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quoteNumber: text('quote_number').notNull().unique(), // e.g. '26-APX000450'
  customerId: text('customer_id')
    .notNull()
    .references(() => customers.id),
  status: text('status', {
    enum: ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'CONVERTED', 'EXPIRED'],
  })
    .notNull()
    .default('DRAFT'),
  currency: text('currency', { enum: ['USD', 'PHP'] }).notNull().default('PHP'),
  totalAmountCents: integer('total_amount_cents').notNull().default(0),
  quoteDate: text('quote_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString().slice(0, 10)),
  validUntil: text('valid_until'),
  paymentTerms: text('payment_terms').notNull().default('100% Advance Payment'),
  bankInfo: text('bank_info'), // JSON or structured account details
  authorizedSignatoryName: text('authorized_signatory_name').notNull().default('Jeneviev Manatad'),
  authorizedSignatoryTitle: text('authorized_signatory_title').notNull().default('General Manager'),
  signatureImageData: text('signature_image_data'),
  notes: text('notes'),
  salesOrderId: text('sales_order_id').references(() => salesOrders.id, { onDelete: 'set null' }),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Quotation Line Items Table
 */
export const quotationItems = sqliteTable('quotation_items', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  quotationId: text('quotation_id')
    .notNull()
    .references(() => quotations.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => products.id),
  partNumber: text('part_number'),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  subtotalCents: integer('subtotal_cents').notNull().default(0),
  notes: text('notes'),
});

export const quotationsRelations = relations(quotations, ({ one, many }) => ({
  customer: one(customers, {
    fields: [quotations.customerId],
    references: [customers.id],
  }),
  salesOrder: one(salesOrders, {
    fields: [quotations.salesOrderId],
    references: [salesOrders.id],
  }),
  items: many(quotationItems),
}));

export const quotationItemsRelations = relations(quotationItems, ({ one }) => ({
  quotation: one(quotations, {
    fields: [quotationItems.quotationId],
    references: [quotations.id],
  }),
  product: one(products, {
    fields: [quotationItems.productId],
    references: [products.id],
  }),
}));

export type Quotation = typeof quotations.$inferSelect;
export type NewQuotation = typeof quotations.$inferInsert;
export type QuotationItem = typeof quotationItems.$inferSelect;
export type NewQuotationItem = typeof quotationItems.$inferInsert;
