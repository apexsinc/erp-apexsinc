import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import { createDbClient } from './db/client';
import * as schema from './db/schema';
import { renderAppHtml } from './ui';
import { authMiddleware, requireAdmin, requireModule } from './middleware/auth';
import { hashPassword, verifyPasswordLegacyAware } from './lib/password';
import { verifyTurnstileToken } from './lib/turnstile';
import { ALL_MODULES, DEFAULT_PERMISSION_MATRIX, isAdminRole, loadPermissionMatrix, seedDefaultPermissions, type EditableRole, type Module } from './lib/permissions';

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

/* ========================================================================== */
/* ROUTE PROTECTION — registered before any handlers so every matching       */
/* request passes through auth/role checks first. Session role/isActive is   */
/* re-read from the DB on every request, so permission or account changes    */
/* made via /api/admin take effect immediately, without waiting for token    */
/* expiry.                                                                    */
/* ========================================================================== */
app.use('/api/auth/me', authMiddleware);
app.use('/api/auth/logout', authMiddleware);
app.use('/api/admin/*', authMiddleware, requireAdmin);
app.use('/api/dashboard', authMiddleware, requireModule('dashboard'));
app.use('/api/inventory/*', authMiddleware, requireModule('inventory'));
app.use('/api/purchasing/*', authMiddleware, requireModule('purchasing'));
app.use('/api/inbound/*', authMiddleware, requireModule('inbound'));
app.use('/api/sales/*', authMiddleware, requireModule('sales'));
app.use('/api/outbound/*', authMiddleware, requireModule('outbound'));
app.use('/api/accounting/*', authMiddleware, requireModule('accounting'));
app.use('/api/payroll/*', authMiddleware, requireModule('payroll'));

// UI Web Application Entrypoint (Served directly at edge)
async function renderApp(c: { env: Bindings }) {
  const db = createDbClient(c.env.DB);
  const rolePermissions = await loadPermissionMatrix(db);
  return renderAppHtml(rolePermissions, { turnstileSiteKey: c.env.TURNSTILE_SITE_KEY });
}
app.get('/', async (c) => c.html(await renderApp(c)));
app.get('/login', async (c) => c.html(await renderApp(c)));
app.get('/app', async (c) => c.html(await renderApp(c)));

/* ========================================================================== */
/* 0. AUTHENTICATION & ADMIN SYSTEM                                           */
/* ========================================================================== */

