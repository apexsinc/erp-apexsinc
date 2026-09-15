/**
 * Purchase Order Official PDF / Printable Document View
 * Exactly replicates the official APEXS, INC. Purchase Order layout (100% pixel-perfect).
 */

export interface PurchaseOrderItemData {
  quantityOrdered: number;
  unitPriceCents: number;
  subtotalCents: number;
  product?: {
    sku?: string;
    name?: string;
    unitOfMeasure?: string;
    description?: string;
  };
}

export interface PurchaseOrderData {
  id: string;
  poNumber: string;
  status: string;
  currency: string;
  totalAmountCents: number;
  issueDate?: string;
  createdAt?: string;
  notes?: string;
  vendor?: {
    name?: string;
    address?: string;
    taxId?: string;
    paymentTermsDays?: number;
  };
  items?: PurchaseOrderItemData[];
}

export function renderPurchaseOrderPrintHtml(po: PurchaseOrderData): string {
  const currencySymbol = po.currency === 'PHP' ? '₱' : '$';

  // Format date issued: e.g. "Aug 27, 2026"
  const rawDate = po.issueDate || po.createdAt || new Date().toISOString();
  const dateObj = new Date(rawDate);
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
    : 'Aug 27, 2026';

  // Normalize PO number to standard 5-digit number (e.g. APX-26-0010 -> APX-26-00010)
  let displayPoNumber = po.poNumber || '';
  if (/^APX-\d{2}-\d{4}$/.test(displayPoNumber)) {
    const parts = displayPoNumber.split('-');
    displayPoNumber = `${parts[0]}-${parts[1]}-${parts[2].padStart(5, '0')}`;
  }

  // Parse notes for metadata if stored as JSON or fallback defaults
  let courierAccount = '';
  let shipVia = 'Deus Logistics';
  let distributorAccount = '11032';
  let terms = 'Prepaid';

  if (po.notes) {
    try {
      if (po.notes.trim().startsWith('{')) {
        const parsed = JSON.parse(po.notes);
        if (parsed.courierAccount !== undefined) courierAccount = parsed.courierAccount;
        if (parsed.shipVia) shipVia = parsed.shipVia;
        if (parsed.distributorAccount) distributorAccount = parsed.distributorAccount;
        if (parsed.terms) terms = parsed.terms;
      }
    } catch (_) {
      // not JSON
    }
  }

  if (po.vendor?.paymentTermsDays && terms === 'Prepaid' && po.vendor.paymentTermsDays !== 0) {
    // If explicitly non-zero and not customized, could show payment terms
  }

  // Vendor address formatting
  const vendorName = po.vendor?.name || 'Davis Instruments';
  const rawVendorAddress = po.vendor?.address || '3465 Diablo Avenue\nHayward\n94545\nUSA';
  const vendorAddressLines = rawVendorAddress
    .replace(/\\n/g, '\n')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Line items
  const items = po.items || [];
  const itemsRowsHtml = items
    .map((item) => {
      const uom = item.product?.unitOfMeasure || 'piece';
      // Normalize UOM text to standard format (e.g. "pcs" -> "piece", or as provided)
      const uomDisplay = uom === 'pcs' || uom === 'pc' ? 'piece' : uom;
      const sku = item.product?.sku || '';
      const name = item.product?.name || '';
      const unitCost = (item.unitPriceCents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const amount = (item.subtotalCents / 100).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      return `
        <tr>
          <td class="col-qty">${item.quantityOrdered}</td>
          <td class="col-uom">${escapeHtml(uomDisplay)}</td>
          <td class="col-part">${escapeHtml(sku)}</td>
          <td class="col-desc">${escapeHtml(name)}</td>
          <td class="col-cost">${unitCost}</td>
          <td class="col-amt">${amount}</td>
        </tr>
      `;
    })
    .join('');

  const totalFormatted = (po.totalAmountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Purchase Order ${escapeHtml(displayPoNumber)} — APEXS, INC.</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&display=swap" rel="stylesheet">
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
      background: #3b82f6;
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
      background: #2563eb;
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
      background: #1d4ed8;
    }
    .btn-secondary {
      background: #475569;
    }
    .btn-secondary:hover {
      background: #334155;
    }

    /* Exact Purchase Order Printable Canvas */
    .po-canvas {
      width: 8.5in;
      min-height: 11in;
      margin: 25px auto;
      background: #ffffff;
      padding: 0.5in 0.6in 0.6in 0.6in;
      box-shadow: 0 4px 25px rgba(0,0,0,0.25);
      position: relative;
    }

    /* 1. Header Section */
    .po-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.15rem;
    }
    .po-header-left {
      display: flex;
      gap: 0.85rem;
      align-items: flex-start;
    }
    .po-logo {
      width: 82px;
      height: auto;
      object-fit: contain;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .po-company-name {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 800;
      font-size: 11.5pt;
      color: #000000;
      line-height: 1.15;
      letter-spacing: -0.01em;
    }
    .po-tagline {
      font-family: Georgia, 'Times New Roman', serif;
      font-style: italic;
      font-size: 9pt;
      color: #111111;
      margin-top: 1px;
      margin-bottom: 2px;
    }
    .po-company-info {
      font-size: 8pt;
      line-height: 1.35;
      color: #000000;
    }
    .po-company-info .fax-row {
      display: flex;
      gap: 1.5rem;
    }

    .po-header-right {
      text-align: right;
      min-width: 280px;
    }
    .po-main-title {
      font-family: Arial, Helvetica, sans-serif;
      font-weight: 900;
      font-size: 27pt;
      line-height: 0.95;
      color: #707d8d;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      text-align: right;
    }
    .po-meta-box {
      margin-top: 1.15rem;
      display: inline-block;
      text-align: left;
      font-size: 8.5pt;
    }
    .po-meta-row {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      margin-bottom: 0.3rem;
      align-items: baseline;
    }
    .po-meta-label {
      font-weight: 700;
      color: #000000;
      min-width: 140px;
    }
    .po-meta-value {
      font-weight: 600;
      color: #000000;
      text-align: right;
    }
    .po-meta-value.bold-po {
      font-weight: 800;
      font-size: 9pt;
    }

    /* 2. Address Boxes (To & Ship To) */
    .po-addresses-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-bottom: 0.95rem;
    }
    .po-address-box {
      border: 1px solid #000000;
      background: #ffffff;
      min-height: 104px;
      display: flex;
      flex-direction: column;
    }
    .po-address-header {
      background: #d9d9d9;
      border-bottom: 1px solid #000000;
      padding: 3px 8px;
      font-weight: 700;
      font-size: 8.5pt;
      color: #000000;
    }
    .po-address-body {
      padding: 6px 8px;
      font-size: 8.2pt;
      line-height: 1.35;
      color: #000000;
      flex: 1;
    }
    .po-address-body strong {
      font-weight: 700;
    }

    /* 3. Shipping / Terms Meta Bar */
    .po-shipping-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #000000;
      margin-bottom: 0.95rem;
      font-size: 8.5pt;
    }
    .po-shipping-table th {
      background: #d9d9d9;
      border: 1px solid #000000;
      padding: 3px 6px;
      font-weight: 700;
      text-align: center;
      width: 25%;
    }
    .po-shipping-table td {
      border: 1px solid #000000;
      padding: 3.5px 6px;
      text-align: center;
      height: 22px;
      font-size: 8.5pt;
    }

    /* 4. Main Line Items Table with Extended Height */
    .po-items-table-container {
      border: 1px solid #000000;
      width: 100%;
      background: #ffffff;
      display: flex;
      flex-direction: column;
    }
    .po-items-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    .po-items-table th {
      background: #d9d9d9;
      border-bottom: 1px solid #000000;
      border-right: 1px solid #000000;
      padding: 3.5px 6px;
      font-size: 8.5pt;
      font-weight: 700;
      text-align: center;
    }
    .po-items-table th:last-child {
      border-right: none;
    }
    .po-items-table td {
      border-right: 1px solid #000000;
      padding: 3px 6px;
      font-size: 8.5pt;
      vertical-align: top;
      line-height: 1.3;
    }
    .po-items-table td:last-child {
      border-right: none;
    }

    /* Exact Column Widths */
    .col-qty  { width: 7.5%;  text-align: right; padding-right: 8px !important; }
    .col-uom  { width: 7.5%;  text-align: left;  padding-left: 8px !important; }
    .col-part { width: 17%;   text-align: left;  padding-left: 6px !important; font-family: Arial, sans-serif; }
    .col-desc { width: 46%;   text-align: left;  padding-left: 6px !important; }
    .col-cost { width: 11%;   text-align: right; padding-right: 8px !important; }
    .col-amt  { width: 11%;   text-align: right; padding-right: 8px !important; }

    /* Extended Empty Body Space to replicate form sheet */
    .po-filler-row td {
      height: 440px;
      padding: 0 !important;
      border-right: 1px solid #000000;
    }
    .po-filler-row td:last-child {
      border-right: none;
    }

    /* Bottom Total Bar */
    .po-total-table {
      width: 100%;
      border-collapse: collapse;
      border-top: 1px solid #000000;
    }
    .po-total-left {
      width: 65%;
      border-right: 1px solid #000000;
    }
    .po-total-label-cell {
      width: 24%;
      background: #d9d9d9;
      border-right: 1px solid #000000;
      padding: 3px 10px;
      text-align: right;
      font-weight: 800;
      font-size: 9pt;
      white-space: nowrap;
    }
    .po-total-value-cell {
      width: 11%;
      padding: 3px 8px;
      text-align: right;
      font-weight: 800;
      font-size: 9pt;
      white-space: nowrap;
    }

    /* 5. Important Notice Box */
    .po-notice-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 1.15rem;
    }
    .po-notice-box {
      width: 440px;
      border: 1px solid #000000;
      padding: 6px 12px 7px 12px;
      font-size: 7.8pt;
      line-height: 1.35;
      color: #000000;
    }
    .po-notice-header {
      text-align: center;
      font-weight: 800;
      font-size: 8.5pt;
      margin-bottom: 2px;
      letter-spacing: 0.5px;
    }

    /* Print Specific Rules */
    @media print {
      @page {
        size: letter portrait;
        margin: 0.4in;
      }
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
      }
      .no-print {
        display: none !important;
      }
      .po-canvas {
        margin: 0 auto !important;
        padding: 0 !important;
        box-shadow: none !important;
        width: 100% !important;
        min-height: auto !important;
      }
      .po-filler-row td {
        height: 410px !important;
      }
    }
  </style>
