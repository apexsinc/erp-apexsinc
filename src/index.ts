import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, desc, asc, like, and, ne, sql } from 'drizzle-orm';
import { createDbClient, type Database } from './db/client';
import * as schema from './db/schema';
import { renderAppHtml, renderPurchaseOrderPrintHtml } from './ui';
import { authMiddleware, requireAdmin, requireModule } from './middleware/auth';
import { hashPassword, verifyPasswordLegacyAware } from './lib/password';
import { verifyTurnstileToken } from './lib/turnstile';
import {
  ALL_MODULES,
  DEFAULT_PERMISSION_MATRIX,
  isAdminRole,
  canPerformAction,
  canUserPerformAction,
  loadPermissionMatrix,
  loadCrudPermissionMatrix,
  loadAllRoles,
  seedDefaultPermissions,
  getUserCustomPermissions,
  getUserEffectiveCrudMatrix,
  getUserVisibleModules,
  saveUserCustomPermissions,
  ensureUserPermissionsTable,
  SYSTEM_ROLES,
  type Module,
  type RoleCrudMatrix,
  type CrudAction,
} from './lib/permissions';
import { APEXS_LOGO_BASE64 } from './ui/assets/logo';
import { MANIFEST_JSON, SERVICE_WORKER_JS } from './ui/pwa';

// Environment Bindings for Cloudflare Workers
type Bindings = {
  DB: D1Database;
  // Public widget id — safe to embed client-side. Unset disables the Turnstile widget entirely.
  TURNSTILE_SITE_KEY?: string;
  // Secret used to verify tokens server-side. Unset disables server-side verification
  // (so login isn't broken before these are provisioned) — set both together.
  TURNSTILE_SECRET_KEY?: string;
};
type Variables = {
  authUser: { id: string; email: string; name: string; role: schema.User['role'] };
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Global Error Handler
app.onError((err, c) => {
  console.error('API Error:', err);
  return c.json(
    {
      success: false,
      error: err.message || 'Internal Server Error',
    },
    500
  );
});

// Helper middleware allowing access if user has permission in either vouchers or accounting
function requireVoucherOrAccounting(explicitAction?: CrudAction) {
  return async (c: any, next: any) => {
    const user = c.get('authUser');
    if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (isAdminRole(user.role)) return await next();
    let action: CrudAction = explicitAction || 'read';
    if (!explicitAction) {
      const method = c.req.method.toUpperCase();
      if (method === 'POST') action = 'create';
      else if (method === 'PUT' || method === 'PATCH') action = 'update';
      else if (method === 'DELETE') action = 'delete';
      else action = 'read';
    }
    // Every employee should be able to see/read vouchers
    if (action === 'read') return await next();

    const db = createDbClient(c.env.DB);
    const hasVoucherPerm = await canUserPerformAction(db, user, 'vouchers', action);
    const hasAcctPerm = await canUserPerformAction(db, user, 'accounting', action);
    if (hasVoucherPerm || hasAcctPerm) return await next();
    return c.json(
      {
        success: false,
        error: `Access Denied: You do not have permission to ${action.toUpperCase()} in vouchers or accounting`,
      },
      403
    );
  };
}

// Role-Based Route Access Control Middlewares
app.use('/api/auth/me', authMiddleware);
app.use('/api/admin/*', authMiddleware, requireAdmin);
app.use('/api/settings/vouchers', authMiddleware, async (c, next) => {
  if (c.req.method.toUpperCase() === 'GET') {
    const user = c.get('authUser');
    if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);
    return await next();
  }
  return await next();
});
app.use('/api/settings/*', authMiddleware, async (c, next) => {
  const path = c.req.path;
  if (path === '/api/settings/vouchers' && c.req.method.toUpperCase() === 'GET') {
    return await next();
  }
  return requireModule('settings')(c, next);
});
app.use('/api/settings', authMiddleware, requireModule('settings'));
app.use('/api/dashboard/*', authMiddleware, requireModule('dashboard'));
app.use('/api/directory/*', authMiddleware, requireModule('directory'));
app.use('/api/inventory/*', authMiddleware, requireModule('inventory'));
app.use('/api/purchasing/*', authMiddleware, async (c, next) => {
  if (c.req.method === 'GET' && c.req.path === '/api/purchasing/vendors') {
    return await next();
  }
  return requireModule('purchasing')(c, next);
});
app.use('/api/inbound/*', authMiddleware, requireModule('inbound'));
app.use('/api/sales/*', authMiddleware, requireModule('sales'));
app.use('/api/outbound/*', authMiddleware, requireModule('outbound'));
app.use('/api/accounting/vouchers/*', authMiddleware, requireVoucherOrAccounting());
app.use('/api/accounting/vouchers', authMiddleware, requireVoucherOrAccounting());
app.use('/api/accounting/accounts', authMiddleware, async (c, next) => {
  const user = c.get('authUser');
  if (!user) return c.json({ success: false, error: 'Authentication required' }, 401);
  return await next();
});
app.use('/api/accounting/*', authMiddleware, async (c, next) => {
  const path = c.req.path;
  if (
    path === '/api/accounting/vouchers' ||
    path.startsWith('/api/accounting/vouchers/') ||
    path === '/api/accounting/accounts' ||
    path.startsWith('/api/accounting/accounts/')
  ) {
    return await next();
  }
  return requireModule('accounting')(c, next);
});
app.use('/api/payroll/employees', authMiddleware, async (c, next) => {
  if (c.req.method === 'GET') {
    return await next();
  }
  return requireModule('staff')(c, next);
});
app.use('/api/payroll/employees/*', authMiddleware, requireModule('staff'));
app.use('/api/payroll/*', authMiddleware, async (c, next) => {
  const path = c.req.path;
  if (path === '/api/payroll/employees' || path.startsWith('/api/payroll/employees/')) {
    return await next();
  }
  return requireModule('payroll')(c, next);
});

function isLocalRequest(c: { req: any }): boolean {
  return !c.req.header('cf-ray') || !!c.req.header('mf-original-hostname') || c.req.header('cf-connecting-ip') === '127.0.0.1';
}

// UI Web Application Entrypoint (Served directly at edge)
async function renderApp(c: { req: any; env: Bindings }) {
  const db = createDbClient(c.env.DB);
  const rolePermissions = await loadPermissionMatrix(db);
  const crudMatrix = await loadCrudPermissionMatrix(db);
  const allRoles = await loadAllRoles(db);
  const isProduction = !isLocalRequest(c);
  const turnstileSiteKey = isProduction ? c.env.TURNSTILE_SITE_KEY : undefined;
  return renderAppHtml(rolePermissions, { turnstileSiteKey, crudMatrix, roles: allRoles });
}

async function serveHtmlApp(c: any) {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  c.header('Pragma', 'no-cache');
  c.header('Expires', '0');
  return c.html(await renderApp(c));
}

app.get('/', serveHtmlApp);
app.get('/login', serveHtmlApp);
app.get('/app', serveHtmlApp);
app.get('/dashboard', serveHtmlApp);
app.get('/directory', serveHtmlApp);
app.get('/inventory', serveHtmlApp);

async function servePurchaseOrderPrint(c: any) {
  const db = createDbClient(c.env.DB);
  const poIdOrNumber = c.req.param('id');
  const altPoNumber = poIdOrNumber.includes('APX-26-0010')
    ? 'APX-26-00010'
    : poIdOrNumber.includes('APX-26-00010')
    ? 'APX-26-0010'
    : poIdOrNumber;

  const po = await db.query.purchaseOrders.findFirst({
    where: (poTable, { eq, or }) =>
      or(
        eq(poTable.id, poIdOrNumber),
        eq(poTable.poNumber, poIdOrNumber),
        eq(poTable.poNumber, altPoNumber)
      ),
    with: { vendor: true, items: { with: { product: true } } },
  });

  if (!po) {
    return c.html(
      '<div style="padding: 3rem; font-family: sans-serif; color: #dc2626; text-align: center;"><h2>Purchase Order not found</h2><p>The requested Purchase Order could not be located in the database.</p></div>',
      404
    );
  }

  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return c.html(renderPurchaseOrderPrintHtml(po as any));
}

app.get('/purchasing', serveHtmlApp);
app.get('/purchasing/orders/:id/print', servePurchaseOrderPrint);
app.get('/purchasing/po/:id/print', servePurchaseOrderPrint);
app.get('/purchasing/po/:id', servePurchaseOrderPrint);
app.get('/purchasing/orders/:id', servePurchaseOrderPrint);
app.get('/inbound', serveHtmlApp);
app.get('/sales', serveHtmlApp);
app.get('/outbound', serveHtmlApp);
app.get('/vouchers', serveHtmlApp);
app.get('/accounting', serveHtmlApp);
app.get('/payroll', serveHtmlApp);
app.get('/staff', serveHtmlApp);
app.get('/admin', serveHtmlApp);
app.get('/permissions', serveHtmlApp);
app.get('/settings', serveHtmlApp);
app.get('/settings/*', serveHtmlApp);

// Static Asset & Branding Routes
app.get('/assets/logo.png', (c) => {
  const binary = Uint8Array.from(atob(APEXS_LOGO_BASE64.split(',')[1]), (char) => char.charCodeAt(0));
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
app.get('/favicon.ico', (c) => {
  const binary = Uint8Array.from(atob(APEXS_LOGO_BASE64.split(',')[1]), (char) => char.charCodeAt(0));
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

// Progressive Web App (PWA) & Mobile Manifest Routes
app.get('/manifest.webmanifest', () => {
  return new Response(MANIFEST_JSON, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
app.get('/manifest.json', () => {
  return new Response(MANIFEST_JSON, {
    headers: {
      'Content-Type': 'application/manifest+json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
});
app.get('/sw.js', () => {
  return new Response(SERVICE_WORKER_JS, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
});
app.get('/assets/icon-192.png', () => {
  const binary = Uint8Array.from(atob(APEXS_LOGO_BASE64.split(',')[1]), (char) => char.charCodeAt(0));
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});
app.get('/assets/icon-512.png', () => {
  const binary = Uint8Array.from(atob(APEXS_LOGO_BASE64.split(',')[1]), (char) => char.charCodeAt(0));
  return new Response(binary, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
});

/* ========================================================================== */
/* 0. AUTHENTICATION & ADMIN SYSTEM                                           */
/* ========================================================================== */

app.post(
  '/api/auth/login',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      password: z.string().min(1),
      cfTurnstileToken: z.string().optional(),
    }),
    (result, c) => {
      if (!result.success) {
        return c.json({ success: false, error: 'Invalid email or password' }, 401);
      }
    }
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const isProduction = !isLocalRequest(c);
    if ((isProduction || body.cfTurnstileToken) && c.env.TURNSTILE_SECRET_KEY) {
      const verified =
        !!body.cfTurnstileToken &&
        (await verifyTurnstileToken(c.env.TURNSTILE_SECRET_KEY, body.cfTurnstileToken, c.req.header('CF-Connecting-IP')));
      if (!verified) {
        return c.json({ success: false, error: 'Verification challenge failed. Please try again.' }, 400);
      }
    }

    // Check user in database
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, body.email.toLowerCase()),
    });

    // Default admin bootstrap if the DB hasn't been seeded yet
    if (!user && body.email.toLowerCase() === 'admin@apexsinc.com' && body.password === 'kbs812sls729@admin') {
      const adminId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: adminId,
        email: 'admin@apexsinc.com',
        name: 'System Administrator',
        passwordHash: await hashPassword('kbs812sls729@admin'),
        role: 'ADMIN',
      });
      user = await db.query.users.findFirst({ where: eq(schema.users.id, adminId) });
    }

    if (!user || !user.isActive) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }

    const { valid, legacy } = await verifyPasswordLegacyAware(body.password, user.passwordHash);
    if (!valid) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }
    // Transparently upgrade pre-hashing accounts the moment they next log in successfully.
    if (legacy) {
      await db.update(schema.users).set({ passwordHash: await hashPassword(body.password) }).where(eq(schema.users.id, user.id));
    }

    // Issue a real, verifiable session (24h expiry) — API routes check this,
    // not the role the client happens to send.
    const token = crypto.randomUUID() + crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await db.insert(schema.sessions).values({
      id: crypto.randomUUID(),
      token,
      userId: user.id,
      expiresAt,
    });

    const effective = await getUserEffectiveCrudMatrix(db, user.id, user.role);
    const visibleModules = ALL_MODULES.filter((m) => effective.crud[m]?.read);

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        hasCustomPermissions: effective.hasCustomOverrides,
        permissions: effective.crud,
        visibleModules,
      },
    });
  }
);

app.post('/api/auth/logout', async (c) => {
  const db = createDbClient(c.env.DB);
  const token = (c.req.header('Authorization') || '').replace('Bearer ', '');
  if (token) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
  }
  return c.json({ success: true });
});

app.get('/api/auth/me', async (c) => {
  const authUser = c.get('authUser');
  const db = createDbClient(c.env.DB);
  const effective = await getUserEffectiveCrudMatrix(db, authUser.id, authUser.role);
  const visibleModules = ALL_MODULES.filter((m) => effective.crud[m]?.read);
  return c.json({
    success: true,
    user: {
      ...authUser,
      hasCustomPermissions: effective.hasCustomOverrides,
      permissions: effective.crud,
      visibleModules,
    },
  });
});

/* ========================================================================== */
/* 0. SYSTEM SETUP & CHART OF ACCOUNTS SEED                                   */
/* ========================================================================== */

app.post('/api/setup/seed', async (c) => {
  const db = createDbClient(c.env.DB);

  // Once any user exists, reseeding (which resets the admin password) is
  // an ADMIN-only operation — otherwise anyone could hit this endpoint to
  // take over the admin account.
  const anyUser = await db.query.users.findFirst();
  if (anyUser) {
    const token = (c.req.header('Authorization') || '').replace('Bearer ', '');
    const session = token
      ? await db.query.sessions.findFirst({
          where: eq(schema.sessions.token, token),
          with: { user: true },
        })
      : null;
    const sessionValid = session && session.expiresAt > new Date().toISOString();
    if (!sessionValid || !session.user?.isActive || !isAdminRole(session.user.role)) {
      return c.json({ success: false, error: 'Administrator access required to reseed an initialized system' }, 403);
    }
  }

  // 1. Seed or Update Admin User
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.email, 'admin@apexsinc.com'),
  });
  if (!existingAdmin) {
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      email: 'admin@apexsinc.com',
      name: 'System Administrator',
      passwordHash: await hashPassword('kbs812sls729@admin'),
      role: 'ADMIN',
    });
  } else {
    await db.update(schema.users).set({ passwordHash: await hashPassword('kbs812sls729@admin') }).where(eq(schema.users.id, existingAdmin.id));
  }

  // 2. Seed default role -> module permission matrix (no-op if already seeded)
  await seedDefaultPermissions(db);

  // 2. Seed Default Chart of Accounts
  const defaultAccounts = [
    { code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET' as const, description: 'Operating checking and bank accounts' },
    { code: '1200', name: 'Merchandise Inventory', type: 'ASSET' as const, description: 'Current value of stock on hand' },
    { code: '1300', name: 'Accounts Receivable', type: 'ASSET' as const, description: 'Outstanding customer invoices' },
    { code: '2010', name: 'Accounts Payable', type: 'LIABILITY' as const, description: 'Outstanding vendor obligations' },
    { code: '2020', name: 'Payroll Liabilities Payable', type: 'LIABILITY' as const, description: 'Accrued wages and withholding taxes' },
    { code: '3010', name: "Owner's Equity", type: 'EQUITY' as const, description: 'Retained earnings and owner capital' },
    { code: '4010', name: 'Sales Revenue', type: 'REVENUE' as const, description: 'Income from goods and services sold' },
    { code: '5010', name: 'Cost of Goods Sold (COGS)', type: 'EXPENSE' as const, description: 'Direct inventory cost of goods sold' },
    { code: '5020', name: 'Salaries and Wages Expense', type: 'EXPENSE' as const, description: 'Employee gross compensation' },
  ];

  for (const acc of defaultAccounts) {
    const existing = await db.query.accounts.findFirst({
      where: eq(schema.accounts.code, acc.code),
    });
    if (!existing) {
      await db.insert(schema.accounts).values({
        id: crypto.randomUUID(),
        code: acc.code,
        name: acc.name,
        type: acc.type,
        description: acc.description,
      });
    }
  }

  return c.json({
    success: true,
    message: 'Default Chart of Accounts and Admin User seeded successfully.',
    accounts: defaultAccounts.map((a) => `${a.code} - ${a.name} (${a.type})`),
  });
});

/* ========================================================================== */
/* 1. INVENTORY MANAGEMENT MODULE                                             */
/* ========================================================================== */

async function getProductStockBalance(db: ReturnType<typeof createDbClient>, productId: string): Promise<number> {
  const movements = await db.select().from(schema.stockMovements).where(eq(schema.stockMovements.productId, productId));
  return movements.reduce((acc, mov) => {
    if (mov.type === 'IN') return acc + mov.quantity;
    if (mov.type === 'OUT') return acc - mov.quantity;
    if (mov.type === 'ADJUST') return acc + mov.quantity;
    return acc;
  }, 0);
}

// Fetches every Delivery Receipt for a batch of Sales Orders in one query and
// groups them by salesOrderId — used by both the Sales and Outbound list
// endpoints so each SO card/row can show what's been delivered vs. invoiced
// without a separate round trip per order.
async function attachDeliveryReceipts<T extends { id: string; soNumber?: string }>(db: ReturnType<typeof createDbClient>, orders: T[]) {
  const soIds = orders.map((o) => o.id);
  const receipts = soIds.length
    ? await db.query.deliveryReceipts.findMany({
        where: (dr, { inArray }) => inArray(dr.salesOrderId, soIds),
        with: { items: { with: { product: true } } },
        orderBy: (dr, { desc }) => [desc(dr.createdAt)],
      })
    : [];

  const bySoId = new Map<string, typeof receipts>();
  for (const r of receipts) {
    const list = bySoId.get(r.salesOrderId) || [];
    list.push(r);
    bySoId.set(r.salesOrderId, list);
  }

  return orders.map((o) => {
    const raw = o.soNumber || (o as any).siNumber || '';
    const num = raw ? raw.replace(/^SO-/i, 'SI-') : raw;
    return {
      ...o,
      soNumber: num,
      siNumber: num,
      deliveryReceipts: bySoId.get(o.id) || [],
    };
  });
}

// GET /api/inventory/categories - List product categories
app.get('/api/inventory/categories', async (c) => {
  const db = createDbClient(c.env.DB);
  const categories = await db.query.productCategories.findMany({
    orderBy: [schema.productCategories.name],
  });
  return c.json({ success: true, data: categories });
});

// POST /api/inventory/categories - Add a new product category
app.post(
  '/api/inventory/categories',
  zValidator('json', z.object({ name: z.string().trim().min(1).max(60) })),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const existing = await db.query.productCategories.findFirst({
      where: eq(schema.productCategories.name, body.name),
    });
    if (existing) return c.json({ success: false, error: 'That category already exists' }, 409);

    const categoryId = crypto.randomUUID();
    await db.insert(schema.productCategories).values({ id: categoryId, name: body.name });

    const created = await db.query.productCategories.findFirst({
      where: eq(schema.productCategories.id, categoryId),
    });

    return c.json({ success: true, data: created }, 201);
  }
);

// DELETE /api/inventory/categories/:id - Delete a product category
app.delete('/api/inventory/categories/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const existing = await db.query.productCategories.findFirst({
    where: eq(schema.productCategories.id, id),
  });
  if (!existing) return c.json({ success: false, error: 'Category not found' }, 404);

  // Check if any products currently use this category name
  const inUse = await db.query.products.findFirst({
    where: eq(schema.products.category, existing.name),
  });
  if (inUse) {
    return c.json(
      {
        success: false,
        error: `Cannot delete category "${existing.name}" because it is still in use by products. Please reassign the products first.`,
      },
      400
    );
  }

  await db.delete(schema.productCategories).where(eq(schema.productCategories.id, id));
  return c.json({ success: true, message: `Category "${existing.name}" deleted successfully` });
});

// POST /api/inventory/products - Create Product
// Identity, category, and name only. Unit of measure, cost price/currency, and
// quantity are captured later, per purchase, on the Purchasing PO form —
// they sync back onto this product record when that PO is issued.
app.post(
  '/api/inventory/products',
  zValidator(
    'json',
    z.object({
      sku: z.string().min(1),
      name: z.string().min(1),
      category: z.string().min(1),
      unitOfMeasure: z.string().optional().default('pcs'),
      description: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const category = await db.query.productCategories.findFirst({
      where: eq(schema.productCategories.name, body.category),
    });
    if (!category) return c.json({ success: false, error: 'Unknown category' }, 400);

    const existingSku = await db.query.products.findFirst({
      where: eq(schema.products.sku, body.sku.toUpperCase()),
    });
    if (existingSku) {
      return c.json({ success: false, error: `Product with SKU "${body.sku.toUpperCase()}" already exists` }, 409);
    }

    const productId = crypto.randomUUID();
    await db.insert(schema.products).values({
      id: productId,
      sku: body.sku.toUpperCase(),
      name: body.name,
      category: body.category,
      unitOfMeasure: body.unitOfMeasure || 'pcs',
      description: body.description,
    });

    const created = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });

    return c.json({ success: true, data: { ...created, onHandStock: 0 } }, 201);
  }
);

