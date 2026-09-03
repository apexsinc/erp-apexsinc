import { AbilityBuilder, createMongoAbility, type MongoAbility } from '@casl/ability';
import type { Database } from '../db/client';
import * as schema from '../db/schema';
import type { RoleItem } from '../db/schema/auth';

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
  'settings',
] as const;
export type Module = (typeof ALL_MODULES)[number];

export const MODULE_METADATA: Record<
  Module,
  {
    name: string;
    category: 'Operations' | 'Finance & HR' | 'Administration';
    route: string;
    description: string;
  }
> = {
  dashboard: {
    name: 'Dashboard',
    category: 'Operations',
    route: '/dashboard',
    description: 'Executive KPIs, business performance charts, and real-time operational feeds',
  },
  directory: {
    name: 'Business Directory',
    category: 'Operations',
    route: '/directory',
    description: 'Company entities, branches, departments, job titles, customers & vendor accounts',
  },
  inventory: {
    name: 'Inventory & Stock',
    category: 'Operations',
    route: '/inventory',
    description: 'Product master catalog, stock levels, warehouse ledger & inventory adjustments',
  },
  purchasing: {
    name: 'Purchasing (P2P)',
    category: 'Operations',
    route: '/purchasing',
    description: 'Purchase Orders (PO), procurement management & vendor purchase commitments',
  },
  inbound: {
    name: 'Inbound Deliveries',
    category: 'Operations',
    route: '/inbound',
    description: 'Goods Receipt Notes (GRN), shipment receiving & warehouse physical check-in',
  },
  sales: {
    name: 'Sales & Invoicing',
    category: 'Operations',
    route: '/sales',
    description: 'Customer Sales Orders (SO), commercial billing invoices & revenue receipts',
  },
  outbound: {
    name: 'Outbound Deliveries',
    category: 'Operations',
    route: '/outbound',
    description: 'Warehouse dispatch, order shipments, delivery notes & customer fulfillment',
  },
  accounting: {
    name: 'Vouchers',
    category: 'Finance & HR',
    route: '/vouchers',
    description: 'Payment & Receipt Vouchers, General Ledger, Trial Balance & Financial Statements',
  },
  payroll: {
    name: 'Payroll',
    category: 'Finance & HR',
    route: '/payroll',
    description: 'Payroll processing runs, compensation computation, payslips & payment disbursement',
  },
  staff: {
    name: 'Staff & HR',
    category: 'Finance & HR',
    route: '/staff',
    description: 'Employee directory, salary compensation packages & ERP login account management',
  },
  settings: {
    name: 'System Settings',
    category: 'Administration',
    route: '/settings',
    description: 'Company profiles, voucher signatories, default currencies & system configuration',
  },
};

export type Role = string;

export type CrudAction = 'create' | 'read' | 'update' | 'delete';
export type AppAction = 'create' | 'read' | 'update' | 'delete' | 'view';

export interface ModuleCrudPermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

export type RoleCrudMatrix = Record<string, Record<Module, ModuleCrudPermissions>>;

type AppAbility = MongoAbility<[AppAction, Module]>;

/**
 * Default CRUD permissions matrix used to seed role_permissions on first run
 * and as a fallback if rows are missing for standard roles.
 */
export const DEFAULT_CRUD_MATRIX: Record<string, Record<Module, ModuleCrudPermissions>> = {
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
    settings:    { create: false, read: true,  update: true,  delete: false },
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
    settings:    { create: false, read: false, update: false, delete: false },
  },
};

export const DEFAULT_PERMISSION_MATRIX: Record<string, Module[]> = {
  MANAGER: ALL_MODULES.filter((m) => DEFAULT_CRUD_MATRIX.MANAGER[m].read),
  STAFF: ALL_MODULES.filter((m) => DEFAULT_CRUD_MATRIX.STAFF[m].read),
};

/** Standard system roles that are permanently protected from deletion. */
export const SYSTEM_ROLES = [
  {
    id: 'role-admin-sys-0001',
    code: 'ADMIN',
    name: 'System Administrator',
    description: 'Full, unrestricted administrative authority across all modules and settings.',
    isSystem: true,
  },
  {
    id: 'role-manager-sys-0002',
    code: 'MANAGER',
    name: 'Operations Manager',
    description: 'Full CRUD management over daily operations, inventory, sales, purchasing, and staff.',
    isSystem: true,
  },
  {
    id: 'role-staff-sys-0003',
    code: 'STAFF',
    name: 'General Staff',
    description: 'Standard operational access for order processing, deliveries, and fulfillment.',
    isSystem: true,
  },
];

/** ADMIN always has full access across all CRUD actions — enforced in code, never stored/editable. */
export function isAdminRole(role: Role): boolean {
  return (role || '').toUpperCase() === 'ADMIN';
}

