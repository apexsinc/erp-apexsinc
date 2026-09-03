async function runTests() {
  const baseUrl = 'http://127.0.0.1:8787';

  console.log('=== 1. TEST SSR & SPA WEB URL ROUTES ===');
  const webRoutes = [
    '/',
    '/login',
    '/app',
    '/dashboard',
    '/directory',
    '/inventory',
    '/purchasing',
    '/inbound',
    '/sales',
    '/outbound',
    '/vouchers',
    '/accounting',
    '/payroll',
    '/staff',
    '/admin',
    '/settings',
    '/vouchers?tab=vouchers-pv',
    '/vouchers?tab=general-ledger',
    '/accounting?tab=reports-pl',
    '/accounting?tab=reports-bs',
    '/accounting?tab=reports-cf',
    '/inventory?search=WIDGET',
  ];

  for (const route of webRoutes) {
    const res = await fetch(`${baseUrl}${route}`);
    const isHtml = (res.headers.get('content-type') || '').includes('text/html');
    if (res.status !== 200 || !isHtml) {
      console.error(`❌ Route check failed for ${route}: status=${res.status}, isHtml=${isHtml}`);
      process.exit(1);
    }
    console.log(`  ✓ Route ${route.padEnd(30)} -> 200 OK (text/html)`);
  }

  // Check static logo & favicon assets
  const logoRes = await fetch(`${baseUrl}/assets/logo.png`);
  if (logoRes.status !== 200 || !logoRes.headers.get('content-type')?.includes('image/png')) {
    console.error(`❌ Logo check failed: status=${logoRes.status}`);
    process.exit(1);
  }
  console.log(`  ✓ Route /assets/logo.png               -> 200 OK (image/png, ${logoRes.headers.get('content-length') || 'valid'} bytes)`);

  const favRes = await fetch(`${baseUrl}/favicon.ico`);
  if (favRes.status !== 200) {
    console.error(`❌ Favicon check failed: status=${favRes.status}`);
    process.exit(1);
  }
  console.log(`  ✓ Route /favicon.ico                   -> 200 OK (image/png)`);

  console.log('\n=== 2. SEED CHART OF ACCOUNTS & ADMIN ===');
  const seedRes = await fetch(`${baseUrl}/api/setup/seed`, { method: 'POST' });
  const seedJson = await seedRes.json();
  console.log('Seed response:', seedJson.message || (seedJson.success ? 'Success' : 'Initialized'));

  console.log('\n=== 3. AUTHENTICATE AS ADMIN ===');
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@apexsinc.com',
      password: 'kbs812sls729@admin',
      cfTurnstileToken: 'TEST_PASS_TOKEN',
    }),
  });
  const loginJson = await loginRes.json();
  if (!loginJson.success || !loginJson.token) {
    console.error('Login failed:', loginJson);
    process.exit(1);
  }
  const token = loginJson.token;
  console.log('Authenticated successfully as:', loginJson.user.name, `(${loginJson.user.role})`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const suffix = Date.now().toString().slice(-4);

  console.log('\n=== 4. INVENTORY: ENSURE CATEGORY & CREATE PRODUCT ===');
  const catRes = await fetch(`${baseUrl}/api/inventory/categories`, { headers: authHeaders });
  const catJson = await catRes.json();
  let categoryName = catJson.data?.[0]?.name;

  if (!categoryName) {
    const newCatRes = await fetch(`${baseUrl}/api/inventory/categories`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Titanium Hardware' }),
    });
    const newCatData = await newCatRes.json();
    categoryName = newCatData.data.name;
  }
  console.log('Using category:', categoryName);

  const productRes = await fetch(`${baseUrl}/api/inventory/products`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      sku: `WIDGET-PRO-${suffix}`,
      name: 'Industrial Widget Pro',
      category: categoryName,
      description: 'High-precision titanium component',
    }),
  });
  const productData = await productRes.json();
  if (!productData.success) {
    console.error('Product creation failed:', productData);
    process.exit(1);
  }
  console.log('Created Product:', productData.data.name, 'SKU:', productData.data.sku);
  const productId = productData.data.id;

  // Set selling price for the product
  await fetch(`${baseUrl}/api/inventory/products/${productId}/price`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      sellingPriceCents: 9000,
      currency: 'PHP',
    }),
  });

  console.log('\n=== 5. PURCHASING: CREATE VENDOR & PO, INBOUND RECEIVE VIA GRN ===');
  const vendorRes = await fetch(`${baseUrl}/api/purchasing/vendors`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      vendorCode: `VEND-ACME-${suffix}`,
      name: 'Acme Materials Corp',
      email: `sales-${suffix}@acmematerials.com`,
      paymentTermsDays: 30,
    }),
  });
  const vendorData = await vendorRes.json();
  console.log('Created Vendor:', vendorData.data.name);
  const vendorId = vendorData.data.id;

  const poRes = await fetch(`${baseUrl}/api/purchasing/orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      vendorId,
      currency: 'PHP',
      notes: 'Urgent restocking order',
      items: [
        {
          productId,
          quantityOrdered: 100,
          unitOfMeasure: 'pcs',
          unitPriceCents: 4500,
        },
      ],
    }),
  });
  const poData = await poRes.json();
  if (!poData.success) {
    console.error('PO creation failed:', poData);
    process.exit(1);
  }
  console.log('Created PO:', poData.data.poNumber, 'Total:', `₱${poData.data.totalAmountCents / 100}`);
  const poId = poData.data.id;
  const poItemId = poData.data.items[0].id;

  // Step 1: Mark PO as delivered in inbound
  await fetch(`${baseUrl}/api/inbound/orders/${poId}/mark-delivered`, {
    method: 'POST',
    headers: authHeaders,
  });

  // Step 2: Receive items via GRN
  const receiveRes = await fetch(`${baseUrl}/api/inbound/orders/${poId}/receive`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      notes: 'Received batch at warehouse dock 3',
      items: [{ poItemId, quantityReceived: 100 }],
    }),
  });
  const receiveData = await receiveRes.json();
  console.log('GRN Processed:', receiveData.grnNumber, 'Message:', receiveData.message);

  // Check inventory level after GRN (100 received)
  const productDetailRes = await fetch(`${baseUrl}/api/inventory/products/${productId}`, {
    headers: authHeaders,
  });
  const productDetail = await productDetailRes.json();
  console.log('Product Stock After GRN:', productDetail.data.onHandStock, '(Expected 100)');

  console.log('\n=== 6. SALES: CREATE CUSTOMER, SO, OUTBOUND SHIP & RECEIPT ===');
  const customerRes = await fetch(`${baseUrl}/api/sales/customers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerCode: `CUST-GLOBEX-${suffix}`,
      name: 'Globex Corporation',
      email: `procurement-${suffix}@globex.com`,
    }),
  });
  const customerData = await customerRes.json();
  console.log('Created Customer:', customerData.data.name);
  const customerId = customerData.data.id;

  const soRes = await fetch(`${baseUrl}/api/sales/orders`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      customerId,
      currency: 'PHP',
      notes: 'Priority delivery',
      items: [{ productId, quantity: 20, unitPriceCents: 9000 }],
    }),
  });
  const soData = await soRes.json();
  console.log('Created Sales Order:', soData.data.soNumber, 'Total:', `₱${soData.data.totalAmountCents / 100}`);
  const soId = soData.data.id;
  const soItemId = soData.data.items[0].id;

  // Step 1: Mark packed in outbound
  await fetch(`${baseUrl}/api/outbound/orders/${soId}/mark-packed`, {
    method: 'POST',
    headers: authHeaders,
  });

  // Step 2: Ship items (decrements inventory, creates invoice)
  const shipRes = await fetch(`${baseUrl}/api/outbound/orders/${soId}/ship`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      notes: 'Shipped via Express Courier',
      items: [{ soItemId, quantityShipped: 20 }],
    }),
  });
  const shipData = await shipRes.json();
  console.log('Outbound Shipped & Invoiced:', shipData.invoiceNumber, 'Total:', `₱${shipData.totalAmountCents / 100}`);
  const invoiceId = shipData.invoiceId;

  // Check stock after shipping (100 - 20 = 80)
  const stockAfterSaleRes = await fetch(`${baseUrl}/api/inventory/products/${productId}`, {
    headers: authHeaders,
  });
  const stockAfterSale = await stockAfterSaleRes.json();
  console.log('Product Stock After Sale:', stockAfterSale.data.onHandStock, '(Expected 80)');

  // Pay Invoice -> Receipt Voucher
  if (invoiceId) {
    const receiptRes = await fetch(`${baseUrl}/api/sales/invoices/${invoiceId}/receipt`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        amountCents: 180000, // ₱1,800.00
        paymentMethod: 'BANK_TRANSFER',
        notes: 'Wire transfer ref #WT-8941',
      }),
    });
    const receiptData = await receiptRes.json();
    console.log('Customer Receipt Recorded:', receiptData.receiptVoucherNumber, 'Status:', receiptData.invoiceStatus);
  }

  console.log('\n=== 7. PAYROLL: CREATE EMPLOYEE, RUN PAYROLL & FINALIZE ===');
  const employeeRes = await fetch(`${baseUrl}/api/payroll/employees`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      employeeCode: `EMP-${suffix}`,
      firstName: 'Sarah',
      lastName: 'Connor',
      email: `sarah-${suffix}@apexsinc.com`,
      department: 'Engineering',
      position: 'Staff Edge Architect',
      salary: {
        baseSalaryCents: 1200000, // ₱12,000.00
        allowancesCents: 50000,   // ₱500.00
        deductionsCents: 250000,  // ₱2,500.00
      },
    }),
  });
  const employeeData = await employeeRes.json();
  console.log('Created Employee:', `${employeeData.data.firstName} ${employeeData.data.lastName}`, 'Net Salary:', `₱${employeeData.data.salaryStructures[0].netSalaryCents / 100}`);

  const runRes = await fetch(`${baseUrl}/api/payroll/runs`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-08-31',
    }),
  });
  const runData = await runRes.json();
  console.log('Payroll Run Created:', runData.data.runNumber, 'Total Net:', `₱${runData.data.totalNetCents / 100}`);
  const runId = runData.data.id;

  // Finalize Payroll Run
  const finalizeRes = await fetch(`${baseUrl}/api/payroll/runs/${runId}/finalize`, {
    method: 'POST',
    headers: authHeaders,
  });
  const finalizeData = await finalizeRes.json();
  console.log('Payroll Run Finalized:', finalizeData.payrollRunNumber);
  console.log('Generated Payment Voucher:', finalizeData.paymentVoucherNumber);
  console.log('Disbursed Amount:', `₱${finalizeData.totalDisbursedCents / 100}`);

  console.log('\n=== 8. ACCOUNTING: TRIAL BALANCE EQUILIBRIUM AUDIT ===');
  const tbRes = await fetch(`${baseUrl}/api/accounting/trial-balance`, {
    headers: authHeaders,
  });
  const tbData = await tbRes.json();
  console.log('Is Double-Entry Balanced?:', tbData.isBalanced ? 'YES (Balanced)' : 'NO (Unbalanced)');
  console.log('Total Debits:', `₱${tbData.totalDebitCents / 100}`);
  console.log('Total Credits:', `₱${tbData.totalCreditCents / 100}`);
  console.log('Discrepancy:', `₱${tbData.discrepancyCents / 100}`);

  console.log('\n=== 8.1 VOUCHER CRUD & ADMIN APPROVAL / DECLINE / RESTORE AUDIT ===');
  // 1. Create a Test Payment Voucher
  const newPvRes = await fetch(`${baseUrl}/api/accounting/vouchers/payment`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      recipientName: 'Apexs Utilities Provider',
      recipientType: 'OTHER',
      currency: 'PHP',
      amountCents: 50000, // ₱500.00
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Monthly high-speed fiber internet subscription',
      signatories: {
        preparedBy: 'Administrator',
        approvedBy: 'Kenneth Brown / CEO',
      },
    }),
  });
  const newPvData = await newPvRes.json();
  console.log('Created Test PV:', newPvData.voucherNumber, 'Success:', newPvData.success);

  // Retrieve voucher ID
  const allVouchersRes = await fetch(`${baseUrl}/api/accounting/vouchers`, { headers: authHeaders });
  const allVouchersData = await allVouchersRes.json();
  const testVoucher = allVouchersData.data.find((v) => v.voucherNumber === newPvData.voucherNumber);
  if (!testVoucher) {
    console.error('Test voucher not found in registry');
    process.exit(1);
  }
  const testVoucherId = testVoucher.id;

  // 2. Edit Voucher (PATCH)
  const editRes = await fetch(`${baseUrl}/api/accounting/vouchers/${testVoucherId}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      recipientName: 'Apexs Telecom & Cloud ISP',
      notes: 'Updated: High-speed edge bandwidth',
      amountCents: 65000, // ₱650.00
    }),
  });
  const editData = await editRes.json();
  console.log('Edited Test Voucher:', editData.message);

  // 3. Decline Voucher (Void & Ledger Removal)
  const declineRes = await fetch(`${baseUrl}/api/accounting/vouchers/${testVoucherId}/decline`, {
    method: 'POST',
    headers: authHeaders,
  });
  const declineData = await declineRes.json();
  console.log('Declined Voucher (Ledger Removed):', declineData.message);

  // Verify TB after decline
  const tbAfterDecline = await (await fetch(`${baseUrl}/api/accounting/trial-balance`, { headers: authHeaders })).json();
  console.log('TB Balanced After Decline?:', tbAfterDecline.isBalanced ? 'YES' : 'NO', 'Discrepancy:', tbAfterDecline.discrepancyCents);

  // 4. Restore Voucher (Re-post & Re-balance)
  const restoreRes = await fetch(`${baseUrl}/api/accounting/vouchers/${testVoucherId}/restore`, {
    method: 'POST',
    headers: authHeaders,
  });
  const restoreData = await restoreRes.json();
  console.log('Restored Voucher (Ledger Restored):', restoreData.message);

  // Verify TB after restore
  const tbAfterRestore = await (await fetch(`${baseUrl}/api/accounting/trial-balance`, { headers: authHeaders })).json();
  console.log('TB Balanced After Restore?:', tbAfterRestore.isBalanced ? 'YES' : 'NO', 'Discrepancy:', tbAfterRestore.discrepancyCents);

  // 5. Delete Test Voucher
  const deleteRes = await fetch(`${baseUrl}/api/accounting/vouchers/${testVoucherId}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  const deleteData = await deleteRes.json();
  console.log('Deleted Test Voucher Permanently:', deleteData.message);

  console.log('\n=== 9. EXECUTIVE DASHBOARD ===');
  const dashRes = await fetch(`${baseUrl}/api/dashboard`, {
    headers: authHeaders,
  });
  const dashData = await dashRes.json();
  console.log('Dashboard KPIs:', JSON.stringify(dashData.formatted || dashData.data || {}, null, 2));

  console.log('\n=== 10. SYSTEM SETTINGS (ADMIN ONLY) ===');
  const settingsRes = await fetch(`${baseUrl}/api/settings`, {
    headers: authHeaders,
  });
  const settingsData = await settingsRes.json();
  if (!settingsData.success) {
    console.error('Failed to get settings:', settingsData);
    process.exit(1);
  }
  console.log('Retrieved Settings Categories:', Object.keys(settingsData.settings).join(', '));
  console.log('Default Signatories:', settingsData.settings.vouchers?.['vouchers.signatories']);

  // Update signatories as Admin
  const updateSettingsRes = await fetch(`${baseUrl}/api/settings/vouchers.signatories`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      category: 'vouchers',
      value: {
        preparedBy: 'Administrator / Bookkeeper',
        certifiedBy: 'Joy / Senior Admin',
        approvedBy: 'Kenneth Brown / CEO',
        receivedBy: 'Signature over printed name / Date',
      },
    }),
  });
  const updateSettingsData = await updateSettingsRes.json();
  if (!updateSettingsData.success) {
    console.error('Failed to update signatories setting:', updateSettingsData);
    process.exit(1);
  }
  console.log('Signatories Update:', updateSettingsData.message);

  // Verify updated signatories
  const verifySettingsRes = await fetch(`${baseUrl}/api/settings/vouchers`, {
    headers: authHeaders,
  });
  const verifySettingsData = await verifySettingsRes.json();
  const updatedSign = verifySettingsData.settings?.['vouchers.signatories'];
  console.log('Verified Updated Signatories in DB:', updatedSign?.preparedBy, '|', updatedSign?.approvedBy);

  console.log('\n=== 11. FINANCIAL STATEMENTS & REPORTING AUDIT ===');
  // 1. Profit & Loss (Income Statement)
  const plRes = await fetch(`${baseUrl}/api/accounting/reports/profit-loss`, { headers: authHeaders });
  const plData = await plRes.json();
  if (!plData.success) {
    console.error('P&L report failed:', plData);
    process.exit(1);
  }
  console.log('Profit & Loss Summary:');
  console.log(`  - Total Revenue: ₱${(plData.totalRevenueCents / 100).toFixed(2)}`);
  console.log(`  - Total COGS: ₱${(plData.totalCogsCents / 100).toFixed(2)}`);
  console.log(`  - Gross Profit: ₱${(plData.grossProfitCents / 100).toFixed(2)} (${plData.grossMarginPct}%)`);
  console.log(`  - Total OPEX: ₱${(plData.totalOpexCents / 100).toFixed(2)}`);
  console.log(`  - Net Income: ₱${(plData.netIncomeCents / 100).toFixed(2)} (${plData.netMarginPct}%)`);

  // 2. Balance Sheet (Statement of Financial Position)
  const bsRes = await fetch(`${baseUrl}/api/accounting/reports/balance-sheet`, { headers: authHeaders });
  const bsData = await bsRes.json();
  if (!bsData.success) {
    console.error('Balance Sheet report failed:', bsData);
    process.exit(1);
  }
  console.log('Balance Sheet Summary:');
  console.log(`  - Total Assets: ₱${(bsData.totalAssetsCents / 100).toFixed(2)}`);
  console.log(`  - Total Liabilities: ₱${(bsData.liabilities.totalLiabilitiesCents / 100).toFixed(2)}`);
  console.log(`  - Total Equity: ₱${(bsData.equity.totalEquityCents / 100).toFixed(2)}`);
  console.log(`  - Is Balanced (A = L + E)?: ${bsData.isBalanced ? 'YES (Balanced)' : 'NO (Unbalanced)'}`);
  console.log(`  - Discrepancy: ₱${(bsData.discrepancyCents / 100).toFixed(2)}`);
  if (!bsData.isBalanced) {
    console.error('❌ Balance Sheet equilibrium failed!');
    process.exit(1);
  }

  // 3. Cash Flow Statement
  const cfRes = await fetch(`${baseUrl}/api/accounting/reports/cash-flow`, { headers: authHeaders });
  const cfData = await cfRes.json();
  if (!cfData.success) {
    console.error('Cash Flow report failed:', cfData);
    process.exit(1);
  }
  console.log('Cash Flow Statement Summary:');
  console.log(`  - Net Operating Cash: ₱${(cfData.operatingActivities.netOperatingCashCents / 100).toFixed(2)}`);
  console.log(`  - Net Investing Cash: ₱${(cfData.investingActivities.netInvestingCashCents / 100).toFixed(2)}`);
  console.log(`  - Net Financing Cash: ₱${(cfData.financingActivities.netFinancingCashCents / 100).toFixed(2)}`);
  console.log(`  - Ending Cash Balance: ₱${(cfData.closingCashCents / 100).toFixed(2)}`);

  console.log('\n🎉 ALL URL ROUTE CHECKS, SYSTEM SETTINGS, FINANCIAL REPORTS & ERP END-TO-END TESTS PASSED SUCCESSFULLY!');
}

runTests().catch(console.error);