// POST /api/inventory/products/batch-import - Batch import products and price list entries
app.post(
  '/api/inventory/products/batch-import',
  zValidator(
    'json',
    z.object({
      products: z
        .array(
          z.object({
            sku: z.string().min(1),
            name: z
              .string()
              .optional()
              .nullable()
              .transform((v) => (v && v.trim() ? v.trim() : 'Unnamed Item')),
            category: z.string().min(1),
            sellingPriceCents: z.number().int().nonnegative().optional().nullable().default(0),
            sellingPriceCurrency: z.enum(['USD', 'PHP']).optional().nullable().default('PHP'),
            costPriceCents: z.number().int().nonnegative().optional().nullable().default(0),
            costPriceCurrency: z.enum(['USD', 'PHP']).optional().nullable().default('USD'),
            unitOfMeasure: z.string().optional().nullable().default('pcs'),
            description: z.string().optional().nullable(),
          })
        )
        .min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const validBody = c.req.valid('json');
    const items = validBody.products.map((item) => ({
      sku: item.sku,
      name: item.name,
      category: item.category,
      sellingPriceCents: item.sellingPriceCents ?? 0,
      sellingPriceCurrency: (item.sellingPriceCurrency || 'PHP') as 'USD' | 'PHP',
      costPriceCents: item.costPriceCents ?? 0,
      costPriceCurrency: (item.costPriceCurrency || 'USD') as 'USD' | 'PHP',
      unitOfMeasure: item.unitOfMeasure || 'pcs',
      description: item.description || undefined,
    }));

    // 1. Ensure all categories exist; auto-create missing categories
    const neededCategories = [...new Set(items.map((i) => i.category.trim()).filter(Boolean))];
    const existingCategories = await db.query.productCategories.findMany();
    const existingCatNames = new Set(existingCategories.map((cat) => cat.name.toLowerCase()));

    const newCategoriesToInsert = neededCategories.filter((cat) => !existingCatNames.has(cat.toLowerCase()));
    if (newCategoriesToInsert.length > 0) {
      const catStatements = newCategoriesToInsert.map((catName) =>
        db.insert(schema.productCategories).values({
          id: crypto.randomUUID(),
          name: catName,
          createdAt: new Date().toISOString(),
        })
      );
      // Execute in chunks of 50 to respect D1 limits
      for (let i = 0; i < catStatements.length; i += 50) {
        await db.batch(catStatements.slice(i, i + 50) as any);
      }
    }

    // 2. Fetch all existing products for quick SKU lookup
    const allExisting = await db.query.products.findMany({
      columns: {
        id: true,
        sku: true,
        name: true,
        category: true,
        sellingPriceCents: true,
        costPriceCents: true,
      },
    });
    const existingBySku = new Map<string, typeof allExisting[0]>(
      allExisting.map((p) => [p.sku.toUpperCase(), p])
    );

    let createdCount = 0;
    let updatedCount = 0;
    const batchStatements: any[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      const normalizedSku = item.sku.trim().toUpperCase();
      const existing = existingBySku.get(normalizedSku);

      if (existing) {
        // Update existing product
        const updateData: Record<string, any> = {
          name: item.name.trim(),
          category: item.category.trim(),
          updatedAt: now,
        };
        if (item.sellingPriceCents !== undefined && item.sellingPriceCents > 0) {
          updateData.sellingPriceCents = item.sellingPriceCents;
          updateData.sellingPriceCurrency = item.sellingPriceCurrency || 'PHP';
        }
        if (item.costPriceCents !== undefined && item.costPriceCents > 0) {
          updateData.costPriceCents = item.costPriceCents;
          updateData.costPriceCurrency = item.costPriceCurrency || 'USD';
        }
        if (item.description) {
          updateData.description = item.description;
        }

        batchStatements.push(
          db.update(schema.products).set(updateData).where(eq(schema.products.id, existing.id))
        );
        updatedCount++;
      } else {
        // Insert new product
        const newId = crypto.randomUUID();
        batchStatements.push(
          db.insert(schema.products).values({
            id: newId,
            sku: normalizedSku,
            name: item.name.trim(),
            category: item.category.trim(),
            unitOfMeasure: item.unitOfMeasure || 'pcs',
            sellingPriceCents: item.sellingPriceCents || 0,
            sellingPriceCurrency: item.sellingPriceCurrency || 'PHP',
            costPriceCents: item.costPriceCents || 0,
            costPriceCurrency: item.costPriceCurrency || 'USD',
            description: item.description || null,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
        );
        // Track inserted SKU so duplicate rows in the same spreadsheet don't conflict
        existingBySku.set(normalizedSku, {
          id: newId,
          sku: normalizedSku,
          name: item.name.trim(),
          category: item.category.trim(),
          sellingPriceCents: item.sellingPriceCents || 0,
          costPriceCents: item.costPriceCents || 0,
        });
        createdCount++;
      }
    }

    // 3. Execute batch statements in chunks of 50
    for (let i = 0; i < batchStatements.length; i += 50) {
      const chunk = batchStatements.slice(i, i + 50);
      if (chunk.length > 0) {
        await db.batch(chunk as any);
      }
    }

    return c.json({
      success: true,
      data: {
        total: items.length,
        createdCount,
        updatedCount,
        categoriesCreated: newCategoriesToInsert,
      },
    });
  }
);

// GET /api/inventory/products - List products with real-time stock levels
app.get('/api/inventory/products', async (c) => {
  const db = createDbClient(c.env.DB);
  const allProducts = await db.query.products.findMany({
    orderBy: [desc(schema.products.createdAt)],
  });

  const productsWithStock = await Promise.all(
    allProducts.map(async (prod) => {
      const stock = await getProductStockBalance(db, prod.id);
      return {
        ...prod,
        onHandStock: stock,
        damagedStock: prod.damagedStock || 0,
        inventoryValuationCents: stock * prod.costPriceCents,
        damagedValuationCents: (prod.damagedStock || 0) * prod.costPriceCents,
      };
    })
  );

  return c.json({ success: true, count: productsWithStock.length, data: productsWithStock });
});

// GET /api/inventory/products/:id - Product detail with ledger history
app.get('/api/inventory/products/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const product = await db.query.products.findFirst({
    where: eq(schema.products.id, id),
    with: {
      stockMovements: {
        orderBy: [desc(schema.stockMovements.createdAt)],
      },
    },
  });

  if (!product) {
    return c.json({ success: false, error: 'Product not found' }, 404);
  }

  const stock = await getProductStockBalance(db, id);

  return c.json({
    success: true,
    data: {
      ...product,
      onHandStock: stock,
      damagedStock: product.damagedStock || 0,
      inventoryValuationCents: stock * product.costPriceCents,
      damagedValuationCents: (product.damagedStock || 0) * product.costPriceCents,
    },
  });
});

// PATCH /api/inventory/products/:id/price - Set the Price List selling price
app.patch(
  '/api/inventory/products/:id/price',
  zValidator(
    'json',
    z.object({
      sellingPriceCents: z.number().int().nonnegative(),
      sellingPriceCurrency: z.enum(['USD', 'PHP']).optional(),
      currency: z.enum(['USD', 'PHP']).optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const currency = body.sellingPriceCurrency || body.currency || 'PHP';

    const product = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    await db
      .update(schema.products)
      .set({ sellingPriceCents: body.sellingPriceCents, sellingPriceCurrency: currency, updatedAt: new Date().toISOString() })
      .where(eq(schema.products.id, id));

    const updated = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    return c.json({ success: true, data: updated });
  }
);

// PATCH /api/inventory/products/:id/category - Reclassify a product
app.patch(
  '/api/inventory/products/:id/category',
  zValidator('json', z.object({ category: z.string().min(1) })),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    const category = await db.query.productCategories.findFirst({
      where: eq(schema.productCategories.name, body.category),
    });
    if (!category) return c.json({ success: false, error: 'Unknown category' }, 400);

    await db
      .update(schema.products)
      .set({ category: body.category, updatedAt: new Date().toISOString() })
      .where(eq(schema.products.id, id));

    const updated = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    return c.json({ success: true, data: updated });
  }
);

// PATCH /api/inventory/products/:id/cost-price - Set the product's cost price
// Normally populated automatically when a PO is issued (see purchasing below).
// This lets legacy/pre-existing products that never went through a PO get a
// cost price recorded when their stock is entered manually.
app.patch(
  '/api/inventory/products/:id/cost-price',
  zValidator(
    'json',
    z.object({
      costPriceCents: z.number().int().nonnegative(),
      costPriceCurrency: z.enum(['USD', 'PHP']).optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    await db
      .update(schema.products)
      .set({
        costPriceCents: body.costPriceCents,
        costPriceCurrency: body.costPriceCurrency || product.costPriceCurrency,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.products.id, id));

    const updated = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    return c.json({ success: true, data: updated });
  }
);

// PATCH /api/inventory/products/:id - Edit product details (name, sku, category, unitOfMeasure, description)
app.patch(
  '/api/inventory/products/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      sku: z.string().min(1).optional(),
      category: z.string().min(1).optional(),
      unitOfMeasure: z.string().min(1).optional(),
      description: z.string().optional().nullable(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    if (body.category) {
      const cat = await db.query.productCategories.findFirst({
        where: eq(schema.productCategories.name, body.category),
      });
      if (!cat) return c.json({ success: false, error: 'Unknown category' }, 400);
    }

    if (body.sku && body.sku.toUpperCase() !== product.sku.toUpperCase()) {
      const existingSku = await db.query.products.findFirst({
        where: eq(schema.products.sku, body.sku.toUpperCase()),
      });
      if (existingSku) {
        return c.json({ success: false, error: `Product with SKU "${body.sku.toUpperCase()}" already exists` }, 409);
      }
    }

    const updateData: Partial<typeof schema.products.$inferInsert> = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name !== undefined) updateData.name = body.name.trim();
    if (body.sku !== undefined) updateData.sku = body.sku.trim().toUpperCase();
    if (body.category !== undefined) updateData.category = body.category.trim();
    if (body.unitOfMeasure !== undefined) updateData.unitOfMeasure = body.unitOfMeasure.trim() || 'pcs';
    if (body.description !== undefined) updateData.description = body.description ? body.description.trim() : null;

    await db.update(schema.products).set(updateData).where(eq(schema.products.id, id));

    const updated = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
    return c.json({ success: true, data: updated });
  }
);

// DELETE /api/inventory/products/:id - Delete a product
app.delete('/api/inventory/products/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const product = await db.query.products.findFirst({ where: eq(schema.products.id, id) });
  if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

  // Check if product is in purchase orders
  const poItem = await db.query.purchaseOrderItems.findFirst({
    where: eq(schema.purchaseOrderItems.productId, id),
  });
  if (poItem) {
    return c.json({ success: false, error: 'Cannot delete product because it has purchase order history' }, 400);
  }

  // Check if product is in sales orders
  const soItem = await db.query.salesOrderItems.findFirst({
    where: eq(schema.salesOrderItems.productId, id),
  });
  if (soItem) {
    return c.json({ success: false, error: 'Cannot delete product because it has sales order history' }, 400);
  }

  // Check if product is in invoice items
  const invItem = await db.query.invoiceItems.findFirst({
    where: eq(schema.invoiceItems.productId, id),
  });
  if (invItem) {
    return c.json({ success: false, error: 'Cannot delete product because it has invoice history' }, 400);
  }

  // Delete associated stock movements
  await db.delete(schema.stockMovements).where(eq(schema.stockMovements.productId, id));

  // Delete product
  await db.delete(schema.products).where(eq(schema.products.id, id));

  return c.json({ success: true, message: `Product "${product.name}" (${product.sku}) deleted successfully` });
});

// POST /api/inventory/movements - Stock Adjustment
app.post(
  '/api/inventory/movements',
  zValidator(
    'json',
    z.object({
      productId: z.string().uuid(),
      type: z.enum(['IN', 'OUT', 'ADJUST']),
      quantity: z.number().int(),
      unitCostCents: z.number().int().nonnegative().optional(),
      referenceType: z.enum(['INITIAL', 'PO_RECEIPT', 'SO_DELIVERY', 'ADJUSTMENT', 'RETURN', 'SCRAP']).default('ADJUSTMENT'),
      referenceId: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, body.productId),
    });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    // De-duplication check: prevent accidental double-click submissions within 3 seconds
    const twoSecondsAgo = new Date(Date.now() - 3000).toISOString();
    const recentDuplicate = await db.query.stockMovements.findFirst({
      where: (m, { and, eq, gte }) =>
        and(
          eq(m.productId, body.productId),
          eq(m.type, body.type),
          eq(m.quantity, body.quantity),
          gte(m.createdAt, twoSecondsAgo)
        ),
    });
    if (recentDuplicate) {
      const currentStock = await getProductStockBalance(db, body.productId);
      return c.json({
        success: true,
        message: 'Stock movement recorded successfully (deduplicated)',
        movementId: recentDuplicate.id,
        productId: body.productId,
        newOnHandStock: currentStock,
      });
    }

    const movementId = crypto.randomUUID();
    await db.insert(schema.stockMovements).values({
      id: movementId,
      productId: body.productId,
      type: body.type,
      quantity: body.quantity,
      unitCostCents: body.unitCostCents ?? product.costPriceCents,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
      notes: body.notes,
    });

    const newStock = await getProductStockBalance(db, body.productId);

    return c.json({
      success: true,
      message: 'Stock movement recorded successfully',
      movementId,
      productId: body.productId,
      newOnHandStock: newStock,
    });
  }
);

// GET /api/inventory/movements - Audit Ledger of all stock movements
app.get('/api/inventory/movements', async (c) => {
  const db = createDbClient(c.env.DB);
  const movements = await db.query.stockMovements.findMany({
    orderBy: [desc(schema.stockMovements.createdAt)],
    with: {
      product: true,
    },
  });
  return c.json({ success: true, count: movements.length, data: movements });
});

// POST /api/inventory/damaged - Manage Damaged / Quarantined Stock (Option 2)
app.post(
  '/api/inventory/damaged',
  zValidator(
    'json',
    z.object({
      productId: z.string().uuid(),
      action: z.enum(['MOVE_TO_DAMAGED', 'DISPOSE_SCRAP', 'RESTORE_TO_AVAILABLE', 'RETURN_TO_SUPPLIER']),
      quantity: z.number().int().positive(),
      reason: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const product = await db.query.products.findFirst({
      where: eq(schema.products.id, body.productId),
    });
    if (!product) return c.json({ success: false, error: 'Product not found' }, 404);

    const availableStock = await getProductStockBalance(db, body.productId);
    const currentDamaged = product.damagedStock || 0;

    let movementPayload: {
      productId: string;
      type: 'IN' | 'OUT' | 'ADJUST';
      quantity: number;
      unitCostCents: number;
      referenceType: 'INITIAL' | 'PO_RECEIPT' | 'SO_DELIVERY' | 'ADJUSTMENT' | 'RETURN' | 'SCRAP';
      notes?: string;
    };
    let newDamaged = currentDamaged;

    if (body.action === 'MOVE_TO_DAMAGED') {
      if (body.quantity > availableStock) {
        return c.json({
          success: false,
          error: `Cannot move ${body.quantity} to damaged. Available on-hand stock is only ${availableStock}.`,
        }, 400);
      }
      newDamaged = currentDamaged + body.quantity;
      movementPayload = {
        productId: body.productId,
        type: 'OUT',
        quantity: body.quantity,
        unitCostCents: product.costPriceCents,
        referenceType: 'ADJUSTMENT',
        notes: `Moved to Damaged/Quarantine (${body.reason || 'Defective/Damaged'}). ${body.notes || ''}`.trim(),
      };
    } else if (body.action === 'DISPOSE_SCRAP') {
      if (body.quantity > currentDamaged) {
        return c.json({
          success: false,
          error: `Cannot dispose ${body.quantity} units. Current damaged stock is only ${currentDamaged}.`,
        }, 400);
      }
      newDamaged = currentDamaged - body.quantity;
      movementPayload = {
        productId: body.productId,
        type: 'ADJUST',
        quantity: 0,
        unitCostCents: product.costPriceCents,
        referenceType: 'SCRAP',
        notes: `Disposed/Scrapped ${body.quantity} damaged units. ${body.notes || ''}`.trim(),
      };
    } else if (body.action === 'RESTORE_TO_AVAILABLE') {
      if (body.quantity > currentDamaged) {
        return c.json({
          success: false,
          error: `Cannot restore ${body.quantity} units. Current damaged stock is only ${currentDamaged}.`,
        }, 400);
      }
      newDamaged = currentDamaged - body.quantity;
      movementPayload = {
        productId: body.productId,
        type: 'IN',
        quantity: body.quantity,
        unitCostCents: product.costPriceCents,
        referenceType: 'ADJUSTMENT',
        notes: `Restored ${body.quantity} units from Damaged/Quarantine to Available stock. ${body.notes || ''}`.trim(),
      };
    } else if (body.action === 'RETURN_TO_SUPPLIER') {
      if (body.quantity > currentDamaged) {
        return c.json({
          success: false,
          error: `Cannot return ${body.quantity} units. Current damaged stock is only ${currentDamaged}.`,
        }, 400);
      }
      newDamaged = currentDamaged - body.quantity;
      movementPayload = {
        productId: body.productId,
        type: 'ADJUST',
        quantity: 0,
        unitCostCents: product.costPriceCents,
        referenceType: 'RETURN',
        notes: `Returned to Supplier (RMA) ${body.quantity} damaged units. ${body.notes || ''}`.trim(),
      };
    } else {
      return c.json({ success: false, error: 'Invalid action' }, 400);
    }

    await db.insert(schema.stockMovements).values({
      id: crypto.randomUUID(),
      ...movementPayload,
    });

    await db
      .update(schema.products)
      .set({
        damagedStock: newDamaged,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.products.id, body.productId));

    const updatedAvailable = await getProductStockBalance(db, body.productId);

    return c.json({
      success: true,
      message: 'Damaged stock updated successfully',
      productId: body.productId,
      availableStock: updatedAvailable,
      damagedStock: newDamaged,
    });
  }
);

/* ========================================================================== */
/* 2. PURCHASING (P2P) MODULE                                                 */
/* ========================================================================== */

// POST /api/purchasing/vendors - Create Vendor
app.post(
  '/api/purchasing/vendors',
  zValidator(
    'json',
    z.object({
      vendorCode: z.string().min(2),
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      taxId: z.string().optional(),
      paymentTermsDays: z.number().int().default(30),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const vendorId = crypto.randomUUID();
    await db.insert(schema.vendors).values({
      id: vendorId,
      vendorCode: body.vendorCode.toUpperCase(),
      name: body.name,
      email: body.email,
      phone: body.phone,
      address: body.address,
      taxId: body.taxId,
      paymentTermsDays: body.paymentTermsDays,
    });

    const vendor = await db.query.vendors.findFirst({ where: eq(schema.vendors.id, vendorId) });
    return c.json({ success: true, data: vendor }, 201);
  }
);

// GET /api/purchasing/vendors - List Vendors
app.get('/api/purchasing/vendors', async (c) => {
  const db = createDbClient(c.env.DB);
  const vendors = await db.query.vendors.findMany({ orderBy: [desc(schema.vendors.createdAt)] });
  return c.json({ success: true, data: vendors });
});

// Continues the buyer's own PO numbering: if the request doesn't supply a
// PO number, pick up right after the most recently created one (preserving
// its prefix and zero-padding) so a manually-entered legacy sequence keeps
// going automatically once the buyer stops typing it in by hand.
function generateNextPoNumber(lastNumber?: string | null): string {
  if (lastNumber) {
    const match = lastNumber.match(/^(.*?)(\d+)$/);
    if (match) {
      const [, prefix, digits] = match;
      const next = (parseInt(digits, 10) + 1).toString().padStart(digits.length, '0');
      return prefix + next;
    }
  }
  return 'PO-' + Date.now().toString().slice(-6);
}

function generateNextSequence(lastNumber?: string | null, defaultPrefix = 'SI-'): string {
  if (lastNumber) {
    let normalized = lastNumber.trim();
    if (defaultPrefix === 'SI-') {
      normalized = normalized.replace(/^SO-/i, 'SI-');
    }
    const match = normalized.match(/^(.*?)(\d+)$/);
    if (match) {
      const [, prefix, digits] = match;
      const next = (parseInt(digits, 10) + 1).toString().padStart(digits.length, '0');
      return prefix + next;
    }
  }
  return defaultPrefix + '1001';
}

// POST /api/purchasing/orders - Create Purchase Order
app.post(
  '/api/purchasing/orders',
  zValidator(
    'json',
    z.object({
      vendorId: z.string().uuid(),
      poNumber: z.string().trim().min(1).max(64).optional(),
      currency: z.enum(['USD', 'PHP']),
      notes: z.string().optional(),
      items: z.array(
        z.object({
          productId: z.string().uuid(),
          quantityOrdered: z.number().int().positive(),
          unitOfMeasure: z.string().min(1),
          unitPriceCents: z.number().int().nonnegative(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const poId = crypto.randomUUID();
    let poNumber: string;
    if (body.poNumber) {
      const existing = await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.poNumber, body.poNumber) });
      if (existing) {
        return c.json({ success: false, error: 'PO number "' + body.poNumber + '" is already in use' }, 409);
      }
      poNumber = body.poNumber;
    } else {
      const lastPO = await db.query.purchaseOrders.findFirst({ orderBy: [desc(schema.purchaseOrders.createdAt)] });
      poNumber = generateNextPoNumber(lastPO?.poNumber);
    }
    const totalAmountCents = body.items.reduce((acc, it) => acc + it.quantityOrdered * it.unitPriceCents, 0);

    const poInsert = db.insert(schema.purchaseOrders).values({
      id: poId,
      poNumber,
      vendorId: body.vendorId,
      status: 'APPROVED',
      currency: body.currency,
      totalAmountCents,
      notes: body.notes,
    });

    const itemInserts = body.items.map((item) =>
      db.insert(schema.purchaseOrderItems).values({
        id: crypto.randomUUID(),
        purchaseOrderId: poId,
        productId: item.productId,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitPriceCents: item.unitPriceCents,
        subtotalCents: item.quantityOrdered * item.unitPriceCents,
      })
    );

    // Purchasing is where cost/UOM/currency actually get set for a product,
    // so a PO line writes those back onto the product master as the latest
    // known values (used for inventory valuation and directory display).
    const productSyncs = body.items.map((item) =>
      db
        .update(schema.products)
        .set({
          unitOfMeasure: item.unitOfMeasure,
          costPriceCents: item.unitPriceCents,
          costPriceCurrency: body.currency,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.products.id, item.productId))
    );

    await db.batch([poInsert, ...itemInserts, ...productSyncs]);

    const createdPO = await db.query.purchaseOrders.findFirst({
      where: eq(schema.purchaseOrders.id, poId),
      with: { vendor: true, items: { with: { product: true } } },
    });

    return c.json({ success: true, data: createdPO }, 201);
  }
);

// GET /api/purchasing/orders - List POs
app.get('/api/purchasing/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.purchaseOrders.findMany({
    orderBy: [desc(schema.purchaseOrders.createdAt)],
    with: { vendor: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: orders });
});

// GET /api/purchasing/orders/:id - Get Single PO
app.get('/api/purchasing/orders/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const idOrNumber = c.req.param('id');
  const altPoNumber = idOrNumber.includes('APX-26-0010')
    ? 'APX-26-00010'
    : idOrNumber.includes('APX-26-00010')
    ? 'APX-26-0010'
    : idOrNumber;

  const po = await db.query.purchaseOrders.findFirst({
    where: (poTable, { eq, or }) =>
      or(
        eq(poTable.id, idOrNumber),
        eq(poTable.poNumber, idOrNumber),
        eq(poTable.poNumber, altPoNumber)
      ),
    with: { vendor: true, items: { with: { product: true } } },
  });
  if (!po) return c.json({ success: false, error: 'Purchase Order not found' }, 404);
  return c.json({ success: true, data: po });
});

// PUT /api/purchasing/orders/:id - Update Purchase Order
app.put(
  '/api/purchasing/orders/:id',
  zValidator(
    'json',
    z.object({
      vendorId: z.string().uuid().optional(),
      poNumber: z.string().trim().min(1).max(64).optional(),
      status: z.enum(['DRAFT', 'APPROVED', 'DELIVERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
      currency: z.enum(['USD', 'PHP']).optional(),
      notes: z.string().optional(),
      items: z
        .array(
          z.object({
            productId: z.string().uuid(),
            quantityOrdered: z.number().int().positive(),
            unitOfMeasure: z.string().min(1),
            unitPriceCents: z.number().int().nonnegative(),
          })
        )
        .min(1)
        .optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const poId = c.req.param('id');
    const body = c.req.valid('json');

    const existing = await db.query.purchaseOrders.findFirst({
      where: (poTable, { eq, or }) => or(eq(poTable.id, poId), eq(poTable.poNumber, poId)),
      with: { items: true },
    });
    if (!existing) return c.json({ success: false, error: 'Purchase Order not found' }, 404);

    const targetId = existing.id;

    if (body.poNumber && body.poNumber !== existing.poNumber) {
      const clash = await db.query.purchaseOrders.findFirst({
        where: and(eq(schema.purchaseOrders.poNumber, body.poNumber), ne(schema.purchaseOrders.id, targetId)),
      });
      if (clash) {
        return c.json({ success: false, error: `PO number "${body.poNumber}" is already in use` }, 409);
      }
    }

    let totalAmountCents = existing.totalAmountCents;
    if (body.items) {
      totalAmountCents = body.items.reduce((acc, it) => acc + it.quantityOrdered * it.unitPriceCents, 0);
    }

    const now = new Date().toISOString();
    await db
      .update(schema.purchaseOrders)
      .set({
        vendorId: body.vendorId ?? existing.vendorId,
        poNumber: body.poNumber ?? existing.poNumber,
        status: body.status ?? existing.status,
        currency: body.currency ?? existing.currency,
        totalAmountCents,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updatedAt: now,
      })
      .where(eq(schema.purchaseOrders.id, targetId));

    if (body.items) {
      await db.delete(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.purchaseOrderId, targetId));

      const itemInserts = body.items.map((item) =>
        db.insert(schema.purchaseOrderItems).values({
          id: crypto.randomUUID(),
          purchaseOrderId: targetId,
          productId: item.productId,
          quantityOrdered: item.quantityOrdered,
          quantityReceived: 0,
          unitPriceCents: item.unitPriceCents,
          subtotalCents: item.quantityOrdered * item.unitPriceCents,
        })
      );

      const currency = body.currency || existing.currency;
      const productSyncs = body.items.map((item) =>
        db
          .update(schema.products)
          .set({
            unitOfMeasure: item.unitOfMeasure,
            costPriceCents: item.unitPriceCents,
            costPriceCurrency: currency,
            updatedAt: now,
          })
          .where(eq(schema.products.id, item.productId))
      );

      await db.batch([...itemInserts, ...productSyncs] as any);
    }

    const updated = await db.query.purchaseOrders.findFirst({
      where: eq(schema.purchaseOrders.id, targetId),
      with: { vendor: true, items: { with: { product: true } } },
    });
    return c.json({ success: true, data: updated });
  }
);

// DELETE /api/purchasing/orders/:id - Delete Purchase Order
app.delete('/api/purchasing/orders/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const poId = c.req.param('id');

  const existing = await db.query.purchaseOrders.findFirst({
    where: (poTable, { eq, or }) => or(eq(poTable.id, poId), eq(poTable.poNumber, poId)),
    with: { items: true, grns: { with: { items: true } } },
  });
  if (!existing) return c.json({ success: false, error: 'Purchase Order not found' }, 404);

  const targetId = existing.id;

  // 1. Delete associated Goods Received Note items and notes if any exist
  const grnIds = (existing.grns || []).map((g) => g.id);
  for (const grnId of grnIds) {
    await db.delete(schema.goodsReceivedNoteItems).where(eq(schema.goodsReceivedNoteItems.grnId, grnId));
    await db.delete(schema.goodsReceivedNotes).where(eq(schema.goodsReceivedNotes.id, grnId));
  }

  // 2. Delete purchase order items
  await db.delete(schema.purchaseOrderItems).where(eq(schema.purchaseOrderItems.purchaseOrderId, targetId));

  // 3. Delete the purchase order record
  await db.delete(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, targetId));

  return c.json({ success: true, message: `Purchase Order ${existing.poNumber} deleted successfully` });
});

/* ========================================================================== */
/* 3. INBOUND DELIVERY TRACKING MODULE                                        */
/* Every approved PO shows up here for two-step receiving:                    */
/*   1) Mark as Delivered — the shipment has physically arrived.              */
/*   2) Confirm Quantity Arrived — records a GRN, updates the stock ledger,   */
/*      and moves the PO to PARTIALLY_RECEIVED or RECEIVED depending on       */
/*      whether every line item is now fully accounted for.                  */
/* ========================================================================== */

// GET /api/inbound/orders - List POs that have moved past DRAFT for delivery tracking
app.get('/api/inbound/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.purchaseOrders.findMany({
    where: (poTable, { inArray }) => inArray(poTable.status, ['APPROVED', 'DELIVERED', 'PARTIALLY_RECEIVED', 'RECEIVED']),
    orderBy: [desc(schema.purchaseOrders.createdAt)],
    with: { vendor: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: orders });
});

// POST /api/inbound/orders/:id/mark-delivered - Step 1: shipment has physically arrived
app.post('/api/inbound/orders/:id/mark-delivered', async (c) => {
  const db = createDbClient(c.env.DB);
  const poId = c.req.param('id');

  const po = await db.query.purchaseOrders.findFirst({ where: eq(schema.purchaseOrders.id, poId) });
  if (!po) return c.json({ success: false, error: 'Purchase Order not found' }, 404);
  if (po.status !== 'APPROVED') {
    return c.json({ success: false, error: `Cannot mark as delivered from status ${po.status}` }, 400);
  }

  await db
    .update(schema.purchaseOrders)
    .set({ status: 'DELIVERED', deliveredAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(schema.purchaseOrders.id, poId));

  const updated = await db.query.purchaseOrders.findFirst({
    where: eq(schema.purchaseOrders.id, poId),
    with: { vendor: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: updated });
});

// POST /api/inbound/orders/:id/receive - Step 2: confirm quantity arrived, create GRN & increment inventory
app.post(
  '/api/inbound/orders/:id/receive',
  zValidator(
    'json',
    z.object({
      notes: z.string().optional(),
      items: z.array(
        z.object({
          poItemId: z.string().uuid(),
          quantityReceived: z.number().int().positive(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const poId = c.req.param('id');
    const body = c.req.valid('json');

    const po = await db.query.purchaseOrders.findFirst({
      where: eq(schema.purchaseOrders.id, poId),
      with: { items: true },
    });
    if (!po) return c.json({ success: false, error: 'Purchase Order not found' }, 404);
    if (po.status !== 'DELIVERED' && po.status !== 'PARTIALLY_RECEIVED') {
      return c.json({ success: false, error: `Cannot confirm quantity from status ${po.status}. Mark as delivered first.` }, 400);
    }

    const grnId = crypto.randomUUID();
    const grnNumber = 'GRN-' + Date.now().toString().slice(-6);

    const grnInsert = db.insert(schema.goodsReceivedNotes).values({
      id: grnId,
      grnNumber,
      purchaseOrderId: poId,
      notes: body.notes,
    });

    const batchStatements: any[] = [grnInsert];
    const updatedQtyByItemId = new Map<string, number>();

    for (const recItem of body.items) {
      const poItem = po.items.find((i) => i.id === recItem.poItemId);
      if (!poItem) continue;

      const grnItemId = crypto.randomUUID();
      batchStatements.push(
        db.insert(schema.goodsReceivedNoteItems).values({
          id: grnItemId,
          grnId,
          poItemId: poItem.id,
          productId: poItem.productId,
          quantityReceived: recItem.quantityReceived,
          unitCostCents: poItem.unitPriceCents,
        })
      );

      // Trigger stock movement IN
      batchStatements.push(
        db.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          productId: poItem.productId,
          type: 'IN',
          quantity: recItem.quantityReceived,
          unitCostCents: poItem.unitPriceCents,
          referenceType: 'PO_RECEIPT',
          referenceId: grnNumber,
          notes: 'Goods received against ' + po.poNumber,
        })
      );

      // Update PO Item quantity received
      const updatedQty = poItem.quantityReceived + recItem.quantityReceived;
      updatedQtyByItemId.set(poItem.id, updatedQty);
      batchStatements.push(
        db.update(schema.purchaseOrderItems).set({ quantityReceived: updatedQty }).where(eq(schema.purchaseOrderItems.id, poItem.id))
      );
    }

    // A PO is only fully RECEIVED once every line item's received quantity meets its ordered
    // quantity; otherwise it's PARTIALLY_RECEIVED so the remainder still shows up in Inbound.
    const isFullyReceived = po.items.every((item) => (updatedQtyByItemId.get(item.id) ?? item.quantityReceived) >= item.quantityOrdered);
    batchStatements.push(
      db
        .update(schema.purchaseOrders)
        .set({ status: isFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED', updatedAt: new Date().toISOString() })
        .where(eq(schema.purchaseOrders.id, poId))
    );

    // Execute atomic batch transaction
    await db.batch(batchStatements as any);

    return c.json({
      success: true,
      message: 'Goods received successfully. Stock ledger updated.',
      grnNumber,
      poNumber: po.poNumber,
    });
  }
);

/* ========================================================================== */
/* 4. SALES (O2C) MODULE                                                      */
/* ========================================================================== */

// POST /api/sales/customers - Create Customer
app.post(
  '/api/sales/customers',
  zValidator(
    'json',
    z.object({
      customerCode: z.string().min(2),
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      billingAddress: z.string().optional(),
      shippingAddress: z.string().optional(),
      taxId: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const customerId = crypto.randomUUID();
    await db.insert(schema.customers).values({
      id: customerId,
      customerCode: body.customerCode.toUpperCase(),
      name: body.name,
      email: body.email,
      phone: body.phone,
      billingAddress: body.billingAddress,
      shippingAddress: body.shippingAddress,
      taxId: body.taxId,
    });

    const customer = await db.query.customers.findFirst({ where: eq(schema.customers.id, customerId) });
    return c.json({ success: true, data: customer }, 201);
  }
);

// GET /api/sales/customers - List Customers
app.get('/api/sales/customers', async (c) => {
  const db = createDbClient(c.env.DB);
  const customers = await db.query.customers.findMany({ orderBy: [desc(schema.customers.createdAt)] });
  return c.json({ success: true, data: customers });
});

// PUT /api/sales/customers/:id - Update Customer Details
app.put(
  '/api/sales/customers/:id',
  zValidator(
    'json',
    z.object({
      customerCode: z.string().min(2).optional(),
      name: z.string().min(1).optional(),
      email: z.string().optional().nullable(),
      phone: z.string().optional().nullable(),
      billingAddress: z.string().optional().nullable(),
      shippingAddress: z.string().optional().nullable(),
      taxId: z.string().optional().nullable(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const existing = await db.query.customers.findFirst({ where: eq(schema.customers.id, id) });
    if (!existing) return c.json({ success: false, error: 'Customer not found' }, 404);

    await db
      .update(schema.customers)
      .set({
        customerCode: body.customerCode ? body.customerCode.trim().toUpperCase() : undefined,
        name: body.name ? body.name.trim() : undefined,
        email: body.email !== undefined ? (body.email ? body.email.trim() : null) : undefined,
        phone: body.phone !== undefined ? (body.phone ? body.phone.trim() : null) : undefined,
        billingAddress: body.billingAddress !== undefined ? (body.billingAddress ? body.billingAddress.trim() : null) : undefined,
        shippingAddress: body.shippingAddress !== undefined ? (body.shippingAddress ? body.shippingAddress.trim() : null) : undefined,
        taxId: body.taxId !== undefined ? (body.taxId ? body.taxId.trim() : null) : undefined,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.customers.id, id));

    const updated = await db.query.customers.findFirst({ where: eq(schema.customers.id, id) });
    return c.json({ success: true, data: updated });
  }
);

// POST /api/sales/customers/batch-import - Batch Import Customers from Excel/CSV
app.post(
  '/api/sales/customers/batch-import',
  zValidator(
    'json',
    z.object({
      customers: z
        .array(
          z.object({
            name: z.string().min(1),
            taxId: z.string().optional().nullable(),
            customerCode: z.string().optional().nullable(),
            email: z.string().optional().nullable(),
            phone: z.string().optional().nullable(),
            billingAddress: z.string().optional().nullable(),
            shippingAddress: z.string().optional().nullable(),
          })
        )
        .min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const validBody = c.req.valid('json');

    // 1. Fetch all existing customers for deduplication
    const allExisting = await db.query.customers.findMany();
    const existingByCode = new Map<string, typeof allExisting[0]>();
    const existingByName = new Map<string, typeof allExisting[0]>();
    const existingByTaxId = new Map<string, typeof allExisting[0]>();
    const usedCodes = new Set<string>();

    for (const cust of allExisting) {
      if (cust.customerCode) {
        const upper = cust.customerCode.trim().toUpperCase();
        existingByCode.set(upper, cust);
        usedCodes.add(upper);
      }
      if (cust.name) {
        existingByName.set(cust.name.trim().toLowerCase(), cust);
      }
      if (cust.taxId) {
        existingByTaxId.set(cust.taxId.trim().toUpperCase(), cust);
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    const batchStatements: any[] = [];
    let autoSeq = 1;

    for (const item of validBody.customers) {
      const name = item.name ? item.name.trim() : '';
      if (!name) continue;

      const cleanTaxId = item.taxId && item.taxId.trim() ? item.taxId.trim() : null;
      const cleanEmail = item.email && item.email.trim() ? item.email.trim() : null;
      const cleanPhone = item.phone && item.phone.trim() ? item.phone.trim() : null;
      const cleanAddress = item.billingAddress && item.billingAddress.trim() ? item.billingAddress.trim() : null;
      const rawCode = item.customerCode && item.customerCode.trim() ? item.customerCode.trim().toUpperCase() : '';

      // Match against existing records by: Code -> Exact Name -> Tax ID
      let matched = rawCode ? existingByCode.get(rawCode) : undefined;
      if (!matched) {
        matched = existingByName.get(name.toLowerCase());
      }
      if (!matched && cleanTaxId) {
        matched = existingByTaxId.get(cleanTaxId.toUpperCase());
      }

      const now = new Date().toISOString();

      if (matched) {
        // Update existing customer record
        batchStatements.push(
          db
            .update(schema.customers)
            .set({
              name,
              taxId: cleanTaxId || matched.taxId,
              email: cleanEmail || matched.email,
              phone: cleanPhone || matched.phone,
              billingAddress: cleanAddress || matched.billingAddress,
              updatedAt: now,
            })
            .where(eq(schema.customers.id, matched.id))
        );
        updatedCount++;
      } else {
        // Determine unique customer code
        let code = rawCode;
        if (!code || usedCodes.has(code)) {
          // Generate code from company initials
          const words = name.replace(/[^a-zA-Z0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
          let prefix = 'CUST';
          if (words.length > 1) {
            prefix = words.slice(0, 4).map((w) => w[0]).join('').toUpperCase();
          } else if (words.length === 1 && words[0].length >= 3) {
            prefix = words[0].slice(0, 4).toUpperCase();
          }
          if (prefix.length < 2) prefix = 'CUST';

          let candidate = `${prefix}-${String(autoSeq).padStart(3, '0')}`;
          while (usedCodes.has(candidate)) {
            autoSeq++;
            candidate = `${prefix}-${String(autoSeq).padStart(3, '0')}`;
          }
          code = candidate;
          autoSeq++;
        }

        usedCodes.add(code);
        const newId = crypto.randomUUID();

        batchStatements.push(
          db.insert(schema.customers).values({
            id: newId,
            customerCode: code,
            name,
            taxId: cleanTaxId,
            email: cleanEmail,
            phone: cleanPhone,
            billingAddress: cleanAddress,
            isActive: true,
            createdAt: now,
            updatedAt: now,
          })
        );
        createdCount++;
      }
    }

    // Execute in chunks of 50 to respect Cloudflare D1 batch constraints
    for (let i = 0; i < batchStatements.length; i += 50) {
      await db.batch(batchStatements.slice(i, i + 50) as any);
    }

    return c.json({
      success: true,
      data: {
        total: validBody.customers.length,
        createdCount,
        updatedCount,
      },
    });
  }
);

// POST /api/sales/orders - Create Sales Order
app.post(
  '/api/sales/orders',
  zValidator(
    'json',
    z.object({
      customerId: z.string().uuid(),
      siNumber: z.string().trim().min(1).max(64).optional(),
      soNumber: z.string().trim().min(1).max(64).optional(),
      currency: z.enum(['USD', 'PHP']),
      notes: z.string().optional(),
      items: z.array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().int().positive(),
          unitPriceCents: z.number().int().nonnegative(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const opsSetting = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, 'operations.config'),
    });
    let prefix = 'SI-';
    if (opsSetting?.value) {
      try {
        const conf = JSON.parse(opsSetting.value);
        prefix = conf.siPrefix || conf.soPrefix || 'SI-';
      } catch {}
    }

    const requestedNumber = (body.siNumber || body.soNumber)?.trim();
    let soNumber: string;
    if (requestedNumber) {
      const existing = await db.query.salesOrders.findFirst({
        where: eq(schema.salesOrders.soNumber, requestedNumber),
      });
      if (existing) {
        return c.json({ success: false, error: 'SI number "' + requestedNumber + '" is already in use' }, 409);
      }
      soNumber = requestedNumber;
    } else {
      const lastSO = await db.query.salesOrders.findFirst({
        orderBy: [desc(schema.salesOrders.createdAt)],
      });
      soNumber = generateNextSequence(lastSO?.soNumber, prefix);
      let attempts = 0;
      while (attempts < 50 && (await db.query.salesOrders.findFirst({ where: eq(schema.salesOrders.soNumber, soNumber) }))) {
        soNumber = generateNextSequence(soNumber, prefix);
        attempts++;
      }
    }

    const soId = crypto.randomUUID();
    const totalAmountCents = body.items.reduce((acc, it) => acc + it.quantity * it.unitPriceCents, 0);

    const soInsert = db.insert(schema.salesOrders).values({
      id: soId,
      soNumber,
      customerId: body.customerId,
      status: 'CONFIRMED',
      currency: body.currency,
      totalAmountCents,
      notes: body.notes,
    });

    const itemInserts = body.items.map((item) =>
      db.insert(schema.salesOrderItems).values({
        id: crypto.randomUUID(),
        salesOrderId: soId,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        subtotalCents: item.quantity * item.unitPriceCents,
      })
    );

    // Sales Invoice IS the Invoice: Create the unified invoice record with the exact same SI number
    const invoiceId = crypto.randomUUID();
    const invoiceInsert = db.insert(schema.invoices).values({
      id: invoiceId,
      invoiceNumber: soNumber,
      salesOrderId: soId,
      customerId: body.customerId,
      status: 'ISSUED',
      currency: body.currency,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalAmountCents,
      paidAmountCents: 0,
      notes: body.notes,
    });

    const invItemInserts = body.items.map((item) =>
      db.insert(schema.invoiceItems).values({
        id: crypto.randomUUID(),
        invoiceId,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
        subtotalCents: item.quantity * item.unitPriceCents,
      })
    );

    // Double-entry accounting: Debit Accounts Receivable (1300), Credit Sales Revenue (4010)
    const arAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1300') });
    const revAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '4010') });
    const jvEntries: any[] = [];
    if (arAccount && revAccount && totalAmountCents > 0) {
      const jvId = crypto.randomUUID();
      jvEntries.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: arAccount.id,
          debitCents: totalAmountCents,
          creditCents: 0,
          description: 'Accounts Receivable for Sales Invoice ' + soNumber,
        }),
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: revAccount.id,
          debitCents: 0,
          creditCents: totalAmountCents,
          description: 'Sales Revenue for Sales Invoice ' + soNumber,
        })
      );
    }

    await db.batch([soInsert, ...itemInserts, invoiceInsert, ...invItemInserts, ...jvEntries]);

    const createdSO = await db.query.salesOrders.findFirst({
      where: eq(schema.salesOrders.id, soId),
      with: { customer: true, items: { with: { product: true } }, invoices: true },
    });

    const responseData = createdSO
      ? {
          ...createdSO,
          soNumber: createdSO.soNumber ? createdSO.soNumber.replace(/^SO-/i, 'SI-') : createdSO.soNumber,
          siNumber: createdSO.soNumber ? createdSO.soNumber.replace(/^SO-/i, 'SI-') : createdSO.soNumber,
        }
      : createdSO;
    return c.json({ success: true, data: responseData }, 201);
  }
);

// GET /api/sales/orders - List Sales Orders
app.get('/api/sales/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.salesOrders.findMany({
    orderBy: [desc(schema.salesOrders.createdAt)],
    with: { customer: true, items: { with: { product: true } }, invoices: true },
  });
  return c.json({ success: true, data: await attachDeliveryReceipts(db, orders) });
});

// POST /api/sales/invoices/:id/receipt - Customer Payment Receipt
app.post(
  '/api/sales/invoices/:id/receipt',
  zValidator(
    'json',
    z.object({
      amountCents: z.number().int().positive(),
      paymentMethod: z.string().default('BANK_TRANSFER'),
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const invoiceId = c.req.param('id');
    const body = c.req.valid('json');

    const invoice = await db.query.invoices.findFirst({ where: eq(schema.invoices.id, invoiceId) });
    if (!invoice) return c.json({ success: false, error: 'Invoice not found' }, 404);

    const rvId = crypto.randomUUID();
    const rvNumber = 'RV-' + Date.now().toString().slice(-6);

    const rvInsert = db.insert(schema.receiptVouchers).values({
      id: rvId,
      voucherNumber: rvNumber,
      customerId: invoice.customerId,
      invoiceId: invoice.id,
      amountCents: body.amountCents,
      paymentMethod: body.paymentMethod,
      notes: body.notes,
    });

    const newPaidAmount = invoice.paidAmountCents + body.amountCents;
    const newStatus = newPaidAmount >= invoice.totalAmountCents ? 'PAID' : 'PARTIALLY_PAID';

    const invoiceUpdate = db
      .update(schema.invoices)
      .set({ paidAmountCents: newPaidAmount, status: newStatus, updatedAt: new Date().toISOString() })
      .where(eq(schema.invoices.id, invoiceId));

    const batchStatements: any[] = [rvInsert, invoiceUpdate];

    // Double-entry accounting: Cash (1010) Debit, Accounts Receivable (1300) Credit
    const cashAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') });
    const arAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1300') });

    if (cashAccount && arAccount) {
      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'RECEIPT',
          voucherId: rvId,
          accountId: cashAccount.id,
          debitCents: body.amountCents,
          creditCents: 0,
          description: 'Cash received for invoice ' + invoice.invoiceNumber,
        })
      );

      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'RECEIPT',
          voucherId: rvId,
          accountId: arAccount.id,
          debitCents: 0,
          creditCents: body.amountCents,
          description: 'A/R clearance for invoice ' + invoice.invoiceNumber,
        })
      );
    }

    await db.batch(batchStatements as any);

    return c.json({
      success: true,
      message: 'Receipt Voucher recorded. Invoice settled.',
      receiptVoucherNumber: rvNumber,
      invoiceNumber: invoice.invoiceNumber,
      invoiceStatus: newStatus,
      amountCents: body.amountCents,
    });
  }
);

// POST /api/sales/invoices - Issue an Invoice for an already-delivered Delivery Receipt, or upfront for a Sales Order.
// Delivery (Outbound) decrements physical stock upon DR confirmation;
// if an invoice is issued upfront for a Sales Order, no stock is moved yet.
app.post(
  '/api/sales/invoices',
  zValidator(
    'json',
    z
      .object({
        deliveryReceiptId: z.string().uuid().optional(),
        salesOrderId: z.string().uuid().optional(),
        dueDate: z.string().optional(),
        notes: z.string().optional(),
      })
      .refine((data) => Boolean(data.deliveryReceiptId || data.salesOrderId), {
        message: 'Either deliveryReceiptId or salesOrderId must be provided',
      })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const invoiceId = crypto.randomUUID();
    let invoiceNumber: string;
    let salesOrderId: string;
    let customerId: string;
    let currency: 'USD' | 'PHP';
    let totalAmountCents = 0;
    let revenueDescription = '';
    const batchStatements: any[] = [];

    if (body.deliveryReceiptId) {
      // Flow A: Issue Invoice for an already-delivered DR
      const dr = await db.query.deliveryReceipts.findFirst({
        where: eq(schema.deliveryReceipts.id, body.deliveryReceiptId),
        with: { items: true, salesOrder: true },
      });
      if (!dr) return c.json({ success: false, error: 'Delivery receipt not found' }, 404);
      if (dr.invoiceId) return c.json({ success: false, error: 'This delivery receipt has already been invoiced' }, 400);

      salesOrderId = dr.salesOrderId;
      customerId = dr.salesOrder.customerId;
      currency = dr.salesOrder.currency;
      totalAmountCents = dr.items.reduce((acc, item) => acc + item.quantity * item.unitPriceCents, 0);
      revenueDescription = 'Revenue from delivery ' + dr.drNumber;
      invoiceNumber = (dr.salesOrder.soNumber || '').replace(/^SO-/i, 'SI-');

      const invoiceInsert = db.insert(schema.invoices).values({
        id: invoiceId,
        invoiceNumber,
        salesOrderId,
        customerId,
        status: 'ISSUED',
        currency,
        dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmountCents,
        paidAmountCents: 0,
        notes: body.notes || dr.notes,
      });
      batchStatements.push(invoiceInsert);

      for (const item of dr.items) {
        batchStatements.push(
          db.insert(schema.invoiceItems).values({
            id: crypto.randomUUID(),
            invoiceId,
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            subtotalCents: item.quantity * item.unitPriceCents,
          })
        );
      }

      batchStatements.push(
        db.update(schema.deliveryReceipts).set({ invoiceId }).where(eq(schema.deliveryReceipts.id, dr.id))
      );
    } else {
      // Flow B: Issue Invoice directly from Sales Order upfront (goods not yet delivered; stock remains intact)
      const so = await db.query.salesOrders.findFirst({
        where: eq(schema.salesOrders.id, body.salesOrderId!),
        with: { items: { with: { product: true } }, customer: true, invoices: true },
      });
      if (!so) return c.json({ success: false, error: 'Sales Order not found' }, 404);
      if (so.status === 'CANCELLED') {
        return c.json({ success: false, error: 'Cannot issue invoice for a cancelled order' }, 400);
      }

      // Check if SO already has an active invoice
      const activeInvoice = (so.invoices || []).find((inv) => inv.status !== 'CANCELLED');
      if (activeInvoice) {
        return c.json({
          success: false,
          error: `Sales Invoice ${so.soNumber} already has an active invoice (${activeInvoice.invoiceNumber}).`,
          invoiceId: activeInvoice.id,
          invoiceNumber: activeInvoice.invoiceNumber,
        }, 400);
      }

      salesOrderId = so.id;
      customerId = so.customerId;
      currency = so.currency;
      totalAmountCents = so.totalAmountCents;
      revenueDescription = 'Revenue for sales invoice ' + so.soNumber;
      invoiceNumber = (so.soNumber || '').replace(/^SO-/i, 'SI-');

      const invoiceInsert = db.insert(schema.invoices).values({
        id: invoiceId,
        invoiceNumber,
        salesOrderId,
        customerId,
        status: 'ISSUED',
        currency,
        dueDate: body.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        totalAmountCents,
        paidAmountCents: 0,
        notes: body.notes || so.notes,
      });
      batchStatements.push(invoiceInsert);

      for (const item of so.items) {
        batchStatements.push(
          db.insert(schema.invoiceItems).values({
            id: crypto.randomUUID(),
            invoiceId,
            productId: item.productId,
            quantity: item.quantity,
            unitPriceCents: item.unitPriceCents,
            subtotalCents: item.subtotalCents,
          })
        );
      }
    }

    // Double-Entry Accounting: Accounts Receivable (1300) Debit, Sales Revenue (4010) Credit
    const arAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1300') });
    const revAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '4010') });

    if (arAccount && revAccount) {
      const jvId = crypto.randomUUID();
      const jvNumber = 'JV-SALES-' + Date.now().toString().slice(-6);

      batchStatements.push(
        db.insert(schema.journalVouchers).values({
          id: jvId,
          jvNumber,
          description: 'Sales revenue recognition for ' + invoiceNumber,
          referenceType: 'INVOICE',
          referenceId: invoiceId,
        })
      );

      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: arAccount.id,
          debitCents: totalAmountCents,
          creditCents: 0,
          description: 'Receivable from invoice ' + invoiceNumber,
        })
      );

      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: revAccount.id,
          debitCents: 0,
          creditCents: totalAmountCents,
          description: revenueDescription,
        })
      );
    }

    await db.batch(batchStatements as any);

    return c.json({
      success: true,
      message: 'Invoice ' + invoiceNumber + ' issued successfully.',
      invoiceId,
      invoiceNumber,
      totalAmountCents,
    });
  }
);

