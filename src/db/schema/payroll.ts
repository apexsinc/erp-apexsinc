import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { paymentVouchers } from './vouchers';

/**
 * Employees Master Table
 */
export const employees = sqliteTable('employees', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  employeeCode: text('employee_code').notNull().unique(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone'),
  department: text('department').notNull(),
  position: text('position').notNull(),
  status: text('status', {
    enum: ['ACTIVE', 'ON_LEAVE', 'TERMINATED'],
  })
    .notNull()
    .default('ACTIVE'),
  hireDate: text('hire_date').notNull(),
  bankAccountNumber: text('bank_account_number'),
  bankName: text('bank_name'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Salary Structures
 * Defines the current compensation rules per employee
 */
export const salaryStructures = sqliteTable('salary_structures', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id, { onDelete: 'cascade' }),
  baseSalaryCents: integer('base_salary_cents').notNull(),
  allowancesCents: integer('allowances_cents').notNull().default(0),
  deductionsCents: integer('deductions_cents').notNull().default(0),
  netSalaryCents: integer('net_salary_cents').notNull(),
  effectiveDate: text('effective_date')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Payroll Runs (Batch processing for pay periods)
 */
export const payrollRuns = sqliteTable('payroll_runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  runNumber: text('run_number').notNull().unique(),
  periodStartDate: text('period_start_date').notNull(),
  periodEndDate: text('period_end_date').notNull(),
  status: text('status', {
    enum: ['DRAFT', 'CALCULATED', 'FINALIZED', 'PAID'],
  })
    .notNull()
    .default('DRAFT'),
  totalGrossCents: integer('total_gross_cents').notNull().default(0),
  totalDeductionsCents: integer('total_deductions_cents').notNull().default(0),
  totalNetCents: integer('total_net_cents').notNull().default(0),
  paymentVoucherId: text('payment_voucher_id').references(() => paymentVouchers.id),
  finalizedAt: text('finalized_at'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
  updatedAt: text('updated_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

/**
 * Payslips (Individual payroll receipts)
 */
export const payslips = sqliteTable('payslips', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  payrollRunId: text('payroll_run_id')
    .notNull()
    .references(() => payrollRuns.id, { onDelete: 'cascade' }),
  employeeId: text('employee_id')
    .notNull()
    .references(() => employees.id),
  baseSalaryCents: integer('base_salary_cents').notNull(),
  allowancesCents: integer('allowances_cents').notNull().default(0),
  deductionsCents: integer('deductions_cents').notNull().default(0),
  netSalaryCents: integer('net_salary_cents').notNull(),
  status: text('status', {
    enum: ['GENERATED', 'PAID'],
  })
    .notNull()
    .default('GENERATED'),
  createdAt: text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString()),
});

export const employeesRelations = relations(employees, ({ many }) => ({
  salaryStructures: many(salaryStructures),
  payslips: many(payslips),
}));

export const salaryStructuresRelations = relations(salaryStructures, ({ one }) => ({
  employee: one(employees, {
    fields: [salaryStructures.employeeId],
    references: [employees.id],
  }),
}));

export const payrollRunsRelations = relations(payrollRuns, ({ one, many }) => ({
  paymentVoucher: one(paymentVouchers, {
    fields: [payrollRuns.paymentVoucherId],
    references: [paymentVouchers.id],
  }),
  payslips: many(payslips),
}));

export const payslipsRelations = relations(payslips, ({ one }) => ({
  payrollRun: one(payrollRuns, {
    fields: [payslips.payrollRunId],
    references: [payrollRuns.id],
  }),
  employee: one(employees, {
    fields: [payslips.employeeId],
    references: [employees.id],
  }),
}));

export type Employee = typeof employees.$inferSelect;
export type NewEmployee = typeof employees.$inferInsert;
export type SalaryStructure = typeof salaryStructures.$inferSelect;
export type NewSalaryStructure = typeof salaryStructures.$inferInsert;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type NewPayrollRun = typeof payrollRuns.$inferInsert;
export type Payslip = typeof payslips.$inferSelect;
export type NewPayslip = typeof payslips.$inferInsert;
