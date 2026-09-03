import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { Database } from '../db/client';
import * as schema from '../db/schema';
import type { User } from '../db/schema/auth';

/**
 * Sidebar modules gated by role. Keys match the `data-tab` values
 * used by the sidebar nav items and the client-side tab router.
 */
export const ALL_MODULES = [
  'dashboard',
  'directory',
  'inventory',
  'purchasing',
  'inbound',
  'sales',
  'outbound',
  'accounting',
  'payroll',
  'staff',
] as const;
export type Module = (typeof ALL_MODULES)[number];

export type Role = User['role'];
/** Roles whose access is editable via the role_permissions table (everyone except ADMIN). */
export type EditableRole = 'MANAGER' | 'STAFF';

export type CrudAction = 'create' | 'read' | 'update' | 'delete';
export type AppAction = 'create' | 'read' | 'update' | 'delete' | 'view';

export interface ModuleCrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export type RoleCrudMatrix = Record<Role, Record<Module, ModuleCrudPermissions>>;

type AppAbility = MongoAbility<[AppAction, Module]>;

/**
 * Default CRUD permissions matrix used to seed role_permissions on first run
 * and as a fallback if rows are missing.
 */
export const DEFAULT_CRUD_MATRIX: Record<EditableRole, Record<Module, ModuleCrudPermissions>> = {
  MANAGER: {
    dashboard:   { create: false, read: true,  update: false, delete: false },
    directory:   { create: true,  read: true,  update: true,  delete: true  },
    inventory:   { create: true,  read: true,  update: true,  delete: true  },
    purchasing:  { create: true,  read: true,  update: true,  delete: true  },
    inbound:     { create: true,  read: true,  update: true,  delete: true  },
    sales:       { create: true,  read: true,  update: true,  delete: true  },
    outbound:    { create: true,  read: true,  update: true,  delete: true  },
    accounting:  { create: true,  read: true,  update: true,  delete: false },
    payroll:     { create: true,  read: true,  update: true,  delete: false },
    staff:       { create: true,  read: true,  update: true,  delete: true  },
  },
  STAFF: {
    dashboard:   { create: false, read: true,  update: false, delete: false },
    directory:   { create: false, read: true,  update: false, delete: false },
    inventory:   { create: false, read: true,  update: false, delete: false },
    purchasing:  { create: false, read: false, update: false, delete: false },
    inbound:     { create: true,  read: true,  update: true,  delete: false },
    sales:       { create: true,  read: true,  update: true,  delete: false },
    outbound:    { create: true,  read: true,  update: true,  delete: false },
    accounting:  { create: false, read: false, update: false, delete: false },
    payroll:     { create: false, read: false, update: false, delete: false },
    staff:       { create: false, read: false, update: false, delete: false },
  },
};

export const DEFAULT_PERMISSION_MATRIX: Record<EditableRole, Module[]> = {
  MANAGER: ALL_MODULES.filter((m) => DEFAULT_CRUD_MATRIX.MANAGER[m].read),
  STAFF: ALL_MODULES.filter((m) => DEFAULT_CRUD_MATRIX.STAFF[m].read),
};

/** ADMIN always has full access across all CRUD actions — enforced in code, never stored/editable. */
export function isAdminRole(role: Role): boolean {
  return role === 'ADMIN';
}

export function getFullAdminCrudMap(): Record<Module, ModuleCrudPermissions> {
  const result = {} as Record<Module, ModuleCrudPermissions>;
  for (const mod of ALL_MODULES) {
    result[mod] = { create: true, read: true, update: true, delete: true };
  }
  return result;
}

/** Loads the complete role -> module -> { create, read, update, delete } matrix from the DB. */
export async function loadCrudPermissionMatrix(db: Database): Promise<RoleCrudMatrix> {
  const rows = await db.query.rolePermissions.findMany();

  const managerMap = {} as Record<Module, ModuleCrudPermissions>;
  const staffMap = {} as Record<Module, ModuleCrudPermissions>;

  for (const mod of ALL_MODULES) {
    const mgrRow = rows.find((r) => r.role === 'MANAGER' && r.module === mod);
    if (mgrRow) {
      managerMap[mod] = {
        create: Boolean(mgrRow.canCreate),
        read: Boolean(mgrRow.canRead ?? mgrRow.canView),
        update: Boolean(mgrRow.canUpdate),
        delete: Boolean(mgrRow.canDelete),
      };
    } else {
      managerMap[mod] = DEFAULT_CRUD_MATRIX.MANAGER[mod];
    }

    const staffRow = rows.find((r) => r.role === 'STAFF' && r.module === mod);
    if (staffRow) {
      staffMap[mod] = {
        create: Boolean(staffRow.canCreate),
        read: Boolean(staffRow.canRead ?? staffRow.canView),
        update: Boolean(staffRow.canUpdate),
        delete: Boolean(staffRow.canDelete),
      };
    } else {
      staffMap[mod] = DEFAULT_CRUD_MATRIX.STAFF[mod];
    }
  }

  return {
    ADMIN: getFullAdminCrudMap(),
    MANAGER: managerMap,
    STAFF: staffMap,
  };
}

/** Loads the visible module list per role (where read === true) for sidebar and routing. */
export async function loadPermissionMatrix(db: Database): Promise<Record<Role, Module[]>> {
  const crud = await loadCrudPermissionMatrix(db);
  return {
    ADMIN: [...ALL_MODULES],
    MANAGER: ALL_MODULES.filter((m) => crud.MANAGER[m]?.read),
    STAFF: ALL_MODULES.filter((m) => crud.STAFF[m]?.read),
  };
}

export async function getVisibleModules(db: Database, role: Role): Promise<Module[]> {
  const matrix = await loadPermissionMatrix(db);
  return matrix[role] ?? [];
}

export async function canViewModule(db: Database, role: Role, mod: Module): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const crud = await loadCrudPermissionMatrix(db);
  return Boolean(crud[role]?.[mod]?.read);
}

export async function canPerformAction(
  db: Database,
  role: Role,
  mod: Module,
  action: CrudAction
): Promise<boolean> {
  if (isAdminRole(role)) return true;
  const crud = await loadCrudPermissionMatrix(db);
  return Boolean(crud[role]?.[mod]?.[action]);
}

/** Idempotently inserts default rows for any (role, module) pair not yet present. */
export async function seedDefaultPermissions(db: Database): Promise<void> {
  const existing = await db.query.rolePermissions.findMany();
  const existingKeys = new Set(existing.map((r) => `${r.role}:${r.module}`));

  const toInsert: schema.NewRolePermission[] = [];
  for (const role of ['MANAGER', 'STAFF'] as EditableRole[]) {
    for (const mod of ALL_MODULES) {
      const key = `${role}:${mod}`;
      if (existingKeys.has(key)) continue;
      const def = DEFAULT_CRUD_MATRIX[role][mod];
      toInsert.push({
        id: crypto.randomUUID(),
        role,
        module: mod,
        canView: def.read,
        canRead: def.read,
        canCreate: def.create,
        canUpdate: def.update,
        canDelete: def.delete,
      });
    }
  }

  if (toInsert.length > 0) {
    await db.insert(schema.rolePermissions).values(toInsert);
  }
}