/* ========================================================================== */
/* 5. OUTBOUND DELIVERY TRACKING MODULE (Delivery Receipts)                   */
/* Every confirmed SO shows up here for two-step fulfillment:                 */
/*   1) Mark as Packed — the order is picked, boxed, ready to leave.          */
/*   2) Confirm Delivery — validates against both remaining ordered quantity  */
/*      and actual on-hand stock, decrements inventory, issues a numbered     */
/*      Delivery Receipt (DR) for just the delivered quantity, and moves the  */
/*      SO to PARTIALLY_FULFILLED or FULFILLED depending on whether every     */
/*      line is now fully delivered. No invoice is created here — that's a    */
/*      separate step from the Sales tab, billed against the DR on demand.   */
/* ========================================================================== */

// GET /api/outbound/orders - List SOs that have moved past DRAFT for delivery tracking
app.get('/api/outbound/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.salesOrders.findMany({
    where: (soTable, { inArray }) => inArray(soTable.status, ['CONFIRMED', 'PACKED', 'PARTIALLY_FULFILLED', 'FULFILLED']),
    orderBy: [desc(schema.salesOrders.createdAt)],
    with: { customer: true, items: { with: { product: true } }, invoices: true },
  });
  return c.json({ success: true, data: await attachDeliveryReceipts(db, orders) });
});

