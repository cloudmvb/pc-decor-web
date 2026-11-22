import {
  ERP,
  apiFetch,
  esc,
  vnd,
  num,
  hasPerm,
  showToast,
  setBanner,
  openDetailModal,
  refreshCustomersCache,
  refreshSuppliersCache,
  paymentMethodLabel,
  cashDirectionMeta,
  downloadCsvUtf8,
  readMoneyVietnamese
} from './api.js';

const INCOME_CATEGORIES = [
  'Thu hoàn cọc / Hoàn tiền NCC',
  'Thu dịch vụ lắp đặt / Vệ sinh PC',
  'Thu thanh lý vật tư / Linh kiện',
  'Thu lãi / Hỗ trợ Marketing hãng',
  'Thu nhập khác'
];

const EXPENSE_CATEGORIES = [
  'Tiền thuê kho bãi & Showroom',
  'Chi phí điện, nước & Internet',
  'Chi phí vận chuyển / Bảo hiểm giao hàng',
  'Lương & Phụ cấp nhân sự',
  'Chi phí Marketing / Sự kiện',
  'Mua sắm vật tư tiêu hao & Văn phòng phẩm',
  'Chi phí vận hành khác'
];

let initialized = false;
let cashbookRows = [];
let cashbookSummary = { total_in: 0, total_out: 0, net_cashflow: 0, receipt_count: 0, expense_count: 0, by_method: {} };
let customerOpenInvoices = [];
let supplierOpenReceipts = [];

function canSubmitDirection(dir) {
  if (dir === 'RECEIPT_FROM_CUSTOMER') return hasPerm(['SALES', 'CUSTOMERS']);
  if (dir === 'PAYMENT_TO_SUPPLIER') return hasPerm(['PURCHASES', 'SUPPLIERS']);
  if (dir === 'OTHER_RECEIPT') return hasPerm(['SALES', 'PURCHASES', 'CUSTOMERS']);
  return hasPerm(['PURCHASES', 'SALES']);
}

