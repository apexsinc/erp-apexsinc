import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import { createDbClient } from './db/client';
import * as schema from './db/schema';
import { renderAppHtml } from './ui';

// Environment Bindings for Cloudflare Workers
type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

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

// UI Web Application Entrypoint (Served directly at edge)
app.get('/', (c) => c.html(renderAppHtml()));
app.get('/login', (c) => c.html(renderAppHtml()));
app.get('/app', (c) => c.html(renderAppHtml()));

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
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    // Check user in database
    let user = await db.query.users.findFirst({
      where: eq(schema.users.email, body.email.toLowerCase()),
    });

    // Default admin fallback if not yet seeded
    if (!user && body.email.toLowerCase() === 'admin@apexsinc.com' && body.password === 'kbs812sls729@admin') {
      const adminId = crypto.randomUUID();
      await db.insert(schema.users).values({
        id: adminId,
        email: 'admin@apexsinc.com',
        name: 'System Administrator',
        passwordHash: 'kbs812sls729@admin',
        role: 'ADMIN',
      });
      user = await db.query.users.findFirst({ where: eq(schema.users.id, adminId) });
    } else if (user && user.email === 'admin@apexsinc.com' && body.password === 'kbs812sls729@admin') {
      // Sync password update if modified
      if (user.passwordHash !== 'kbs812sls729@admin') {
        await db.update(schema.users).set({ passwordHash: 'kbs812sls729@admin' }).where(eq(schema.users.id, user.id));
        user.passwordHash = 'kbs812sls729@admin';
      }
    }

    if (!user || user.passwordHash !== body.password) {
      return c.json({ success: false, error: 'Invalid email or password' }, 401);
    }

    // Return session token and user profile
    const token = 'session_' + user.id + '_' + Date.now();
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

app.get('/api/auth/me', async (c) => {
  return c.json({
    success: true,
    user: {
      email: 'admin@apexsinc.com',
      name: 'System Administrator',
      role: 'ADMIN',
    },
  });
});

/* ========================================================================== */
/* 0. SYSTEM SETUP & CHART OF ACCOUNTS SEED                                   */
/* ========================================================================== */

app.post('/api/setup/seed', async (c) => {
  const db = createDbClient(c.env.DB);

  // 1. Seed or Update Admin User
  const existingAdmin = await db.query.users.findFirst({
    where: eq(schema.users.email, 'admin@apexsinc.com'),
  });
  if (!existingAdmin) {
    await db.insert(schema.users).values({
      id: crypto.randomUUID(),
      email: 'admin@apexsinc.com',
      name: 'System Administrator',
      passwordHash: 'kbs812sls729@admin',
      role: 'ADMIN',
    });
  } else {
    await db.update(schema.users).set({ passwordHash: 'kbs812sls729@admin' }).where(eq(schema.users.id, existingAdmin.id));
  }

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

// POST /api/purchasing/orders/:id/receive - Process Goods Received Note (GRN) & increment inventory
app.post(
  '/api/purchasing/orders/:id/receive',
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

    const grnId = crypto.randomUUID();
    const grnNumber = 'GRN-' + Date.now().toString().slice(-6);

    const grnInsert = db.insert(schema.goodsReceivedNotes).values({
      id: grnId,
      grnNumber,
      purchaseOrderId: poId,
      notes: body.notes,
    });

    const batchStatements: any[] = [grnInsert];

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
      batchStatements.push(
        db.update(schema.purchaseOrderItems).set({ quantityReceived: updatedQty }).where(eq(schema.purchaseOrderItems.id, poItem.id))
      );
    }

    // Update PO Status
    batchStatements.push(
      db.update(schema.purchaseOrders).set({ status: 'RECEIVED', updatedAt: new Date().toISOString() }).where(eq(schema.purchaseOrders.id, poId))
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
/* 3. SALES (O2C) MODULE                                                      */
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
    with: { customer: true, items: { with: { product: true } } },
  });
  return c.json({ success: true, data: orders });
});

// POST /api/sales/orders/:id/invoice - Invoice & Fulfill SO
app.post(
  '/api/sales/orders/:id/invoice',
  zValidator(
    'json',
    z.object({
      dueDate: z.string().default(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
      notes: z.string().optional(),
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

    const invoiceId = crypto.randomUUID();
    const invoiceNumber = 'INV-' + Date.now().toString().slice(-6);

    const invoiceInsert = db.insert(schema.invoices).values({
      id: invoiceId,
      invoiceNumber,
      salesOrderId: so.id,
      customerId: so.customerId,
      status: 'ISSUED',
      dueDate: body.dueDate,
      totalAmountCents: so.totalAmountCents,
      paidAmountCents: 0,
      notes: body.notes,
    });

    const batchStatements: any[] = [invoiceInsert];

    // Invoice items & Stock Movements OUT
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

      // Decrement Inventory via stock movement
      batchStatements.push(
        db.insert(schema.stockMovements).values({
          id: crypto.randomUUID(),
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          unitCostCents: item.product.costPriceCents,
          referenceType: 'SO_DELIVERY',
          referenceId: invoiceNumber,
          notes: 'Fulfillment for ' + so.soNumber,
        })
      );
    }

    // Mark Sales Order as Fulfilled
    batchStatements.push(
      db.update(schema.salesOrders).set({ status: 'FULFILLED', updatedAt: new Date().toISOString() }).where(eq(schema.salesOrders.id, so.id))
    );

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

      // Debit A/R
      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: arAccount.id,
          debitCents: so.totalAmountCents,
          creditCents: 0,
          description: 'Receivable from invoice ' + invoiceNumber,
        })
      );

      // Credit Revenue
      batchStatements.push(
        db.insert(schema.journalEntries).values({
          id: crypto.randomUUID(),
          voucherType: 'JOURNAL',
          voucherId: jvId,
          accountId: revAccount.id,
          debitCents: 0,
          creditCents: so.totalAmountCents,
          description: 'Revenue from sales order ' + so.soNumber,
        })
      );
    }

    await db.batch(batchStatements as any);

    return c.json({
      success: true,
      message: 'Invoice created, stock decremented, and accounting entries posted.',
      invoiceId,
      invoiceNumber,
      totalAmountCents: so.totalAmountCents,
    });
  }
);

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
/* 4. VOUCHERS & ACCOUNTING MODULE                                            */
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
/* 5. PAYROLL MODULE                                                          */
/* ========================================================================== */

// POST /api/payroll/employees - Create Employee
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
    })
  ),
  async (c) => {
    const db = createDbClient(c.env.DB);
    const body = c.req.valid('json');

    const employeeId = crypto.randomUUID();
    const empInsert = db.insert(schema.employees).values({
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
    });

    if (body.salary) {
      const net = body.salary.baseSalaryCents + body.salary.allowancesCents - body.salary.deductionsCents;
      const salaryInsert = db.insert(schema.salaryStructures).values({
        id: crypto.randomUUID(),
        employeeId,
        baseSalaryCents: body.salary.baseSalaryCents,
        allowancesCents: body.salary.allowancesCents,
        deductionsCents: body.salary.deductionsCents,
        netSalaryCents: net,
      });
      await db.batch([empInsert, salaryInsert]);
    } else {
      await empInsert;
    }

    const created = await db.query.employees.findFirst({
      where: eq(schema.employees.id, employeeId),
      with: { salaryStructures: true },
    });

    return c.json({ success: true, data: created }, 201);
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
/* 6. EXECUTIVE DASHBOARD & AGGREGATIONS                                      */
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

export default app;
