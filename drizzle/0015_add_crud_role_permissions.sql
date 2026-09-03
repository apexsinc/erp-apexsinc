ALTER TABLE role_permissions ADD COLUMN can_create INTEGER NOT NULL DEFAULT 0;
ALTER TABLE role_permissions ADD COLUMN can_read INTEGER NOT NULL DEFAULT 0;
ALTER TABLE role_permissions ADD COLUMN can_update INTEGER NOT NULL DEFAULT 0;
ALTER TABLE role_permissions ADD COLUMN can_delete INTEGER NOT NULL DEFAULT 0;

-- Backfill can_read from existing can_view
UPDATE role_permissions SET can_read = can_view;

-- Manager defaults: Full CRUD on operational modules, CRU on master data, no delete on accounting/payroll
UPDATE role_permissions SET can_create = 1 WHERE can_view = 1 AND role = 'MANAGER' AND module NOT IN ('dashboard');
UPDATE role_permissions SET can_update = 1 WHERE can_view = 1 AND role = 'MANAGER' AND module NOT IN ('dashboard');
UPDATE role_permissions SET can_delete = 1 WHERE can_view = 1 AND role = 'MANAGER' AND module IN ('directory', 'inventory', 'purchasing', 'inbound', 'sales', 'outbound', 'staff');

-- Staff defaults: CRU on order processing/warehouse, Read-only on directory & inventory, No access on accounting/payroll/staff
UPDATE role_permissions SET can_create = 1 WHERE can_view = 1 AND role = 'STAFF' AND module IN ('inbound', 'sales', 'outbound');
UPDATE role_permissions SET can_update = 1 WHERE can_view = 1 AND role = 'STAFF' AND module IN ('inbound', 'sales', 'outbound');
UPDATE role_permissions SET can_delete = 0 WHERE role = 'STAFF';
