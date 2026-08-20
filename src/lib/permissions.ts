import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { Database } from '../db/client';
import * as schema from '../db/schema';
import type { User } from '../db/schema/auth';

/**
 * Sidebar modules gated by role. Keys match the `data-tab` values
 * used by the sidebar nav items and the client-side tab router.
 */
export const ALL_MODULES = ['dashboard', 'inventory', 'purchasing', 'sales', 'accounting', 'payroll'] as const;
export type Module = (typeof ALL_MODULES)[number];

export type Role = User['role'];
/** Roles whose access is editable via the role_permissions table (everyone except ADMIN). */
export type EditableRole = 'MANAGER' | 'STAFF';

type Actions = 'view';
type AppAbility = MongoAbility<[Actions, Module]>;

/**
 * Defaults used to seed role_permissions on first run and as a fallback
 * if a (role, module) row hasn't been created yet. Mirrors sensible ERP
 * defaults: MANAGER runs day-to-day ops but not payroll/ledger, STAFF is
 * further restricted to order fulfillment modules.
 */
export const DEFAULT_PERMISSION_MATRIX: Record<EditableRole, Module[]> = {
  MANAGER: ['dashboard', 'inventory', 'purchasing', 'sales'],
  STAFF: ['dashboard', 'inventory', 'sales'],
};

/** ADMIN always has full access — enforced in code, never stored/editable, so the matrix can't be edited into locking out every admin. */
export function isAdminRole(role: Role): boolean {
  return role === 'ADMIN';
}

function buildAbility(role: Role, grantedModules: Module[]): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);
  if (isAdminRole(role)) {
    can('view', ALL_MODULES as unknown as Module[]);
  } else {
    can('view', grantedModules);
  }
  return build();
}

/** Loads the full editable-role permission matrix from the DB, seeding defaults for any missing rows. */
export async function loadPermissionMatrix(db: Database): Promise<Record<Role, Module[]>> {
  const rows = await db.query.rolePermissions.findMany();

  const matrix: Record<EditableRole, Module[]> = { MANAGER: [], STAFF: [] };
  for (const role of Object.keys(matrix) as EditableRole[]) {
    const roleRows = rows.filter((r) => r.role === role);
    if (roleRows.length === 0) {
      // Not seeded yet — fall back to defaults rather than denying everything.
      matrix[role] = DEFAULT_PERMISSION_MATRIX[role];
    } else {
      matrix[role] = roleRows.filter((r) => r.canView).map((r) => r.module as Module);
    }
  }

  return {
    ADMIN: [...ALL_MODULES],
    MANAGER: matrix.MANAGER,
    STAFF: matrix.STAFF,
  };
}

export async function getVisibleModules(db: Database, role: Role): Promise<Module[]> {
  const matrix = await loadPermissionMatrix(db);
  return matrix[role] ?? [];
}

export async function canViewModule(db: Database, role: Role, mod: Module): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const matrix = await loadPermissionMatrix(db);
  const ability = buildAbility(role, matrix[role] ?? []);
  return ability.can('view', mod);
}

/** Idempotently inserts default rows for any (role, module) pair not yet present. */
export async function seedDefaultPermissions(db: Database): Promise<void> {
  const existing = await db.query.rolePermissions.findMany();
  const existingKeys = new Set(existing.map((r) => `${r.role}:${r.module}`));

  const toInsert: schema.NewRolePermission[] = [];
  for (const role of Object.keys(DEFAULT_PERMISSION_MATRIX) as EditableRole[]) {
    for (const mod of ALL_MODULES) {
      const key = `${role}:${mod}`;
      if (existingKeys.has(key)) continue;
      toInsert.push({
        id: crypto.randomUUID(),
        role,
        module: mod,
        canView: DEFAULT_PERMISSION_MATRIX[role].includes(mod),
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(schema.rolePermissions).values(toInsert);
  }
}
