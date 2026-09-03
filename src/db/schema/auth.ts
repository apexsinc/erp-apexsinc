import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

/**
 * Roles & Permission Groups table
 * Defines system and custom roles with display names, descriptions, and system flags.
 */
export const roles = sqliteTable('roles', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export type RoleItem = typeof roles.$inferSelect;
export type NewRoleItem = typeof roles.$inferInsert;

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
  role: text('role').notNull().default('STAFF'),
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
 * Dynamic role -> module CRUD permission matrix. Drives sidebar visibility,
 * UI action rendering, and server-side route authorization.
 */
export const rolePermissions = sqliteTable(
  'role_permissions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    role: text('role').notNull(),
    module: text('module', {
      enum: ['dashboard', 'directory', 'inventory', 'purchasing', 'inbound', 'sales', 'outbound', 'vouchers', 'accounting', 'payroll', 'staff', 'settings'],
    }).notNull(),
    canView: integer('can_view', { mode: 'boolean' }).notNull().default(false),
    canCreate: integer('can_create', { mode: 'boolean' }).notNull().default(false),
    canRead: integer('can_read', { mode: 'boolean' }).notNull().default(false),
    canUpdate: integer('can_update', { mode: 'boolean' }).notNull().default(false),
    canDelete: integer('can_delete', { mode: 'boolean' }).notNull().default(false),
    updatedAt: text('updated_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('role_permissions_role_module_unique').on(table.role, table.module)]
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