app.post(
  '/api/auth/login',
  zValidator(
    'json',
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      cfTurnstileToken: z.string().optional(),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    if (c.env.TURNSTILE_SECRET_KEY) {
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

    return c.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
  return c.json({ success: true, user: authUser });
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

// POST /api/inventory/products - Create Product
app.post(
  '/api/inventory/products',
  zValidator(
    'json',
    z.object({
      sku: z.string().min(2),
      name: z.string().min(1),
      description: z.string().optional(),
      unitOfMeasure: z.string().default('unit'),
      costPriceCents: z.number().int().nonnegative(),
      sellingPriceCents: z.number().int().nonnegative(),
      initialStock: z.number().int().nonnegative().default(0),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const productId = crypto.randomUUID();
    const productInsert = db.insert(schema.products).values({
      id: productId,
      sku: body.sku.toUpperCase(),
      name: body.name,
      description: body.description,
      unitOfMeasure: body.unitOfMeasure,
      costPriceCents: body.costPriceCents,
      sellingPriceCents: body.sellingPriceCents,
    });

    if (body.initialStock > 0) {
      const stockMovementInsert = db.insert(schema.stockMovements).values({
        id: crypto.randomUUID(),
        productId,
        type: 'IN',
        quantity: body.initialStock,
        unitCostCents: body.costPriceCents,
        referenceType: 'INITIAL',
        notes: 'Initial inventory count on product setup',
      });
      await db.batch([productInsert, stockMovementInsert]);
    } else {
      await productInsert;
    }

    const created = await db.query.products.findFirst({
      where: eq(schema.products.id, productId),
    });

    return c.json({ success: true, data: { ...created, onHandStock: body.initialStock } }, 201);
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
        inventoryValuationCents: stock * prod.costPriceCents,
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
      inventoryValuationCents: stock * product.costPriceCents,
    },
  });
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

// POST /api/purchasing/orders - Create Purchase Order
app.post(
  '/api/purchasing/orders',
  zValidator(
    'json',
    z.object({
      vendorId: z.string().uuid(),
      notes: z.string().optional(),
      items: z.array(
        z.object({
          productId: z.string().uuid(),
          quantityOrdered: z.number().int().positive(),
          unitPriceCents: z.number().int().nonnegative(),
        })
      ).min(1),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const poId = crypto.randomUUID();
    const poNumber = 'PO-' + Date.now().toString().slice(-6);
    const totalAmountCents = body.items.reduce((acc, it) => acc + it.quantityOrdered * it.unitPriceCents, 0);

    const poInsert = db.insert(schema.purchaseOrders).values({
      id: poId,
      poNumber,
      vendorId: body.vendorId,
      status: 'APPROVED',
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

    await db.batch([poInsert, ...itemInserts]);

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

// POST /api/sales/orders - Create Sales Order
app.post(
  '/api/sales/orders',
  zValidator(
    'json',
    z.object({
      customerId: z.string().uuid(),
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

    const soId = crypto.randomUUID();
    const soNumber = 'SO-' + Date.now().toString().slice(-6);
    const totalAmountCents = body.items.reduce((acc, it) => acc + it.quantity * it.unitPriceCents, 0);

    const soInsert = db.insert(schema.salesOrders).values({
      id: soId,
      soNumber,
      customerId: body.customerId,
      status: 'CONFIRMED',
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

    await db.batch([soInsert, ...itemInserts]);

    const createdSO = await db.query.salesOrders.findFirst({
      where: eq(schema.salesOrders.id, soId),
      with: { customer: true, items: { with: { product: true } } },
    });

    return c.json({ success: true, data: createdSO }, 201);
  }
);

// GET /api/sales/orders - List Sales Orders
app.get('/api/sales/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.salesOrders.findMany({
    orderBy: [desc(schema.salesOrders.createdAt)],
    with: { customer: true, items: { with: { product: true } }, invoices: true },
  });
  return c.json({ success: true, data: orders });
});

// POST /api/sales/invoices/:id/receipt - Customer Payment Receipt
app.post(
  '/api/sales/invoices/:id/receipt',
  zValidator(
    'json',
    z.object({
      amountCents: z.number().int().positive(),
      paymentMethod: z.enum(['BANK_TRANSFER', 'CHECK', 'CASH', 'CREDIT_CARD', 'ONLINE']).default('BANK_TRANSFER'),
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

/* ========================================================================== */
/* 5. OUTBOUND DELIVERY TRACKING MODULE                                       */
/* Every confirmed SO shows up here for two-step fulfillment:                 */
/*   1) Mark as Packed — the order is picked, boxed, ready to leave.          */
/*   2) Confirm Shipped Quantity — validates against both remaining ordered   */
/*      quantity and actual on-hand stock, decrements inventory, issues an    */
/*      invoice for just the shipped value, and moves the SO to               */
/*      PARTIALLY_FULFILLED or FULFILLED depending on whether every line is   */
/*      now fully shipped.                                                    */
/* ========================================================================== */

// GET /api/outbound/orders - List SOs that have moved past DRAFT for shipment tracking
app.get('/api/outbound/orders', async (c) => {
  const db = createDbClient(c.env.DB);
  const orders = await db.query.salesOrders.findMany({
    where: (soTable, { inArray }) => inArray(soTable.status, ['CONFIRMED', 'PACKED', 'PARTIALLY_FULFILLED', 'FULFILLED']),
    orderBy: [desc(schema.salesOrders.createdAt)],
    with: { customer: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: orders });
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
    with: { customer: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: updated });
});

// POST /api/outbound/orders/:id/ship - Step 2: confirm shipped quantity, invoice, decrement inventory
app.post(
  '/api/outbound/orders/:id/ship',
  zValidator(
    'json',
    z.object({
      notes: z.string().optional(),
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

    const so = await db.query.salesOrders.findFirst({
      where: eq(schema.salesOrders.id, soId),
      with: { items: { with: { product: true } } },
    });
    if (!so) return c.json({ success: false, error: 'Sales Order not found' }, 404);
    if (so.status !== 'PACKED' && so.status !== 'PARTIALLY_FULFILLED') {
      return c.json({ success: false, error: `Cannot ship from status ${so.status}. Mark as packed first.` }, 400);
    }

    // Validate every line before writing anything: can't ship more than what's still
    // owed on the order, and — unlike receiving inbound stock — can't ship more than
    // what's actually on hand.
    for (const shipItem of body.items) {
      const soItem = so.items.find((i) => i.id === shipItem.soItemId);
      if (!soItem) return c.json({ success: false, error: 'Sales order item not found: ' + shipItem.soItemId }, 400);

      const remaining = soItem.quantity - soItem.quantityShipped;
      if (shipItem.quantityShipped > remaining) {
        return c.json(
          { success: false, error: `Cannot ship ${shipItem.quantityShipped} of ${soItem.product.name}; only ${remaining} remain on this order.` },
          400
        );
      }

      const onHand = await getProductStockBalance(db, soItem.productId);
      if (shipItem.quantityShipped > onHand) {
        return c.json(
          { success: false, error: `Insufficient stock for ${soItem.product.name}: ${onHand} available, ${shipItem.quantityShipped} requested.` },
          400
        );
      }
    }

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);
    const shippedTotalCents = body.items.reduce((acc, shipItem) => {
      const soItem = so.items.find((i) => i.id === shipItem.soItemId)!;
      return acc + shipItem.quantityShipped * soItem.unitPriceCents;
    }, 0);

    const invoiceInsert = db.insert(schema.invoices).values({
      id: invoiceId,
      invoiceNumber,
      salesOrderId: so.id,
      customerId: so.customerId,
      status: 'ISSUED',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      totalAmountCents: shippedTotalCents,
      paidAmountCents: 0,
      notes: body.notes,
    });

    const batchStatements: any[] = [invoiceInsert];
    const updatedQtyByItemId = new Map<string, number>();

    for (const shipItem of body.items) {
      const soItem = so.items.find((i) => i.id === shipItem.soItemId)!;

      batchStatements.push(
        db.insert(schema.invoiceItems).values({
          id: crypto.randomUUID(),
          invoiceId,
          productId: soItem.productId,
          quantity: shipItem.quantityShipped,
          unitPriceCents: soItem.unitPriceCents,
          subtotalCents: shipItem.quantityShipped * soItem.unitPriceCents,
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
          referenceId: invoiceNumber,
          notes: 'Shipment for ' + so.soNumber,
        })
      );

      // Update SO Item quantity shipped
      const updatedQty = soItem.quantityShipped + shipItem.quantityShipped;
      updatedQtyByItemId.set(soItem.id, updatedQty);
      batchStatements.push(
        db.update(schema.salesOrderItems).set({ quantityShipped: updatedQty }).where(eq(schema.salesOrderItems.id, soItem.id))
      );
    }

    // A SO is only fully FULFILLED once every line item's shipped quantity meets its
    // ordered quantity; otherwise it's PARTIALLY_FULFILLED so the remainder still shows
    // up in Outbound.
    const isFullyShipped = so.items.every((item) => (updatedQtyByItemId.get(item.id) ?? item.quantityShipped) >= item.quantity);
    batchStatements.push(
      db
        .update(schema.salesOrders)
        .set({ status: isFullyShipped ? 'FULFILLED' : 'PARTIALLY_FULFILLED', updatedAt: new Date().toISOString() })
        .where(eq(schema.salesOrders.id, soId))
    );

    // Double-Entry Accounting: Accounts Receivable (1300) Debit, Sales Revenue (4010) Credit — for the shipped value only
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
          debitCents: shippedTotalCents,
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
          creditCents: shippedTotalCents,
          description: 'Revenue from sales order ' + so.soNumber,
        })
      );
    }

    await db.batch(batchStatements as any);

    return c.json({
      success: true,
      message: 'Shipment confirmed, invoice issued, and stock ledger updated.',
      invoiceId,
      invoiceNumber,
      totalAmountCents: shippedTotalCents,
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

// POST /api/accounting/vouchers/journal - Create Balanced Journal Voucher
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

    return c.json({
      success: true,
      message: 'Journal Voucher created and posted.',
      jvNumber,
      totalAmountCents: totalDebit,
    }, 201);
  }
);

// GET /api/accounting/ledger - Full General Ledger
app.get('/api/accounting/ledger', async (c) => {
  const db = createDbClient(c.env.DB);
  const ledger = await db.query.journalEntries.findMany({
    orderBy: [desc(schema.journalEntries.createdAt)],
    with: { account: true },
  });
  return c.json({ success: true, count: ledger.length, data: ledger });
});

/* ========================================================================== */
/* 7. PAYROLL MODULE                                                          */
/* ========================================================================== */

// POST /api/payroll/employees - Create Employee (optionally with a linked login account)
app.post(
  '/api/payroll/employees',
  zValidator(
    'json',
    z
      .object({
        employeeCode: z.string().min(2),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        department: z.string().min(1),
        position: z.string().min(1),
        hireDate: z.string().default(() => new Date().toISOString()),
        bankAccountNumber: z.string().optional(),
        bankName: z.string().optional(),
        salary: z
          .object({
            baseSalaryCents: z.number().int().positive(),
            allowancesCents: z.number().int().nonnegative().default(0),
            deductionsCents: z.number().int().nonnegative().default(0),
          })
          .optional(),
        createUserAccount: z.boolean().default(false),
        userRole: z.enum(['ADMIN', 'MANAGER', 'STAFF']).default('STAFF'),
        password: z.string().min(8).optional(),
      })
      .refine((data) => !data.createUserAccount || !!data.password, {
        message: 'Password is required to create a login account',
        path: ['password'],
      })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const existingEmployee = await db.query.employees.findFirst({ where: eq(schema.employees.email, body.email) });
    if (existingEmployee) {
      return c.json({ success: false, error: 'An employee with that email already exists' }, 400);
    }

    let userId: string | undefined;
    const batchStatements: any[] = [];

    if (body.createUserAccount) {
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
          role: body.userRole,
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

    if (body.salary) {
      const net = body.salary.baseSalaryCents + body.salary.allowancesCents - body.salary.deductionsCents;
      batchStatements.push(
        db.insert(schema.salaryStructures).values({
          id: crypto.randomUUID(),
          employeeId,
          baseSalaryCents: body.salary.baseSalaryCents,
          allowancesCents: body.salary.allowancesCents,
          deductionsCents: body.salary.deductionsCents,
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

    return c.json({ success: true, data: { ...employeeSafe, user: safeUser } }, 201);
  }
);

// GET /api/payroll/employees - List Employees
app.get('/api/payroll/employees', async (c) => {
  const db = createDbClient(c.env.DB);
  const emps = await db.query.employees.findMany({
    where: eq(schema.employees.status, 'ACTIVE'),
    with: { salaryStructures: true },
  });
  return c.json({ success: true, count: emps.length, data: emps });
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

  const [products, customers, vendors, employees, soList, poList, payrollList] = await Promise.all([
    db.query.products.findMany(),
    db.query.customers.findMany(),
    db.query.vendors.findMany(),
    db.query.employees.findMany({ where: eq(schema.employees.status, 'ACTIVE') }),
    db.query.salesOrders.findMany(),
    db.query.purchaseOrders.findMany(),
    db.query.payrollRuns.findMany({ where: eq(schema.payrollRuns.status, 'FINALIZED') }),
  ]);

  let totalInventoryValuationCents = 0;
  for (const prod of products) {
    const stock = await getProductStockBalance(db, prod.id);
    totalInventoryValuationCents += stock * prod.costPriceCents;
  }

  const totalSalesRevenueCents = soList.reduce((acc, so) => acc + so.totalAmountCents, 0);
  const totalPurchaseCommitmentCents = poList.reduce((acc, po) => acc + po.totalAmountCents, 0);
  const totalPayrollPaidCents = payrollList.reduce((acc, pr) => acc + pr.totalNetCents, 0);

  return c.json({
    success: true,
    kpis: {
      totalProducts: products.length,
      totalCustomers: customers.length,
      totalVendors: vendors.length,
      activeEmployees: employees.length,
      totalInventoryValuationCents,
      totalSalesRevenueCents,
      totalPurchaseCommitmentCents,
      totalPayrollPaidCents,
    },
    formatted: {
      inventoryValuation: '₱' + (totalInventoryValuationCents / 100).toFixed(2),
      salesRevenue: '₱' + (totalSalesRevenueCents / 100).toFixed(2),
      purchaseCommitments: '₱' + (totalPurchaseCommitmentCents / 100).toFixed(2),
      payrollPaid: '₱' + (totalPayrollPaidCents / 100).toFixed(2),
    },
  });
});

/* ========================================================================== */
/* 9. ADMINISTRATION — USER & ROLE PERMISSION MANAGEMENT (ADMIN only)         */
/* ========================================================================== */

// GET /api/admin/users - List all user accounts
app.get('/api/admin/users', async (c) => {
  const db = createDbClient(c.env.DB);
  const users = await db.query.users.findMany({ orderBy: [desc(schema.users.createdAt)] });
  return c.json({
    success: true,
    data: users.map(({ passwordHash, ...safe }) => safe),
  });
});

// PATCH /api/admin/users/:id - Update name/role/active status (and optionally reset password)
app.patch(
  '/api/admin/users/:id',
  zValidator(
    'json',
    z.object({
      name: z.string().min(1).optional(),
      role: z.enum(['ADMIN', 'MANAGER', 'STAFF']).optional(),
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

// GET /api/admin/role-permissions - Current role -> module visibility matrix
app.get('/api/admin/role-permissions', async (c) => {
  const db = createDbClient(c.env.DB);
  const matrix = await loadPermissionMatrix(db);
  return c.json({
    success: true,
    modules: ALL_MODULES,
    matrix, // { ADMIN: [...always all], MANAGER: [...], STAFF: [...] }
  });
});

// PUT /api/admin/role-permissions - Bulk-update one editable role's module access
app.put(
  '/api/admin/role-permissions',
  zValidator(
    'json',
    z.object({
      role: z.enum(['MANAGER', 'STAFF']),
      permissions: z.record(z.enum(ALL_MODULES), z.boolean()),
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');
    const role = body.role as EditableRole;

    const statements = ALL_MODULES.filter((mod) => body.permissions[mod] !== undefined).map((mod) => {
      const canView = body.permissions[mod as Module] as boolean;
      return db
        .insert(schema.rolePermissions)
        .values({ id: crypto.randomUUID(), role, module: mod, canView })
        .onConflictDoUpdate({
          target: [schema.rolePermissions.role, schema.rolePermissions.module],
          set: { canView, updatedAt: new Date().toISOString() },
        });
    });

    if (statements.length > 0) {
      await db.batch(statements as any);
    }

    const matrix = await loadPermissionMatrix(db);
    return c.json({ success: true, message: 'Permissions updated', matrix });
  }
);

export default app;
