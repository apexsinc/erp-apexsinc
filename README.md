# Apexs ERP — Enterprise Business Management System

A serverless, edge-native Enterprise Resource Planning (ERP) and business operations platform built specifically for **Apexs Inc.** Powered by **Cloudflare Workers**, **Hono**, **Drizzle ORM**, and **Cloudflare D1** (distributed SQLite at the edge).

[![Production Deployment](https://img.shields.io/badge/Production-app.apexsinc.com-blue?style=for-the-badge&logo=cloudflare)](https://app.apexsinc.com)
[![Runtime](https://img.shields.io/badge/Runtime-Cloudflare%20Workers-orange?style=for-the-badge&logo=cloudflareworkers)](https://workers.cloudflare.com/)
[![Framework](https://img.shields.io/badge/Framework-Hono%20v4-E36002?style=for-the-badge&logo=hono)](https://hono.dev/)
[![Database](https://img.shields.io/badge/Database-Cloudflare%20D1%20%2B%20Drizzle-5C2D91?style=for-the-badge&logo=sqlite)](https://orm.drizzle.team/)
[![Security](https://img.shields.io/badge/Bot%20Protection-Cloudflare%20Turnstile-black?style=for-the-badge&logo=cloudflare)](https://www.cloudflare.com/products/turnstile/)

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture & Tech Stack](#-architecture--tech-stack)
- [Core Business Modules](#-core-business-modules)
- [Database & Schema Architecture](#-database--schema-architecture)
- [Role-Based Access Control (RBAC) & Permissions](#-role-based-access-control-rbac--permissions)
- [Repository Directory Structure](#-repository-directory-structure)
- [Getting Started & Local Development](#-getting-started--local-development)
- [Database Migrations](#-database-migrations)
- [Deployment](#-deployment)
- [Batch Scripts & Utilities](#-batch-scripts--utilities)
- [Environment Configuration](#-environment-configuration)

---

## 🌟 Overview

Apexs ERP provides an integrated, real-time operating system for wholesale, procurement, inventory management, multi-currency corporate disbursements, financial accounting, and payroll:

- **100% Serverless Edge Architecture**: Deployed across 300+ Cloudflare global data centers with sub-30ms cold-start response times.
- **Unified Single-File Distribution**: Frontend UI and backend REST API are served together directly from the Cloudflare Worker, requiring zero separate frontend hosting (no Vercel, Netlify, or S3 needed).
- **Responsive Mobile & Desktop Experience**: Features a responsive design system, collapsible off-canvas drawer navigation, and automatic table-to-card cascading wrap mode on mobile devices.
- **Audit-Ready Double-Entry Accounting**: Real-time General Ledger postings for disbursements, receipts, journal entries, and automated financial statements (Profit & Loss, Balance Sheet, Cash Flow).
- **Hardened Authentication**: PBKDF2 SHA-256 password hashing with legacy migration awareness, session tokens with automatic timeout handling, and Cloudflare Turnstile anti-bot verification.

---

## 🛠 Architecture & Tech Stack

| Layer | Technology | Description |
| :--- | :--- | :--- |
| **Compute / Edge** | [Cloudflare Workers](https://workers.cloudflare.com/) | Edge-native JavaScript execution with `nodejs_compat` enabled |
| **HTTP Engine** | [Hono v4](https://hono.dev/) | High-performance, lightweight TypeScript web framework for edge runtimes |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) | Distributed, serverless SQL database powered by SQLite |
| **ORM & Migrations** | [Drizzle ORM](https://orm.drizzle.team/) & `drizzle-kit` | Type-safe schema definition, relational querying, and migration management |
| **Validation** | [Zod](https://zod.dev/) & `@hono/zod-validator` | Strict runtime request body and query parameter validation |
| **Access Control** | [@casl/ability](https://casl.js.org/) + Custom CRUD Matrix | Granular role- and user-level CRUD permission rules |
| **Bot Protection** | [Cloudflare Turnstile](https://www.cloudflare.com/products/turnstile/) | Privacy-preserving CAPTCHA replacement on authentication |
| **Frontend UI** | TypeScript / CSS Custom Properties | Edge-rendered SPA with live reactive state, modal system, and toast notifications |
| **Document Export** | `html2pdf.js` & `jszip` | In-browser client-side PDF voucher slip generation and bulk ZIP downloads |

---

## 📦 Core Business Modules

### 1. Executive Dashboard (`/dashboard`)
- High-level KPIs: Total Revenue, Total Disbursements (YTD), Active PO commitments, Current Inventory Valuation, and Pending Approvals.
- Currency breakdowns (e.g. PHP `₱` and USD `$`).
- Real-time operational activity log feed.

### 2. Business Directory (`/directory`)
- **Corporate Entities**: Management of operating companies, branches, departments, and job titles.
- **Trading Partners**: Customer database and vendor master records with tax IDs, payment terms, contact details, and credit limits.

### 3. Inventory & Warehouse (`/inventory`)
- Master product catalog with SKU, barcode, unit of measure, category classification, and reorder thresholds.
- Real-time stock balance tracking across locations.
- Inventory movement audit trail (`INBOUND`, `OUTBOUND`, `ADJUSTMENT`, `RETURN`).

### 4. Procure-to-Pay / Purchasing (`/purchasing`)
- Vendor Purchase Order (PO) creation with itemized pricing, discounts, and currency selection.
- Multi-state lifecycle: `DRAFT` → `SUBMITTED` → `APPROVED` → `PARTIALLY_RECEIVED` → `COMPLETED` → `CANCELLED`.
- Direct conversion into Inbound Deliveries upon shipment receipt.

### 5. Inbound Deliveries (`/inbound`)
- Goods Receipt Notes (GRN) for physical shipment intake against Purchase Orders.
- Quantity verification (ordered vs. received) with automatic stock increment in the warehouse ledger.

### 6. Sales & Invoicing (`/sales`)
- Customer Sales Orders (SO) and commercial tax invoicing.
- Line-item order processing, customer terms, order approval, and fulfillment pipelines.
- Payment status tracking (`UNPAID`, `PARTIALLY_PAID`, `PAID`).

### 7. Delivery Receipts & Outbound (`/outbound`)
- Warehouse dispatch staging and official Delivery Receipts (DR).
- Automatic inventory stock deduction and cost-of-goods-sold calculation upon confirmed customer receipt.

### 8. Payment Vouchers & Corporate Disbursements (`/vouchers`)
- Official company payment vouchers with multi-item expense breakdowns.
- Tag and category allocation (Utilities, Logistics & Freight, Payroll & Wages, Medical, Office Supplies & IT, Travel).
- Complete 4-tier approval pipeline: **Prepared By**, **Certified By**, **Approved By**, and **Received By**.
- Interactive features:
  - In-browser PDF voucher slip generation with corporate header and signature lines.
  - Bulk ZIP export containing individual PDFs.
  - CSV export and import utilities.
  - Responsive **Auto / Table / Wrap Cards** view modes with zero horizontal scrolling on mobile.
  - Progressive **Load More & Infinite Scrolling** for large annual datasets, maintaining fast rendering and low DOM overhead.

### 9. Accounting & Financial Reports (`/accounting`)
- **Voucher Sub-Ledgers**:
  - Receipt Vouchers (RV): Inflow recording and customer collections.
  - Journal Vouchers (JV): Non-cash adjusting and closing journal entries.
  - Voided Voucher Audit Trail: Full immutable history of cancelled or declined transactions.
- **Chart of Accounts (COA)**: Standardized accounting codes (Assets `1000s`, Liabilities `2000s`, Equity `3000s`, Revenue `4000s`, Expenses `5000s`).
- **General Ledger Audit**: Double-entry ledger with debit/credit balance verification.
- **Financial Statements**:
  - Profit & Loss Statement (P&L) with revenue, COGS, gross margin, and operating expenses.
  - Balance Sheet (BS) reflecting assets, liabilities, and retained equity.
  - Cash Flow Statement (CF) tracking operating, investing, and financing flows.

### 10. Payroll & Compensation (`/payroll`)
- Payroll cycle processing (Semi-monthly / Monthly).
- Automated compensation calculations: basic pay, overtime, allowances, deductions (tax withholding, statutory contributions), and net payout.
- Printable payslips and disbursement voucher linkage.

### 11. Staff & HR Management (`/staff`)
- Employee master profiles, compensation packages, department assignments, and job roles.
- Linkage between employees, ERP user accounts, and voucher signatories.

### 12. Security, Roles & Permissions (`/permissions` / `/admin`)
- Dynamic Role-Based Access Control (RBAC).
- Granular permission matrix per Role and per User across all 12 modules:
  - **Create** (POST)
  - **Read** (GET)
  - **Update** (PUT / PATCH)
  - **Delete** (DELETE)
- Built-in System Roles: `SUPERADMIN`, `ADMIN`, `MANAGER`, `ACCOUNTANT`, `STAFF`, `VIEWER`.

### 13. System Settings (`/settings`)
- Organization profiles, legal entity details, and company logos.
- Default signatory configuration for vouchers and commercial documents.
- Currency definitions and system defaults.

---

## 🗄 Database & Schema Architecture

All database tables are defined using Drizzle ORM in `src/db/schema/` targeting Cloudflare D1:

```
src/db/schema/
├── auth.ts         # users, sessions, roles, role_permissions, user_permissions
├── delivery.ts     # delivery_receipts, delivery_receipt_items
├── inventory.ts    # products, product_categories, inventory_transactions
├── purchasing.ts   # purchase_orders, purchase_order_items, vendors
├── sales.ts        # sales_orders, sales_order_items, customers
├── vouchers.ts     # vouchers, voucher_items, accounts, general_ledger_entries
├── payroll.ts      # employees, payroll_runs, payroll_items
├── settings.ts     # system_settings, companies, branches, departments, job_titles
└── index.ts        # Central schema export hub
```

---

## 🔒 Role-Based Access Control (RBAC) & Permissions

Access control is enforced at both the API layer and the UI layer:

1. **Server-Side Route Middleware** (`src/middleware/auth.ts`, `src/index.ts`):
   - Every API endpoint checks the session token against `sessions` table.
   - Evaluates the user's role and custom permission overrides via `canPerformAction(db, role, module, action)`.
   - Admin routes (`/api/admin/*`) are strictly restricted to `SUPERADMIN` and `ADMIN`.
2. **Client-Side Menu & Action Gating** (`src/ui/app.client.ts`):
   - Sidebar navigation dynamically hides modules where the user lacks read permissions.
   - UI buttons (`Create`, `Edit`, `Delete`, `Approve`) check `userCan(module, action)` before rendering or executing.

---

## 📁 Repository Directory Structure

```
.
├── drizzle/                    # Generated SQL migration files
├── scripts/
│   └── import-vouchers-zip.js  # Node.js batch PDF voucher parser & importer
├── src/
│   ├── db/
│   │   ├── client.ts           # Drizzle D1 client factory
│   │   └── schema/             # Modular database schema definitions
│   ├── lib/
│   │   ├── password.ts         # PBKDF2 SHA-256 password hashing & verification
│   │   ├── permissions.ts      # CASL matrix, role CRUD rules & DB persistence
│   │   └── turnstile.ts        # Cloudflare Turnstile token validation
│   ├── middleware/
│   │   └── auth.ts             # Authentication & permission check middlewares
│   ├── ui/
│   │   ├── assets/             # Base64 brand logos & vector graphics
│   │   ├── components/         # Topbar, sidebar, modals, toast alerts
│   │   ├── styles/             # Modular CSS design system & responsive rules
│   │   ├── views/              # View templates (Dashboard, Vouchers, Accounting, etc.)
│   │   ├── app.client.ts       # Client-side SPA controller, router & event handlers
│   │   └── index.ts            # SSR application shell renderer
│   └── index.ts                # Main Hono worker entrypoint & REST API routes
├── test-erp-flow.js            # End-to-end integration test suite
├── drizzle.config.ts           # Drizzle Kit configuration
├── package.json                # Project dependencies & scripts
├── tsconfig.json               # TypeScript compiler configuration
└── wrangler.jsonc              # Cloudflare Workers & D1 binding configuration
```

---

## 🚀 Getting Started & Local Development

### Prerequisites

- **Node.js**: `v18.x` or `v20.x` or higher
- **npm**: `v9.x` or higher
- **Wrangler CLI**: Installed locally via `package.json` devDependencies

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/apexsinc/erp-apexsinc.git
cd erp-apexsinc
npm install
```

### 2. Configure Environment Variables

Create or update `.env` in the project root:

```ini
TURNSTILE_SITE_KEY=0x4AAAAAAEWXjWO9n9rN0ZIi
TURNSTILE_SECRET_KEY=your_turnstile_secret_key
```

### 3. Run Local Development Server

```bash
npm run dev
```

The application will start locally at `http://localhost:8787` using the local D1 SQLite emulator.

### 4. Run TypeScript Check

```bash
npm run typecheck
```

---

## 🗃 Database Migrations

### Generate New Migrations from Schema Changes

```bash
npm run db:generate
```

### Apply Migrations to Local D1 Database

```bash
npm run db:migrate:local
```

### Apply Migrations to Production Remote D1 Database

```bash
npm run db:migrate:prod
```

---

## 🚢 Deployment

The application is deployed as a Cloudflare Worker on custom domain `app.apexsinc.com`.

### 1. Dry-Run Build & Validation

```bash
npm run build
```

### 2. Deploy to Production

```bash
npm run deploy
```

*Or directly using Wrangler:*
```bash
npx wrangler deploy
```

---

## 📜 Batch Scripts & Utilities

### Batch Voucher PDF Import (`scripts/import-vouchers-zip.js`)
Utility script to parse legacy exported voucher PDF ZIP archives:
- Extracts voucher numbers, dates, recipients, currencies, line items, and signatories using `pdf-parse`.
- Automatically categorizes expenses into the appropriate Chart of Accounts code (`5020`, `5030`, `5040`, `5050`, `5060`, `5070`, `5080`).
- Inserts parsed records directly into the D1 database.

### Comprehensive ERP Flow Test (`test-erp-flow.js`)
End-to-end automated integration script verifying:
- Authentication & JWT token issuance.
- Product creation & stock movements.
- PO creation → Inbound GRN receiving → Inventory increment.
- Sales Order creation → Outbound DR dispatch → Inventory deduction.
- Payment Voucher creation → Approval cycle → General Ledger posting.

---

## 📄 License & Proprietary Notice

Copyright © 2026 **Apexs Inc.** All rights reserved.  
This software and its documentation are proprietary to Apexs Inc. Unauthorized copying, distribution, modification, or deployment without explicit written permission is strictly prohibited.