// GET /api/outbound/receipts - List all issued Delivery Receipts with line items & invoice link
app.get('/api/outbound/receipts', async (c) => {
  const db = createDbClient(c.env.DB);
  const receipts = await db.query.deliveryReceipts.findMany({
    orderBy: [desc(schema.deliveryReceipts.createdAt)],
    with: {
      salesOrder: {
        with: { customer: true },
      },
      invoice: true,
      items: {
        with: { product: true },
      },
    },
  });
  const mappedReceipts = receipts.map((dr) => {
    const so = dr.salesOrder;
    const raw = so?.soNumber || (so as any)?.siNumber || '';
    const num = raw ? raw.replace(/^SO-/i, 'SI-') : raw;
    const inv = dr.invoice;
    const mappedInv = inv
      ? {
          ...inv,
          invoiceNumber: num || (inv.invoiceNumber ? inv.invoiceNumber.replace(/^SO-/i, 'SI-').replace(/^INV-/i, 'SI-') : num),
        }
      : (num ? { id: dr.invoiceId || dr.id, invoiceNumber: num, status: 'ISSUED' } : null);
    return {
      ...dr,
      invoice: mappedInv,
      salesOrder: so ? { ...so, soNumber: num, siNumber: num } : so,
    };
  });
  return c.json({ success: true, data: mappedReceipts });
});

// POST /api/outbound/orders/:id/mark-packed - Step 1: order picked and ready to ship
app.post('/api/outbound/orders/:id/mark-packed', async (c) => {
  const db = createDbClient(c.env.DB);
  const soId = c.req.param('id');

  const so = await db.query.salesOrders.findFirst({ where: eq(schema.salesOrders.id, soId) });
  if (!so) return c.json({ success: false, error: 'Sales Order not found' }, 404);
  if (so.status !== 'CONFIRMED') {
    return c.json({ success: false, error: `Cannot mark as packed from status ${so.status}` }, 400);
  }

  await db
    .update(schema.salesOrders)
    .set({ status: 'PACKED', packedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(schema.salesOrders.id, soId));

  const updated = await db.query.salesOrders.findFirst({
    where: eq(schema.salesOrders.id, soId),
    with: { customer: true, items: { with: { product: true } }, invoices: true },
  });
  return c.json({ success: true, data: updated });
});

// Core logic to issue a Delivery Receipt against a Sales Order
async function executeDeliveryReceipt(
  db: ReturnType<typeof createDbClient>,
  soId: string,
  body: {
    drNumber?: string;
    notes?: string;
    receivedBy?: string;
    invoiceId?: string;
    items: Array<{ soItemId: string; quantityShipped: number }>;
  }
) {
  const so = await db.query.salesOrders.findFirst({
    where: eq(schema.salesOrders.id, soId),
    with: { items: { with: { product: true } }, invoices: true },
  });
  if (!so) return { error: 'Sales Order not found', status: 404 as const };
  if (so.status !== 'CONFIRMED' && so.status !== 'PACKED' && so.status !== 'PARTIALLY_FULFILLED') {
    return { error: `Cannot deliver from status ${so.status}. Order must be confirmed or packed.`, status: 400 as const };
  }

  // Validate every line before writing anything: can't deliver more than what's still
  // owed on the order, and — unlike receiving inbound stock — can't deliver more than
  // what's actually on hand.
  for (const shipItem of body.items) {
    const soItem = so.items.find((i) => i.id === shipItem.soItemId);
    if (!soItem) return { error: 'Sales order item not found: ' + shipItem.soItemId, status: 400 as const };

    const remaining = soItem.quantity - soItem.quantityShipped;
    if (shipItem.quantityShipped > remaining) {
      return {
        error: `Cannot deliver ${shipItem.quantityShipped} of ${soItem.product.name}; only ${remaining} remain on this order.`,
        status: 400 as const,
      };
    }

    const onHand = await getProductStockBalance(db, soItem.productId);
    if (shipItem.quantityShipped > onHand) {
      return {
        error: `Insufficient stock for ${soItem.product.name}: ${onHand} available, ${shipItem.quantityShipped} requested.`,
        status: 400 as const,
      };
    }
  }

  // Auto-link to existing invoice if one exists on this Sales Order
  let resolvedInvoiceId: string | null = body.invoiceId || null;
  if (!resolvedInvoiceId && so.invoices && so.invoices.length > 0) {
    const activeInvoice = so.invoices.find((inv) => inv.status !== 'CANCELLED');
    if (activeInvoice) {
      resolvedInvoiceId = activeInvoice.id;
    }
  }

  let drNumber: string;
  const requestedDr = body.drNumber?.trim();
  if (requestedDr) {
    const existing = await db.query.deliveryReceipts.findFirst({
      where: eq(schema.deliveryReceipts.drNumber, requestedDr),
    });
    if (existing) {
      return { error: 'DR number "' + requestedDr + '" is already in use', status: 409 as const };
    }
    drNumber = requestedDr;
  } else {
    const opsSetting = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, 'operations.config'),
    });
    let prefix = 'DR-';
    if (opsSetting?.value) {
      try {
        const conf = JSON.parse(opsSetting.value);
        if (conf.drPrefix) prefix = conf.drPrefix;
      } catch {}
    }
    const lastDR = await db.query.deliveryReceipts.findFirst({
      orderBy: [desc(schema.deliveryReceipts.createdAt)],
    });
    drNumber = generateNextSequence(lastDR?.drNumber, prefix);
    let attempts = 0;
    while (attempts < 50 && (await db.query.deliveryReceipts.findFirst({ where: eq(schema.deliveryReceipts.drNumber, drNumber) }))) {
      drNumber = generateNextSequence(drNumber, prefix);
      attempts++;
    }
  }

  const deliveryReceiptId = crypto.randomUUID();
  const drStatus = body.receivedBy ? 'COMPLETED' : 'IN_TRANSIT';
  const arrivedAt = body.receivedBy ? new Date().toISOString() : null;

  try {
    await db.run(sql`ALTER TABLE delivery_receipts ADD COLUMN status text NOT NULL DEFAULT 'IN_TRANSIT'`);
  } catch {}
  try {
    await db.run(sql`ALTER TABLE delivery_receipts ADD COLUMN arrived_at text`);
  } catch {}

  const drInsert = db.insert(schema.deliveryReceipts).values({
    id: deliveryReceiptId,
    drNumber,
    salesOrderId: so.id,
    invoiceId: resolvedInvoiceId,
    receivedBy: body.receivedBy || null,
    status: drStatus,
    arrivedAt,
    notes: body.notes,
  });

  const batchStatements: any[] = [drInsert];
  const updatedQtyByItemId = new Map<string, number>();

  for (const shipItem of body.items) {
    const soItem = so.items.find((i) => i.id === shipItem.soItemId)!;

    batchStatements.push(
      db.insert(schema.deliveryReceiptItems).values({
        id: crypto.randomUUID(),
        deliveryReceiptId,
        salesOrderItemId: soItem.id,
        productId: soItem.productId,
        quantity: shipItem.quantityShipped,
        unitPriceCents: soItem.unitPriceCents,
      })
    );

    // Decrement inventory via stock movement
    batchStatements.push(
      db.insert(schema.stockMovements).values({
        id: crypto.randomUUID(),
        productId: soItem.productId,
        type: 'OUT',
        quantity: shipItem.quantityShipped,
        unitCostCents: soItem.product.costPriceCents,
        referenceType: 'SO_DELIVERY',
        referenceId: drNumber,
        notes: 'Delivery for ' + so.soNumber,
      })
    );

    // Update SO Item quantity delivered
    const updatedQty = soItem.quantityShipped + shipItem.quantityShipped;
    updatedQtyByItemId.set(soItem.id, updatedQty);
    batchStatements.push(
      db.update(schema.salesOrderItems).set({ quantityShipped: updatedQty }).where(eq(schema.salesOrderItems.id, soItem.id))
    );
  }

  // A SO is only fully FULFILLED once every line item's delivered quantity meets its
  // ordered quantity; otherwise it's PARTIALLY_FULFILLED so the remainder still shows
  // up in Delivery Receipts.
  const isFullyDelivered = so.items.every((item) => (updatedQtyByItemId.get(item.id) ?? item.quantityShipped) >= item.quantity);
  batchStatements.push(
    db
      .update(schema.salesOrders)
      .set({
        status: isFullyDelivered ? 'FULFILLED' : 'PARTIALLY_FULFILLED',
        packedAt: so.packedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.salesOrders.id, soId))
  );

  await db.batch(batchStatements as any);

  return {
    deliveryReceiptId,
    drNumber,
    deliveryStatus: drStatus,
    arrivedAt,
    invoiceId: resolvedInvoiceId,
  };
}

// POST /api/outbound/orders/:id/deliver - Step 2: confirm delivered quantity, decrement inventory,
// issue a Delivery Receipt.
app.post(
  '/api/outbound/orders/:id/deliver',
  zValidator(
    'json',
    z.object({
      drNumber: z.string().trim().min(1).max(64).optional(),
      notes: z.string().optional(),
      receivedBy: z.string().optional(),
      invoiceId: z.string().uuid().optional(),
      items: z.array(
        z.object({
          soItemId: z.string().uuid(),
          quantityShipped: z.number().int().positive(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const soId = c.req.param('id');
    const body = c.req.valid('json');

    const result = await executeDeliveryReceipt(db, soId, body);
    if ('error' in result) {
      return c.json({ success: false, error: result.error }, result.status);
    }

    return c.json({
      success: true,
      message: 'Delivery Receipt issued and stock ledger updated.',
      deliveryReceiptId: result.deliveryReceiptId,
      drNumber: result.drNumber,
      status: result.deliveryStatus,
      arrivedAt: result.arrivedAt,
      invoiceId: result.invoiceId,
    });
  }
);

// POST /api/outbound/receipts - Create a Delivery Receipt directly
app.post(
  '/api/outbound/receipts',
  zValidator(
    'json',
    z.object({
      salesOrderId: z.string().uuid(),
      drNumber: z.string().trim().min(1).max(64).optional(),
      invoiceId: z.string().uuid().optional(),
      notes: z.string().optional(),
      receivedBy: z.string().optional(),
      items: z.array(
        z.object({
          soItemId: z.string().uuid(),
          quantityShipped: z.number().int().positive(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const result = await executeDeliveryReceipt(db, body.salesOrderId, body);
    if ('error' in result) {
      return c.json({ success: false, error: result.error }, result.status);
    }

    return c.json({
      success: true,
      message: 'Delivery Receipt issued and stock ledger updated.',
      deliveryReceiptId: result.deliveryReceiptId,
      drNumber: result.drNumber,
      status: result.deliveryStatus,
      arrivedAt: result.arrivedAt,
      invoiceId: result.invoiceId,
    }, 201);
  }
);

// POST /api/outbound/receipts/:id/mark-arrived - Mark a Delivery Receipt as Arrived & Completed
app.post(
  '/api/outbound/receipts/:id/mark-arrived',
  zValidator(
    'json',
    z.object({
      receivedBy: z.string().trim().min(1, 'Receiver name is required'),
      notes: z.string().optional(),
      arrivedAt: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const drId = c.req.param('id');
    const body = c.req.valid('json');

    const dr = await db.query.deliveryReceipts.findFirst({
      where: eq(schema.deliveryReceipts.id, drId),
    });
    if (!dr) return c.json({ success: false, error: 'Delivery receipt not found' }, 404);

    const arrivalTimestamp = body.arrivedAt || new Date().toISOString();
    const updatedNotes = body.notes
      ? (dr.notes ? `${dr.notes} | ${body.notes}` : body.notes)
      : dr.notes;

    await db
      .update(schema.deliveryReceipts)
      .set({
        status: 'COMPLETED',
        receivedBy: body.receivedBy,
        arrivedAt: arrivalTimestamp,
        notes: updatedNotes,
      })
      .where(eq(schema.deliveryReceipts.id, drId));

    return c.json({
      success: true,
      message: `Delivery Receipt ${dr.drNumber} marked as Arrived and Completed.`,
      data: {
        id: dr.id,
        drNumber: dr.drNumber,
        status: 'COMPLETED',
        receivedBy: body.receivedBy,
        arrivedAt: arrivalTimestamp,
      },
    });
  }
);

/* ========================================================================== */
/* 6. VOUCHERS & ACCOUNTING MODULE                                            */
/* ========================================================================== */

// GET /api/accounting/accounts - List Chart of Accounts
app.get('/api/accounting/accounts', async (c) => {
  const db = createDbClient(c.env.DB);
  const accounts = await db.query.accounts.findMany({ orderBy: [schema.accounts.code] });
  return c.json({ success: true, data: accounts });
});

// GET /api/accounting/trial-balance - Real-time Trial Balance Verification
app.get('/api/accounting/trial-balance', async (c) => {
  const db = createDbClient(c.env.DB);
  const accounts = await db.query.accounts.findMany({ orderBy: [schema.accounts.code] });
  const allEntries = await db.query.journalEntries.findMany();

  let totalDebitCents = 0;
  let totalCreditCents = 0;

  const trialBalance = accounts.map((acc) => {
    const accEntries = allEntries.filter((e) => e.accountId === acc.id);
    const debit = accEntries.reduce((sum, e) => sum + e.debitCents, 0);
    const credit = accEntries.reduce((sum, e) => sum + e.creditCents, 0);

    totalDebitCents += debit;
    totalCreditCents += credit;

    return {
      code: acc.code,
      name: acc.name,
      type: acc.type,
      totalDebitCents: debit,
      totalCreditCents: credit,
      netBalanceCents: acc.type === 'ASSET' || acc.type === 'EXPENSE' ? debit - credit : credit - debit,
    };
  });

  return c.json({
    success: true,
    isBalanced: totalDebitCents === totalCreditCents,
    totalDebitCents,
    totalCreditCents,
    discrepancyCents: totalDebitCents - totalCreditCents,
    accounts: trialBalance,
  });
});

// Helper to generate APEXS official sequential voucher numbers (e.g. 26-000440)
async function generateNextPaymentVoucherNumber(db: any): Promise<string> {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = `${currentYear}-`;

  const existing = await db.query.paymentVouchers.findMany({
    where: like(schema.paymentVouchers.voucherNumber, `${prefix}%`),
  });

  let maxSeq = 0;
  for (const v of existing) {
    if (v.voucherNumber && v.voucherNumber.startsWith(prefix)) {
      const numPart = v.voucherNumber.slice(prefix.length);
      const parsed = parseInt(numPart, 10);
      if (!isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }

  // Ensure next sequential candidate is strictly unique and never duplicates
  let candidateSeq = maxSeq + 1;
  while (true) {
    const candidate = `${prefix}${candidateSeq.toString().padStart(6, '0')}`;
    const taken = await db.query.paymentVouchers.findFirst({
      where: eq(schema.paymentVouchers.voucherNumber, candidate),
    });
    if (!taken) {
      return candidate;
    }
    candidateSeq++;
  }
}

// GET /api/accounting/vouchers - Unified Voucher Registry (PV, RV, JV)
app.get('/api/accounting/vouchers', async (c) => {
  const db = createDbClient(c.env.DB);
  const typeFilter = c.req.query('type'); // 'PAYMENT', 'RECEIPT', 'JOURNAL', or all

  await ensureVoucherHistoryTable(db);

  const [pvs, rvs, jvs, allEntries, allAccounts, allHistory] = await Promise.all([
    db.query.paymentVouchers.findMany({ orderBy: [desc(schema.paymentVouchers.createdAt)] }),
    db.query.receiptVouchers.findMany({
      orderBy: [desc(schema.receiptVouchers.createdAt)],
      with: { customer: true, invoice: true },
    }),
    db.query.journalVouchers.findMany({ orderBy: [desc(schema.journalVouchers.createdAt)] }),
    db.query.journalEntries.findMany({ with: { account: true } }),
    db.query.accounts.findMany(),
    db.query.voucherHistory.findMany({ columns: { voucherId: true } }).catch(() => []),
  ]);

  const historyCounts: Record<string, number> = {};
  for (const h of allHistory) {
    if (h.voucherId) {
      historyCounts[h.voucherId] = (historyCounts[h.voucherId] || 0) + 1;
    }
  }

  const vouchers: any[] = [];

  if (!typeFilter || typeFilter === 'PAYMENT') {
    pvs.forEach((pv) => {
      const entries = allEntries.filter((e) => e.voucherId === pv.id && e.voucherType === 'PAYMENT');
      let parsedItems = [];
      try {
        if (pv.items) parsedItems = JSON.parse(pv.items);
      } catch {}

      let parsedSignatories = null;
      try {
        if (pv.signatories) parsedSignatories = JSON.parse(pv.signatories);
      } catch {}

      let tag: string | null = pv.referenceType;
      let cleanNotes = pv.notes || '';
      if (cleanNotes.startsWith('[') && cleanNotes.includes(']')) {
        tag = cleanNotes.slice(1, cleanNotes.indexOf(']'));
        cleanNotes = cleanNotes.slice(cleanNotes.indexOf(']') + 1).trim();
      }
      if (tag === 'MANUAL') tag = null;

      vouchers.push({
        id: pv.id,
        voucherType: 'PAYMENT',
        voucherNumber: pv.voucherNumber,
        voucherDate: pv.voucherDate,
        recipient: pv.recipientName || pv.notes || pv.recipientType,
        recipientName: pv.recipientName,
        recipientType: pv.recipientType,
        currency: pv.currency || 'PHP',
        amountCents: pv.amountCents,
        paymentMethod: pv.paymentMethod,
        referenceType: pv.referenceType,
        tag: tag || null,
        referenceId: pv.referenceId,
        status: pv.status,
        notes: cleanNotes || pv.notes,
        items: parsedItems,
        signatories: parsedSignatories,
        createdAt: pv.createdAt,
        entries,
        historyCount: historyCounts[pv.id] || 0,
      });
    });
  }

  if (!typeFilter || typeFilter === 'RECEIPT') {
    rvs.forEach((rv) => {
      const entries = allEntries.filter((e) => e.voucherId === rv.id && e.voucherType === 'RECEIPT');
      vouchers.push({
        id: rv.id,
        voucherType: 'RECEIPT',
        voucherNumber: rv.voucherNumber,
        voucherDate: rv.voucherDate,
        recipient: rv.customer?.name || 'Customer Deposit',
        recipientType: 'CUSTOMER',
        currency: 'PHP',
        amountCents: rv.amountCents,
        paymentMethod: rv.paymentMethod,
        referenceType: rv.invoiceId ? 'INVOICE' : 'DIRECT_RECEIPT',
        tag: rv.invoiceId ? 'Sales Invoice' : 'Customer Receipt',
        referenceId: rv.invoice?.invoiceNumber || rv.invoiceId,
        status: rv.status,
        notes: rv.notes,
        createdAt: rv.createdAt,
        entries,
        historyCount: historyCounts[rv.id] || 0,
      });
    });
  }

  if (!typeFilter || typeFilter === 'JOURNAL') {
    jvs.forEach((jv) => {
      const entries = allEntries.filter((e) => e.voucherId === jv.id && e.voucherType === 'JOURNAL');
      const totalAmount = entries.reduce((sum, e) => sum + e.debitCents, 0);
      vouchers.push({
        id: jv.id,
        voucherType: 'JOURNAL',
        voucherNumber: jv.jvNumber,
        voucherDate: jv.voucherDate,
        recipient: jv.description,
        recipientType: 'GENERAL_LEDGER',
        currency: 'PHP',
        amountCents: totalAmount,
        paymentMethod: 'DOUBLE_ENTRY',
        referenceType: jv.referenceType || 'ADJUSTING_ENTRY',
        tag: jv.referenceType === 'CONTRA_TRANSFER' ? 'Contra Transfer' : (jv.referenceType || 'Journal Entry'),
        referenceId: jv.referenceId,
        status: jv.status,
        notes: jv.description,
        createdAt: jv.createdAt,
        entries,
        historyCount: historyCounts[jv.id] || 0,
      });
    });
  }

  vouchers.sort((a, b) => {
    const timeB = new Date((b as any).updatedAt || b.createdAt || b.voucherDate || 0).getTime();
    const timeA = new Date((a as any).updatedAt || a.createdAt || a.voucherDate || 0).getTime();
    return timeB - timeA;
  });

  return c.json({
    success: true,
    count: vouchers.length,
    data: vouchers,
    summary: {
      totalPaymentCents: pvs.reduce((s, p) => s + p.amountCents, 0),
      totalReceiptCents: rvs.reduce((s, r) => s + r.amountCents, 0),
      paymentCount: pvs.length,
      receiptCount: rvs.length,
      journalCount: jvs.length,
    },
  });
});

/** Ensures voucher_history table and index exist in the database. */
export async function ensureVoucherHistoryTable(db: Database): Promise<void> {
  try {
    const { sql } = await import('drizzle-orm');
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS voucher_history (
        id text PRIMARY KEY NOT NULL,
        voucher_id text NOT NULL,
        voucher_type text NOT NULL,
        voucher_number text,
        action text NOT NULL,
        changed_by_user_id text,
        changed_by_user_name text NOT NULL,
        changed_by_user_email text,
        summary text NOT NULL,
        changes text,
        created_at text NOT NULL
      );
    `);
    await db.run(sql`
      CREATE INDEX IF NOT EXISTS voucher_history_voucher_id_idx ON voucher_history (voucher_id);
    `);
  } catch (err) {
    // ignore
  }
}

interface VoucherHistoryEntryParams {
  voucherId: string;
  voucherType: 'PAYMENT' | 'RECEIPT' | 'JOURNAL';
  voucherNumber?: string | null;
  action: 'CREATED' | 'UPDATED' | 'APPROVED' | 'VOIDED' | 'RESTORED';
  user?: { id?: string; name?: string; email?: string } | null;
  summary: string;
  changes?: Record<string, { old: any; new: any }> | null;
}

async function recordVoucherHistory(db: Database, params: VoucherHistoryEntryParams): Promise<void> {
  try {
    await ensureVoucherHistoryTable(db);
    await db.insert(schema.voucherHistory).values({
      id: crypto.randomUUID(),
      voucherId: params.voucherId,
      voucherType: params.voucherType,
      voucherNumber: params.voucherNumber || null,
      action: params.action,
      changedByUserId: params.user?.id || null,
      changedByUserName: params.user?.name || params.user?.email || 'System / Admin',
      changedByUserEmail: params.user?.email || null,
      summary: params.summary,
      changes: params.changes ? JSON.stringify(params.changes) : null,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to record voucher history:', err);
  }
}

// POST /api/accounting/vouchers/payment - Create Payment Voucher (PV)
app.post(
  '/api/accounting/vouchers/payment',
  zValidator(
    'json',
    z.object({
      voucherNumber: z.string().optional(),
      voucherDate: z.string().optional(),
      recipientType: z.enum(['VENDOR', 'EMPLOYEE', 'OTHER']).default('VENDOR'),
      recipientName: z.string().min(1),
      currency: z.enum(['PHP', 'USD']).default('PHP'),
      amountCents: z.number().int().nonnegative().optional(),
      tag: z.string().optional(),
      items: z
        .array(
          z.object({
            invoiceNo: z.string().optional(),
            description: z.string(),
            currency: z.string().optional(),
            amountCents: z.number().int().nonnegative(),
          })
        )
        .optional(),
      signatories: z
        .object({
          preparedBy: z.string().optional(),
          certifiedBy: z.string().optional(),
          approvedBy: z.string().optional(),
          receivedBy: z.string().optional(),
        })
        .optional(),
      paymentMethod: z.string().default('BANK_TRANSFER'),
      paymentAccountCode: z.string().default('1010'), // Cash & Bank Account (credited)
      expenseAccountCode: z.string().default('5020'), // Expense or AP Account (debited)
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const [payAcc, expAcc] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.paymentAccountCode) }),
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.expenseAccountCode) }),
    ]);

    if (!payAcc) return c.json({ success: false, error: `Payment account code ${body.paymentAccountCode} not found` }, 404);
    if (!expAcc) return c.json({ success: false, error: `Expense account code ${body.expenseAccountCode} not found` }, 404);

    let totalAmountCents = body.amountCents || 0;
    if (body.items && body.items.length > 0) {
      totalAmountCents = body.items.reduce((sum, it) => sum + (it.amountCents || 0), 0);
    }

    if (totalAmountCents <= 0) {
      return c.json({ success: false, error: 'Total voucher amount must be greater than zero' }, 400);
    }

    const pvId = crypto.randomUUID();
    let voucherNumber = body.voucherNumber?.trim();
    if (voucherNumber) {
      const dup = await db.query.paymentVouchers.findFirst({
        where: eq(schema.paymentVouchers.voucherNumber, voucherNumber),
      });
      if (dup) {
        return c.json({ success: false, error: `Voucher #${voucherNumber} already exists. Please choose a unique voucher number.` }, 409);
      }
    } else {
      voucherNumber = await generateNextPaymentVoucherNumber(db);
    }
    const voucherDate = body.voucherDate || new Date().toISOString();

    const tagPrefix = body.tag ? `[${body.tag}] ` : '';
    const storedNotes = body.notes ? `${tagPrefix}${body.notes}`.trim() : (body.tag ? `[${body.tag}]` : null);

    const pvInsert = db.insert(schema.paymentVouchers).values({
      id: pvId,
      voucherNumber,
      voucherDate,
      recipientType: body.recipientType,
      recipientName: body.recipientName,
      currency: body.currency,
      amountCents: totalAmountCents,
      paymentMethod: body.paymentMethod,
      referenceType: 'MANUAL',
      notes: storedNotes,
      items: body.items && body.items.length > 0 ? JSON.stringify(body.items) : null,
      signatories: body.signatories ? JSON.stringify(body.signatories) : null,
      status: 'POSTED',
    });

    // Leg 1: Debit Expense / AP Account
    const debitLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'PAYMENT',
      voucherId: pvId,
      accountId: expAcc.id,
      debitCents: totalAmountCents,
      creditCents: 0,
      description: `Payment to ${body.recipientName} (${voucherNumber})`,
      entryDate: voucherDate,
    });

    // Leg 2: Credit Cash / Bank Account
    const creditLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'PAYMENT',
      voucherId: pvId,
      accountId: payAcc.id,
      debitCents: 0,
      creditCents: totalAmountCents,
      description: `Disbursement for ${body.recipientName} (${voucherNumber})`,
      entryDate: voucherDate,
    });

    await db.batch([pvInsert, debitLeg, creditLeg]);

    const authUser = c.get('authUser');
    await recordVoucherHistory(db, {
      voucherId: pvId,
      voucherType: 'PAYMENT',
      voucherNumber,
      action: 'CREATED',
      user: authUser,
      summary: `Created Payment Voucher for ${body.recipientName} (${body.currency || 'PHP'} ${(totalAmountCents / 100).toFixed(2)})`,
    });

    return c.json(
      {
        success: true,
        message: 'Payment Voucher posted successfully',
        voucherNumber,
        amountCents: totalAmountCents,
      },
      201
    );
  }
);

// POST /api/accounting/vouchers/receipt - Create Receipt Voucher (RV)
app.post(
  '/api/accounting/vouchers/receipt',
  zValidator(
    'json',
    z.object({
      payerName: z.string().min(1),
      amountCents: z.number().int().positive(),
      paymentMethod: z.string().default('BANK_TRANSFER'),
      depositAccountCode: z.string().default('1010'), // Cash & Bank Account (debited)
      creditAccountCode: z.string().default('4010'),  // Revenue or AR Account (credited)
      notes: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const [depAcc, crdAcc] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.depositAccountCode) }),
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.creditAccountCode) }),
    ]);

    if (!depAcc) return c.json({ success: false, error: `Deposit account code ${body.depositAccountCode} not found` }, 404);
    if (!crdAcc) return c.json({ success: false, error: `Credit account code ${body.creditAccountCode} not found` }, 404);

    const rvId = crypto.randomUUID();
    const voucherNumber = 'RV-' + Date.now().toString().slice(-6);

    const rvInsert = db.insert(schema.receiptVouchers).values({
      id: rvId,
      voucherNumber,
      amountCents: body.amountCents,
      paymentMethod: body.paymentMethod,
      notes: `${body.payerName}${body.notes ? ' - ' + body.notes : ''}`,
      status: 'POSTED',
    });

    // Leg 1: Debit Cash / Bank Account (Funds In)
    const debitLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'RECEIPT',
      voucherId: rvId,
      accountId: depAcc.id,
      debitCents: body.amountCents,
      creditCents: 0,
      description: `Receipt from ${body.payerName} (${voucherNumber})`,
    });

    // Leg 2: Credit Revenue / AR Account
    const creditLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'RECEIPT',
      voucherId: rvId,
      accountId: crdAcc.id,
      debitCents: 0,
      creditCents: body.amountCents,
      description: `Credit allocation for receipt ${body.payerName} (${voucherNumber})`,
    });

    await db.batch([rvInsert, debitLeg, creditLeg]);

    const authUser = c.get('authUser');
    await recordVoucherHistory(db, {
      voucherId: rvId,
      voucherType: 'RECEIPT',
      voucherNumber,
      action: 'CREATED',
      user: authUser,
      summary: `Created Receipt Voucher for ${body.payerName} (₱${(body.amountCents / 100).toFixed(2)})`,
    });

    return c.json({
      success: true,
      message: 'Receipt Voucher posted successfully',
      voucherNumber,
      amountCents: body.amountCents,
    }, 201);
  }
);

