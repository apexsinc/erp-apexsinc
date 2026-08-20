async function runTests() {
  const baseUrl = 'http://127.0.0.1:8787';

  console.log('=== 1. TEST ROOT HEALTH ===');
  const rootRes = await fetch(`${baseUrl}/`);
  const rootJson = await rootRes.json();
  console.log('Root:', JSON.stringify(rootJson, null, 2));

  console.log('\n=== 2. SEED CHART OF ACCOUNTS ===');
  const seedRes = await fetch(`${baseUrl}/api/setup/seed`, { method: 'POST' });
  const seedJson = await seedRes.json();
  console.log('Seed:', seedJson.message);

  console.log('\n=== 3. INVENTORY: CREATE PRODUCT WITH INITIAL STOCK ===');
  const productRes = await fetch(`${baseUrl}/api/inventory/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sku: 'WIDGET-PRO-100',
      name: 'Industrial Widget Pro',
      description: 'High-precision titanium component',
      unitOfMeasure: 'pcs',
      costPriceCents: 4500, // $45.00
      sellingPriceCents: 9000, // $90.00
      initialStock: 50,
    }),
  });
  const productData = await productRes.json();
  console.log('Created Product:', productData.data.name, 'SKU:', productData.data.sku, 'Stock:', productData.data.onHandStock);
  const productId = productData.data.id;

  console.log('\n=== 4. PURCHASING: CREATE VENDOR & PO, PROCESS GRN RECEIVING ===');
  const vendorRes = await fetch(`${baseUrl}/api/purchasing/vendors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorCode: 'VEND-ACME',
      name: 'Acme Materials Corp',
      email: 'sales@acmematerials.com',
      paymentTermsDays: 30,
    }),
  });
  const vendorData = await vendorRes.json();
  console.log('Created Vendor:', vendorData.data.name);
  const vendorId = vendorData.data.id;

  const poRes = await fetch(`${baseUrl}/api/purchasing/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      vendorId,
      notes: 'Urgent restocking order',
      items: [
        {
          productId,
          quantityOrdered: 100,
          unitPriceCents: 4500,
        },
      ],
    }),
  });
  const poData = await poRes.json();
  console.log('Created PO:', poData.data.poNumber, 'Total:', `$${poData.data.totalAmountCents / 100}`);
  const poId = poData.data.id;
  const poItemId = poData.data.items[0].id;

  // Receive items via GRN
  const receiveRes = await fetch(`${baseUrl}/api/purchasing/orders/${poId}/receive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notes: 'Received batch at warehouse dock 3',
      items: [{ poItemId, quantityReceived: 100 }],
    }),
  });
  const receiveData = await receiveRes.json();
  console.log('GRN Processed:', receiveData.grnNumber, 'Message:', receiveData.message);

  // Check inventory level after GRN (50 initial + 100 received = 150)
  const productDetailRes = await fetch(`${baseUrl}/api/inventory/products/${productId}`);
  const productDetail = await productDetailRes.json();
  console.log('Product Stock After GRN:', productDetail.data.onHandStock, '(Expected 150)');

  console.log('\n=== 5. SALES: CREATE CUSTOMER, SO, INVOICE & RECEIPT ===');
  const customerRes = await fetch(`${baseUrl}/api/sales/customers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerCode: 'CUST-GLOBEX',
      name: 'Globex Corporation',
      email: 'procurement@globex.com',
    }),
  });
  const customerData = await customerRes.json();
  console.log('Created Customer:', customerData.data.name);
  const customerId = customerData.data.id;

  const soRes = await fetch(`${baseUrl}/api/sales/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerId,
      notes: 'Priority delivery',
      items: [{ productId, quantity: 20, unitPriceCents: 9000 }],
    }),
  });
  const soData = await soRes.json();
  console.log('Created Sales Order:', soData.data.soNumber, 'Total:', `$${soData.data.totalAmountCents / 100}`);
  const soId = soData.data.id;

  // Invoice & fulfill SO (150 - 20 = 130 stock)
  const invoiceRes = await fetch(`${baseUrl}/api/sales/orders/${soId}/invoice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Net 30 terms' }),
  });
  const invoiceData = await invoiceRes.json();
  console.log('Invoiced & Fulfilled:', invoiceData.invoiceNumber, 'Total:', `$${invoiceData.totalAmountCents / 100}`);
  const invoiceId = invoiceData.invoiceId;

  // Check stock after sales fulfillment
  const stockAfterSaleRes = await fetch(`${baseUrl}/api/inventory/products/${productId}`);
  const stockAfterSale = await stockAfterSaleRes.json();
  console.log('Product Stock After Sale:', stockAfterSale.data.onHandStock, '(Expected 130)');

  // Pay Invoice -> Receipt Voucher
  const receiptRes = await fetch(`${baseUrl}/api/sales/invoices/${invoiceId}/receipt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amountCents: 180000, // $1800.00
      paymentMethod: 'BANK_TRANSFER',
      notes: 'Wire transfer ref #WT-8941',
    }),
  });
  const receiptData = await receiptRes.json();
  console.log('Customer Receipt Recorded:', receiptData.receiptVoucherNumber, 'Status:', receiptData.invoiceStatus);

  console.log('\n=== 6. PAYROLL: CREATE EMPLOYEE, RUN PAYROLL & FINALIZE ===');
  const employeeRes = await fetch(`${baseUrl}/api/payroll/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeCode: 'EMP-001',
      firstName: 'Sarah',
      lastName: 'Connor',
      email: 'sarah.connor@apexsinc.com',
      department: 'Engineering',
      position: 'Staff Edge Architect',
      salary: {
        baseSalaryCents: 1200000, // $12,000.00
        allowancesCents: 50000,   // $500.00
        deductionsCents: 250000,  // $2,500.00
      },
    }),
  });
  const employeeData = await employeeRes.json();
  console.log('Created Employee:', `${employeeData.data.firstName} ${employeeData.data.lastName}`, 'Net Salary:', `$${employeeData.data.salaryStructures[0].netSalaryCents / 100}`);

  const runRes = await fetch(`${baseUrl}/api/payroll/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-08-31',
    }),
  });
  const runData = await runRes.json();
  console.log('Payroll Run Created:', runData.data.runNumber, 'Total Net:', `$${runData.data.totalNetCents / 100}`);
  const runId = runData.data.id;

  // Finalize Payroll Run
  const finalizeRes = await fetch(`${baseUrl}/api/payroll/runs/${runId}/finalize`, {
    method: 'POST',
  });
  const finalizeData = await finalizeRes.json();
  console.log('Payroll Run Finalized:', finalizeData.payrollRunNumber);
  console.log('Generated Payment Voucher:', finalizeData.paymentVoucherNumber);
  console.log('Disbursed Amount:', `$${finalizeData.totalDisbursedCents / 100}`);

  console.log('\n=== 7. ACCOUNTING: TRIAL BALANCE EQUILIBRIUM AUDIT ===');
  const tbRes = await fetch(`${baseUrl}/api/accounting/trial-balance`);
  const tbData = await tbRes.json();
  console.log('Is Double-Entry Balanced?:', tbData.isBalanced ? 'YES (Balanced)' : 'NO (Unbalanced)');
  console.log('Total Debits:', `$${tbData.totalDebitCents / 100}`);
  console.log('Total Credits:', `$${tbData.totalCreditCents / 100}`);
  console.log('Discrepancy:', `$${tbData.discrepancyCents / 100}`);

  console.log('\n=== 8. EXECUTIVE DASHBOARD ===');
  const dashRes = await fetch(`${baseUrl}/api/dashboard`);
  const dashData = await dashRes.json();
  console.log('Dashboard KPIs:', JSON.stringify(dashData.formatted, null, 2));
}

runTests().catch(console.error);