export async function renderCashbookTab() {
  const host = document.getElementById('tab-cashbook');
  if (!initialized) {
    initialized = true;
    const dirOptions = [
      { v: 'OPERATING_EXPENSE', label: 'Phiếu Chi Vận Hành (Thuê kho, Điện nước, Lương, Ship...)' },
      { v: 'OTHER_RECEIPT', label: 'Phiếu Thu Khác (Thu cọc, Dịch vụ, Hoàn tiền, Hỗ trợ hãng...)' },
      { v: 'RECEIPT_FROM_CUSTOMER', label: 'Phiếu Thu Công Nợ Khách Hàng (Trừ nợ AR)' },
      { v: 'PAYMENT_TO_SUPPLIER', label: 'Phiếu Chi Trả Nợ Nhà Cung Cấp (Trừ nợ AP)' }
    ].filter((o) => canSubmitDirection(o.v));

    host.innerHTML = `
      <div class="sales-toolbar">
        <div>
          <h2 style="margin:0;font-size:1.05rem;font-weight:800;letter-spacing:0.02em;">SỔ QUỸ — QUẢN LÝ PHIẾU THU &amp; PHIẾU CHI</h2>
          <div class="admin-card-sub">Theo dõi dòng tiền thực thu / thực chi (Tiền mặt &amp; Ngân hàng), thu hồi nợ AR/AP và chi phí vận hành đa kho</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <button type="button" class="erp-btn erp-btn-outline" id="cbExportCsvBtn">Xuất Excel (.csv)</button>
          <button type="button" class="erp-btn erp-btn-navy" id="cbPrintLedgerBtn">In Sổ quỹ (A4)</button>
        </div>
      </div>

      <div class="admin-summary-cards" id="cbStatsGrid"></div>

      ${dirOptions.length ? `
      <section class="admin-card">
        <div class="admin-card-head">
          <h3 class="admin-card-title">Lập Phiếu Thu / Phiếu Chi Mới</h3>
          <span class="admin-card-sub">Kiểm tra hợp lệ 3 lớp (Form → API → SQL Server 2022) và tự động cấp mã chứng từ PT / PC</span>
        </div>
        <div id="cbFormBanner" class="erp-alert-banner"></div>
        <form id="cbForm" novalidate>
          <div class="admin-form-grid">
            <div class="admin-field span-2">
              <label for="cbDirection">Loại chứng từ giao dịch <span class="req">*</span></label>
              <select id="cbDirection" class="admin-select">
                ${dirOptions.map((o) => `<option value="${o.v}">${o.label}</option>`).join('')}
              </select>
            </div>
            <div class="admin-field">
              <label for="cbAmount">Số tiền (VNĐ) <span class="req">*</span></label>
              <input type="number" id="cbAmount" class="admin-input" min="1" step="1" placeholder="VD: 1500000" />
            </div>
            <div class="admin-field">
              <label for="cbMethod">Phương thức thanh toán <span class="req">*</span></label>
              <select id="cbMethod" class="admin-select">
                <option value="BANK_TRANSFER">Chuyển khoản Ngân hàng</option>
                <option value="CASH">Tiền mặt tại quỹ</option>
                <option value="CARD">Thẻ / VNPAY</option>
              </select>
            </div>

            <!-- Customer Debt Receipt Fields -->
            <div class="admin-field span-2" id="cbCustWrap" style="display:none;">
              <label for="cbCustomerId">Khách hàng đang có công nợ (AR) <span class="req">*</span></label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select id="cbCustomerId" class="admin-select" style="flex:1;"></select>
                <button type="button" class="erp-btn sm erp-btn-outline" id="cbFillCustDebtBtn">Thu hết nợ</button>
              </div>
              <small id="cbCustDebtHint" style="font-size:0.72rem;color:var(--erp-muted);font-weight:600;"></small>
            </div>
            <div class="admin-field span-2" id="cbInvWrap" style="display:none;">
              <label for="cbInvoiceId">Áp dụng cho Hóa đơn (tùy chọn)</label>
              <select id="cbInvoiceId" class="admin-select">
                <option value="">Tự động trừ nợ FIFO (Hóa đơn cũ nhất trước)</option>
              </select>
            </div>

            <!-- Supplier Debt Payment Fields -->
            <div class="admin-field span-2" id="cbSupWrap" style="display:none;">
              <label for="cbSupplierId">Nhà cung cấp đang có công nợ (AP) <span class="req">*</span></label>
              <div style="display:flex;gap:8px;align-items:center;">
                <select id="cbSupplierId" class="admin-select" style="flex:1;"></select>
                <button type="button" class="erp-btn sm erp-btn-outline" id="cbFillSupDebtBtn">Trả hết nợ</button>
              </div>
              <small id="cbSupDebtHint" style="font-size:0.72rem;color:var(--erp-muted);font-weight:600;"></small>
            </div>
            <div class="admin-field span-2" id="cbRecWrap" style="display:none;">
              <label for="cbReceiptId">Áp dụng cho Phiếu nhập (tùy chọn)</label>
              <select id="cbReceiptId" class="admin-select">
                <option value="">Tự động trừ nợ FIFO (Phiếu nhập cũ nhất trước)</option>
              </select>
            </div>

            <!-- Standalone Operating Expense / Other Receipt Fields -->
            <div class="admin-field span-2" id="cbCatWrap">
              <label for="cbCategorySel" id="cbCategoryLabel">Hạng mục chi phí <span class="req">*</span></label>
              <div style="display:flex;gap:8px;">
                <select id="cbCategorySel" class="admin-select" style="flex:1;"></select>
                <input type="text" id="cbCategoryCustom" class="admin-input" placeholder="Nhập tên hạng mục..." style="flex:1;display:none;" />
              </div>
            </div>
            <div class="admin-field span-2" id="cbCounterpartyWrap">
              <label for="cbCounterparty" id="cbCounterpartyLabel">Người nhận tiền / Đơn vị nhận <span class="req">*</span></label>
              <input type="text" id="cbCounterparty" class="admin-input" placeholder="VD: Điện lực EVN Hà Nội / Ban quản lý Kho Cầu Giấy" />
            </div>

            <div class="admin-field span-4">
              <label for="cbNote">Nội dung diễn giải / Lý do giao dịch <span class="req" id="cbNoteReq">*</span></label>
              <input type="text" id="cbNote" class="admin-input" placeholder="VD: Thanh toán tiền điện & thuê mặt bằng kho tháng 11/2026" />
            </div>
          </div>

          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="cbSubmitBtn">Lập &amp; Ghi sổ Chứng từ</button>
            <button type="button" class="erp-btn erp-btn-outline" id="cbResetBtn">Làm mới biểu mẫu</button>
          </div>
        </form>
      </section>` : ''}

      <section class="admin-card">
        <div class="admin-card-head">
          <h3 class="admin-card-title">Nhật ký Chứng từ Thu Chi (Sổ quỹ)</h3>
          <span class="admin-card-sub" id="cbTableCount">Đang tải...</span>
        </div>
        <div id="cbFilterBanner" class="erp-alert-banner"></div>
        <form id="cbFilterForm" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:14px;">
          <select id="cbFilterDir" class="admin-select" style="width:190px;">
            <option value="">Tất cả Thu &amp; Chi</option>
            <option value="IN">Chỉ Phiếu Thu (Dòng vào)</option>
            <option value="OUT">Chỉ Phiếu Chi (Dòng ra)</option>
            <option value="RECEIPT_FROM_CUSTOMER">Thu công nợ KH</option>
            <option value="OTHER_RECEIPT">Phiếu thu khác</option>
            <option value="PAYMENT_TO_SUPPLIER">Chi trả nợ NCC</option>
            <option value="OPERATING_EXPENSE">Chi phí vận hành</option>
          </select>
          <select id="cbFilterMethod" class="admin-select" style="width:165px;">
            <option value="">Mọi phương thức</option>
            <option value="BANK_TRANSFER">Chuyển khoản</option>
            <option value="CASH">Tiền mặt</option>
            <option value="CARD">Thẻ / VNPAY</option>
          </select>
          <div class="erp-date-range">
            <label for="cbFilterFrom">Từ</label>
            <input type="date" id="cbFilterFrom" />
            <label for="cbFilterTo">Đến</label>
            <input type="date" id="cbFilterTo" />
          </div>
          <input type="text" id="cbFilterQ" class="admin-input" style="flex:1;min-width:190px;" placeholder="Tìm mã PT/PC, đối tượng, hạng mục, ghi chú..." />
          <button type="submit" class="erp-btn erp-btn-primary">Lọc sổ quỹ</button>
          <button type="button" class="erp-btn erp-btn-outline" id="cbFilterResetBtn">Xóa lọc</button>
        </form>

        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã chứng từ</th>
                <th>Thời gian</th>
                <th>Loại phiếu</th>
                <th>Hạng mục</th>
                <th>Đối tượng nộp / nhận</th>
                <th>Chứng từ gốc</th>
                <th>Phương thức</th>
                <th class="num">Số tiền</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="cbTableBody"></tbody>
            <tfoot id="cbTableFoot"></tfoot>
          </table>
        </div>
      </section>
    `;

    bindCashbookEvents();
  }

  await Promise.all([refreshCustomersCache(), refreshSuppliersCache()]);
  populatePartnerDebtSelects();
  syncDirectionFields();
  await loadCashbookTable();
}

