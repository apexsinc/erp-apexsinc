const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFParse } = require('pdf-parse');

function categorizeVoucher(v) {
  const text = (v.recipient + ' ' + (v.notes || '') + ' ' + v.items.map(i => (i.invoiceNo || '') + ' ' + i.description).join(' ')).toUpperCase();

  if (/HOSPITAL|MEDICIN|DOCTOR|PHARMACY|URINE|VIAL|SYRINGE|CHLORIDE|MEDICATION/i.test(text)) {
    return { accountCode: '5080', tag: 'Medical / Health', category: 'Medical & Healthcare' };
  }
  if (/FREIGHT|DUTIES|TAXES|LOGISTICS|DEUS|CUSTOMS|SHIPMENT|FORWARDING|PORT|CARGO/i.test(text)) {
    return { accountCode: '5050', tag: 'Logistics & Freight', category: 'Logistics, Freight & Customs' };
  }
  if (/GASOLINE|TICKET|AIR\s*INC|CEBU\s*PACIFIC|AIRFARE|FLIGHT|MEAL|TRAVEL|TRAINING|TRANSPORT|DROP\s*OFF|HONDA|CAR/i.test(text)) {
    return { accountCode: '5060', tag: 'Travel & Transport', category: 'Travel & Transportation' };
  }
  if (/INTERNET|DITO|PLDT|GLOBE|SMART|TELECOM|UTILITIES|ELECTRIC|WATER|MONTHLY\s*WITH\s*ACCOUNT/i.test(text)) {
    return { accountCode: '5040', tag: 'Utilities & Telecom', category: 'Utilities & Communications' };
  }
  if (/SUPPLIES|PRINTER|DRUM|HARDWARE|STATIONERY|OFFICE|PAPER|TONER|KIT/i.test(text)) {
    return { accountCode: '5070', tag: 'Office Supplies & IT', category: 'Office Supplies & IT' };
  }
  if (/SALARY|COMPENSATION|CAREGIVER|RELIEVER|WAGE|PAYROLL|BONUS/i.test(text)) {
    return { accountCode: '5020', tag: 'Payroll & Wages', category: 'Salaries & Wages' };
  }
  return { accountCode: '5030', tag: 'General Expense', category: 'General & Administrative Expenses' };
}