</head>
<body>
  <!-- Floating Action Toolbar for Screen Preview -->
  <div class="top-toolbar no-print">
    <div class="top-toolbar-title">
      <span>Purchase Order</span>
      <span style="font-family: monospace; font-size: 1rem; color: #93c5fd;">${escapeHtml(displayPoNumber)}</span>
      <span class="top-toolbar-badge">${escapeHtml(po.status)}</span>
    </div>
    <div class="top-toolbar-actions">
      <button class="btn-action" onclick="window.print()">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        Print / Save as PDF
      </button>
      <button class="btn-action btn-secondary" onclick="window.close()">Close</button>
    </div>
  </div>

  <!-- 100% Exact Purchase Order Form Sheet -->
  <div class="po-canvas">
    <!-- 1. Header Section -->
    <div class="po-header">
      <div class="po-header-left">
        <img class="po-logo" src="/assets/logo.png" alt="APEXS Logo" />
        <div>
          <div class="po-company-name">APPLIED EXPERT SYSTEMS &amp; SOFTWARE, INC.</div>
          <div class="po-tagline">We put technology to work for you</div>
          <div class="po-company-info">
            <div>Suite 714 EGI City by the Sea</div>
            <div>Maribago, Lapu-lapu City &nbsp;&nbsp;&nbsp;&nbsp; 6015 &nbsp;&nbsp;&nbsp;&nbsp; Philippines</div>
            <div>Email ad: apexsinc@mozcom.com</div>
            <div style="margin-top: 1px;">Tel #: &nbsp;6332 4952106</div>
            <div class="fax-row">
              <span>Fax: &nbsp;&nbsp;&nbsp;6332 2330835</span>
            </div>
          </div>
        </div>
      </div>

      <div class="po-header-right">
        <div class="po-main-title">
          PURCHASE<br />ORDER
        </div>
        <div class="po-meta-box">
          <div class="po-meta-row">
            <span class="po-meta-label">Date Issued:</span>
            <span class="po-meta-value">${formattedDate}</span>
          </div>
          <div class="po-meta-row">
            <span class="po-meta-label">Purchase Order No.:</span>
            <span class="po-meta-value bold-po">${escapeHtml(displayPoNumber)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. Address Blocks: To & Ship To -->
    <div class="po-addresses-grid">
      <div class="po-address-box">
        <div class="po-address-header">To:</div>
        <div class="po-address-body">
          <div style="font-weight: 800; margin-bottom: 2px;">${escapeHtml(vendorName)}</div>
          ${vendorAddressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      </div>
      <div class="po-address-box">
        <div class="po-address-header">Ship To:</div>
        <div class="po-address-body">
          <div>APPLIED EXPERT SYSTEMS &amp; SOFTWARE, INC.</div>
          <div>Suite 714 EGI City By The Sea</div>
          <div>Maribago, Lapulapu City</div>
          <div>6015</div>
          <div>Philippines</div>
        </div>
      </div>
    </div>

    <!-- 3. Shipping & Payment Terms Table -->
    <table class="po-shipping-table">
      <thead>
        <tr>
          <th>Courier Account No.</th>
          <th>Ship Via</th>
          <th>Distributor's Account No.</th>
          <th>Terms</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${escapeHtml(courierAccount)}</td>
          <td>${escapeHtml(shipVia)}</td>
          <td>${escapeHtml(distributorAccount)}</td>
          <td>${escapeHtml(terms)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 4. Line Items Table with Full-Height Form Grid -->
    <div class="po-items-table-container">
      <table class="po-items-table">
        <thead>
          <tr>
            <th class="col-qty">Qty</th>
            <th class="col-uom">U/M</th>
            <th class="col-part">Part Number</th>
            <th class="col-desc">Description</th>
            <th class="col-cost">Unit Cost</th>
            <th class="col-amt">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRowsHtml}
          <!-- Vertical column lines continue all the way down to bottom -->
          <tr class="po-filler-row">
            <td class="col-qty"></td>
            <td class="col-uom"></td>
            <td class="col-part"></td>
            <td class="col-desc"></td>
            <td class="col-cost"></td>
            <td class="col-amt"></td>
          </tr>
        </tbody>
      </table>

      <!-- Bottom Total Bar -->
      <table class="po-total-table">
        <tr>
          <td class="po-total-left"></td>
          <td class="po-total-label-cell">TOTAL &gt; &gt;</td>
          <td class="po-total-value-cell">${currencySymbol}${totalFormatted}</td>
        </tr>
      </table>
    </div>

    <!-- 5. Important Instructions Box -->
    <div class="po-notice-container">
      <div class="po-notice-box">
        <div class="po-notice-header">&gt;&gt; &nbsp;IMPORTANT &nbsp;&lt;&lt;</div>
        <div>
          Your Invoice cannot be processed for payment unless our <strong>Purchase Order No. &amp; Part No.</strong> are shown on the invoice &amp; packing list for each item.
        </div>
      </div>
    </div>
  </div>
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