function bindCashbookEvents() {
  const dirEl = document.getElementById('cbDirection');
  if (dirEl) {
    dirEl.onchange = () => {
      setBanner('cbFormBanner', '', '');
      syncDirectionFields();
    };
  }

  const catSelEl = document.getElementById('cbCategorySel');
  if (catSelEl) {
    catSelEl.onchange = () => {
      const customEl = document.getElementById('cbCategoryCustom');
      if (customEl) customEl.style.display = catSelEl.value === '__CUSTOM__' ? 'block' : 'none';
    };
  }

  document.getElementById('cbCustomerId')?.addEventListener('change', onSelectCustomerDebt);
  document.getElementById('cbInvoiceId')?.addEventListener('change', () => {
    const invId = Number(document.getElementById('cbInvoiceId')?.value || 0);
    const found = customerOpenInvoices.find((x) => Number(x.id) === invId);
    if (found) document.getElementById('cbAmount').value = Math.round(Number(found.debt_amount || 0));
  });
  document.getElementById('cbFillCustDebtBtn')?.addEventListener('click', () => {
    const custId = Number(document.getElementById('cbCustomerId')?.value || 0);
    const c = (ERP.customersCache || []).find((x) => Number(x.id) === custId);
    if (c && Number(c.receivable_debt) > 0) {
      document.getElementById('cbAmount').value = Math.round(Number(c.receivable_debt));
    }
  });

  document.getElementById('cbSupplierId')?.addEventListener('change', onSelectSupplierDebt);
  document.getElementById('cbReceiptId')?.addEventListener('change', () => {
    const recId = Number(document.getElementById('cbReceiptId')?.value || 0);
    const found = supplierOpenReceipts.find((x) => Number(x.id) === recId);
    if (found) document.getElementById('cbAmount').value = Math.round(Number(found.debt_amount || 0));
  });
  document.getElementById('cbFillSupDebtBtn')?.addEventListener('click', () => {
    const supId = Number(document.getElementById('cbSupplierId')?.value || 0);
    const s = (ERP.suppliersCache || []).find((x) => Number(x.id) === supId);
    if (s && Number(s.payable_debt) > 0) {
      document.getElementById('cbAmount').value = Math.round(Number(s.payable_debt));
    }
  });

  document.getElementById('cbForm')?.addEventListener('submit', handleCreateCashVoucher);
  document.getElementById('cbResetBtn')?.addEventListener('click', () => {
    document.getElementById('cbForm')?.reset();
    setBanner('cbFormBanner', '', '');
    syncDirectionFields();
  });

  document.getElementById('cbFilterForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    loadCashbookTable();
  });
  document.getElementById('cbFilterDir')?.addEventListener('change', () => loadCashbookTable());
  document.getElementById('cbFilterMethod')?.addEventListener('change', () => loadCashbookTable());
  document.getElementById('cbFilterResetBtn')?.addEventListener('click', () => {
    document.getElementById('cbFilterDir').value = '';
    document.getElementById('cbFilterMethod').value = '';
    document.getElementById('cbFilterFrom').value = '';
    document.getElementById('cbFilterTo').value = '';
    document.getElementById('cbFilterQ').value = '';
    setBanner('cbFilterBanner', '', '');
    loadCashbookTable();
  });

  document.getElementById('cbExportCsvBtn')?.addEventListener('click', exportCashbookCsv);
  document.getElementById('cbPrintLedgerBtn')?.addEventListener('click', openCashbookPrintLedger);
}