// POST /api/accounting/vouchers/contra - Create Contra Voucher (CV / Bank-to-Cash transfer)
app.post(
  '/api/accounting/vouchers/contra',
  zValidator(
    'json',
    z.object({
      fromAccountCode: z.string(), // e.g., '1010' Cash on Hand (credited)
      toAccountCode: z.string(),   // e.g., '1020' Main Bank Account (debited)
      amountCents: z.number().int().positive(),
      description: z.string().min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    if (body.fromAccountCode === body.toAccountCode) {
      return c.json({ success: false, error: 'Source and destination accounts must be different' }, 400);
    }

    const [fromAcc, toAcc] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.fromAccountCode) }),
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, body.toAccountCode) }),
    ]);

    if (!fromAcc) return c.json({ success: false, error: `Source account ${body.fromAccountCode} not found` }, 404);
    if (!toAcc) return c.json({ success: false, error: `Destination account ${body.toAccountCode} not found` }, 404);

    const jvId = crypto.randomUUID();
    const cvNumber = 'CV-' + Date.now().toString().slice(-6);

    const jvInsert = db.insert(schema.journalVouchers).values({
      id: jvId,
      jvNumber: cvNumber,
      description: `Contra Transfer: ${body.description}`,
      referenceType: 'CONTRA_TRANSFER',
      status: 'POSTED',
    });

    // Debit destination account
    const debitLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'JOURNAL',
      voucherId: jvId,
      accountId: toAcc.id,
      debitCents: body.amountCents,
      creditCents: 0,
      description: `Contra: Transfer to ${toAcc.name} (${cvNumber})`,
    });

    // Credit source account
    const creditLeg = db.insert(schema.journalEntries).values({
      id: crypto.randomUUID(),
      voucherType: 'JOURNAL',
      voucherId: jvId,
      accountId: fromAcc.id,
      debitCents: 0,
      creditCents: body.amountCents,
      description: `Contra: Transfer from ${fromAcc.name} (${cvNumber})`,
    });

    await db.batch([jvInsert, debitLeg, creditLeg]);

    const authUser = c.get('authUser');
    await recordVoucherHistory(db, {
      voucherId: jvId,
      voucherType: 'JOURNAL',
      voucherNumber: cvNumber,
      action: 'CREATED',
      user: authUser,
      summary: `Created Contra Voucher: ${body.description} (₱${(body.amountCents / 100).toFixed(2)})`,
    });

    return c.json({
      success: true,
      message: 'Contra Voucher posted successfully',
      voucherNumber: cvNumber,
      amountCents: body.amountCents,
    }, 201);
  }
);

// POST /api/accounting/vouchers/journal - Create Balanced Journal Voucher (JV)
app.post(
  '/api/accounting/vouchers/journal',
  zValidator(
    'json',
    z.object({
      description: z.string().min(1),
      referenceType: z.string().optional(),
      referenceId: z.string().optional(),
      entries: z
        .array(
          z.object({
            accountCode: z.string(),
            debitCents: z.number().int().nonnegative(),
            creditCents: z.number().int().nonnegative(),
            description: z.string().optional(),
          })
        )
        .min(2),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const totalDebit = body.entries.reduce((sum, e) => sum + e.debitCents, 0);
    const totalCredit = body.entries.reduce((sum, e) => sum + e.creditCents, 0);

    if (totalDebit !== totalCredit) {
      return c.json(
        {
          success: false,
          error: 'Double-entry violation: Total debits must equal total credits',
        },
        400
      );
    }

    const jvId = crypto.randomUUID();
    const jvNumber = 'JV-' + Date.now().toString().slice(-6);

    const jvInsert = db.insert(schema.journalVouchers).values({
      id: jvId,
      jvNumber,
      description: body.description,
      referenceType: body.referenceType,
      referenceId: body.referenceId,
    });

    const entryInserts: any[] = [];
    for (const entry of body.entries) {
      const acc = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, entry.accountCode) });
      if (!acc) return c.json({ success: false, error: 'Account with code ' + entry.accountCode + ' not found' }, 404);

      entryInserts.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: acc.id,
          debitCents: entry.debitCents,
          creditCents: entry.creditCents,
          description: entry.description || body.description,
        })
      );
    }

    await db.batch([jvInsert, ...entryInserts]);

    const authUser = c.get('authUser');
    await recordVoucherHistory(db, {
      voucherId: jvId,
      voucherType: 'JOURNAL',
      voucherNumber: jvNumber,
      action: 'CREATED',
      user: authUser,
      summary: `Created Journal Voucher: ${body.description} (₱${(totalDebit / 100).toFixed(2)})`,
    });

    return c.json({
      success: true,
      message: 'Journal Voucher created and posted.',
      jvNumber,
      totalAmountCents: totalDebit,
    }, 201);
  }
);

/* ========================================================================== */
/* VOUCHER CRUD & ADMIN APPROVAL / DECLINE / RESTORE WORKFLOW                 */
/* ========================================================================== */

// PATCH /api/accounting/vouchers/:id - Edit Voucher
app.patch(
  '/api/accounting/vouchers/:id',
  zValidator(
    'json',
    z.object({
      voucherNumber: z.string().optional(),
      recipientName: z.string().optional(),
      recipientType: z.enum(['VENDOR', 'EMPLOYEE', 'OTHER']).optional(),
      currency: z.enum(['PHP', 'USD']).optional(),
      voucherDate: z.string().optional(),
      paymentMethod: z.string().optional(),
      tag: z.string().optional(),
      status: z.enum(['DRAFT', 'POSTED', 'VOID']).optional(),
      notes: z.string().optional(),
      amountCents: z.number().int().nonnegative().optional(),
      items: z
        .array(
          z.object({
            invoiceNo: z.string().optional(),
            description: z.string(),
            currency: z.string().optional(),
            amountCents: z.number().int().nonnegative(),
          })
        )
        .optional(),
      signatories: z
        .object({
          preparedBy: z.string().optional(),
          certifiedBy: z.string().optional(),
          approvedBy: z.string().optional(),
          receivedBy: z.string().optional(),
        })
        .optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');
    const authUser = c.get('authUser');

    const [pv, rv, jv] = await Promise.all([
      db.query.paymentVouchers.findFirst({ where: eq(schema.paymentVouchers.id, id) }),
      db.query.receiptVouchers.findFirst({ where: eq(schema.receiptVouchers.id, id) }),
      db.query.journalVouchers.findFirst({ where: eq(schema.journalVouchers.id, id) }),
    ]);

    if (!pv && !rv && !jv) {
      return c.json({ success: false, error: 'Voucher not found' }, 404);
    }

    if (pv) {
      // Track granular field differences
      const changes: Record<string, { old: any; new: any }> = {};
      const summaryParts: string[] = [];

      let finalVoucherNumber = pv.voucherNumber;
      if (body.voucherNumber !== undefined && body.voucherNumber.trim() !== '') {
        const trimmedVoucherNumber = body.voucherNumber.trim();
        if (trimmedVoucherNumber !== pv.voucherNumber) {
          if (pv.status !== 'DRAFT') {
            return c.json(
              { success: false, error: 'Voucher number can only be changed while the voucher is in DRAFT status.' },
              400
            );
          }
          const existingPv = await db.query.paymentVouchers.findFirst({
            where: and(
              eq(schema.paymentVouchers.voucherNumber, trimmedVoucherNumber),
              ne(schema.paymentVouchers.id, id)
            ),
          });
          if (existingPv) {
            return c.json(
              { success: false, error: `Voucher # "${trimmedVoucherNumber}" is already in use by another voucher. Please choose a unique voucher number.` },
              409
            );
          }
          changes['voucherNumber'] = { old: pv.voucherNumber, new: trimmedVoucherNumber };
          summaryParts.push(`voucher # changed from "${pv.voucherNumber}" to "${trimmedVoucherNumber}"`);
          finalVoucherNumber = trimmedVoucherNumber;
        }
      }

      let totalAmountCents = body.amountCents !== undefined ? body.amountCents : pv.amountCents;
      if (body.items && body.items.length > 0) {
        totalAmountCents = body.items.reduce((sum, it) => sum + (it.amountCents || 0), 0);
      }

      let finalNotes = body.notes !== undefined ? body.notes : pv.notes;
      if (body.tag !== undefined) {
        let cleanNotes = finalNotes || '';
        if (cleanNotes.startsWith('[') && cleanNotes.includes(']')) {
          cleanNotes = cleanNotes.slice(cleanNotes.indexOf(']') + 1).trim();
        }
        const tagTrimmed = body.tag.trim();
        const tagPrefix = tagTrimmed ? `[${tagTrimmed}] ` : '';
        finalNotes = tagTrimmed ? `${tagPrefix}${cleanNotes}`.trim() : (cleanNotes || null);
      }

      if (totalAmountCents !== pv.amountCents) {
        changes['amountCents'] = { old: pv.amountCents, new: totalAmountCents };
        const curr = body.currency || pv.currency || 'PHP';
        const sym = curr === 'USD' ? '$' : '₱';
        summaryParts.push(`amount changed from ${sym}${(pv.amountCents / 100).toFixed(2)} to ${sym}${(totalAmountCents / 100).toFixed(2)}`);
      }

      if (body.recipientName !== undefined && body.recipientName !== (pv.recipientName || '')) {
        changes['recipientName'] = { old: pv.recipientName || '', new: body.recipientName };
        summaryParts.push(`recipient changed to "${body.recipientName}"`);
      }

      if (body.recipientType !== undefined && body.recipientType !== pv.recipientType) {
        changes['recipientType'] = { old: pv.recipientType, new: body.recipientType };
        summaryParts.push(`classification changed to ${body.recipientType}`);
      }

      if (body.currency !== undefined && body.currency !== pv.currency) {
        changes['currency'] = { old: pv.currency, new: body.currency };
        summaryParts.push(`currency changed to ${body.currency}`);
      }

      if (body.voucherDate !== undefined) {
        const oldDate = pv.voucherDate ? pv.voucherDate.slice(0, 10) : '';
        const newDate = body.voucherDate.slice(0, 10);
        if (oldDate !== newDate) {
          changes['voucherDate'] = { old: oldDate, new: newDate };
          summaryParts.push(`voucher date changed to ${newDate}`);
        }
      }

      if (body.paymentMethod !== undefined && body.paymentMethod !== pv.paymentMethod) {
        changes['paymentMethod'] = { old: pv.paymentMethod, new: body.paymentMethod };
        summaryParts.push(`payment method changed to ${body.paymentMethod}`);
      }

      if (body.status !== undefined && body.status !== pv.status) {
        changes['status'] = { old: pv.status, new: body.status };
        summaryParts.push(`status changed from ${pv.status} to ${body.status}`);
      }

      if (finalNotes !== (pv.notes || null)) {
        changes['notes'] = { old: pv.notes || '', new: finalNotes || '' };
        summaryParts.push(`memo/notes updated`);
      }

      if (body.items !== undefined) {
        const oldItemsStr = pv.items || '[]';
        const newItemsStr = JSON.stringify(body.items);
        if (oldItemsStr !== newItemsStr) {
          changes['items'] = {
            old: (() => { try { return JSON.parse(oldItemsStr); } catch (_) { return []; } })(),
            new: body.items,
          };
          summaryParts.push(`line items updated (${body.items.length} item${body.items.length === 1 ? '' : 's'})`);
        }
      }

      if (body.signatories !== undefined) {
        const oldSigStr = pv.signatories || '{}';
        const newSigStr = JSON.stringify(body.signatories);
        if (oldSigStr !== newSigStr) {
          changes['signatories'] = {
            old: (() => { try { return JSON.parse(oldSigStr); } catch (_) { return {}; } })(),
            new: body.signatories,
          };
          summaryParts.push(`signatories updated`);
        }
      }

      await db
        .update(schema.paymentVouchers)
        .set({
          voucherNumber: finalVoucherNumber,
          recipientName: body.recipientName !== undefined ? body.recipientName : pv.recipientName,
          recipientType: body.recipientType !== undefined ? body.recipientType : pv.recipientType,
          currency: body.currency || pv.currency,
          voucherDate: body.voucherDate || pv.voucherDate,
          paymentMethod: (body.paymentMethod as any) || pv.paymentMethod,
          status: body.status || pv.status,
          notes: finalNotes,
          amountCents: totalAmountCents,
          items: body.items ? JSON.stringify(body.items) : pv.items,
          signatories: body.signatories ? JSON.stringify(body.signatories) : pv.signatories,
        })
        .where(eq(schema.paymentVouchers.id, id));

      if (pv.status === 'POSTED') {
        const entries = await db.query.journalEntries.findMany({ where: eq(schema.journalEntries.voucherId, id) });
        for (const entry of entries) {
          if (entry.debitCents > 0) {
            await db.update(schema.journalEntries).set({ debitCents: totalAmountCents, entryDate: body.voucherDate || pv.voucherDate }).where(eq(schema.journalEntries.id, entry.id));
          } else if (entry.creditCents > 0) {
            await db.update(schema.journalEntries).set({ creditCents: totalAmountCents, entryDate: body.voucherDate || pv.voucherDate }).where(eq(schema.journalEntries.id, entry.id));
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        const summary = summaryParts.length > 0 ? `Edited: ${summaryParts.join(', ')}` : 'Edited voucher details';
        await recordVoucherHistory(db, {
          voucherId: id,
          voucherType: 'PAYMENT',
          voucherNumber: finalVoucherNumber,
          action: 'UPDATED',
          user: authUser,
          summary,
          changes,
        });
      }

      return c.json({ success: true, message: 'Payment Voucher updated successfully' });
    }

    if (rv) {
      const totalAmountCents = body.amountCents !== undefined ? body.amountCents : rv.amountCents;

      const changes: Record<string, { old: any; new: any }> = {};
      const summaryParts: string[] = [];

      if (totalAmountCents !== rv.amountCents) {
        changes['amountCents'] = { old: rv.amountCents, new: totalAmountCents };
        const sym = '₱';
        summaryParts.push(`amount changed from ${sym}${(rv.amountCents / 100).toFixed(2)} to ${sym}${(totalAmountCents / 100).toFixed(2)}`);
      }

      if (body.voucherDate !== undefined) {
        const oldDate = rv.voucherDate ? rv.voucherDate.slice(0, 10) : '';
        const newDate = body.voucherDate.slice(0, 10);
        if (oldDate !== newDate) {
          changes['voucherDate'] = { old: oldDate, new: newDate };
          summaryParts.push(`voucher date changed to ${newDate}`);
        }
      }

      if (body.paymentMethod !== undefined && body.paymentMethod !== rv.paymentMethod) {
        changes['paymentMethod'] = { old: rv.paymentMethod, new: body.paymentMethod };
        summaryParts.push(`payment method changed to ${body.paymentMethod}`);
      }

      if (body.notes !== undefined && body.notes !== (rv.notes || '')) {
        changes['notes'] = { old: rv.notes || '', new: body.notes };
        summaryParts.push(`notes updated`);
      }

      await db
        .update(schema.receiptVouchers)
        .set({
          voucherDate: body.voucherDate || rv.voucherDate,
          paymentMethod: (body.paymentMethod as any) || rv.paymentMethod,
          notes: body.notes !== undefined ? body.notes : rv.notes,
          amountCents: totalAmountCents,
        })
        .where(eq(schema.receiptVouchers.id, id));

      if (rv.status === 'POSTED') {
        const entries = await db.query.journalEntries.findMany({ where: eq(schema.journalEntries.voucherId, id) });
        for (const entry of entries) {
          if (entry.debitCents > 0) {
            await db.update(schema.journalEntries).set({ debitCents: totalAmountCents, entryDate: body.voucherDate || rv.voucherDate }).where(eq(schema.journalEntries.id, entry.id));
          } else if (entry.creditCents > 0) {
            await db.update(schema.journalEntries).set({ creditCents: totalAmountCents, entryDate: body.voucherDate || rv.voucherDate }).where(eq(schema.journalEntries.id, entry.id));
          }
        }
      }

      if (Object.keys(changes).length > 0) {
        const summary = summaryParts.length > 0 ? `Edited: ${summaryParts.join(', ')}` : 'Edited voucher details';
        await recordVoucherHistory(db, {
          voucherId: id,
          voucherType: 'RECEIPT',
          voucherNumber: rv.voucherNumber,
          action: 'UPDATED',
          user: authUser,
          summary,
          changes,
        });
      }

      return c.json({ success: true, message: 'Receipt Voucher updated successfully' });
    }

    if (jv) {
      const changes: Record<string, { old: any; new: any }> = {};
      const summaryParts: string[] = [];

      if (body.voucherDate !== undefined) {
        const oldDate = jv.voucherDate ? jv.voucherDate.slice(0, 10) : '';
        const newDate = body.voucherDate.slice(0, 10);
        if (oldDate !== newDate) {
          changes['voucherDate'] = { old: oldDate, new: newDate };
          summaryParts.push(`voucher date changed to ${newDate}`);
        }
      }

      if (body.notes !== undefined && body.notes !== (jv.description || '')) {
        changes['description'] = { old: jv.description || '', new: body.notes };
        summaryParts.push(`description updated`);
      }

      await db
        .update(schema.journalVouchers)
        .set({
          voucherDate: body.voucherDate || jv.voucherDate,
          description: body.notes !== undefined ? body.notes : jv.description,
        })
        .where(eq(schema.journalVouchers.id, id));

      if (Object.keys(changes).length > 0) {
        const summary = summaryParts.length > 0 ? `Edited: ${summaryParts.join(', ')}` : 'Edited voucher details';
        await recordVoucherHistory(db, {
          voucherId: id,
          voucherType: 'JOURNAL',
          voucherNumber: jv.jvNumber,
          action: 'UPDATED',
          user: authUser,
          summary,
          changes,
        });
      }

      return c.json({ success: true, message: 'Journal Voucher updated successfully' });
    }
  }
);

// POST /api/accounting/vouchers/:id/approve - Approve Voucher
app.post('/api/accounting/vouchers/:id/approve', requireVoucherOrAccounting('update'), async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const [pv, rv, jv] = await Promise.all([
    db.query.paymentVouchers.findFirst({ where: eq(schema.paymentVouchers.id, id) }),
    db.query.receiptVouchers.findFirst({ where: eq(schema.receiptVouchers.id, id) }),
    db.query.journalVouchers.findFirst({ where: eq(schema.journalVouchers.id, id) }),
  ]);

  if (!pv && !rv && !jv) return c.json({ success: false, error: 'Voucher not found' }, 404);

  const authUser = c.get('authUser');
  const voucherNumber = pv?.voucherNumber || rv?.voucherNumber || jv?.jvNumber || null;
  const voucherType = pv ? 'PAYMENT' : (rv ? 'RECEIPT' : 'JOURNAL');
  const oldStatus = (pv || rv || jv)!.status;

  if (pv) {
    await db.update(schema.paymentVouchers).set({ status: 'POSTED' }).where(eq(schema.paymentVouchers.id, id));
    const entries = await db.query.journalEntries.findMany({ where: eq(schema.journalEntries.voucherId, id) });
    if (entries.length === 0) {
      const [payAcc, expAcc] = await Promise.all([
        db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') }),
        db.query.accounts.findFirst({ where: eq(schema.accounts.code, '5020') }),
      ]);
      if (payAcc && expAcc) {
        await db.insert(schema.journalEntries).values([
          {
            id: crypto.randomUUID(),
            voucherType: 'PAYMENT',
            voucherId: id,
            accountId: expAcc.id,
            debitCents: pv.amountCents,
            creditCents: 0,
            description: `Payment to ${pv.recipientName || 'Payee'} (${pv.voucherNumber})`,
            entryDate: pv.voucherDate,
          },
          {
            id: crypto.randomUUID(),
            voucherType: 'PAYMENT',
            voucherId: id,
            accountId: payAcc.id,
            debitCents: 0,
            creditCents: pv.amountCents,
            description: `Disbursement for ${pv.recipientName || 'Payee'} (${pv.voucherNumber})`,
            entryDate: pv.voucherDate,
          },
        ]);
      }
    }
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'APPROVED',
      user: authUser,
      summary: 'Approved voucher and posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Payment Voucher approved and posted to General Ledger' });
  }

  if (rv) {
    await db.update(schema.receiptVouchers).set({ status: 'POSTED' }).where(eq(schema.receiptVouchers.id, id));
    const entries = await db.query.journalEntries.findMany({ where: eq(schema.journalEntries.voucherId, id) });
    if (entries.length === 0) {
      const [cashAcc, arAcc] = await Promise.all([
        db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') }),
        db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1100') }),
      ]);
      if (cashAcc && arAcc) {
        await db.insert(schema.journalEntries).values([
          {
            id: crypto.randomUUID(),
            voucherType: 'RECEIPT',
            voucherId: id,
            accountId: cashAcc.id,
            debitCents: rv.amountCents,
            creditCents: 0,
            description: `Customer Receipt (${rv.voucherNumber})`,
            entryDate: rv.voucherDate,
          },
          {
            id: crypto.randomUUID(),
            voucherType: 'RECEIPT',
            voucherId: id,
            accountId: arAcc.id,
            debitCents: 0,
            creditCents: rv.amountCents,
            description: `Customer A/R Settlement (${rv.voucherNumber})`,
            entryDate: rv.voucherDate,
          },
        ]);
      }
    }
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'APPROVED',
      user: authUser,
      summary: 'Approved voucher and posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Receipt Voucher approved and posted to General Ledger' });
  }

  if (jv) {
    await db.update(schema.journalVouchers).set({ status: 'POSTED' }).where(eq(schema.journalVouchers.id, id));
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'APPROVED',
      user: authUser,
      summary: 'Approved voucher and posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Journal Voucher approved and posted to General Ledger' });
  }
});