function parseVoucherText(rawText, filename) {
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  let recipient = '';
  let voucherNumber = '';
  let voucherDate = '';
  let totalAmountCents = 0;
  let currency = 'PHP';
  let preparedBy = '';
  let certifiedBy = '';
  let approvedBy = '';
  let receivedBy = '';
  let notes = '';
  let paymentMethod = 'BANK_TRANSFER';
  let items = [];

  // 1. Voucher Number
  const fnMatch = filename.match(/Voucher_([0-9]{2}-[0-9]+)/i) || filename.match(/voucher\s*([0-9]+)/i);
  const noMatch = text.match(/(?:\n|^)\s*No\.?\s*[\t:]?\s*([0-9]{2}-[0-9]{4,6})/i);
  if (noMatch) {
    voucherNumber = noMatch[1].trim();
  } else if (fnMatch) {
    voucherNumber = fnMatch[1].includes('-') ? fnMatch[1] : '26-000' + fnMatch[1];
  }

  // 2. Pay to
  const payMatch = text.match(/Pay\s+to\s*[:\t]\s*([^\n\r]+)/i);
  if (payMatch) {
    recipient = payMatch[1].trim();
  }

  // 3. Date
  const dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/i) ||
                    text.match(/\d{4}-\d{2}-\d{2}/) ||
                    text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
  if (dateMatch) {
    const d = new Date(dateMatch[0]);
    if (!isNaN(d.getTime())) {
      voucherDate = d.toISOString().slice(0, 10);
    }
  }

  // 4. Signatories
  const prepMatch = text.match(/Prepared\s+by\s*[:\t\n\r]+([^\n\r]+)/i);
  if (prepMatch) preparedBy = prepMatch[1].replace(/Certified Correct by.*/i, '').trim();

  const certMatch = text.match(/Certified\s+Correct\s+by\s*[:\t\n\r]+([^\n\r]+)/i);
  if (certMatch) certifiedBy = certMatch[1].replace(/Approved by.*/i, '').trim();

  const appMatch = text.match(/Approved\s+by\s*[:\t\n\r]+([^\n\r]+)/i);
  if (appMatch) approvedBy = appMatch[1].replace(/Received Payment.*/i, '').trim();

  const recMatch = text.match(/Received\s+Payment\s*[:\t\n\r]+([^\n\r]+)/i);
  if (recMatch) receivedBy = recMatch[1].replace(/--.*/i, '').trim();

  // 5. Payment method / Notes detection
  if (/CORPORATE\s+CC|CREDIT\s+CARD/i.test(text)) {
    paymentMethod = 'CREDIT_CARD';
  } else if (/CHECK|CHEQUE/i.test(text)) {
    paymentMethod = 'CHECK';
  } else if (/CASH/i.test(text)) {
    paymentMethod = 'CASH';
  } else if (/GCASH|PAYMAYA|PMAYA/i.test(text)) {
    paymentMethod = 'E_WALLET';
  } else if (/BIZLINK|BDO|BANK/i.test(text)) {
    paymentMethod = 'BANK_TRANSFER';
  }

  const remarkMatch = text.match(/CORPORATE\s+CC[^\n\r]*/i) || text.match(/\(([^)]+)\)/);
  if (remarkMatch) {
    notes = remarkMatch[0].trim();
  }

  // 6. Total Row & Currency
  const totalLineMatch = text.match(/(?:Php|PHP|USD|Total)\s*[\t:]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2}))/i);
  if (totalLineMatch) {
    const num = parseFloat(totalLineMatch[1].replace(/,/g, ''));
    if (!isNaN(num)) totalAmountCents = Math.round(num * 100);
    if (/USD|\$/i.test(text)) currency = 'USD';
  }

  // 7. Extract Table Items
  const tableStartIndex = lines.findIndex(l => /Invoice No/i.test(l));
  const tableEndIndex = lines.findIndex((l, idx) => idx > tableStartIndex && /^(?:Php|PHP|USD|Total|Prepared by)/i.test(l));

  if (tableStartIndex !== -1 && tableEndIndex !== -1 && tableEndIndex > tableStartIndex) {
    const tableLines = lines.slice(tableStartIndex + 1, tableEndIndex);
    let pendingInvoice = '';
    let pendingDesc = '';

    for (let i = 0; i < tableLines.length; i++) {
      const line = tableLines[i].trim();
      if (!line || line.startsWith('--') || line.startsWith('APEXS') || line.startsWith('*****')) continue;

      // Check for parenthesized annotations like (orig: $22.40 USD) -> treat as notes
      if (/^\([^)]+\)$/.test(line)) {
        notes = (notes ? notes + '; ' : '') + line;
        continue;
      }

      // Extract amount at the end of the line or with currency symbol
      const amtMatch = line.match(/(?:[₱\$]\s*)?([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})$/) ||
                       line.match(/(?:[₱\$]\s*)([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})/);

      if (amtMatch) {
        const amtVal = parseFloat(amtMatch[1].replace(/,/g, ''));
        const prefix = line.substring(0, amtMatch.index).replace(/[₱\$]\s*$/, '').trim();

        const parts = prefix.split('\t').map(p => p.trim()).filter(Boolean);
        let lineInvoice = pendingInvoice;
        let lineDesc = pendingDesc;

        if (parts.length >= 2) {
          lineInvoice = (lineInvoice ? lineInvoice + ' ' : '') + parts[0];
          lineDesc = (lineDesc ? lineDesc + ' ' : '') + parts.slice(1).join(' ');
        } else if (parts.length === 1) {
          if (!lineInvoice && /^(?:BIZLINK|INV#|SI#|AR#|SOA#|PMAYA|ACA-|BLP-|OR#)/i.test(parts[0])) {
            lineInvoice = parts[0];
          } else {
            lineDesc = (lineDesc ? lineDesc + ' ' : '') + parts[0];
          }
        }

        items.push({
          invoiceNo: lineInvoice.trim(),
          description: lineDesc.trim() || notes || 'Disbursement',
          currency,
          amountCents: Math.round(amtVal * 100)
        });

        pendingInvoice = '';
        pendingDesc = '';
      } else {
        if (/^(?:BIZLINK|INV#|SI#|AR#|SOA#|PMAYA|ACA-|BLP-|OR#)/i.test(line)) {
          pendingInvoice = (pendingInvoice ? pendingInvoice + ' ' : '') + line;
        } else if (/CORPORATE\s+CC|LQD'N/i.test(line)) {
          notes = (notes ? notes + '; ' : '') + line;
        } else {
          pendingDesc = (pendingDesc ? pendingDesc + ' ' : '') + line;
        }
      }
    }
  }

  // Handle special single/multi-line reconciliations
  if (filename === 'Voucher_26-000457.pdf') {
    // Only Internet DITO belongs to 26-000457 (1490.00)
    items = [{
      invoiceNo: '0055452754',
      description: 'Internet DITO Monthly (Jun 16 - Jul 15, 2026)',
      currency: 'PHP',
      amountCents: 149000
    }];
    totalAmountCents = 149000;
  }

  // Fallback: If no line items parsed but total > 0
  if (items.length === 0 && totalAmountCents > 0) {
    items.push({
      invoiceNo: '',
      description: notes || (recipient ? recipient + ' disbursement' : 'Disbursement'),
      currency,
      amountCents: totalAmountCents
    });
  }

  if (totalAmountCents === 0 && items.length > 0) {
    totalAmountCents = items.reduce((s, it) => s + it.amountCents, 0);
  }

  return {
    filename,
    voucherNumber,
    recipient,
    voucherDate,
    totalAmountCents,
    currency,
    paymentMethod,
    notes,
    items,
    signatories: { preparedBy, certifiedBy, approvedBy, receivedBy }
  };
}

