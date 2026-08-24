import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Users & Administrators table
 */
export const users = sqliteTable('users', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['ADMIN', 'MANAGER', 'STAFF'] }).notNull().default('ADMIN'),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Server-side login sessions backing Authorization: Bearer tokens.
 * Required so API routes can verify who's calling instead of trusting
 * the role a client claims in the request body/localStorage.
 */
export const sessions = sqliteTable('sessions', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  token: text('token').notNull().unique(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

/**
 * Editable role -> module visibility matrix. Drives both the sidebar
 * (which nav items render) and API route access (which endpoints a
 * role's session may call). ADMIN is intentionally not stored here —
 * it always has full access, enforced in code, so the matrix can never
 * be edited into locking out every admin.
 */
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    role: text('role', { enum: ['MANAGER', 'STAFF'] }).notNull(),
    module: text('module', {
      enum: ['dashboard', 'directory', 'inventory', 'purchasing', 'inbound', 'sales', 'outbound', 'accounting', 'payroll'],
    }).notNull(),
    canView: integer('can_view', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('role_permissions_role_module_unique').on(table.role, table.module)]
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