// POST /api/accounting/vouchers/:id/decline - Decline / Void Voucher
app.post('/api/accounting/vouchers/:id/decline', requireVoucherOrAccounting('update'), async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const [pv, rv, jv] = await Promise.all([
    db.query.paymentVouchers.findFirst({ where: eq(schema.paymentVouchers.id, id) }),
    db.query.receiptVouchers.findFirst({ where: eq(schema.receiptVouchers.id, id) }),
    db.query.journalVouchers.findFirst({ where: eq(schema.journalVouchers.id, id) }),
  ]);

  if (!pv && !rv && !jv) return c.json({ success: false, error: 'Voucher not found' }, 404);

  const authUser = c.get('authUser');
  const voucherNumber = pv?.voucherNumber || rv?.voucherNumber || jv?.jvNumber || null;
  const voucherType = pv ? 'PAYMENT' : (rv ? 'RECEIPT' : 'JOURNAL');
  const oldStatus = (pv || rv || jv)!.status;

  // Mark status as VOID and remove journal entries so ledger equilibrium and financial reports adjust cleanly
  if (pv) {
    await db.update(schema.paymentVouchers).set({ status: 'VOID' }).where(eq(schema.paymentVouchers.id, id));
  } else if (rv) {
    await db.update(schema.receiptVouchers).set({ status: 'VOID' }).where(eq(schema.receiptVouchers.id, id));
    if (rv.invoiceId) {
      await db.update(schema.invoices).set({ status: 'ISSUED' }).where(eq(schema.invoices.id, rv.invoiceId));
    }
  } else if (jv) {
    await db.update(schema.journalVouchers).set({ status: 'VOID' }).where(eq(schema.journalVouchers.id, id));
  }

  await db.delete(schema.journalEntries).where(eq(schema.journalEntries.voucherId, id));

  await recordVoucherHistory(db, {
    voucherId: id,
    voucherType,
    voucherNumber,
    action: 'VOIDED',
    user: authUser,
    summary: 'Declined and voided voucher. Ledger balance adjusted.',
    changes: { status: { old: oldStatus, new: 'VOID' } },
  });

  return c.json({ success: true, message: 'Voucher declined and voided. Ledger balance adjusted.' });
});

// POST /api/accounting/vouchers/:id/restore - Restore Declined / Voided Voucher
app.post('/api/accounting/vouchers/:id/restore', requireVoucherOrAccounting('update'), async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const [pv, rv, jv] = await Promise.all([
    db.query.paymentVouchers.findFirst({ where: eq(schema.paymentVouchers.id, id) }),
    db.query.receiptVouchers.findFirst({ where: eq(schema.receiptVouchers.id, id) }),
    db.query.journalVouchers.findFirst({ where: eq(schema.journalVouchers.id, id) }),
  ]);

  if (!pv && !rv && !jv) return c.json({ success: false, error: 'Voucher not found' }, 404);

  const authUser = c.get('authUser');
  const voucherNumber = pv?.voucherNumber || rv?.voucherNumber || jv?.jvNumber || null;
  const voucherType = pv ? 'PAYMENT' : (rv ? 'RECEIPT' : 'JOURNAL');
  const oldStatus = (pv || rv || jv)!.status;

  if (pv) {
    await db.update(schema.paymentVouchers).set({ status: 'POSTED' }).where(eq(schema.paymentVouchers.id, id));
    const [payAcc, expAcc] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') }),
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, '5020') }),
    ]);
    if (payAcc && expAcc) {
      await db.insert(schema.journalEntries).values([
        {
          id: crypto.randomUUID(),
          voucherType: 'PAYMENT',
          voucherId: id,
          accountId: expAcc.id,
          debitCents: pv.amountCents,
          creditCents: 0,
          description: `Payment to ${pv.recipientName || 'Payee'} (${pv.voucherNumber})`,
          entryDate: pv.voucherDate,
        },
        {
          id: crypto.randomUUID(),
          voucherType: 'PAYMENT',
          voucherId: id,
          accountId: payAcc.id,
          debitCents: 0,
          creditCents: pv.amountCents,
          description: `Disbursement for ${pv.recipientName || 'Payee'} (${pv.voucherNumber})`,
          entryDate: pv.voucherDate,
        },
      ]);
    }
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'RESTORED',
      user: authUser,
      summary: 'Restored voucher and re-posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Payment Voucher restored and re-posted to General Ledger' });
  }

  if (rv) {
    await db.update(schema.receiptVouchers).set({ status: 'POSTED' }).where(eq(schema.receiptVouchers.id, id));
    if (rv.invoiceId) {
      await db.update(schema.invoices).set({ status: 'PAID' }).where(eq(schema.invoices.id, rv.invoiceId));
    }
    const [cashAcc, arAcc] = await Promise.all([
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') }),
      db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1100') }),
    ]);
    if (cashAcc && arAcc) {
      await db.insert(schema.journalEntries).values([
        {
          id: crypto.randomUUID(),
          voucherType: 'RECEIPT',
          voucherId: id,
          accountId: cashAcc.id,
          debitCents: rv.amountCents,
          creditCents: 0,
          description: `Customer Receipt (${rv.voucherNumber})`,
          entryDate: rv.voucherDate,
        },
        {
          id: crypto.randomUUID(),
          voucherType: 'RECEIPT',
          voucherId: id,
          accountId: arAcc.id,
          debitCents: 0,
          creditCents: rv.amountCents,
          description: `Customer A/R Settlement (${rv.voucherNumber})`,
          entryDate: rv.voucherDate,
        },
      ]);
    }
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'RESTORED',
      user: authUser,
      summary: 'Restored voucher and re-posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Receipt Voucher restored and re-posted to General Ledger' });
  }

  if (jv) {
    await db.update(schema.journalVouchers).set({ status: 'POSTED' }).where(eq(schema.journalVouchers.id, id));
    await recordVoucherHistory(db, {
      voucherId: id,
      voucherType,
      voucherNumber,
      action: 'RESTORED',
      user: authUser,
      summary: 'Journal Voucher restored and re-posted to General Ledger',
      changes: { status: { old: oldStatus, new: 'POSTED' } },
    });
    return c.json({ success: true, message: 'Journal Voucher restored and re-posted to General Ledger' });
  }
});

// DELETE /api/accounting/vouchers/:id - Delete Voucher Permanently
app.delete('/api/accounting/vouchers/:id', requireVoucherOrAccounting('delete'), async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  await Promise.all([
    db.delete(schema.paymentVouchers).where(eq(schema.paymentVouchers.id, id)),
    db.delete(schema.receiptVouchers).where(eq(schema.receiptVouchers.id, id)),
    db.delete(schema.journalVouchers).where(eq(schema.journalVouchers.id, id)),
    db.delete(schema.journalEntries).where(eq(schema.journalEntries.voucherId, id)),
    db.delete(schema.voucherHistory).where(eq(schema.voucherHistory.voucherId, id)),
  ]);

  return c.json({ success: true, message: 'Voucher permanently deleted' });
});

// GET /api/accounting/vouchers/:id/history - Get revision history for a voucher
app.get('/api/accounting/vouchers/:id/history', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');
  await ensureVoucherHistoryTable(db);

  try {
    const history = await db.query.voucherHistory.findMany({
      where: eq(schema.voucherHistory.voucherId, id),
      orderBy: [desc(schema.voucherHistory.createdAt)],
    });

    return c.json({
      success: true,
      data: history.map((item) => {
        let parsedChanges = null;
        if (item.changes) {
          try {
            parsedChanges = JSON.parse(item.changes);
          } catch (_) {
            parsedChanges = null;
          }
        }
        return {
          ...item,
          changes: parsedChanges,
        };
      }),
    });
  } catch (err: any) {
    return c.json({ success: true, data: [] });
  }
});

// GET /api/accounting/ledger - Full General Ledger
app.get('/api/accounting/ledger', async (c) => {
  const db = createDbClient(c.env.DB);
  const ledger = await db.query.journalEntries.findMany({
    orderBy: [desc(schema.journalEntries.createdAt)],
    with: { account: true },
  });
  return c.json({ success: true, count: ledger.length, data: ledger });
});

// GET /api/accounting/reports/profit-loss - Income Statement (Profit & Loss)
app.get('/api/accounting/reports/profit-loss', async (c) => {
  const db = createDbClient(c.env.DB);
  const accounts = await db.query.accounts.findMany({ orderBy: [schema.accounts.code] });
  const allEntries = await db.query.journalEntries.findMany();

  const revenues: Array<{ code: string; name: string; amountCents: number }> = [];
  const cogs: Array<{ code: string; name: string; amountCents: number }> = [];
  const operatingExpenses: Array<{ code: string; name: string; amountCents: number }> = [];

  let totalRevenueCents = 0;
  let totalCogsCents = 0;
  let totalOpexCents = 0;

  for (const acc of accounts) {
    const entries = allEntries.filter((e) => e.accountId === acc.id);
    const debit = entries.reduce((sum, e) => sum + e.debitCents, 0);
    const credit = entries.reduce((sum, e) => sum + e.creditCents, 0);

    if (acc.type === 'REVENUE') {
      const net = credit - debit;
      if (net !== 0 || entries.length > 0) {
        revenues.push({ code: acc.code, name: acc.name, amountCents: net });
        totalRevenueCents += net;
      }
    } else if (acc.type === 'EXPENSE') {
      const net = debit - credit;
      if (acc.code === '5010' || acc.name.toLowerCase().includes('cost of goods') || acc.name.toLowerCase().includes('cogs')) {
        cogs.push({ code: acc.code, name: acc.name, amountCents: net });
        totalCogsCents += net;
      } else {
        operatingExpenses.push({ code: acc.code, name: acc.name, amountCents: net });
        totalOpexCents += net;
      }
    }
  }

  const grossProfitCents = totalRevenueCents - totalCogsCents;
  const grossMarginPct = totalRevenueCents > 0 ? (grossProfitCents / totalRevenueCents) * 100 : 0;
  const netIncomeCents = grossProfitCents - totalOpexCents;
  const netMarginPct = totalRevenueCents > 0 ? (netIncomeCents / totalRevenueCents) * 100 : 0;

  return c.json({
    success: true,
    generatedAt: new Date().toISOString(),
    revenues,
    cogs,
    operatingExpenses,
    totalRevenueCents,
    totalCogsCents,
    grossProfitCents,
    grossMarginPct: Number(grossMarginPct.toFixed(2)),
    totalOpexCents,
    netIncomeCents,
    netMarginPct: Number(netMarginPct.toFixed(2)),
    isProfitable: netIncomeCents >= 0,
  });
});

// GET /api/accounting/reports/balance-sheet - Statement of Financial Position (Balance Sheet)
app.get('/api/accounting/reports/balance-sheet', async (c) => {
  const db = createDbClient(c.env.DB);
  const accounts = await db.query.accounts.findMany({ orderBy: [schema.accounts.code] });
  const allEntries = await db.query.journalEntries.findMany();

  const currentAssets: Array<{ code: string; name: string; amountCents: number }> = [];
  const nonCurrentAssets: Array<{ code: string; name: string; amountCents: number }> = [];
  const currentLiabilities: Array<{ code: string; name: string; amountCents: number }> = [];
  const nonCurrentLiabilities: Array<{ code: string; name: string; amountCents: number }> = [];
  const equityItems: Array<{ code: string; name: string; amountCents: number }> = [];

  let totalAssetsCents = 0;
  let totalLiabilitiesCents = 0;
  let totalBaseEquityCents = 0;
  let totalRevenueCents = 0;
  let totalExpenseCents = 0;

  for (const acc of accounts) {
    const entries = allEntries.filter((e) => e.accountId === acc.id);
    const debit = entries.reduce((sum, e) => sum + e.debitCents, 0);
    const credit = entries.reduce((sum, e) => sum + e.creditCents, 0);

    if (acc.type === 'ASSET') {
      const net = debit - credit;
      if (acc.code.startsWith('15') || acc.name.toLowerCase().includes('fixed') || acc.name.toLowerCase().includes('equipment') || acc.name.toLowerCase().includes('property')) {
        nonCurrentAssets.push({ code: acc.code, name: acc.name, amountCents: net });
      } else {
        currentAssets.push({ code: acc.code, name: acc.name, amountCents: net });
      }
      totalAssetsCents += net;
    } else if (acc.type === 'LIABILITY') {
      const net = credit - debit;
      if (acc.code.startsWith('25') || acc.name.toLowerCase().includes('long-term') || acc.name.toLowerCase().includes('loan')) {
        nonCurrentLiabilities.push({ code: acc.code, name: acc.name, amountCents: net });
      } else {
        currentLiabilities.push({ code: acc.code, name: acc.name, amountCents: net });
      }
      totalLiabilitiesCents += net;
    } else if (acc.type === 'EQUITY') {
      const net = credit - debit;
      equityItems.push({ code: acc.code, name: acc.name, amountCents: net });
      totalBaseEquityCents += net;
    } else if (acc.type === 'REVENUE') {
      totalRevenueCents += (credit - debit);
    } else if (acc.type === 'EXPENSE') {
      totalExpenseCents += (debit - credit);
    }
  }

  const currentPeriodNetIncomeCents = totalRevenueCents - totalExpenseCents;
  const totalEquityCents = totalBaseEquityCents + currentPeriodNetIncomeCents;
  const totalLiabilitiesAndEquityCents = totalLiabilitiesCents + totalEquityCents;
  const discrepancyCents = totalAssetsCents - totalLiabilitiesAndEquityCents;
  const isBalanced = discrepancyCents === 0;

  return c.json({
    success: true,
    generatedAt: new Date().toISOString(),
    isBalanced,
    assets: {
      current: currentAssets,
      nonCurrent: nonCurrentAssets,
      totalAssetsCents,
    },
    liabilities: {
      current: currentLiabilities,
      nonCurrent: nonCurrentLiabilities,
      totalLiabilitiesCents,
    },
    equity: {
      items: equityItems,
      currentPeriodNetIncomeCents,
      totalEquityCents,
    },
    totalAssetsCents,
    totalLiabilitiesAndEquityCents,
    discrepancyCents,
  });
});

// GET /api/accounting/reports/cash-flow - Statement of Cash Flows
app.get('/api/accounting/reports/cash-flow', async (c) => {
  const db = createDbClient(c.env.DB);
  const cashAccount = await db.query.accounts.findFirst({
    where: eq(schema.accounts.code, '1010'),
  });

  if (!cashAccount) {
    return c.json({ success: false, error: 'Cash account (1010) not found in Chart of Accounts' }, 404);
  }

  const cashEntries = await db.query.journalEntries.findMany({
    where: eq(schema.journalEntries.accountId, cashAccount.id),
    orderBy: [asc(schema.journalEntries.createdAt)],
  });

  const operatingInflows: Array<{ description: string; amountCents: number; date: string }> = [];
  const operatingOutflows: Array<{ description: string; amountCents: number; date: string }> = [];
  const investingFlows: Array<{ description: string; amountCents: number; date: string }> = [];
  const financingFlows: Array<{ description: string; amountCents: number; date: string }> = [];

  let totalOperatingInflowCents = 0;
  let totalOperatingOutflowCents = 0;
  let totalInvestingCents = 0;
  let totalFinancingCents = 0;

  for (const entry of cashEntries) {
    const desc = entry.description || 'Cash Transaction';
    const descLower = desc.toLowerCase();

    if (entry.debitCents > 0) {
      if (descLower.includes('equity') || descLower.includes('capital') || descLower.includes('investment')) {
        financingFlows.push({ description: desc, amountCents: entry.debitCents, date: entry.createdAt });
        totalFinancingCents += entry.debitCents;
      } else {
        operatingInflows.push({ description: desc, amountCents: entry.debitCents, date: entry.createdAt });
        totalOperatingInflowCents += entry.debitCents;
      }
    } else if (entry.creditCents > 0) {
      if (descLower.includes('equipment') || descLower.includes('asset purchase')) {
        investingFlows.push({ description: desc, amountCents: -entry.creditCents, date: entry.createdAt });
        totalInvestingCents -= entry.creditCents;
      } else if (descLower.includes('dividend') || descLower.includes('drawing') || descLower.includes('loan repayment')) {
        financingFlows.push({ description: desc, amountCents: -entry.creditCents, date: entry.createdAt });
        totalFinancingCents -= entry.creditCents;
      } else {
        operatingOutflows.push({ description: desc, amountCents: entry.creditCents, date: entry.createdAt });
        totalOperatingOutflowCents += entry.creditCents;
      }
    }
  }

  const netOperatingCashCents = totalOperatingInflowCents - totalOperatingOutflowCents;
  const netCashFlowCents = netOperatingCashCents + totalInvestingCents + totalFinancingCents;
  const closingCashCents = netCashFlowCents;

  return c.json({
    success: true,
    generatedAt: new Date().toISOString(),
    operatingActivities: {
      inflows: operatingInflows,
      outflows: operatingOutflows,
      totalInflowCents: totalOperatingInflowCents,
      totalOutflowCents: totalOperatingOutflowCents,
      netOperatingCashCents,
    },
    investingActivities: {
      items: investingFlows,
      netInvestingCashCents: totalInvestingCents,
    },
    financingActivities: {
      items: financingFlows,
      netFinancingCashCents: totalFinancingCents,
    },
    netCashFlowCents,
    closingCashCents,
  });
});

/* ========================================================================== */
/* 7. PAYROLL MODULE                                                          */
/* ========================================================================== */

// POST /api/payroll/employees - Create Employee (optionally with a linked login account)
app.post(
  '/api/payroll/employees',
  zValidator(
    'json',
    z.object({
      employeeCode: z.string().min(2),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      department: z.string().min(1),
      position: z.string().min(1),
      hireDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
      bankAccountNumber: z.string().optional(),
      bankName: z.string().optional(),
      salary: z
        .object({
          baseSalaryCents: z.number().int().positive(),
          allowancesCents: z.number().int().nonnegative().default(0),
          deductionsCents: z.number().int().nonnegative().default(0),
        })
        .optional(),
      baseSalaryCents: z.number().int().positive().optional(),
      allowancesCents: z.number().int().nonnegative().optional(),
      deductionsCents: z.number().int().nonnegative().optional(),
      createUserAccount: z.boolean().optional(),
      createAccount: z.boolean().optional(),
      userRole: z.string().min(1).optional(),
      role: z.string().min(1).optional(),
      password: z.string().min(8).optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const existingEmployee = await db.query.employees.findFirst({ where: eq(schema.employees.email, body.email) });
    if (existingEmployee) {
      return c.json({ success: false, error: 'An employee with that email already exists' }, 400);
    }

    const shouldCreateAccount = body.createUserAccount || body.createAccount;
    const accountRole = body.userRole || body.role || 'STAFF';

    if (shouldCreateAccount && !body.password) {
      return c.json({ success: false, error: 'Password is required to create a login account' }, 400);
    }

    let userId: string | undefined;
    const batchStatements: any[] = [];

    if (shouldCreateAccount) {
      const existingUser = await db.query.users.findFirst({ where: eq(schema.users.email, body.email.toLowerCase()) });
      if (existingUser) {
        return c.json({ success: false, error: 'A user account with that email already exists' }, 400);
      }
      userId = crypto.randomUUID();
      batchStatements.push(
        db.insert(schema.users).values({
          id: userId,
          email: body.email.toLowerCase(),
          name: `${body.firstName} ${body.lastName}`,
          passwordHash: await hashPassword(body.password!),
          role: accountRole,
        })
      );
    }

    const employeeId = crypto.randomUUID();
    batchStatements.push(
      db.insert(schema.employees).values({
        id: employeeId,
        employeeCode: body.employeeCode.toUpperCase(),
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        department: body.department,
        position: body.position,
        hireDate: body.hireDate,
        bankAccountNumber: body.bankAccountNumber,
        bankName: body.bankName,
        userId,
      })
    );

    const baseSalary = body.salary?.baseSalaryCents ?? body.baseSalaryCents ?? 0;
    const allowances = body.salary?.allowancesCents ?? body.allowancesCents ?? 0;
    const deductions = body.salary?.deductionsCents ?? body.deductionsCents ?? 0;

    if (baseSalary > 0) {
      const net = baseSalary + allowances - deductions;
      batchStatements.push(
        db.insert(schema.salaryStructures).values({
          id: crypto.randomUUID(),
          employeeId,
          baseSalaryCents: baseSalary,
          allowancesCents: allowances,
          deductionsCents: deductions,
          netSalaryCents: net,
        })
      );
    }

    await db.batch(batchStatements as any);

    const created = await db.query.employees.findFirst({
      where: eq(schema.employees.id, employeeId),
      with: { salaryStructures: true, user: true },
    });

    const { user, ...employeeSafe } = created as NonNullable<typeof created>;
    const safeUser = user ? (({ passwordHash, ...rest }) => rest)(user) : null;

    return c.json({ success: true, data: { ...employeeSafe, user: safeUser }, userCreated: !!userId, userRole: accountRole }, 201);
  }
);

// GET /api/payroll/employees - List Employees
app.get('/api/payroll/employees', async (c) => {
  const db = createDbClient(c.env.DB);
  const statusParam = c.req.query('status');
  const emps = await db.query.employees.findMany({
    where: statusParam ? eq(schema.employees.status, statusParam as any) : undefined,
    with: { salaryStructures: true, user: true },
    orderBy: [asc(schema.employees.employeeCode)],
  });
  const safeEmps = emps.map((emp) => {
    const { user, ...rest } = emp;
    const safeUser = user ? (({ passwordHash, ...uRest }) => uRest)(user) : null;
    return { ...rest, user: safeUser };
  });
  return c.json({ success: true, count: safeEmps.length, data: safeEmps });
});

// GET /api/payroll/employees/:id - Get Single Employee
app.get('/api/payroll/employees/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');
  const emp = await db.query.employees.findFirst({
    where: eq(schema.employees.id, id),
    with: { salaryStructures: true, user: true },
  });
  if (!emp) {
    return c.json({ success: false, error: 'Employee not found' }, 404);
  }
  const { user, ...rest } = emp;
  const safeUser = user ? (({ passwordHash, ...uRest }) => uRest)(user) : null;
  return c.json({ success: true, data: { ...rest, user: safeUser } });
});

