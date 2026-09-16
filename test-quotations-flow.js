async function runQuotationsTest() {
  const baseUrl = 'http://127.0.0.1:8787';

  console.log('=== 1. TEST SSR & SPA QUOTATIONS ROUTE ===');
  const pageRes = await fetch(`${baseUrl}/quotations`);
  const isHtml = (pageRes.headers.get('content-type') || '').includes('text/html');
  if (pageRes.status !== 200 || !isHtml) {
    console.error(`❌ Route check failed for /quotations: status=${pageRes.status}, isHtml=${isHtml}`);
    process.exit(1);
  }
  const pageHtml = await pageRes.text();
  if (!pageHtml.includes('Quotations') || !pageHtml.includes('view-quotations')) {
    console.error('❌ Quotations view markup missing from HTML app');
    process.exit(1);
  }
  console.log('  ✓ Route /quotations -> 200 OK (text/html, contains Quotations sidebar & view)');

  console.log('\n=== 2. AUTHENTICATE AS ADMIN ===');
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
  console.log('  ✓ Authenticated successfully as:', loginJson.user.name, `(${loginJson.user.role})`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\n=== 3. READ BUSINESS DIRECTORY: CUSTOMERS & SERVICES ===');
  // Ensure customer "Revlv Solutions Inc." exists in Business Directory
  const custRes = await fetch(`${baseUrl}/api/sales/customers`, { headers: authHeaders });
  const custJson = await custRes.json();
  let customer = (custJson.data || []).find((c) => c.name.toLowerCase().includes('revlv'));

  if (!customer) {
    console.log('Creating customer "Revlv Solutions Inc." in Business Directory...');
    const createCustRes = await fetch(`${baseUrl}/api/sales/customers`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        customerCode: 'REV-001',
        name: 'Revlv Solutions Inc.',
        email: 'info@revlvsolutions.com',
        phone: '+63 32 412 8888',
        billingAddress: 'Unit 1205 Ayala Tower One, Cebu Business Park, Cebu City 6000',
      }),
    });
    const createdCustJson = await createCustRes.json();
    if (!createdCustJson.success) {
      console.error('Failed to create customer:', createdCustJson);
      process.exit(1);
    }
    customer = createdCustJson.data;
  }
  console.log('  ✓ Business Directory Customer:', customer.name, `(ID: ${customer.id})`);

  // Ensure service "Installation and Training Fee" exists in Business Directory
  const prodRes = await fetch(`${baseUrl}/api/inventory/products`, { headers: authHeaders });
  const prodJson = await prodRes.json();
  let service = (prodJson.data || []).find((p) => p.name.toLowerCase().includes('installation and training'));

  if (!service) {
    console.log('Creating service "Installation and Training Fee" in Business Directory...');
    const createSrvRes = await fetch(`${baseUrl}/api/directory/services`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        sku: 'SRV-INST-TRN',
        name: 'Installation and Training Fee',
        sellingPriceCents: 4500000,
        sellingPriceCurrency: 'PHP',
      }),
    });
    const createdSrvJson = await createSrvRes.json();
    if (!createdSrvJson.success) {
      console.error('Failed to create service:', createdSrvJson);
      process.exit(1);
    }
    service = createdSrvJson.data;
  }
  console.log('  ✓ Business Directory Service:', service.name, `(Rate: PHP ${(service.sellingPriceCents / 100).toFixed(2)})`);

  console.log('\n=== 4. CREATE QUOTATION (POST /api/quotations) ===');
  const quoteNumber = '26-APX' + Math.floor(100000 + Math.random() * 900000);
  const sampleSignaturePng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const createQuoteRes = await fetch(`${baseUrl}/api/quotations`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      quoteNumber,
      customerId: customer.id,
      currency: 'PHP',
      quoteDate: '2026-09-11',
      validUntil: 'December 31, 2026 only',
      paymentTerms: '100% Advance Payment',
      authorizedSignatoryName: 'Jeneviev Manatad',
      authorizedSignatoryTitle: 'General Manager',
      signatureImageData: sampleSignaturePng,
      notes: 'NOTE: Installation and training fee includes airline tickets, meals, accommodation and local transportation expenses for the Technical Support. Three (3) days inclusive of travel time. Installation of Mounting pole is not included.',
      items: [
        {
          productId: service.id,
          partNumber: service.sku,
          description: service.name,
          quantity: 1,
          unitPriceCents: 4500000,
          notes: 'VAT Inclusive',
        },
      ],
    }),
  });
  const quoteJson = await createQuoteRes.json();
  if (!quoteJson.success) {
    console.error('❌ Failed to create quotation:', quoteJson);
    process.exit(1);
  }
  const createdQuote = quoteJson.data;
  console.log('  ✓ Created Quotation:', createdQuote.quoteNumber, `Total: PHP ${(createdQuote.totalAmountCents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log('  ✓ E-Signature PNG Data Attached:', Boolean(createdQuote.signatureImageData));

  console.log('\n=== 5. RETRIEVE QUOTATION (GET /api/quotations & GET /api/quotations/:id) ===');
  const listRes = await fetch(`${baseUrl}/api/quotations`, { headers: authHeaders });
  const listJson = await listRes.json();
  if (!listJson.success || !listJson.data.some((q) => q.quoteNumber === quoteNumber)) {
    console.error('❌ Quotation not listed in /api/quotations:', listJson);
    process.exit(1);
  }
  console.log('  ✓ Quotation confirmed in list (total quotes:', listJson.data.length, ')');

  const getRes = await fetch(`${baseUrl}/api/quotations/${quoteNumber}`, { headers: authHeaders });
  const getJson = await getRes.json();
  if (!getJson.success || getJson.data.quoteNumber !== quoteNumber) {
    console.error('❌ Failed to fetch quotation by number:', getJson);
    process.exit(1);
  }
  console.log('  ✓ Successfully retrieved quotation by quote number:', getJson.data.quoteNumber);
  if (getJson.data.signatureImageData !== sampleSignaturePng) {
    console.error('❌ signatureImageData mismatch in retrieved quotation');
    process.exit(1);
  }
  console.log('  ✓ Confirmed signatureImageData matches attached PNG');

  console.log('\n=== 6. TEST PRINTABLE / OFFICIAL PDF VIEW IN NEW TAB ===');
  const printUrl = `${baseUrl}/quotations/${quoteNumber}/print`;
  const printRes = await fetch(printUrl);
  if (printRes.status !== 200 || !printRes.headers.get('content-type')?.includes('text/html')) {
    console.error('❌ Print route failed:', printRes.status);
    process.exit(1);
  }
  const printHtml = await printRes.text();

  // Verify all essential components from the user sample PDF are rendered
  const checks = [
    { label: 'Company Header Name', pass: printHtml.includes('APPLIED EXPERT SYSTEMS &amp; SOFTWARE, INC.') || printHtml.includes('APPLIED EXPERT SYSTEMS & SOFTWARE, INC.') },
    { label: 'Document Title QUOTATION', pass: printHtml.includes('QUOTATION') },
    { label: 'Quote Date Sep 11, 2026', pass: printHtml.includes('Sep 11, 2026') },
    { label: `Quote Number ${quoteNumber}`, pass: printHtml.includes(quoteNumber) },
    { label: 'Quoted To Revlv Solutions Inc.', pass: printHtml.includes('Revlv Solutions Inc.') },
    { label: 'Bank Name Bank of the Philippine Island', pass: printHtml.includes('Bank of the Philippine Island') },
    { label: 'Bank Account No 9171-0030-64', pass: printHtml.includes('9171-0030-64') },
    { label: 'Item Installation and Training Fee', pass: printHtml.includes('Installation and Training Fee') },
    { label: 'Item Remarks VAT Inclusive', pass: printHtml.includes('VAT Inclusive') },
    { label: 'Scope Notes airline tickets, meals', pass: printHtml.includes('airline tickets, meals') },
    { label: 'Validity Date December 31, 2026', pass: printHtml.includes('December 31, 2026') },
    { label: 'Total Amount 45,000.00', pass: printHtml.includes('45,000.00') },
    { label: 'Payment Terms 100% Advance Payment', pass: printHtml.includes('100% Advance Payment') },
    { label: 'Authorized Signatory Jeneviev Manatad', pass: printHtml.includes('Jeneviev Manatad') },
    { label: 'Signatory Title General Manager', pass: printHtml.includes('General Manager') },
    { label: 'Attached E-Signature PNG Image', pass: printHtml.includes('class="signature-png"') && printHtml.includes(sampleSignaturePng) },
    { label: 'Print & PDF Action Toolbar', pass: printHtml.includes('Print / Save as PDF') && printHtml.includes('Download PDF') },
  ];

  for (const c of checks) {
    if (!c.pass) {
      console.error(`❌ Print HTML check failed for: ${c.label}`);
      process.exit(1);
    }
    console.log(`  ✓ ${c.label.padEnd(36)} -> Verified in HTML document`);
  }

  console.log('\n=== 7. UPDATE QUOTATION STATUS (PATCH /api/quotations/:id) ===');
  const patchRes = await fetch(`${baseUrl}/api/quotations/${createdQuote.id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'ACCEPTED',
    }),
  });
  const patchJson = await patchRes.json();
  if (!patchJson.success || patchJson.data.status !== 'ACCEPTED') {
    console.error('❌ Failed to update status:', patchJson);
    process.exit(1);
  }
  console.log('  ✓ Updated Quotation status to:', patchJson.data.status);

  console.log('\n=== 8. CONVERT QUOTATION TO SALES INVOICE (POST /api/quotations/:id/convert) ===');
  const convertRes = await fetch(`${baseUrl}/api/quotations/${createdQuote.id}/convert`, {
    method: 'POST',
    headers: authHeaders,
  });
  const convertJson = await convertRes.json();
  if (!convertJson.success || !convertJson.data.salesOrder) {
    console.error('❌ Failed to convert quotation:', convertJson);
    process.exit(1);
  }
  const convertedSo = convertJson.data.salesOrder;
  console.log('  ✓ Converted to Sales Invoice:', convertedSo.soNumber, `(Total: ${convertedSo.currency} ${(convertedSo.totalAmountCents / 100).toFixed(2)})`);

  // Verify quote status is now CONVERTED
  const quoteAfterConvert = await fetch(`${baseUrl}/api/quotations/${createdQuote.id}`, { headers: authHeaders }).then(r => r.json());
  if (quoteAfterConvert.data.status !== 'CONVERTED' || quoteAfterConvert.data.salesOrderId !== convertedSo.id) {
    console.error('❌ Quotation not properly linked to converted Sales Order:', quoteAfterConvert);
    process.exit(1);
  }
  console.log('  ✓ Quotation status verified as CONVERTED with linked salesOrderId');

  console.log('\n============================================================');
  console.log('🎉 ALL QUOTATION WORKFLOW TESTS PASSED PERFECTLY (100%)!');
  console.log('============================================================\n');
}

runQuotationsTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
