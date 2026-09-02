import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * System Settings Table (Grouped Key-Value configuration)
 * Stores organization metadata, voucher defaults (signatories, prefixes, accounts),
 * lookup taxonomies (payment methods, tags, cost centers), and module policies.
 */
export const systemSettings = sqliteTable('system_settings', {
  key: text('key').primaryKey(), // e.g. 'vouchers.signatories', 'vouchers.tags'
  category: text('category').notNull(), // 'vouchers', 'organization', 'operations', 'payroll'
  value: text('value').notNull(), // JSON string or text payload
  description: text('description'),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedBy: text('updated_by'), // user id / name / email
});

export type SystemSetting = typeof systemSettings.$inferSelect;
export type NewSystemSetting = typeof systemSettings.$inferInsert;