// PUT /api/payroll/employees/:id - Update Employee & Salary Structure
app.put(
  '/api/payroll/employees/:id',
  zValidator(
    'json',
    z.object({
      employeeCode: z.string().min(2).optional(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      department: z.string().min(1),
      position: z.string().min(1),
      status: z.enum(['ACTIVE', 'ON_LEAVE', 'TERMINATED']).default('ACTIVE'),
      hireDate: z.string().optional(),
      bankAccountNumber: z.string().optional(),
      bankName: z.string().optional(),
      baseSalaryCents: z.number().int().nonnegative().optional(),
      allowancesCents: z.number().int().nonnegative().optional(),
      deductionsCents: z.number().int().nonnegative().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const id = c.req.param('id');
    const body = c.req.valid('json');

    const existing = await db.query.employees.findFirst({
      where: eq(schema.employees.id, id),
      with: { salaryStructures: true, user: true },
    });
    if (!existing) {
      return c.json({ success: false, error: 'Employee not found' }, 404);
    }

    // Disallow employee code changes once created
    if (body.employeeCode && body.employeeCode.toUpperCase().trim() !== existing.employeeCode) {
      return c.json({ success: false, error: 'Employee code is permanent and cannot be modified once created' }, 400);
    }

    // Check email collision
    if (body.email !== existing.email) {
      const emailTaken = await db.query.employees.findFirst({
        where: eq(schema.employees.email, body.email),
      });
      if (emailTaken && emailTaken.id !== id) {
        return c.json({ success: false, error: 'An employee with that email already exists' }, 400);
      }
    }

    const now = new Date().toISOString();
    const batchStatements: any[] = [];

    batchStatements.push(
      db
        .update(schema.employees)
        .set({
          firstName: body.firstName,
          lastName: body.lastName,
          email: body.email,
          phone: body.phone,
          department: body.department,
          position: body.position,
          status: body.status,
          hireDate: body.hireDate || existing.hireDate,
          bankAccountNumber: body.bankAccountNumber,
          bankName: body.bankName,
          updatedAt: now,
        })
        .where(eq(schema.employees.id, id))
    );

    // Update or insert salary structure
    if (body.baseSalaryCents !== undefined) {
      const base = body.baseSalaryCents;
      const allow = body.allowancesCents ?? 0;
      const deduct = body.deductionsCents ?? 0;
      const net = base + allow - deduct;

      const existingSalary = existing.salaryStructures[0];
      if (existingSalary) {
        batchStatements.push(
          db
            .update(schema.salaryStructures)
            .set({
              baseSalaryCents: base,
              allowancesCents: allow,
              deductionsCents: deduct,
              netSalaryCents: net,
              updatedAt: now,
            })
            .where(eq(schema.salaryStructures.id, existingSalary.id))
        );
      } else {
        batchStatements.push(
          db.insert(schema.salaryStructures).values({
            id: crypto.randomUUID(),
            employeeId: id,
            baseSalaryCents: base,
            allowancesCents: allow,
            deductionsCents: deduct,
            netSalaryCents: net,
            effectiveDate: now,
          })
        );
      }
    }

    // If status is TERMINATED and has linked user, deactivate user
    if (body.status === 'TERMINATED' && existing.userId) {
      batchStatements.push(
        db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, existing.userId))
      );
    } else if (body.status === 'ACTIVE' && existing.userId) {
      batchStatements.push(
        db.update(schema.users).set({ isActive: true }).where(eq(schema.users.id, existing.userId))
      );
    }

    await db.batch(batchStatements as any);

    const updated = await db.query.employees.findFirst({
      where: eq(schema.employees.id, id),
      with: { salaryStructures: true, user: true },
    });

    const { user, ...empSafe } = updated as NonNullable<typeof updated>;
    const safeUser = user ? (({ passwordHash, ...rest }) => rest)(user) : null;

    return c.json({ success: true, message: 'Employee updated successfully', data: { ...empSafe, user: safeUser } });
  }
);

// DELETE /api/payroll/employees/:id - Delete or Deactivate Employee
app.delete('/api/payroll/employees/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const id = c.req.param('id');

  const existing = await db.query.employees.findFirst({
    where: eq(schema.employees.id, id),
  });
  if (!existing) {
    return c.json({ success: false, error: 'Employee not found' }, 404);
  }

  // Check if employee has payslips records
  const payslip = await db.query.payslips.findFirst({
    where: eq(schema.payslips.employeeId, id),
  });

  if (payslip) {
    // Soft delete: set status to TERMINATED
    await db
      .update(schema.employees)
      .set({
        status: 'TERMINATED',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.employees.id, id));

    if (existing.userId) {
      await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, existing.userId));
    }

    return c.json({
      success: true,
      message: `Employee ${existing.employeeCode} has historical payroll payslips. Status updated to TERMINATED and login access revoked.`,
      softDeleted: true,
    });
  }

  // Hard delete: no historical payroll records
  await db.delete(schema.employees).where(eq(schema.employees.id, id));
  if (existing.userId) {
    await db.delete(schema.users).where(eq(schema.users.id, existing.userId));
  }

  return c.json({
    success: true,
    message: `Employee ${existing.employeeCode} successfully deleted from the system.`,
  });
});

// POST /api/payroll/employees/:id/account - Provision a Login Account for an Employee
app.post(
  '/api/payroll/employees/:id/account',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      role: z.string().min(1).default('STAFF'),
      password: z.string().min(8),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const empId = c.req.param('id');
    const body = c.req.valid('json');

    const employee = await db.query.employees.findFirst({
      where: eq(schema.employees.id, empId),
      with: { user: true },
    });
    if (!employee) {
      return c.json({ success: false, error: 'Employee not found' }, 404);
    }
    if (employee.userId) {
      return c.json({ success: false, error: 'Employee already has a linked login account. Use edit account instead.' }, 400);
    }

    const emailTaken = await db.query.users.findFirst({
      where: eq(schema.users.email, body.email),
    });
    if (emailTaken) {
      return c.json({ success: false, error: 'A login account with that email already exists' }, 400);
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(body.password);
    const fullName = `${employee.firstName} ${employee.lastName}`.trim();

    await db.batch([
      db.insert(schema.users).values({
        id: userId,
        email: body.email,
        name: fullName,
        role: body.role,
        passwordHash,
        isActive: true,
      }),
      db
        .update(schema.employees)
        .set({
          userId,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.employees.id, empId)),
    ] as any);

    return c.json(
      {
        success: true,
        message: `Login account created for ${fullName} with role ${body.role}`,
        data: { id: userId, email: body.email, name: fullName, role: body.role, isActive: true },
      },
      201
    );
  }
);

// PUT /api/payroll/employees/:id/account - Update / Edit Employee's Login Account (Role, Email, Password, Active Status)
app.put(
  '/api/payroll/employees/:id/account',
  zValidator(
    'json',
    z.object({
      email: z.string().email().optional(),
      name: z.string().min(1).optional(),
      role: z.string().min(1).optional(),
      password: z.string().min(8).optional(),
      isActive: z.boolean().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const empId = c.req.param('id');
    const body = c.req.valid('json');

    const employee = await db.query.employees.findFirst({
      where: eq(schema.employees.id, empId),
      with: { user: true },
    });
    if (!employee) {
      return c.json({ success: false, error: 'Employee not found' }, 404);
    }
    if (!employee.userId || !employee.user) {
      return c.json({ success: false, error: 'Employee does not have a linked login account' }, 400);
    }

    const userId = employee.userId;
    const targetUser = employee.user;

    // Check if email changed and taken
    if (body.email && body.email !== targetUser.email) {
      const emailTaken = await db.query.users.findFirst({
        where: eq(schema.users.email, body.email),
      });
      if (emailTaken && emailTaken.id !== userId) {
        return c.json({ success: false, error: 'A login account with that email already exists' }, 400);
      }
    }

    // Protection against removing last admin
    const losingAdminStatus =
      isAdminRole(targetUser.role) && ((body.role && !isAdminRole(body.role)) || body.isActive === false);
    if (losingAdminStatus) {
      const otherActiveAdmins = await db.query.users.findMany({
        where: eq(schema.users.role, 'ADMIN'),
      });
      const remaining = otherActiveAdmins.filter((u) => u.id !== userId && u.isActive);
      if (remaining.length === 0) {
        return c.json({ success: false, error: 'Cannot remove or deactivate the last active administrator' }, 400);
      }
    }

    const updateFields: any = {
      updatedAt: new Date().toISOString(),
    };
    if (body.name !== undefined) updateFields.name = body.name;
    if (body.email !== undefined) updateFields.email = body.email;
    if (body.role !== undefined) updateFields.role = body.role;
    if (body.isActive !== undefined) updateFields.isActive = body.isActive;
    if (body.password !== undefined && body.password.trim().length >= 8) {
      updateFields.passwordHash = await hashPassword(body.password.trim());
    }

    await db.update(schema.users).set(updateFields).where(eq(schema.users.id, userId));

    // Invalidate existing sessions if role, active status, or password changed
    if (body.isActive === false || body.role !== undefined || (body.password !== undefined && body.password.trim().length >= 8)) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    }

    const updatedUser = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    const { passwordHash, ...safe } = updatedUser!;

    return c.json({
      success: true,
      message: 'Login account updated successfully',
      data: safe,
    });
  }
);

// DELETE /api/payroll/employees/:id/account - Unlink / Revoke Login Account
app.delete('/api/payroll/employees/:id/account', async (c) => {
  const db = createDbClient(c.env.DB);
  const empId = c.req.param('id');

  const employee = await db.query.employees.findFirst({
    where: eq(schema.employees.id, empId),
    with: { user: true },
  });
  if (!employee) {
    return c.json({ success: false, error: 'Employee not found' }, 404);
  }
  if (!employee.userId) {
    return c.json({ success: false, error: 'Employee has no linked login account' }, 400);
  }

  const userId = employee.userId;
  if (employee.user && isAdminRole(employee.user.role)) {
    const admins = await db.query.users.findMany({ where: eq(schema.users.role, 'ADMIN') });
    const remaining = admins.filter((u) => u.id !== userId && u.isActive);
    if (remaining.length === 0) {
      return c.json({ success: false, error: 'Cannot revoke account of the last active administrator' }, 400);
    }
  }

  await db.batch([
    db.update(schema.employees).set({ userId: null, updatedAt: new Date().toISOString() }).where(eq(schema.employees.id, empId)),
    db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, userId)),
    db.delete(schema.sessions).where(eq(schema.sessions.userId, userId)),
  ] as any);

  return c.json({
    success: true,
    message: `Login account unlinked from employee ${employee.employeeCode} and login access revoked.`,
  });
});

// POST /api/payroll/runs - Create Payroll Run Batch
app.post(
  '/api/payroll/runs',
  zValidator(
    'json',
    z.object({
      periodStartDate: z.string(),
      periodEndDate: z.string(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const activeEmployees = await db.query.employees.findMany({
      where: eq(schema.employees.status, 'ACTIVE'),
      with: { salaryStructures: true },
    });

    let totalGross = 0;
    let totalDeductions = 0;
    let totalNet = 0;

    for (const emp of activeEmployees) {
      const salary = emp.salaryStructures[0];
      if (salary) {
        totalGross += salary.baseSalaryCents + salary.allowancesCents;
        totalDeductions += salary.deductionsCents;
        totalNet += salary.netSalaryCents;
      }
    }

    const runId = crypto.randomUUID();
    const runNumber = 'PR-' + Date.now().toString().slice(-6);

    await db.insert(schema.payrollRuns).values({
      id: runId,
      runNumber,
      periodStartDate: body.periodStartDate,
      periodEndDate: body.periodEndDate,
      status: 'CALCULATED',
      totalGrossCents: totalGross,
      totalDeductionsCents: totalDeductions,
      totalNetCents: totalNet,
    });

    const run = await db.query.payrollRuns.findFirst({ where: eq(schema.payrollRuns.id, runId) });

    return c.json({
      success: true,
      message: 'Payroll run calculated. Ready for review and finalization.',
      data: run,
      employeeCount: activeEmployees.length,
    }, 201);
  }
);

// POST /api/payroll/runs/:id/finalize - Finalize Payroll Run
app.post('/api/payroll/runs/:id/finalize', async (c) => {
  const db = createDbClient(c.env.DB);
  const runId = c.req.param('id');

  const run = await db.query.payrollRuns.findFirst({ where: eq(schema.payrollRuns.id, runId) });
  if (!run) return c.json({ success: false, error: 'Payroll Run not found' }, 404);
  if (run.status === 'FINALIZED' || run.status === 'PAID') {
    return c.json({ success: false, error: 'Payroll Run has already been finalized.' }, 400);
  }

  const activeEmployees = await db.query.employees.findMany({
    where: eq(schema.employees.status, 'ACTIVE'),
    with: { salaryStructures: true },
  });

  const paymentVoucherId = crypto.randomUUID();
  const pvNumber = 'PV-PAYROLL-' + Date.now().toString().slice(-6);

  // 1. Payment Voucher for Payroll Disbursement
  const pvInsert = db.insert(schema.paymentVouchers).values({
    id: paymentVoucherId,
    voucherNumber: pvNumber,
    recipientType: 'EMPLOYEE',
    amountCents: run.totalNetCents,
    paymentMethod: 'BANK_TRANSFER',
    referenceType: 'PAYROLL_RUN',
    referenceId: run.runNumber,
    notes: 'Payroll payout for period ' + run.periodStartDate + ' to ' + run.periodEndDate,
    status: 'POSTED',
  });

  const batchStatements: any[] = [pvInsert];

  // 2. Individual Payslips
  for (const emp of activeEmployees) {
    const salary = emp.salaryStructures[0];
    if (salary) {
      batchStatements.push(
        db.insert(schema.payslips).values({
          id: crypto.randomUUID(),
          payrollRunId: run.id,
          employeeId: emp.id,
          baseSalaryCents: salary.baseSalaryCents,
          allowancesCents: salary.allowancesCents,
          deductionsCents: salary.deductionsCents,
          netSalaryCents: salary.netSalaryCents,
          status: 'GENERATED',
        })
      );
    }
  }

  // 3. Double-Entry Accounting: Salaries Expense (5020) Debit, Cash (1010) Credit
  const salaryExpAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '5020') });
  const cashAccount = await db.query.accounts.findFirst({ where: eq(schema.accounts.code, '1010') });

  if (salaryExpAccount && cashAccount) {
    // Debit Salary Expense
    batchStatements.push(
      db.insert(schema.journalEntries).values({
        id: crypto.randomUUID(),
        voucherType: 'PAYMENT',
        voucherId: paymentVoucherId,
        accountId: salaryExpAccount.id,
        debitCents: run.totalNetCents,
        creditCents: 0,
        description: 'Payroll expense for run ' + run.runNumber,
      })
    );

    // Credit Cash
    batchStatements.push(
      db.insert(schema.journalEntries).values({
        id: crypto.randomUUID(),
        voucherType: 'PAYMENT',
        voucherId: paymentVoucherId,
        accountId: cashAccount.id,
        debitCents: 0,
        creditCents: run.totalNetCents,
        description: 'Bank disbursement for payroll run ' + run.runNumber,
      })
    );
  }

  // 4. Update Payroll Run to FINALIZED
  batchStatements.push(
    db
      .update(schema.payrollRuns)
      .set({
        status: 'FINALIZED',
        paymentVoucherId,
        finalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.payrollRuns.id, run.id))
  );

  await db.batch(batchStatements as any);

  return c.json({
    success: true,
    message: 'Payroll Run finalized successfully. Payslips generated and Payment Voucher linked.',
    payrollRunNumber: run.runNumber,
    paymentVoucherNumber: pvNumber,
    totalDisbursedCents: run.totalNetCents,
    payslipsGenerated: activeEmployees.length,
  });
});

// GET /api/payroll/runs - List Payroll Runs
app.get('/api/payroll/runs', async (c) => {
  const db = createDbClient(c.env.DB);
  const runs = await db.query.payrollRuns.findMany({
    orderBy: [desc(schema.payrollRuns.createdAt)],
    with: { payslips: { with: { employee: true } }, paymentVoucher: true },
  });
  return c.json({ success: true, data: runs });
});

/* ========================================================================== */
/* 8. EXECUTIVE DASHBOARD & AGGREGATIONS                                      */
/* ========================================================================== */

app.get('/api/dashboard', async (c) => {
  const db = createDbClient(c.env.DB);

  const [
    products,
    customers,
    vendors,
    employees,
    soList,
    poList,
    payrollList,
    paymentVouchersList,
    receiptVouchersList,
    stockMovementsList,
  ] = await Promise.all([
    db.query.products.findMany(),
    db.query.customers.findMany(),
    db.query.vendors.findMany(),
    db.query.employees.findMany(),
    db.query.salesOrders.findMany({ with: { customer: true } }),
    db.query.purchaseOrders.findMany({ with: { vendor: true } }),
    db.query.payrollRuns.findMany({ orderBy: [desc(schema.payrollRuns.createdAt)] }),
    db.query.paymentVouchers.findMany({ where: ne(schema.paymentVouchers.status, 'VOID') }),
    db.query.receiptVouchers.findMany({ where: ne(schema.receiptVouchers.status, 'VOID') }),
    db.select().from(schema.stockMovements),
  ]);

  // 1. In-memory stock calculation from movements for O(N) performance
  const stockByProductId: Record<string, number> = {};
  for (const mov of stockMovementsList) {
    const q = mov.type === 'IN' ? mov.quantity : mov.type === 'OUT' ? -mov.quantity : mov.quantity;
    stockByProductId[mov.productId] = (stockByProductId[mov.productId] || 0) + q;
  }

  // 2. Inventory Valuations & Category Distributions
  const inventoryValuationByCurrency: Record<string, number> = {};
  const categoryStats: Record<string, { count: number; valueCents: number; damagedCount: number }> = {};
  let healthyStockCount = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let totalDamagedUnits = 0;

  for (const prod of products) {
    const stock = stockByProductId[prod.id] || 0;
    const cat = prod.category || 'Uncategorized';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { count: 0, valueCents: 0, damagedCount: 0 };
    }
    categoryStats[cat].count++;
    const prodVal = stock * prod.costPriceCents;
    categoryStats[cat].valueCents += prodVal;
    categoryStats[cat].damagedCount += (prod.damagedStock || 0);

    totalDamagedUnits += (prod.damagedStock || 0);
    if (stock > 5) {
      healthyStockCount++;
    } else if (stock > 0) {
      lowStockCount++;
    } else {
      outOfStockCount++;
    }

    inventoryValuationByCurrency[prod.costPriceCurrency] = (inventoryValuationByCurrency[prod.costPriceCurrency] || 0) + prodVal;
  }

  // Top Products by estimated cost value or stock
  const topProducts = [...products]
    .map(p => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      stock: stockByProductId[p.id] || 0,
      costPriceCents: p.costPriceCents,
      currency: p.costPriceCurrency,
      totalValueCents: (stockByProductId[p.id] || 0) * p.costPriceCents,
    }))
    .sort((a, b) => b.totalValueCents - a.totalValueCents || b.costPriceCents - a.costPriceCents)
    .slice(0, 7);

  // 3. Last 6 Months Window (YYYY-MM)
  const now = new Date();
  const monthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const ym = d.toISOString().slice(0, 7);
    monthKeys.push(ym);
  }

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyTrends: Record<string, {
    month: string;
    label: string;
    salesCents: number;
    purchasesCents: number;
    cashInCents: number;
    cashOutCents: number;
    payrollCents: number;
    netCashFlowCents: number;
  }> = {};

  for (const ym of monthKeys) {
    const [year, monthNum] = ym.split('-');
    const mName = monthNames[parseInt(monthNum, 10) - 1] || monthNum;
    monthlyTrends[ym] = {
      month: ym,
      label: `${mName} ${year}`,
      salesCents: 0,
      purchasesCents: 0,
      cashInCents: 0,
      cashOutCents: 0,
      payrollCents: 0,
      netCashFlowCents: 0,
    };
  }

  // 4. Sales Orders metrics & monthly aggregation
  const salesRevenueByCurrency: Record<string, number> = {};
  const soStatusCounts: Record<string, number> = {
    DRAFT: 0,
    CONFIRMED: 0,
    PACKED: 0,
    PARTIALLY_FULFILLED: 0,
    FULFILLED: 0,
    CANCELLED: 0,
  };
  const customerRevenue: Record<string, { name: string; count: number; revenueCents: number }> = {};

  for (const so of soList) {
    salesRevenueByCurrency[so.currency] = (salesRevenueByCurrency[so.currency] || 0) + so.totalAmountCents;
    if (so.status in soStatusCounts) {
      soStatusCounts[so.status]++;
    }
    const ym = (so.orderDate || so.createdAt || '').slice(0, 7);
    if (monthlyTrends[ym]) {
      monthlyTrends[ym].salesCents += so.totalAmountCents;
    }
    const custName = so.customer?.name || 'Client';
    if (!customerRevenue[so.customerId]) {
      customerRevenue[so.customerId] = { name: custName, count: 0, revenueCents: 0 };
    }
    customerRevenue[so.customerId].count++;
    customerRevenue[so.customerId].revenueCents += so.totalAmountCents;
  }

  // 5. Purchase Orders metrics & monthly aggregation
  const purchaseCommitmentByCurrency: Record<string, number> = {};
  const poStatusCounts: Record<string, number> = {
    DRAFT: 0,
    APPROVED: 0,
    DELIVERED: 0,
    PARTIALLY_RECEIVED: 0,
    RECEIVED: 0,
    CANCELLED: 0,
  };
  const vendorSpend: Record<string, { name: string; count: number; spendCents: number }> = {};

  for (const po of poList) {
    purchaseCommitmentByCurrency[po.currency] = (purchaseCommitmentByCurrency[po.currency] || 0) + po.totalAmountCents;
    if (po.status in poStatusCounts) {
      poStatusCounts[po.status]++;
    }
    const ym = (po.issueDate || po.createdAt || '').slice(0, 7);
    if (monthlyTrends[ym]) {
      monthlyTrends[ym].purchasesCents += po.totalAmountCents;
    }
    const vName = po.vendor?.name || 'Vendor';
    if (!vendorSpend[po.vendorId]) {
      vendorSpend[po.vendorId] = { name: vName, count: 0, spendCents: 0 };
    }
    vendorSpend[po.vendorId].count++;
    vendorSpend[po.vendorId].spendCents += po.totalAmountCents;
  }

  // 6. Vouchers (Cash Flow) metrics & monthly aggregation
  const paymentMethodStats: Record<string, { count: number; inCents: number; outCents: number }> = {};
  const recipientTypeStats: Record<string, { count: number; amountCents: number }> = {
    VENDOR: { count: 0, amountCents: 0 },
    EMPLOYEE: { count: 0, amountCents: 0 },
    OTHER: { count: 0, amountCents: 0 },
  };

  for (const pv of paymentVouchersList) {
    const ym = (pv.voucherDate || pv.createdAt || '').slice(0, 7);
    if (monthlyTrends[ym]) {
      monthlyTrends[ym].cashOutCents += pv.amountCents;
    }
    const method = pv.paymentMethod || 'OTHER';
    if (!paymentMethodStats[method]) {
      paymentMethodStats[method] = { count: 0, inCents: 0, outCents: 0 };
    }
    paymentMethodStats[method].count++;
    paymentMethodStats[method].outCents += pv.amountCents;

    const rType = pv.recipientType || 'OTHER';
    if (rType in recipientTypeStats) {
      recipientTypeStats[rType].count++;
      recipientTypeStats[rType].amountCents += pv.amountCents;
    }
  }

  for (const rv of receiptVouchersList) {
    const ym = (rv.voucherDate || rv.createdAt || '').slice(0, 7);
    if (monthlyTrends[ym]) {
      monthlyTrends[ym].cashInCents += rv.amountCents;
    }
    const method = rv.paymentMethod || 'OTHER';
    if (!paymentMethodStats[method]) {
      paymentMethodStats[method] = { count: 0, inCents: 0, outCents: 0 };
    }
    paymentMethodStats[method].count++;
    paymentMethodStats[method].inCents += rv.amountCents;
  }

  // Compute Net Cash Flow per month
  for (const ym of monthKeys) {
    monthlyTrends[ym].netCashFlowCents = monthlyTrends[ym].cashInCents - monthlyTrends[ym].cashOutCents;
  }

  // 7. Payroll metrics & monthly aggregation
  let totalPayrollPaidCents = 0;
  for (const pr of payrollList) {
    if (pr.status === 'FINALIZED') {
      totalPayrollPaidCents += pr.totalNetCents;
      const ym = (pr.createdAt || '').slice(0, 7);
      if (monthlyTrends[ym]) {
        monthlyTrends[ym].payrollCents += pr.totalNetCents;
      }
    }
  }

  // 8. Staff & Department Headcount
  const departmentStats: Record<string, { count: number; activeCount: number }> = {};
  for (const emp of employees) {
    const dept = emp.department || 'General';
    if (!departmentStats[dept]) {
      departmentStats[dept] = { count: 0, activeCount: 0 };
    }
    departmentStats[dept].count++;
    if (emp.status === 'ACTIVE') {
      departmentStats[dept].activeCount++;
    }
  }

  return c.json({
    success: true,
    kpis: {
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalVendors: vendors.length,
      activeEmployees: employees.filter(e => e.status === 'ACTIVE').length,
      totalEmployees: employees.length,
      inventoryValuationByCurrency,
      salesRevenueByCurrency,
      purchaseCommitmentByCurrency,
      totalPayrollPaidCents,
      totalPaymentVouchersCount: paymentVouchersList.length,
      totalReceiptVouchersCount: receiptVouchersList.length,
    },
    analytics: {
      monthlyTrends: monthKeys.map(k => monthlyTrends[k]),
      inventory: {
        byCategory: Object.entries(categoryStats).map(([name, stat]) => ({
          name,
          count: stat.count,
          valueCents: stat.valueCents,
          damagedCount: stat.damagedCount,
        })),
        stockHealth: {
          healthy: healthyStockCount,
          lowStock: lowStockCount,
          outOfStock: outOfStockCount,
          damaged: totalDamagedUnits,
        },
        topProducts,
      },
      purchasing: {
        byStatus: poStatusCounts,
        topVendors: Object.values(vendorSpend).sort((a, b) => b.spendCents - a.spendCents).slice(0, 6),
      },
      sales: {
        byStatus: soStatusCounts,
        topCustomers: Object.values(customerRevenue).sort((a, b) => b.revenueCents - a.revenueCents).slice(0, 6),
      },
      cashFlow: {
        byPaymentMethod: Object.entries(paymentMethodStats).map(([method, data]) => ({
          method,
          ...data,
        })),
        byRecipientType: Object.entries(recipientTypeStats).map(([type, data]) => ({
          type,
          ...data,
        })),
      },
      staff: {
        byDepartment: Object.entries(departmentStats).map(([department, data]) => ({
          department,
          ...data,
        })),
      },
    },
  });
});

