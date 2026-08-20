import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { customers, invoices } from './sales';

/**
 * Chart of Accounts (Double-Entry Accounting Foundation)
 */
export const accounts = sqliteTable('accounts', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(), // e.g. '1010' for Cash, '1200' for Inventory
  name: text('name').notNull(),
  type: text('type', {
    enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'],
  }).notNull(),
  description: text('description'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Payment Vouchers (Vendor disbursements, Payroll payouts, Expenses)
 */
export const paymentVouchers = sqliteTable('payment_vouchers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  voucherNumber: text('voucher_number').notNull().unique(),
  voucherDate: text('voucher_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  recipientType: text('recipient_type', {
    enum: ['VENDOR', 'EMPLOYEE', 'OTHER'],
  }).notNull(),
  recipientId: text('recipient_id'),
  amountCents: integer('amount_cents').notNull(),
  paymentMethod: text('payment_method', {
    enum: ['BANK_TRANSFER', 'CHECK', 'CASH', 'CREDIT_CARD'],
  })
    .notNull()
    .default('BANK_TRANSFER'),
  referenceType: text('reference_type', {
    enum: ['PURCHASE_ORDER', 'PAYROLL_RUN', 'EXPENSE', 'MANUAL'],
  }).notNull(),
  referenceId: text('reference_id'),
  notes: text('notes'),
  status: text('status', {
    enum: ['DRAFT', 'POSTED', 'VOID'],
  })
    .notNull()
    .default('POSTED'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Receipt Vouchers (Customer incoming payments)
 */
export const receiptVouchers = sqliteTable('receipt_vouchers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  voucherNumber: text('voucher_number').notNull().unique(),
  voucherDate: text('voucher_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  customerId: text('customer_id').references(() => customers.id),
  invoiceId: text('invoice_id').references(() => invoices.id),
  amountCents: integer('amount_cents').notNull(),
  paymentMethod: text('payment_method', {
    enum: ['BANK_TRANSFER', 'CHECK', 'CASH', 'CREDIT_CARD', 'ONLINE'],
  })
    .notNull()
    .default('BANK_TRANSFER'),
  notes: text('notes'),
  status: text('status', {
    enum: ['DRAFT', 'POSTED', 'VOID'],
  })
    .notNull()
    .default('POSTED'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Journal Vouchers (General Double-Entry Journal)
 */
export const journalVouchers = sqliteTable('journal_vouchers', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  jvNumber: text('jv_number').notNull().unique(),
  voucherDate: text('voucher_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  description: text('description').notNull(),
  referenceType: text('reference_type'),
  referenceId: text('reference_id'),
  status: text('status', {
    enum: ['DRAFT', 'POSTED', 'VOID'],
  })
    .notNull()
    .default('POSTED'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * General Journal Ledger Entries
 * Every financial transaction produces debits and credits that MUST balance
 */
export const journalEntries = sqliteTable('journal_entries', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  voucherType: text('voucher_type', {
    enum: ['PAYMENT', 'RECEIPT', 'JOURNAL'],
  }).notNull(),
  voucherId: text('voucher_id').notNull(),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id),
  debitCents: integer('debit_cents').notNull().default(0),
  creditCents: integer('credit_cents').notNull().default(0),
  description: text('description'),
  entryDate: text('entry_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const accountsRelations = relations(accounts, ({ many }) => ({
  journalEntries: many(journalEntries),
}));

export const paymentVouchersRelations = relations(paymentVouchers, ({ many }) => ({
  entries: many(journalEntries),
}));

export const receiptVouchersRelations = relations(receiptVouchers, ({ one, many }) => ({
  customer: one(customers, {
    fields: [receiptVouchers.customerId],
    references: [customers.id],
  }),
  invoice: one(invoices, {
    fields: [receiptVouchers.invoiceId],
    references: [invoices.id],
  }),
  entries: many(journalEntries),
}));

export const journalVouchersRelations = relations(journalVouchers, ({ many }) => ({
  entries: many(journalEntries),
}));

export const journalEntriesRelations = relations(journalEntries, ({ one }) => ({
  account: one(accounts, {
    fields: [journalEntries.accountId],
    references: [accounts.id],
  }),
}));

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type PaymentVoucher = typeof paymentVouchers.$inferSelect;
export type NewPaymentVoucher = typeof paymentVouchers.$inferInsert;
export type ReceiptVoucher = typeof receiptVouchers.$inferSelect;
export type NewReceiptVoucher = typeof receiptVouchers.$inferInsert;
export type JournalVoucher = typeof journalVouchers.$inferSelect;
export type NewJournalVoucher = typeof journalVouchers.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