async function generateMigrationSql() {
  const dir = '/tmp/vouchers_extracted';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.pdf'));
  console.log(`Reading ${files.length} voucher PDFs...`);

  const vouchers = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const parser = new PDFParse(new Uint8Array(buf));
    await parser.load();
    const res = await parser.getText();
    const parsed = parseVoucherText(res.text, f);
    const cat = categorizeVoucher(parsed);
    parsed.accountCode = cat.accountCode;
    parsed.tag = cat.tag;
    parsed.category = cat.category;
    vouchers.push(parsed);
  }

  // Sort chronologically by voucherNumber
  vouchers.sort((a, b) => a.voucherNumber.localeCompare(b.voucherNumber));

  console.log(`Successfully parsed ${vouchers.length} vouchers!`);

  // Build SQL Statements
  const sqlStatements = [];

  // 1. Ensure Standard Operating Expense Accounts exist
  const newAccounts = [
    { id: 'c5c39252-440f-444e-ad9a-de2e549e9bc1', code: '1010', name: 'Cash and Cash Equivalents', type: 'ASSET', description: 'Operating checking and bank accounts' },
    { id: 'e0ec9cfc-5f69-46ca-9875-94a90a134cb4', code: '5020', name: 'Salaries and Wages Expense', type: 'EXPENSE', description: 'Gross compensation and employee wages' },
    { id: '11111111-5030-4000-8000-000000005030', code: '5030', name: 'General & Administrative Expenses', type: 'EXPENSE', description: 'General operating and admin disbursements' },
    { id: '11111111-5040-4000-8000-000000005040', code: '5040', name: 'Utilities & Communications Expense', type: 'EXPENSE', description: 'Internet, telecom, electric, and water' },
    { id: '11111111-5050-4000-8000-000000005050', code: '5050', name: 'Logistics, Freight & Customs Duties', type: 'EXPENSE', description: 'Freight forwarding, shipping, customs and taxes' },
    { id: '11111111-5060-4000-8000-000000005060', code: '5060', name: 'Travel & Transportation Expense', type: 'EXPENSE', description: 'Airfare, fuel, meals, and field expenses' },
    { id: '11111111-5070-4000-8000-000000005070', code: '5070', name: 'Office Supplies & IT Expense', type: 'EXPENSE', description: 'Stationery, printer drums, hardware supplies' },
    { id: '11111111-5080-4000-8000-000000005080', code: '5080', name: 'Medical & Healthcare Expense', type: 'EXPENSE', description: 'Hospitalization, clinic bills, and medicines' },
  ];

  for (const acc of newAccounts) {
    sqlStatements.push(
      `INSERT OR IGNORE INTO accounts (id, code, name, type, description, is_active, created_at) VALUES ('${acc.id}', '${acc.code}', '${acc.name.replace(/'/g, "''")}', '${acc.type}', '${acc.description.replace(/'/g, "''")}', 1, '2026-01-01T00:00:00.000Z');`
    );
  }

  // Account ID lookup map
  const accountIdMap = {};
  newAccounts.forEach(a => { accountIdMap[a.code] = a.id; });

  // 2. Insert Payment Vouchers and balanced Journal Entries
  let totalDebit = 0;
  let totalCredit = 0;

  for (const v of vouchers) {
    const pvId = crypto.randomUUID();
    const vDate = v.voucherDate || '2026-06-10';
    const isoDateTime = vDate + 'T08:00:00.000Z';
    const status = v.totalAmountCents === 0 ? 'VOID' : 'POSTED';
    const storedNotes = v.notes ? `[${v.tag}] ${v.notes}` : `[${v.tag}]`;
    const itemsJson = JSON.stringify(v.items).replace(/'/g, "''");
    const sigJson = JSON.stringify(v.signatories).replace(/'/g, "''");

    const expAccountId = accountIdMap[v.accountCode] || accountIdMap['5030'];
    const cashAccountId = accountIdMap['1010'];

    // Payment Voucher record
    sqlStatements.push(
      `INSERT INTO payment_vouchers (id, voucher_number, voucher_date, recipient_type, recipient_name, currency, amount_cents, payment_method, reference_type, notes, items, signatories, status, created_at) ` +
      `VALUES ('${pvId}', '${v.voucherNumber}', '${isoDateTime}', 'OTHER', '${(v.recipient || 'DISBURSEMENT').replace(/'/g, "''")}', '${v.currency}', ${v.totalAmountCents}, '${v.paymentMethod}', 'MANUAL', '${storedNotes.replace(/'/g, "''")}', '${itemsJson}', '${sigJson}', '${status}', '${isoDateTime}') ` +
      `ON CONFLICT(voucher_number) DO UPDATE SET amount_cents=excluded.amount_cents, items=excluded.items, signatories=excluded.signatories, notes=excluded.notes, voucher_date=excluded.voucher_date;`
    );

    // If active posted voucher with amount > 0, create balanced Journal Entries
    if (status === 'POSTED' && v.totalAmountCents > 0) {
      const leg1Id = crypto.randomUUID();
      const leg2Id = crypto.randomUUID();

      // Leg 1: Debit Expense Account
      sqlStatements.push(
        `INSERT INTO journal_entries (id, voucher_type, voucher_id, account_id, debit_cents, credit_cents, description, entry_date, created_at) ` +
        `VALUES ('${leg1Id}', 'PAYMENT', '${pvId}', '${expAccountId}', ${v.totalAmountCents}, 0, 'Disbursement to ${(v.recipient || '').replace(/'/g, "''")} (${v.voucherNumber})', '${isoDateTime}', '${isoDateTime}');`
      );

      // Leg 2: Credit Cash & Bank Account (1010)
      sqlStatements.push(
        `INSERT INTO journal_entries (id, voucher_type, voucher_id, account_id, debit_cents, credit_cents, description, entry_date, created_at) ` +
        `VALUES ('${leg2Id}', 'PAYMENT', '${pvId}', '${cashAccountId}', 0, ${v.totalAmountCents}, 'Disbursement to ${(v.recipient || '').replace(/'/g, "''")} (${v.voucherNumber})', '${isoDateTime}', '${isoDateTime}');`
      );

      totalDebit += v.totalAmountCents;
      totalCredit += v.totalAmountCents;
    }
  }

  console.log(`Generated ${sqlStatements.length} SQL operations.`);
  console.log(`Total Debits: ₱${(totalDebit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Total Credits: ₱${(totalCredit / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
  console.log(`Discrepancy: ₱${totalDebit - totalCredit}`);

  const fullSql = sqlStatements.join('\n');
  fs.writeFileSync('/tmp/import-vouchers.sql', fullSql);
  console.log(`Saved migration SQL to /tmp/import-vouchers.sql (${(fullSql.length / 1024).toFixed(1)} KB)`);
}

generateMigrationSql().catch(console.error);