/* ========================================================================== */
/* 9. ADMINISTRATION — USER & ROLE PERMISSION MANAGEMENT (ADMIN only)         */
/* ========================================================================== */

// GET /api/admin/users - List all user accounts with custom permissions status
app.get('/api/admin/users', async (c) => {
  const db = createDbClient(c.env.DB);
  let allUserPerms: schema.UserPermission[] = [];
  try {
    allUserPerms = await db.query.userPermissions.findMany();
  } catch (err) {
    await ensureUserPermissionsTable(db);
    try {
      allUserPerms = await db.query.userPermissions.findMany();
    } catch (e) {
      allUserPerms = [];
    }
  }

  const users = await db.query.users.findMany({ orderBy: [desc(schema.users.createdAt)] });

  const userPermCounts = new Map<string, number>();
  for (const up of allUserPerms) {
    userPermCounts.set(up.userId, (userPermCounts.get(up.userId) || 0) + 1);
  }

  return c.json({
    success: true,
    data: users.map(({ passwordHash, ...safe }) => ({
      ...safe,
      hasCustomPermissions: (userPermCounts.get(safe.id) || 0) > 0,
      customPermissionCount: userPermCounts.get(safe.id) || 0,
    })),
  });
});

// GET /api/admin/users/:id/permissions - Get employee custom/effective permissions
app.get('/api/admin/users/:id/permissions', async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.req.param('id');
  const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);

  const userCustom = await getUserCustomPermissions(db, userId);
  const effective = await getUserEffectiveCrudMatrix(db, userId, target.role);

  return c.json({
    success: true,
    userId: target.id,
    name: target.name,
    email: target.email,
    baseRole: target.role,
    hasCustomOverrides: userCustom.hasCustomOverrides,
    customPermissions: userCustom.permissions,
    effectivePermissions: effective.crud,
  });
});

// PUT /api/admin/users/:id/permissions - Set employee custom permissions or revert to base role
app.put(
  '/api/admin/users/:id/permissions',
  zValidator(
    'json',
    z.object({
      mode: z.enum(['ROLE', 'CUSTOM']),
      permissions: z
        .record(
          z.string(),
          z.object({
            create: z.boolean(),
            read: z.boolean(),
            update: z.boolean(),
            delete: z.boolean(),
          })
        )
        .optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const userId = c.req.param('id');
    const { mode, permissions } = c.req.valid('json');

    const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!target) return c.json({ success: false, error: 'User not found' }, 404);

    if (mode === 'ROLE') {
      await saveUserCustomPermissions(db, userId, null);
    } else {
      await saveUserCustomPermissions(db, userId, (permissions as any) || null);
    }

    // Invalidate active sessions so new permissions take effect immediately
    await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

    const updatedEffective = await getUserEffectiveCrudMatrix(db, userId, target.role);

    return c.json({
      success: true,
      message:
        mode === 'ROLE'
          ? 'Reverted to base role permissions'
          : 'Custom employee permissions updated successfully',
      hasCustomOverrides: mode === 'CUSTOM',
      effectivePermissions: updatedEffective.crud,
    });
  }
);

// PATCH /api/admin/users/:id - Update name/role/active status (and optionally reset password)
app.patch(
  '/api/admin/users/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      role: z.string().min(1).optional(),
      isActive: z.boolean().optional(),
      password: z.string().min(8).optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const userId = c.req.param('id');
    const body = c.req.valid('json');

    const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    if (!target) return c.json({ success: false, error: 'User not found' }, 404);

    const losingAdminStatus = isAdminRole(target.role) && ((body.role && !isAdminRole(body.role)) || body.isActive === false);
    if (losingAdminStatus) {
      const otherActiveAdmins = await db.query.users.findMany({ where: eq(schema.users.role, 'ADMIN') });
      const remaining = otherActiveAdmins.filter((u) => u.id !== userId && u.isActive);
      if (remaining.length === 0) {
        return c.json({ success: false, error: 'Cannot remove the last active administrator' }, 400);
      }
    }

    await db
      .update(schema.users)
      .set({
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.role !== undefined ? { role: body.role } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
        ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      })
      .where(eq(schema.users.id, userId));

    // Any change here should take effect immediately, not at next token expiry.
    if (body.isActive === false || body.role !== undefined || body.password !== undefined) {
      await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));
    }

    const updated = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
    const { passwordHash, ...safe } = updated!;
    return c.json({ success: true, data: safe });
  }
);

// DELETE /api/admin/users/:id - Deactivate a user account (soft delete; preserves referential integrity)
app.delete('/api/admin/users/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const userId = c.req.param('id');

  const target = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  if (!target) return c.json({ success: false, error: 'User not found' }, 404);

  if (isAdminRole(target.role)) {
    const admins = await db.query.users.findMany({ where: eq(schema.users.role, 'ADMIN') });
    const remaining = admins.filter((u) => u.id !== userId && u.isActive);
    if (remaining.length === 0) {
      return c.json({ success: false, error: 'Cannot deactivate the last active administrator' }, 400);
    }
  }

  await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.id, userId));
  await db.delete(schema.sessions).where(eq(schema.sessions.userId, userId));

  return c.json({ success: true, message: 'User deactivated' });
});

// GET /api/admin/roles - List all roles & permission groups with assigned user count
app.get('/api/admin/roles', async (c) => {
  const db = createDbClient(c.env.DB);
  const [allRoles, allUsers] = await Promise.all([
    loadAllRoles(db),
    db.query.users.findMany({ columns: { id: true, role: true, isActive: true } }),
  ]);

  const userCountByRole: Record<string, number> = {};
  for (const u of allUsers) {
    userCountByRole[u.role] = (userCountByRole[u.role] || 0) + 1;
  }

  const formattedRoles = allRoles.map((r) => ({
    ...r,
    userCount: userCountByRole[r.code] || 0,
  }));

  return c.json({
    success: true,
    roles: formattedRoles,
  });
});

// POST /api/admin/roles - Create a new custom role / permission group
app.post(
  '/api/admin/roles',
  zValidator(
    'json',
    z.object({
      code: z.string().min(2).max(50),
      name: z.string().min(2).max(100),
      description: z.string().optional(),
      permissions: z
        .record(
          z.enum(ALL_MODULES),
          z.object({
            create: z.boolean(),
            read: z.boolean(),
            update: z.boolean(),
            delete: z.boolean(),
          })
        )
        .optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');
    const cleanCode = body.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');

    if (!cleanCode || cleanCode.length < 2) {
      return c.json({ success: false, error: 'Role code must contain at least 2 alphanumeric characters' }, 400);
    }

    const existing = await db.query.roles.findFirst({ where: eq(schema.roles.code, cleanCode) });
    if (existing) {
      return c.json({ success: false, error: `A role with code "${cleanCode}" already exists` }, 400);
    }

    const roleId = crypto.randomUUID();
    const now = new Date().toISOString();

    const newRole: schema.NewRoleItem = {
      id: roleId,
      code: cleanCode,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      isSystem: false,
      createdAt: now,
      updatedAt: now,
    };

    const statements: any[] = [db.insert(schema.roles).values(newRole)];

    if (body.permissions) {
      for (const mod of ALL_MODULES) {
        const p = body.permissions[mod];
        if (!p) continue;
        statements.push(
          db.insert(schema.rolePermissions).values({
            id: crypto.randomUUID(),
            role: cleanCode,
            module: mod,
            canView: Boolean(p.read),
            canRead: Boolean(p.read),
            canCreate: Boolean(p.create),
            canUpdate: Boolean(p.update),
            canDelete: Boolean(p.delete),
            updatedAt: now,
          })
        );
      }
    }

    await db.batch(statements as any);

    return c.json(
      {
        success: true,
        message: `Role "${newRole.name}" (${cleanCode}) created successfully`,
        role: { ...newRole, userCount: 0 },
      },
      201
    );
  }
);

// PUT /api/admin/roles/:id - Update custom role name and description
app.put(
  '/api/admin/roles/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(2).max(100).optional(),
      description: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const roleId = c.req.param('id');
    const body = c.req.valid('json');

    const existing = await db.query.roles.findFirst({ where: eq(schema.roles.id, roleId) });
    if (!existing) {
      return c.json({ success: false, error: 'Role not found' }, 404);
    }

    const now = new Date().toISOString();
    await db
      .update(schema.roles)
      .set({
        ...(body.name ? { name: body.name.trim() } : {}),
        ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
        updatedAt: now,
      })
      .where(eq(schema.roles.id, roleId));

    const updated = await db.query.roles.findFirst({ where: eq(schema.roles.id, roleId) });
    return c.json({ success: true, message: 'Role updated successfully', role: updated });
  }
);

// DELETE /api/admin/roles/:id - Delete a custom role / permission group
app.delete('/api/admin/roles/:id', async (c) => {
  const db = createDbClient(c.env.DB);
  const roleId = c.req.param('id');

  const existing = await db.query.roles.findFirst({ where: eq(schema.roles.id, roleId) });
  if (!existing) {
    return c.json({ success: false, error: 'Role not found' }, 404);
  }

  if (existing.isSystem || ['ADMIN', 'MANAGER', 'STAFF'].includes(existing.code)) {
    return c.json({ success: false, error: 'System default roles are protected and cannot be deleted' }, 400);
  }

  const assignedUsers = await db.query.users.findMany({ where: eq(schema.users.role, existing.code) });
  if (assignedUsers.length > 0) {
    return c.json(
      {
        success: false,
        error: `Cannot delete role "${existing.name}" because it is currently assigned to ${assignedUsers.length} user(s). Please reassign their roles in Staff or Admin first.`,
      },
      400
    );
  }

  await db.batch([
    db.delete(schema.rolePermissions).where(eq(schema.rolePermissions.role, existing.code)),
    db.delete(schema.roles).where(eq(schema.roles.id, roleId)),
  ] as any);

  return c.json({
    success: true,
    message: `Role "${existing.name}" successfully deleted`,
  });
});

// GET /api/admin/role-permissions - Current role -> module visibility & CRUD matrix
app.get('/api/admin/role-permissions', async (c) => {
  const db = createDbClient(c.env.DB);
  const [allRoles, matrix, crudMatrix] = await Promise.all([
    loadAllRoles(db),
    loadPermissionMatrix(db),
    loadCrudPermissionMatrix(db),
  ]);
  return c.json({
    success: true,
    modules: ALL_MODULES,
    roles: allRoles,
    matrix, // { ADMIN: [...always all], MANAGER: [...], STAFF: [...], ... }
    crudMatrix, // { ADMIN: { ... }, MANAGER: { ... }, STAFF: { ... }, ... }
  });
});

// PUT /api/admin/role-permissions - Bulk-update any editable role's module CRUD access
app.put(
  '/api/admin/role-permissions',
  zValidator(
    'json',
    z.object({
      role: z.string().min(1),
      permissions: z.record(
        z.enum(ALL_MODULES),
        z.union([
          z.object({
            create: z.boolean(),
            read: z.boolean(),
            update: z.boolean(),
            delete: z.boolean(),
          }),
          z.boolean(),
        ])
      ),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');
    const role = body.role.trim().toUpperCase();

    if (isAdminRole(role)) {
      return c.json({ success: false, error: 'System Administrator permissions are permanently full access and cannot be modified' }, 400);
    }

    const statements = ALL_MODULES.filter((mod) => body.permissions[mod] !== undefined).map((mod) => {
      const p = body.permissions[mod as Module];
      let canCreate = false;
      let canRead = false;
      let canUpdate = false;
      let canDelete = false;

      if (typeof p === 'boolean') {
        canRead = p;
        canCreate = p && role === 'MANAGER';
        canUpdate = p && role === 'MANAGER';
        canDelete = p && role === 'MANAGER';
      } else if (p) {
        canCreate = Boolean(p.create);
        canRead = Boolean(p.read);
        canUpdate = Boolean(p.update);
        canDelete = Boolean(p.delete);
      }

      const canView = canRead;
      const now = new Date().toISOString();

      return db
        .insert(schema.rolePermissions)
        .values({
          id: crypto.randomUUID(),
          role,
          module: mod,
          canView,
          canRead,
          canCreate,
          canUpdate,
          canDelete,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [schema.rolePermissions.role, schema.rolePermissions.module],
          set: {
            canView,
            canRead,
            canCreate,
            canUpdate,
            canDelete,
            updatedAt: now,
          },
        });
    });

    if (statements.length > 0) {
      await db.batch(statements as any);
    }

    const matrix = await loadPermissionMatrix(db);
    const crudMatrix = await loadCrudPermissionMatrix(db);
    return c.json({ success: true, message: 'Permissions updated successfully', matrix, crudMatrix });
  }
);

/* ========================================================================== */
/* 9. SYSTEM SETTINGS MODULE (ADMIN CONTROLLED)                               */
/* ========================================================================== */

export const DEFAULT_SETTINGS = [
  // 1. VOUCHERS & ACCOUNTING SETTINGS
  {
    key: 'vouchers.signatories',
    category: 'vouchers',
    description: 'Default signatory names and titles for voucher slip generation',
    value: JSON.stringify({
      preparedBy: 'Administrator',
      certifiedBy: 'Joy/Admin',
      approvedBy: 'Kenneth Brown/CEO',
      receivedBy: 'Signature over printed name/Date',
    }),
  },
  {
    key: 'vouchers.permissions',
    category: 'vouchers',
    description: 'Role-based policies for voiding, deleting, and hiding vouchers',
    value: JSON.stringify({
      allowStaffDelete: false,
      allowManagerDelete: false,
      allowAdminDelete: true,
      allowStaffVoid: false,
      allowManagerVoid: true,
      allowAdminVoid: true,
      allowStaffHide: false,
      allowManagerHide: false,
      allowAdminHide: true,
    }),
  },
  {
    key: 'vouchers.payment_methods',
    category: 'vouchers',
    description: 'Allowed payment disbursement and collection methods',
    value: JSON.stringify([
      { id: 'BANK_TRANSFER', name: 'Bank Transfer / Wire', isActive: true },
      { id: 'CHECK', name: 'Corporate Check', isActive: true },
      { id: 'CASH', name: 'Petty Cash', isActive: true },
      { id: 'CREDIT_CARD', name: 'Corporate Credit Card', isActive: true },
      { id: 'ONLINE', name: 'Online / E-Wallet', isActive: true },
    ]),
  },
  {
    key: 'vouchers.types',
    category: 'vouchers',
    description: 'Voucher types and standard numbering prefixes',
    value: JSON.stringify([
      { id: 'PAYMENT', name: 'Payment Voucher (PV)', prefix: '26-', description: 'Vendor disbursements, payroll payouts, expenses' },
      { id: 'RECEIPT', name: 'Receipt Voucher (RV)', prefix: 'RV-', description: 'Customer incoming payments and receipts' },
      { id: 'JOURNAL', name: 'Journal Voucher (JV)', prefix: 'JV-', description: 'General double-entry adjusting entries' },
      { id: 'CONTRA', name: 'Contra Voucher (CV)', prefix: 'CV-', description: 'Bank and cash internal transfers' },
    ]),
  },
  {
    key: 'vouchers.tags',
    category: 'vouchers',
    description: 'Standard expense and cost-center tags for categorization',
    value: JSON.stringify([
      'Operating Expense (OPEX)',
      'Capital Expenditure (CAPEX)',
      'Office Supplies',
      'Utilities & Power',
      'Software & Subscriptions',
      'Logistics & Freight',
      'Direct Materials',
      'Subcontractor Services',
      'Travel & Representation',
      'Taxes & Licenses',
      'Salaries & Compensation',
      'Petty Cash Replenishment',
    ]),
  },
  {
    key: 'vouchers.default_accounts',
    category: 'vouchers',
    description: 'Default Chart of Accounts mappings for automated voucher double entries',
    value: JSON.stringify({
      cashAccountCode: '1010',
      inventoryAssetCode: '1200',
      accountsReceivableCode: '1300',
      accountsPayableCode: '2010',
      payrollLiabilitiesCode: '2020',
      equityCode: '3010',
      salesRevenueCode: '4010',
      cogsCode: '5010',
      salariesExpenseCode: '5020',
    }),
  },
  // 2. ORGANIZATION PROFILE
  {
    key: 'organization.profile',
    category: 'organization',
    description: 'Company identification, print header, and currency preferences',
    value: JSON.stringify({
      companyName: 'APEXS, INC.',
      tagline: 'Applied Expert Systems & Software, Inc.',
      motto: 'We put technology to work for you',
      address: 'Suite 714 EGI City by the Sea, Maribago, Lapu-Lapu City 6015',
      telefax: '495-2106',
      taxId: '000-000-000-000',
      defaultCurrency: 'PHP',
    }),
  },
  // 3. OPERATIONS CONFIG
  {
    key: 'operations.config',
    category: 'operations',
    description: 'Inventory, Purchasing, and Sales workflow preferences',
    value: JSON.stringify({
      lowStockThreshold: 10,
      defaultUom: 'pcs',
      defaultPaymentTermsDays: 30,
      poPrefix: 'PO-',
      siPrefix: 'SI-',
      soPrefix: 'SI-',
      invPrefix: 'INV-',
      grnPrefix: 'GRN-',
    }),
  },
  // 4. PAYROLL CONFIG
  {
    key: 'payroll.config',
    category: 'payroll',
    description: 'Payroll run defaults and work schedule standards',
    value: JSON.stringify({
      payrollRunPrefix: 'PR-',
      standardWorkDaysPerMonth: 22,
      defaultDisbursementMethod: 'BANK_TRANSFER',
    }),
  },
];

async function seedDefaultSettings(db: ReturnType<typeof createDbClient>) {
  for (const s of DEFAULT_SETTINGS) {
    const existing = await db.query.systemSettings.findFirst({
      where: eq(schema.systemSettings.key, s.key),
    });
    if (!existing) {
      await db.insert(schema.systemSettings).values({
        key: s.key,
        category: s.category,
        value: s.value,
        description: s.description,
        updatedAt: new Date().toISOString(),
        updatedBy: 'system_seed',
      });
    }
  }
}

// GET /api/settings - Retrieve all system settings
app.get('/api/settings', async (c) => {
  const db = createDbClient(c.env.DB);
  await seedDefaultSettings(db);

  const rows = await db.query.systemSettings.findMany({
    orderBy: [schema.systemSettings.category, schema.systemSettings.key],
  });

  const settings: Record<string, Record<string, any>> = {};
  for (const row of rows) {
    if (!settings[row.category]) settings[row.category] = {};
    try {
      settings[row.category][row.key] = JSON.parse(row.value);
    } catch {
      settings[row.category][row.key] = row.value;
    }
  }

  return c.json({ success: true, settings, raw: rows });
});

// GET /api/settings/:category - Retrieve settings for a specific module category
app.get('/api/settings/:category', async (c) => {
  const db = createDbClient(c.env.DB);
  await seedDefaultSettings(db);

  const category = c.req.param('category');
  const rows = await db.query.systemSettings.findMany({
    where: eq(schema.systemSettings.category, category),
  });

  const categorySettings: Record<string, any> = {};
  for (const row of rows) {
    try {
      categorySettings[row.key] = JSON.parse(row.value);
    } catch {
      categorySettings[row.key] = row.value;
    }
  }

  return c.json({ success: true, category, settings: categorySettings });
});

// PUT /api/settings/:key - Update a specific system setting
app.put(
  '/api/settings/:key',
  requireModule('settings', 'update'),
  zValidator(
    'json',
    z.object({
      category: z.string().min(1),
      value: z.any(),
      description: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const key = c.req.param('key');
    const body = c.req.valid('json');
    const user = c.get('authUser');

    const stringVal = typeof body.value === 'string' ? body.value : JSON.stringify(body.value);

    await db
      .insert(schema.systemSettings)
      .values({
        key,
        category: body.category,
        value: stringVal,
        description: body.description,
        updatedAt: new Date().toISOString(),
        updatedBy: user ? `${user.name} (${user.email})` : 'admin',
      })
      .onConflictDoUpdate({
        target: [schema.systemSettings.key],
        set: {
          category: body.category,
          value: stringVal,
          description: body.description,
          updatedAt: new Date().toISOString(),
          updatedBy: user ? `${user.name} (${user.email})` : 'admin',
        },
      });

    return c.json({ success: true, message: `Setting ${key} updated successfully` });
  }
);

// PUT /api/settings/category/:category - Bulk update settings in a category
app.put(
  '/api/settings/category/:category',
  requireModule('settings', 'update'),
  zValidator(
    'json',
    z.object({
      settings: z.record(z.string(), z.any()),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const category = c.req.param('category');
    const body = c.req.valid('json');
    const user = c.get('authUser');

    const statements = Object.entries(body.settings).map(([key, value]) => {
      const stringVal = typeof value === 'string' ? value : JSON.stringify(value);
      return db
        .insert(schema.systemSettings)
        .values({
          key,
          category,
          value: stringVal,
          updatedAt: new Date().toISOString(),
          updatedBy: user ? `${user.name} (${user.email})` : 'admin',
        })
        .onConflictDoUpdate({
          target: [schema.systemSettings.key],
          set: {
            value: stringVal,
            updatedAt: new Date().toISOString(),
            updatedBy: user ? `${user.name} (${user.email})` : 'admin',
          },
        });
    });

    if (statements.length > 0) {
      await db.batch(statements as any);
    }

    return c.json({ success: true, message: `Settings for category ${category} updated successfully` });
  }
);

// SPA wildcard fallback for all client routes and subpaths
app.get('*', async (c, next) => {
  if (c.req.path.startsWith('/api/')) return next();
  return serveHtmlApp(c);
});

export default app;
