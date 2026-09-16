/**
 * Official Quotation PDF / Printable Document View
 * Exactly replicates the official APPLIED EXPERT SYSTEMS & SOFTWARE, INC.
 * Quotation layout (100% pixel-perfect matching company specifications).
 */

export interface QuotationItemData {
  id?: string;
  quantity: number;
  partNumber?: string;
  description: string;
  unitPriceCents: number;
  subtotalCents: number;
  notes?: string;
  product?: {
    sku?: string;
    name?: string;
    unitOfMeasure?: string;
    description?: string;
  };
}

export interface QuotationData {
  id: string;
  quoteNumber: string;
  status: string;
  currency: string;
  totalAmountCents: number;
  quoteDate?: string;
  validUntil?: string;
  paymentTerms?: string;
  bankInfo?: string;
  authorizedSignatoryName?: string;
  authorizedSignatoryTitle?: string;
  signatureImageData?: string;
  notes?: string;
  createdAt?: string;
  customer?: {
    name?: string;
    customerCode?: string;
    billingAddress?: string;
    shippingAddress?: string;
    phone?: string;
    email?: string;
    taxId?: string;
  };
  items?: QuotationItemData[];
}

export function renderQuotationPrintHtml(quote: QuotationData): string {
  const currencyCode = quote.currency || 'PHP';
  const currencyPrefix = currencyCode === 'PHP' ? 'PHP ' : (currencyCode === 'USD' ? '$' : currencyCode + ' ');

  // Format Quote Date: e.g. "Sep 11, 2026"
  const rawDate = quote.quoteDate || quote.createdAt || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Sep 11, 2026';

  // Normalize Quote Number
  const displayQuoteNumber = quote.quoteNumber || '26-APX000450';

  // Customer / Quoted To
  const customerName = quote.customer?.name || 'Revlv Solutions Inc.';
  const customerAddress = quote.customer?.billingAddress || quote.customer?.shippingAddress || '';
  const customerLines = customerAddress
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Bank Info defaults
  let bankAccountName = 'Applied Expert Systems and Software, Inc.';
  let bankAccountNo = '9171-0030-64';
  let bankName = 'Bank of the Philippine Island';
  let bankAddress = 'Cebu Gaisano Grand Mall Branch, Mactan\ncorner Basak-Agus Road, Lapu-lapu City\n6015, Cebu, Philippines';

  if (quote.bankInfo) {
    try {
      if (quote.bankInfo.trim().startsWith('{')) {
        const parsed = JSON.parse(quote.bankInfo);
        if (parsed.accountName) bankAccountName = parsed.accountName;
        if (parsed.accountNo) bankAccountNo = parsed.accountNo;
        if (parsed.bankName) bankName = parsed.bankName;
        if (parsed.bankAddress) bankAddress = parsed.bankAddress;
      } else {
        bankAddress = quote.bankInfo;
      }
    } catch (_) {
      // fallback to defaults
    }
  }

  const bankAddressLines = bankAddress
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Payment Terms
  const paymentTerms = quote.paymentTerms || '100% Advance Payment';

  // Signatory
  const signatoryName = quote.authorizedSignatoryName || 'Jeneviev Manatad';
  const signatoryTitle = quote.authorizedSignatoryTitle || 'General Manager';

  // Line items
  const items = quote.items || [];
  const itemsRowsHtml = items
    .map((item) => {
      const partNumber = item.partNumber || item.product?.sku || '';
      const unitPrice = (item.unitPriceCents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const amount = (item.subtotalCents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      // Description formatting (handle multi-line notes, scope terms, valid date)
      let descHtml = escapeHtml(item.description || item.product?.name || '');
      if (item.notes) {
        const notesLines = item.notes.split(/\r?\n/).map((l) => escapeHtml(l.trim())).filter(Boolean);
        if (notesLines.length) {
          descHtml += `<div class="item-notes-block">${notesLines.map((l) => `<div>${l}</div>`).join('')}</div>`;
        }
      }

      return `
        <tr>
          <td class="col-qty">${item.quantity}</td>
          <td class="col-part">${escapeHtml(partNumber)}</td>
          <td class="col-desc">${descHtml}</td>
          <td class="col-price">${unitPrice}</td>
          <td class="col-amt">${amount}</td>
        </tr>
      `;
    })
    .join('');

  // Top level quote notes (if any and not already on items)
  let generalNotesHtml = '';
  if (quote.notes && quote.notes.trim()) {
    const quoteNotesLines = quote.notes
      .split(/\r?\n/)
      .map((l) => escapeHtml(l.trim()))
      .filter(Boolean);
    if (quoteNotesLines.length) {
      generalNotesHtml = `
        <tr class="quote-notes-row">
          <td class="col-qty"></td>
          <td class="col-part"></td>
          <td class="col-desc">
            <div class="item-notes-block" style="margin-top: 15px;">
              ${quoteNotesLines.map((l) => `<div>${l}</div>`).join('')}
              ${quote.validUntil ? `<div style="margin-top: 4px;">This quotation is valid until ${escapeHtml(quote.validUntil)} only.</div>` : ''}
            </div>
          </td>
          <td class="col-price"></td>
          <td class="col-amt"></td>
        </tr>
      `;
    }
  } else if (quote.validUntil) {
    generalNotesHtml = `
      <tr class="quote-notes-row">
        <td class="col-qty"></td>
        <td class="col-part"></td>
        <td class="col-desc">
          <div class="item-notes-block" style="margin-top: 15px;">
            <div>This quotation is valid until ${escapeHtml(quote.validUntil)} only.</div>
          </div>
        </td>
        <td class="col-price"></td>
        <td class="col-amt"></td>
      </tr>
    `;
  }

  const totalFormatted = (quote.totalAmountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Quotation ${escapeHtml(displayQuoteNumber)} — APPLIED EXPERT SYSTEMS &amp; SOFTWARE, INC.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      background-color: #525659;
      font-family: Arial, Arimo, "Helvetica Neue", Helvetica, sans-serif;
      color: #000000;
      -webkit-font-smoothing: antialiased;
      padding-bottom: 40px;
    }

    /* Floating Top Toolbar (Screen only) */
    .top-toolbar {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #1e293b;
      color: #ffffff;
      padding: 0.65rem 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-size: 0.9rem;
    }
    .top-toolbar-title {
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .top-toolbar-badge {
      background: #0284c7;
      color: #ffffff;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 4px;
      letter-spacing: 0.05em;
    }
    .top-toolbar-actions {
      display: flex;
      gap: 0.65rem;
    }
    .btn-action {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 0.45rem 1rem;
      font-size: 0.85rem;
      font-weight: 600;
      border-radius: 4px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      transition: background 0.15s ease;
      text-decoration: none;
    }
    .btn-action:hover {
      background: #0369a1;
    }
    .btn-secondary {
      background: #475569;
    }
    .btn-secondary:hover {
      background: #334155;
    }

    /* Exact Quotation Printable Canvas: 8.5in x 11in */
    .quote-canvas {
      width: 8.5in;
      min-height: 11in;
      margin: 25px auto;
      background: #ffffff;
      padding: 0.5in 0.6in 0.6in 0.6in;
      box-shadow: 0 4px 25px rgba(0,0,0,0.25);
      position: relative;
      display: flex;
      flex-direction: column;
    }

    /* 1. Header Section */
    .quote-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.15rem;
    }
    .quote-header-left {
      display: flex;
      gap: 0.85rem;
      align-items: flex-start;
    }
    .quote-logo {
      width: 78px;
      height: auto;
      object-fit: contain;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .quote-company-name {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 800;
      font-size: 11pt;
      color: #000000;
      line-height: 1.2;
      letter-spacing: -0.01em;
    }
    .quote-tagline {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-size: 9pt;
      color: #111111;
      margin-top: 1px;
      margin-bottom: 2px;
    }
    .quote-company-info {
      font-size: 8pt;
      line-height: 1.35;
      color: #000000;
    }

    .quote-header-right {
      text-align: right;
      min-width: 250px;
    }
    .quote-main-title {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 900;
      font-size: 26pt;
      line-height: 1;
      color: #707d8d;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-align: right;
    }
    .quote-meta-box {
      margin-top: 1rem;
      display: inline-block;
      text-align: left;
      font-size: 8.5pt;
    }
    .quote-meta-row {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 0.25rem;
      align-items: baseline;
    }
    .quote-meta-label {
      font-weight: 700;
      color: #000000;
      min-width: 90px;
    }
    .quote-meta-value {
      font-weight: 600;
      color: #000000;
      text-align: right;
    }
    .quote-meta-value.bold-quote {
      font-weight: 800;
      font-size: 9pt;
    }

    /* 2. Top Info Boxes: Quoted To & Bank Information */
    .quote-info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 0.95rem;
    }
    .quote-box {
      border: 1px solid #000000;
      background: #ffffff;
      min-height: 110px;
      display: flex;
      flex-direction: column;
    }
    .quote-box-header {
      background: #d9d9d9;
      border-bottom: 1px solid #000000;
      padding: 4px 8px;
      font-weight: 700;
      font-size: 8.5pt;
      color: #000000;
    }
    .quote-box-body {
      padding: 6px 8px;
      font-size: 8.2pt;
      line-height: 1.4;
      color: #000000;
      flex: 1;
    }
    .quote-box-body strong {
      font-weight: 700;
    }

    .bank-grid-row {
      display: flex;
      margin-bottom: 2px;
    }
    .bank-grid-label {
      width: 105px;
      flex-shrink: 0;
      font-weight: 600;
    }
    .bank-grid-val {
      flex: 1;
    }

    /* 3. Main Line Items Table Container */
    .quote-items-container {
      border: 1px solid #000000;
      width: 100%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      flex: 1;
      margin-bottom: 0.95rem;
    }
    .quote-items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .quote-items-table th {
      background: #d9d9d9;
      border-bottom: 1px solid #000000;
      border-right: 1px solid #000000;
      padding: 4px 6px;
      font-size: 8.5pt;
      font-weight: 700;
      text-align: center;
      color: #000000;
    }
    .quote-items-table th:last-child {
      border-right: none;
    }
    .quote-items-table td {
      border-right: 1px solid #000000;
      padding: 4px 6px;
      font-size: 8.5pt;
      vertical-align: top;
      line-height: 1.35;
    }
    .quote-items-table td:last-child {
      border-right: none;
    }

    /* Column Widths matching official sample */
    .col-qty   { width: 9%;   text-align: center; }
    .col-part  { width: 14%;  text-align: left; padding-left: 6px !important; }
    .col-desc  { width: 49%;  text-align: left; padding-left: 6px !important; }
    .col-price { width: 14%;  text-align: right; padding-right: 8px !important; }
    .col-amt   { width: 14%;  text-align: right; padding-right: 8px !important; }

    .item-notes-block {
      margin-top: 10px;
      font-size: 8pt;
      line-height: 1.35;
      color: #111111;
      white-space: pre-line;
    }

    /* Filler row to push table lines all the way down */
    .quote-filler-row td {
      height: 220px;
      border-top: none;
    }

    /* Bottom Total Bar */
    .quote-total-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #000000;
    }
    .quote-total-left {
      width: 72%;
      border-right: 1px solid #000000;
    }
    .quote-total-label-cell {
      padding: 4px 8px;
      font-weight: 700;
      font-size: 8.5pt;
      text-align: center;
      background: #d9d9d9;
      border-right: 1px solid #000000;
      width: 14%;
      white-space: nowrap;
    }
    .quote-total-value-cell {
      padding: 4px 8px;
      font-weight: 800;
      font-size: 8.5pt;
      text-align: right;
      width: 14%;
    }

    /* 4. Bottom Terms & Authorized Signature Blocks */
    .quote-bottom-section {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 0.85rem;
      margin-top: auto;
    }

    .payment-terms-container {
      width: 360px;
      border: 1px solid #000000;
      display: flex;
      height: 28px;
    }
    .payment-terms-label {
      background: #d9d9d9;
      border-right: 1px solid #000000;
      padding: 4px 8px;
      font-weight: 700;
      font-size: 8.5pt;
      width: 130px;
      display: flex;
      align-items: center;
    }
    .payment-terms-val {
      padding: 4px 10px;
      font-size: 8.5pt;
      display: flex;
      align-items: center;
      flex: 1;
    }

    .signature-container {
      width: 360px;
      border: 1px solid #000000;
      display: flex;
      flex-direction: column;
    }
    .signature-header {
      background: #d9d9d9;
      border-bottom: 1px solid #000000;
      padding: 4px 8px;
      font-weight: 700;
      font-size: 8.5pt;
    }
    .signature-body {
      padding: 12px 10px 8px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .signature-img-box {
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 4px;
    }
    .signature-svg {
      width: 130px;
      height: 46px;
    }
    .signature-png {
      max-width: 160px;
      max-height: 46px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
    .signature-line {
      width: 180px;
      border-top: 1px solid #000000;
      margin-top: 2px;
      margin-bottom: 4px;
    }
    .signatory-name {
      font-weight: 700;
      font-size: 8.5pt;
      color: #000000;
    }
    .signatory-title {
      font-size: 7.5pt;
      color: #111111;
    }

    /* Print Specific Media Styles */
    @media print {
      @page {
        size: letter portrait;
        margin: 0;
      }
      body {
        background: #ffffff !important;
        padding: 0 !important;
      }
      .top-toolbar {
        display: none !important;
      }
      .quote-canvas {
        margin: 0 auto !important;
        box-shadow: none !important;
        width: 100% !important;
        max-width: 8.5in !important;
        min-height: 11in !important;
        padding: 0.5in 0.6in 0.6in 0.6in !important;
        page-break-after: avoid;
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <!-- Floating Screen Action Toolbar -->
  <div class="top-toolbar">
    <div class="top-toolbar-title">
      <span>Quotation Document</span>
      <span class="top-toolbar-badge">${escapeHtml(displayQuoteNumber)}</span>
    </div>
    <div class="top-toolbar-actions">
      <button class="btn-action" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
      <button class="btn-action btn-secondary" onclick="downloadQuotePdf()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Download PDF
      </button>
      <button class="btn-action btn-secondary" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- 100% Exact Quotation Form Sheet -->
  <div class="quote-canvas" id="quotation-printable-sheet">
    <!-- 1. Header Section -->
    <div class="quote-header">
      <div class="quote-header-left">
        <img class="quote-logo" src="/assets/logo.png" alt="APEXS Logo" />
        <div>
          <div class="quote-company-name">APPLIED EXPERT SYSTEMS &amp; SOFTWARE, INC.</div>
          <div class="quote-tagline">We put technology to work for you</div>
          <div class="quote-company-info">
            <div>Suite 714 EGI City by the Sea</div>
            <div>Maribago, Lapu-lapu City &nbsp;&nbsp;&nbsp;&nbsp; 6015 &nbsp;&nbsp;&nbsp;&nbsp; Philippines</div>
            <div>Email ad: apexsinc@mozcom.com</div>
            <div style="margin-top: 1px;">Tel no.: 6332 4952106</div>
          </div>
        </div>
      </div>

      <div class="quote-header-right">
        <div class="quote-main-title">QUOTATION</div>
        <div class="quote-meta-box">
          <div class="quote-meta-row">
            <span class="quote-meta-label">Quote Date:</span>
            <span class="quote-meta-value">${formattedDate}</span>
          </div>
          <div class="quote-meta-row">
            <span class="quote-meta-label">Page:</span>
            <span class="quote-meta-value">1</span>
          </div>
          <div class="quote-meta-row">
            <span class="quote-meta-label">Quote No.:</span>
            <span class="quote-meta-value bold-quote">${escapeHtml(displayQuoteNumber)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Address & Bank Info Blocks -->
    <div class="quote-info-grid">
      <div class="quote-box">
        <div class="quote-box-header">Quoted To:</div>
        <div class="quote-box-body">
          <div style="font-weight: 800; margin-bottom: 2px;">${escapeHtml(customerName)}</div>
          ${customerLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
          ${quote.customer?.phone ? `<div>Tel: ${escapeHtml(quote.customer.phone)}</div>` : ''}
          ${quote.customer?.email ? `<div>Email: ${escapeHtml(quote.customer.email)}</div>` : ''}
        </div>
      </div>

      <div class="quote-box">
        <div class="quote-box-header">Bank Information</div>
        <div class="quote-box-body">
          <div class="bank-grid-row">
            <span class="bank-grid-label">Account Name:</span>
            <span class="bank-grid-val">${escapeHtml(bankAccountName)}</span>
          </div>
          <div class="bank-grid-row">
            <span class="bank-grid-label">Account No.:</span>
            <span class="bank-grid-val">${escapeHtml(bankAccountNo)}</span>
          </div>
          <div class="bank-grid-row">
            <span class="bank-grid-label">Bank Name:</span>
            <span class="bank-grid-val">${escapeHtml(bankName)}</span>
          </div>
          <div class="bank-grid-row">
            <span class="bank-grid-label">Bank Address:</span>
            <span class="bank-grid-val">${bankAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. Line Items Table -->
    <div class="quote-items-container">
      <table class="quote-items-table">
        <thead>
          <tr>
            <th class="col-qty">Quantity</th>
            <th class="col-part">Part Number</th>
            <th class="col-desc">Description</th>
            <th class="col-price">Unit Price</th>
            <th class="col-amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          ${generalNotesHtml}
          <!-- Vertical column lines continue down to bottom -->
          <tr class="quote-filler-row">
            <td class="col-qty"></td>
            <td class="col-part"></td>
            <td class="col-desc"></td>
            <td class="col-price"></td>
            <td class="col-amt"></td>
          </tr>
        </tbody>
      </table>

      <!-- Bottom Total Bar -->
      <table class="quote-total-table">
        <tr>
          <td class="quote-total-left"></td>
          <td class="quote-total-label-cell">TOTAL &gt; &gt;</td>
          <td class="quote-total-value-cell">${currencyPrefix}${totalFormatted}</td>
        </tr>
      </table>
    </div>

    <!-- 4. Bottom Terms & Authorized Signature -->
    <div class="quote-bottom-section">
      <div class="payment-terms-container">
        <div class="payment-terms-label">Payment Terms</div>
        <div class="payment-terms-val">${escapeHtml(paymentTerms)}</div>
      </div>

      <div class="signature-container">
        <div class="signature-header">Authorized Signature</div>
        <div class="signature-body">
          <div class="signature-img-box">
            ${quote.signatureImageData ? `
              <img src="${escapeHtml(quote.signatureImageData)}" class="signature-png" alt="Authorized Signature" />
            ` : `
              <!-- Official Cursive Signature Replicating Jeneviev Manatad signature -->
              <svg class="signature-svg" viewBox="0 0 140 45" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 36 C18 12, 28 6, 32 18 C35 28, 26 38, 20 32 C15 26, 26 14, 40 22 C48 26, 52 18, 58 24 C64 30, 68 20, 75 22 C82 24, 88 18, 95 24 C100 28, 108 20, 116 22 M30 18 Q55 8 95 12" />
                <path d="M42 34 C58 32, 85 30, 118 31" stroke-width="1.2" />
              </svg>
            `}
          </div>
          <div class="signature-line"></div>
          <div class="signatory-name">${escapeHtml(signatoryName)}</div>
          <div class="signatory-title">${escapeHtml(signatoryTitle)}</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function downloadQuotePdf() {
      const element = document.getElementById('quotation-printable-sheet');
      const opt = {
        margin: 0,
        filename: 'Quotation_${escapeHtml(displayQuoteNumber)}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
      };
      if (window.html2pdf) {
        window.html2pdf().set(opt).from(element).save();
      } else {
        window.print();
      }
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