function populatePartnerDebtSelects() {
  const custSel = document.getElementById('cbCustomerId');
  if (custSel) {
    const debtCusts = (ERP.customersCache || []).filter((c) => Number(c.receivable_debt || 0) > 0);
    custSel.innerHTML = debtCusts.length
      ? debtCusts.map((c) => `<option value="${c.id}">${esc(c.code)} — ${esc(c.name)} (Nợ: ${vnd(c.receivable_debt)})</option>`).join('')
      : '<option value="">Không có khách hàng đang dư nợ phải thu</option>';
  }

  const supSel = document.getElementById('cbSupplierId');
  if (supSel) {
    const debtSups = (ERP.suppliersCache || []).filter((s) => Number(s.payable_debt || 0) > 0);
    supSel.innerHTML = debtSups.length
      ? debtSups.map((s) => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)} (Nợ NCC: ${vnd(s.payable_debt)})</option>`).join('')
      : '<option value="">Không có nhà cung cấp đang dư nợ phải trả</option>';
  }
}

async function syncDirectionFields() {
  const dir = document.getElementById('cbDirection')?.value || 'OPERATING_EXPENSE';
  const isCust = dir === 'RECEIPT_FROM_CUSTOMER';
  const isSup = dir === 'PAYMENT_TO_SUPPLIER';
  const isStandalone = dir === 'OTHER_RECEIPT' || dir === 'OPERATING_EXPENSE';

  const show = (id, flag) => {
    const el = document.getElementById(id);
    if (el) el.style.display = flag ? '' : 'none';
  };

  show('cbCustWrap', isCust);
  show('cbInvWrap', isCust);
  show('cbSupWrap', isSup);
  show('cbRecWrap', isSup);
  show('cbCatWrap', isStandalone);
  show('cbCounterpartyWrap', isStandalone);

  const noteReq = document.getElementById('cbNoteReq');
  if (noteReq) noteReq.style.display = isStandalone ? '' : 'none';

  if (isStandalone) {
    const isOther = dir === 'OTHER_RECEIPT';
    document.getElementById('cbCategoryLabel').innerHTML = `${isOther ? 'Hạng mục thu' : 'Hạng mục chi phí'} <span class="req">*</span>`;
    document.getElementById('cbCounterpartyLabel').innerHTML = `${isOther ? 'Người nộp tiền / Đơn vị nộp' : 'Người nhận tiền / Đơn vị nhận'} <span class="req">*</span>`;
    document.getElementById('cbCounterparty').placeholder = isOther
      ? 'VD: Khách lẻ lắp PC / Nhà phân phối hỗ trợ'
      : 'VD: Điện lực EVN Hà Nội / Ban quản lý Kho';

    const list = isOther ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const catSel = document.getElementById('cbCategorySel');
    catSel.innerHTML = `${list.map((x) => `<option value="${esc(x)}">${esc(x)}</option>`).join('')}<option value="__CUSTOM__">+ Tự nhập hạng mục khác...</option>`;
    document.getElementById('cbCategoryCustom').style.display = 'none';
  } else if (isCust) {
    await onSelectCustomerDebt();
  } else if (isSup) {
    await onSelectSupplierDebt();
  }
}

async function onSelectCustomerDebt() {
  const custId = Number(document.getElementById('cbCustomerId')?.value || 0);
  const hint = document.getElementById('cbCustDebtHint');
  const invSel = document.getElementById('cbInvoiceId');
  customerOpenInvoices = [];
  if (!custId) {
    if (hint) hint.textContent = 'Hiện không có khách hàng nào còn công nợ phải thu.';
    if (invSel) invSel.innerHTML = '<option value="">Tự động trừ nợ FIFO</option>';
    return;
  }
  const c = (ERP.customersCache || []).find((x) => Number(x.id) === custId);
  if (hint && c) hint.textContent = `Số dư phải thu hiện tại: ${vnd(c.receivable_debt)}`;
  try {
    const res = await apiFetch('/api/sales');
    customerOpenInvoices = (res.items || []).filter((s) => Number(s.customer_id) === custId && Number(s.debt_amount || 0) > 0);
    if (invSel) {
      invSel.innerHTML = '<option value="">Tự động trừ nợ FIFO (Hóa đơn cũ nhất trước)</option>' +
        customerOpenInvoices.map((inv) => `<option value="${inv.id}">${esc(inv.invoice_code)} — Còn nợ ${vnd(inv.debt_amount)}</option>`).join('');
    }
  } catch (_) {}
}

async function onSelectSupplierDebt() {
  const supId = Number(document.getElementById('cbSupplierId')?.value || 0);
  const hint = document.getElementById('cbSupDebtHint');
  const recSel = document.getElementById('cbReceiptId');
  supplierOpenReceipts = [];
  if (!supId) {
    if (hint) hint.textContent = 'Hiện không có nhà cung cấp nào còn công nợ phải trả.';
    if (recSel) recSel.innerHTML = '<option value="">Tự động trừ nợ FIFO</option>';
    return;
  }
  const s = (ERP.suppliersCache || []).find((x) => Number(x.id) === supId);
  if (hint && s) hint.textContent = `Số dư phải trả hiện tại: ${vnd(s.payable_debt)}`;
  try {
    const res = await apiFetch('/api/purchases');
    supplierOpenReceipts = (res.items || []).filter((p) => Number(p.supplier_id) === supId && Number(p.debt_amount || 0) > 0);
    if (recSel) {
      recSel.innerHTML = '<option value="">Tự động trừ nợ FIFO (Phiếu nhập cũ nhất trước)</option>' +
        supplierOpenReceipts.map((pr) => `<option value="${pr.id}">${esc(pr.receipt_code)} — Còn nợ ${vnd(pr.debt_amount)}</option>`).join('');
    }
  } catch (_) {}
}

async function handleCreateCashVoucher(e) {
  e.preventDefault();
  setBanner('cbFormBanner', '', '');

  const tx_direction = document.getElementById('cbDirection').value;
  const rawAmt = document.getElementById('cbAmount').value;
  const amount = Number(rawAmt);
  const payment_method = document.getElementById('cbMethod').value;
  const note = document.getElementById('cbNote').value.trim();

  if (!rawAmt || !Number.isFinite(amount) || amount < 1) {
    setBanner('cbFormBanner', 'err', 'Vui lòng nhập số tiền hợp lệ lớn hơn 0.');
    return;
  }

  const payload = { tx_direction, amount, payment_method, note };

  if (tx_direction === 'RECEIPT_FROM_CUSTOMER') {
    const custId = Number(document.getElementById('cbCustomerId').value || 0);
    if (!custId) {
      setBanner('cbFormBanner', 'err', 'Vui lòng chọn khách hàng đang có công nợ phải thu.');
      return;
    }
    const cust = (ERP.customersCache || []).find((c) => Number(c.id) === custId);
    if (cust && amount > Number(cust.receivable_debt || 0)) {
      setBanner('cbFormBanner', 'err', `Số tiền thu (${vnd(amount)}) không được vượt công nợ phải thu (${vnd(cust.receivable_debt)}).`);
      return;
    }
    payload.customer_id = custId;
    const invId = Number(document.getElementById('cbInvoiceId').value || 0);
    if (invId) payload.invoice_id = invId;
  } else if (tx_direction === 'PAYMENT_TO_SUPPLIER') {
    const supId = Number(document.getElementById('cbSupplierId').value || 0);
    if (!supId) {
      setBanner('cbFormBanner', 'err', 'Vui lòng chọn nhà cung cấp đang có công nợ phải trả.');
      return;
    }
    const sup = (ERP.suppliersCache || []).find((s) => Number(s.id) === supId);
    if (sup && amount > Number(sup.payable_debt || 0)) {
      setBanner('cbFormBanner', 'err', `Số tiền chi (${vnd(amount)}) không được vượt công nợ phải trả (${vnd(sup.payable_debt)}).`);
      return;
    }
    payload.supplier_id = supId;
    const recId = Number(document.getElementById('cbReceiptId').value || 0);
    if (recId) payload.receipt_id = recId;
  } else {
    const selVal = document.getElementById('cbCategorySel').value;
    const category = selVal === '__CUSTOM__'
      ? document.getElementById('cbCategoryCustom').value.trim()
      : selVal;
    const counterparty = document.getElementById('cbCounterparty').value.trim();

    if (category.length < 2) {
      setBanner('cbFormBanner', 'err', 'Vui lòng nhập hạng mục thu/chi (tối thiểu 2 ký tự).');
      return;
    }
    if (counterparty.length < 2) {
      setBanner('cbFormBanner', 'err', 'Vui lòng nhập tên người nộp/nhận tiền (tối thiểu 2 ký tự).');
      return;
    }
    if (note.length < 3) {
      setBanner('cbFormBanner', 'err', 'Vui lòng nhập nội dung diễn giải lý do giao dịch (tối thiểu 3 ký tự).');
      return;
    }
    payload.category = category;
    payload.counterparty_name = counterparty;
  }

  const btn = document.getElementById('cbSubmitBtn');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/payments', { method: 'POST', body: payload });
    showToast(res.message || 'Đã ghi nhận phiếu thu/chi.', 'ok');
    setBanner('cbFormBanner', 'ok', res.message);
    document.getElementById('cbAmount').value = '';
    document.getElementById('cbNote').value = '';
    if (document.getElementById('cbCounterparty')) document.getElementById('cbCounterparty').value = '';
    await Promise.all([refreshCustomersCache(), refreshSuppliersCache()]);
    populatePartnerDebtSelects();
    await syncDirectionFields();
    await loadCashbookTable();
  } catch (err) {
    setBanner('cbFormBanner', 'err', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadCashbookTable() {
  setBanner('cbFilterBanner', '', '');
  const dir = document.getElementById('cbFilterDir')?.value || '';
  const method = document.getElementById('cbFilterMethod')?.value || '';
  const from = document.getElementById('cbFilterFrom')?.value || '';
  const to = document.getElementById('cbFilterTo')?.value || '';
  const q = document.getElementById('cbFilterQ')?.value.trim() || '';

  if (from && to && from > to) {
    setBanner('cbFilterBanner', 'err', 'Khoảng thời gian không hợp lệ: "Từ ngày" phải nhỏ hơn hoặc bằng "Đến ngày".');
    return;
  }

  const qs = new URLSearchParams();
  if (dir) qs.set('tx_direction', dir);
  if (method) qs.set('payment_method', method);
  if (from) qs.set('from', from);
  if (to) qs.set('to', to);
  if (q) qs.set('q', q);

  try {
    const res = await apiFetch(`/api/payments?${qs.toString()}`);
    cashbookRows = res.items || [];
    cashbookSummary = res.summary || { total_in: 0, total_out: 0, net_cashflow: 0, receipt_count: 0, expense_count: 0, by_method: {} };
    renderCashbookStats();
    renderCashbookRows();
  } catch (err) {
    setBanner('cbFilterBanner', 'err', err.message);
  }
}

function renderCashbookStats() {
  const s = cashbookSummary;
  const grid = document.getElementById('cbStatsGrid');
  if (!grid) return;
  const bm = s.by_method || {};
  const cashIn = bm.CASH?.in || 0;
  const bankIn = (bm.BANK_TRANSFER?.in || 0) + (bm.CARD?.in || 0);
  const netCls = s.net_cashflow >= 0 ? 'navy' : 'warn';

  grid.innerHTML = `
    <div class="sales-stat-card ok" id="cbKpiIn">
      <div class="sales-stat-label">Tổng Thu trong kỳ (${num(s.receipt_count)} phiếu)</div>
      <div class="sales-stat-value">${vnd(s.total_in)}</div>
      <div class="sales-stat-sub">Tiền mặt: <b>${vnd(cashIn)}</b> • NH/Thẻ: <b>${vnd(bankIn)}</b></div>
    </div>
    <div class="sales-stat-card danger" id="cbKpiOut">
      <div class="sales-stat-label">Tổng Chi trong kỳ (${num(s.expense_count)} phiếu)</div>
      <div class="sales-stat-value">${vnd(s.total_out)}</div>
      <div class="sales-stat-sub">Trả NCC &amp; Chi phí vận hành hệ thống</div>
    </div>
    <div class="sales-stat-card ${netCls}" id="cbKpiNet">
      <div class="sales-stat-label">Tồn quỹ ròng (Thu − Chi)</div>
      <div class="sales-stat-value">${s.net_cashflow >= 0 ? '' : '-'}${vnd(Math.abs(s.net_cashflow))}</div>
      <div class="sales-stat-sub">Cân đối dòng tiền thực tế tại quỹ</div>
    </div>
    <div class="sales-stat-card" id="cbKpiCount">
      <div class="sales-stat-label">Tổng số chứng từ</div>
      <div class="sales-stat-value">${num(s.receipt_count + s.expense_count)} chứng từ</div>
      <div class="sales-stat-sub">Phiếu Thu (PT): <b>${num(s.receipt_count)}</b> • Phiếu Chi (PC): <b>${num(s.expense_count)}</b></div>
    </div>
  `;
}

function renderCashbookRows() {
  const tbody = document.getElementById('cbTableBody');
  const tfoot = document.getElementById('cbTableFoot');
  const countEl = document.getElementById('cbTableCount');
  if (countEl) countEl.textContent = `${num(cashbookRows.length)} chứng từ`;

  if (!cashbookRows.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--erp-muted);">Chưa có chứng từ thu chi nào khớp điều kiện lọc.</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  let tableIn = 0;
  let tableOut = 0;
  tbody.innerHTML = cashbookRows.map((r) => {
    const meta = cashDirectionMeta(r.tx_direction);
    if (r.flow_type === 'IN') tableIn += r.amount;
    else tableOut += r.amount;
    const signAmt = r.flow_type === 'IN' ? `+${vnd(r.amount)}` : `-${vnd(r.amount)}`;
    const amtColor = r.flow_type === 'IN' ? '#047857' : '#be123c';

    return `
      <tr>
        <td><b>${esc(r.payment_code)}</b></td>
        <td style="white-space:nowrap;">${esc(r.created_at)}</td>
        <td><span class="erp-badge ${meta.badgeClass}">${esc(meta.shortLabel)}</span></td>
        <td>
          <div style="font-weight:700;">${esc(r.display_category)}</div>
          ${r.note ? `<div style="font-size:0.71rem;color:var(--erp-muted);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${esc(r.note)}">${esc(r.note)}</div>` : ''}
        </td>
        <td><b>${esc(r.display_counterparty)}</b></td>
        <td>${esc(r.display_ref)}</td>
        <td><span class="erp-badge navy">${esc(paymentMethodLabel(r.payment_method))}</span></td>
        <td class="num" style="color:${amtColor};font-weight:800;white-space:nowrap;">${signAmt}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button type="button" class="erp-btn sm erp-btn-outline" data-view-cb="${r.id}">Xem / In A4</button>
        </td>
      </tr>`;
  }).join('');

  if (tfoot) {
    tfoot.innerHTML = `
      <tr>
        <td colspan="7">TỔNG CỘNG DANH SÁCH ĐANG LỌC (${num(cashbookRows.length)} chứng từ)</td>
        <td class="num" style="white-space:nowrap;">Thu: +${vnd(tableIn)}<br/>Chi: -${vnd(tableOut)}</td>
        <td></td>
      </tr>`;
  }

  tbody.querySelectorAll('[data-view-cb]').forEach((b) => {
    b.onclick = () => viewPaymentVoucher(Number(b.dataset.viewCb));
  });
}

async function viewPaymentVoucher(id) {
  const res = await apiFetch(`/api/payments/${id}`);
  const r = res.item;
  const meta = cashDirectionMeta(r.tx_direction);
  const isIncome = r.flow_type === 'IN';
  const partyLabel = isIncome ? 'Họ tên / Đơn vị nộp tiền' : 'Họ tên / Đơn vị nhận tiền';
  const partnerPhone = r.customer_phone || r.supplier_phone || '---';
  const partnerAddr = r.customer_address || r.supplier_address || 'Tại trụ sở / Kho SKYCRUMB Studio';
  const dateObj = new Date(String(r.created_at || '').replace(' ', 'T'));
  const dayStr = Number.isNaN(dateObj.getTime())
    ? esc(r.created_at)
    : `Ngày ${String(dateObj.getDate()).padStart(2, '0')} tháng ${String(dateObj.getMonth() + 1).padStart(2, '0')} năm ${dateObj.getFullYear()}`;

  openDetailModal(`${meta.docTitle} — ${r.payment_code}`, `
    <div class="erp-voucher-a4">
      <div class="erp-voucher-a4-head">
        <div>
          <div style="font-size:1.05rem;font-weight:800;color:#071a33;">CÔNG TY TNHH CÔNG NGHỆ SKYCRUMB STUDIO</div>
          <div style="font-size:0.78rem;color:#476282;">Hệ thống Quản trị Doanh nghiệp &amp; Đa kho Toàn quốc (5 Hubs)</div>
          <div style="font-size:0.75rem;color:#64748b;">Trụ sở: Tòa nhà SKYCRUMB Lab, Q. Cầu Giấy, Hà Nội • Hotline: 1900 8868</div>
        </div>
        <div style="text-align:right;font-size:0.79rem;">
          <div><b>Mẫu số:</b> ${isIncome ? '01-TT' : '02-TT'} (TT200)</div>
          <div><b>Số chứng từ:</b> <span style="color:#0369a1;font-weight:800;">${esc(r.payment_code)}</span></div>
          <div><b>Giờ lập:</b> ${esc(r.created_at)}</div>
        </div>
      </div>

      <div class="erp-voucher-a4-title">
        <h2>${esc(meta.docTitle)}</h2>
        <div style="font-size:0.8rem;color:#476282;font-style:italic;">${dayStr}</div>
      </div>

      <div class="erp-voucher-a4-meta">
        <div><b>${partyLabel}:</b> ${esc(r.display_counterparty)}</div>
        <div><b>Điện thoại / Địa chỉ:</b> ${esc(partnerPhone)} • ${esc(partnerAddr)}</div>
        <div><b>Phân loại &amp; Hạng mục:</b> <span class="erp-badge ${meta.badgeClass}">${esc(meta.label)}</span> — ${esc(r.display_category)}</div>
        <div><b>Lý do ${isIncome ? 'thu' : 'chi'}:</b> ${esc(r.note || r.display_category)}</div>
        <div><b>Phương thức:</b> ${esc(paymentMethodLabel(r.payment_method))} • <b>Chứng từ kèm theo:</b> ${esc(r.display_ref)}</div>
        <div style="margin-top:6px;padding-top:8px;border-top:1px dashed #cbd5e1;font-size:0.96rem;">
          <b>Số tiền bằng số:</b>
          <span style="color:${isIncome ? '#047857' : '#be123c'};font-weight:800;font-size:1.12rem;">${vnd(r.amount)}</span>
        </div>
        <div><b>Viết bằng chữ:</b> <i>${esc(readMoneyVietnamese(r.amount))}</i></div>
      </div>

      <div class="erp-sign-grid">
        <div class="erp-sign-box"><strong>Giám đốc</strong><em>(Ký, họ tên, đóng dấu)</em><div>&nbsp;</div></div>
        <div class="erp-sign-box"><strong>Kế toán trưởng</strong><em>(Ký, họ tên)</em><div>&nbsp;</div></div>
        <div class="erp-sign-box"><strong>${isIncome ? 'Người nộp tiền' : 'Người nhận tiền'}</strong><em>(Ký, họ tên)</em><div style="font-size:0.72rem;font-weight:700;">${esc(r.display_counterparty)}</div></div>
        <div class="erp-sign-box"><strong>Người lập phiếu</strong><em>(Ký, họ tên)</em><div style="font-size:0.72rem;font-weight:700;">${esc(r.created_by_name || ERP.user?.full_name || 'Admin')}</div></div>
        <div class="erp-sign-box"><strong>Thủ quỹ</strong><em>(Ký, họ tên)</em><div>&nbsp;</div></div>
      </div>
    </div>
  `);
}

function exportCashbookCsv() {
  if (!cashbookRows.length) {
    showToast('Chưa có chứng từ nào trong danh sách để xuất Excel.', 'err');
    return;
  }
  const headers = ['Mã chứng từ', 'Thời gian', 'Loại giao dịch', 'Dòng tiền', 'Hạng mục', 'Đối tượng nộp/nhận', 'Chứng từ gốc', 'Phương thức', 'Số tiền (VNĐ)', 'Người lập', 'Ghi chú'];
  const rows = cashbookRows.map((r) => [
    r.payment_code,
    r.created_at,
    cashDirectionMeta(r.tx_direction).label,
    r.flow_type === 'IN' ? 'Thu vào' : 'Chi ra',
    r.display_category,
    r.display_counterparty,
    r.display_ref,
    paymentMethodLabel(r.payment_method),
    r.flow_type === 'IN' ? r.amount : -r.amount,
    r.created_by_name || '---',
    r.note || ''
  ]);
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCsvUtf8(`skycrumb_so_quy_thu_chi_${stamp}.csv`, headers, rows);
  showToast(`Đã xuất file Excel (.csv) gồm ${cashbookRows.length} chứng từ thu chi.`, 'ok');
}

function openCashbookPrintLedger() {
  const from = document.getElementById('cbFilterFrom')?.value || '';
  const to = document.getElementById('cbFilterTo')?.value || '';
  const periodLabel = (from || to) ? `Từ ${from || '...'} đến ${to || '...'}` : 'Toàn bộ chứng từ theo bộ lọc hiện tại';
  let sumIn = 0;
  let sumOut = 0;

  const bodyRows = cashbookRows.map((r, i) => {
    if (r.flow_type === 'IN') sumIn += r.amount;
    else sumOut += r.amount;
    return `
      <tr>
        <td>${i + 1}</td>
        <td><b>${esc(r.payment_code)}</b></td>
        <td>${esc(r.created_at)}</td>
        <td>${esc(r.display_category)}</td>
        <td>${esc(r.display_counterparty)}</td>
        <td>${esc(paymentMethodLabel(r.payment_method))}</td>
        <td class="num">${r.flow_type === 'IN' ? vnd(r.amount) : '0đ'}</td>
        <td class="num">${r.flow_type === 'OUT' ? vnd(r.amount) : '0đ'}</td>
      </tr>`;
  }).join('');

  openDetailModal('Sổ Quỹ Thu Chi Chi Tiết (A4)', `
    <div class="erp-voucher-a4">
      <div class="erp-voucher-a4-head">
        <div>
          <div style="font-size:1.05rem;font-weight:800;color:#071a33;">SKYCRUMB STUDIO — SỔ QUỸ TIỀN MẶT &amp; NGÂN HÀNG</div>
          <div style="font-size:0.78rem;color:#476282;">Kỳ báo cáo: ${esc(periodLabel)} • Tổng số: ${num(cashbookRows.length)} chứng từ</div>
        </div>
        <div style="text-align:right;font-size:0.78rem;">
          <div><b>Ngày in:</b> ${esc(new Date().toLocaleString('vi-VN'))}</div>
          <div><b>Người lập:</b> ${esc(ERP.user?.full_name || 'Quản trị')}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px;background:#f8fbfe;padding:10px 14px;border-radius:10px;border:1px solid #d7e4f2;">
        <div><small>Tổng Thu danh sách</small><div style="font-weight:800;color:#047857;font-size:1rem;">${vnd(sumIn)}</div></div>
        <div><small>Tổng Chi danh sách</small><div style="font-weight:800;color:#be123c;font-size:1rem;">${vnd(sumOut)}</div></div>
        <div><small>Chênh lệch Thu − Chi</small><div style="font-weight:800;color:#071a33;font-size:1rem;">${sumIn - sumOut >= 0 ? '' : '-'}${vnd(Math.abs(sumIn - sumOut))}</div></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>#</th><th>Mã CT</th><th>Thời gian</th><th>Hạng mục</th><th>Đối tượng</th><th>Phương thức</th><th class="num">Thu vào</th><th class="num">Chi ra</th></tr></thead>
          <tbody>${bodyRows || '<tr><td colspan="8" style="text-align:center;">Không có dữ liệu</td></tr>'}</tbody>
          <tfoot><tr><td colspan="6">TỔNG CỘNG SỔ QUỸ</td><td class="num">${vnd(sumIn)}</td><td class="num">${vnd(sumOut)}</td></tr></tfoot>
        </table>
      </div>
      <div class="erp-sign-grid cols-3">
        <div class="erp-sign-box"><strong>Người lập biểu</strong><em>(Ký, họ tên)</em><div>${esc(ERP.user?.full_name || '')}</div></div>
        <div class="erp-sign-box"><strong>Kế toán trưởng</strong><em>(Ký, họ tên)</em><div>&nbsp;</div></div>
        <div class="erp-sign-box"><strong>Giám đốc</strong><em>(Ký, đóng dấu)</em><div>&nbsp;</div></div>
      </div>
    </div>
  `);
}