export function getFullAdminCrudMap(): Record<Module, ModuleCrudPermissions> {
  const result = {} as Record<Module, ModuleCrudPermissions>;
  for (const mod of ALL_MODULES) {
    result[mod] = { create: true, read: true, update: true, delete: true };
  }
  return result;
}

export function getEmptyCrudMap(): Record<Module, ModuleCrudPermissions> {
  const result = {} as Record<Module, ModuleCrudPermissions>;
  for (const mod of ALL_MODULES) {
    result[mod] = { create: false, read: false, update: false, delete: false };
  }
  return result;
}

/** Loads all defined roles from the database. */
export async function loadAllRoles(db: Database): Promise<RoleItem[]> {
  try {
    return await db.query.roles.findMany({
      orderBy: (roles, { asc }) => [asc(roles.createdAt)],
    });
  } catch (err) {
    // If table not yet queryable, fallback to system roles
    return SYSTEM_ROLES.map((r) => ({
      ...r,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }
}

/** Loads the complete role -> module -> { create, read, update, delete } matrix from the DB. */
export async function loadCrudPermissionMatrix(db: Database): Promise<RoleCrudMatrix> {
  const [allRoles, rows] = await Promise.all([
    loadAllRoles(db),
    db.query.rolePermissions.findMany(),
  ]);

  const matrix: RoleCrudMatrix = {
    ADMIN: getFullAdminCrudMap(),
  };

  const roleCodes = new Set<string>();
  allRoles.forEach((r) => roleCodes.add(r.code));
  rows.forEach((r) => roleCodes.add(r.role));
  roleCodes.add('MANAGER');
  roleCodes.add('STAFF');

  for (const roleCode of roleCodes) {
    if (roleCode === 'ADMIN') continue;

    const modMap = {} as Record<Module, ModuleCrudPermissions>;
    for (const mod of ALL_MODULES) {
      const row = rows.find((r) => r.role === roleCode && r.module === mod);
      if (row) {
        modMap[mod] = {
          create: Boolean(row.canCreate),
          read: Boolean(row.canRead ?? row.canView),
          update: Boolean(row.canUpdate),
          delete: Boolean(row.canDelete),
        };
      } else if (DEFAULT_CRUD_MATRIX[roleCode]?.[mod]) {
        modMap[mod] = DEFAULT_CRUD_MATRIX[roleCode][mod];
      } else {
        modMap[mod] = { create: false, read: false, update: false, delete: false };
      }
    }
    matrix[roleCode] = modMap;
  }

  return matrix;
}

/** Loads the visible module list per role (where read === true) for sidebar and routing. */
export async function loadPermissionMatrix(db: Database): Promise<Record<Role, Module[]>> {
  const crud = await loadCrudPermissionMatrix(db);
  const result: Record<Role, Module[]> = {
    ADMIN: [...ALL_MODULES],
  };

  for (const [roleCode, modMap] of Object.entries(crud)) {
    result[roleCode] = ALL_MODULES.filter((m) => modMap[m]?.read);
  }

  return result;
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

/** Idempotently inserts default roles and default permission rows. */
export async function seedDefaultPermissions(db: Database): Promise<void> {
  // 1. Seed system roles in roles table
  try {
    const existingRoles = await db.query.roles.findMany();
    const existingRoleCodes = new Set(existingRoles.map((r) => r.code));

    const rolesToInsert: schema.NewRoleItem[] = [];
    const now = new Date().toISOString();
    for (const sysRole of SYSTEM_ROLES) {
      if (!existingRoleCodes.has(sysRole.code)) {
        rolesToInsert.push({
          id: sysRole.id,
          code: sysRole.code,
          name: sysRole.name,
          description: sysRole.description,
          isSystem: sysRole.isSystem,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    if (rolesToInsert.length > 0) {
      await db.insert(schema.roles).values(rolesToInsert);
    }
  } catch (err) {
    console.error('Error seeding roles table:', err);
  }

  // 2. Seed default permissions in role_permissions table
  try {
    const existingPerms = await db.query.rolePermissions.findMany();
    const existingKeys = new Set(existingPerms.map((r) => `${r.role}:${r.module}`));

    const permsToInsert: schema.NewRolePermission[] = [];
    const now = new Date().toISOString();
    for (const role of ['MANAGER', 'STAFF']) {
      for (const mod of ALL_MODULES) {
        const key = `${role}:${mod}`;
        if (existingKeys.has(key)) continue;
        const def = DEFAULT_CRUD_MATRIX[role][mod];
        permsToInsert.push({
          id: crypto.randomUUID(),
          role,
          module: mod,
          canView: def.read,
          canRead: def.read,
          canCreate: def.create,
          canUpdate: def.update,
          canDelete: def.delete,
          updatedAt: now,
        });
      }
    }

    if (permsToInsert.length > 0) {
      await db.insert(schema.rolePermissions).values(permsToInsert);
    }
  } catch (err) {
    console.error('Error seeding role_permissions table:', err);
  }
}
