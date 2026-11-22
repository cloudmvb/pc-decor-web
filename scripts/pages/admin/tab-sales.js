import {
  ERP,
  apiFetch,
  refreshProductsCache,
  refreshCustomersCache,
  esc,
  vnd,
  num,
  showToast,
  setBanner,
  openDetailModal,
  openPaymentModal,
  paymentBadge,
  fulfillmentBadge
} from './api.js';

let salesInit = false;
let ordersInit = false;
let saleLines = [];
let salesList = [];
let ordersList = [];

function getWhAvail(product, warehouseId) {
  if (!product) return 0;
  const st = (product.warehouse_stocks || []).find((w) => Number(w.warehouse_id) === Number(warehouseId));
  return st ? Number(st.qty_available || 0) : 0;
}

function getCustomerById(id) {
  return (ERP.customersCache || []).find((c) => Number(c.id) === Number(id)) || null;
}

function getEffectiveUnitPrice(prod, customer) {
  if (!prod) return 0;
  if (customer && customer.customer_type === 'B2B' && Number(prod.wholesale_price) > 0) {
    return Number(prod.wholesale_price);
  }
  return Number(prod.retail_price || 0);
}

function makeSaleLine(prod = null, customer = null) {
  const p = prod || ERP.productsCache[0];
  return {
    product_id: p ? p.id : '',
    qty: 1,
    unit_price: getEffectiveUnitPrice(p, customer),
    discount_pct: customer?.customer_type === 'VIP' ? 3 : 0,
    serial_numbers: ''
  };
}

/* ============================================================================
 *  TAB 4: SALES & INVOICE BUILDER (POS / B2B / SMART ROUTING / CHẶN XUẤT ÂM)
 * ============================================================================ */
export async function renderSalesTab() {
  const host = document.getElementById('tab-sales');
  await Promise.all([refreshProductsCache(), refreshCustomersCache()]);

  if (!salesInit) {
    salesInit = true;
    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Lập Hóa Đơn Bán Hàng (POS / B2B / Web 3D • Chặn Xuất Âm Kho 3 Lớp)</h2>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <button type="button" class="erp-btn sm erp-btn-navy" id="saleSmartRouteBtn">Gợi ý Kho xuất tối ưu theo Khu vực</button>
          </div>
        </div>
        <div id="saleFormBanner" class="erp-alert-banner"></div>
        <form id="saleForm">
          <div class="admin-form-grid">
            <div class="admin-field span-2">
              <label>Khách hàng <span class="req">*</span></label>
              <select id="saleCustSel" class="admin-select" required></select>
              <div id="saleCustInfo" style="font-size:0.72rem;color:var(--erp-sky-dark);font-weight:700;"></div>
            </div>
            <div class="admin-field">
              <label>Kho xuất hàng <span class="req">*</span></label>
              <select id="saleWhSel" class="admin-select" required></select>
            </div>
            <div class="admin-field">
              <label>Kênh bán hàng</label>
              <select id="saleChannelSel" class="admin-select">
                <option value="POS">POS (Tại Showroom)</option>
                <option value="B2B">B2B (Dự án / Doanh nghiệp)</option>
                <option value="WEB3D">WEB3D (Đơn Online 3D)</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Phương thức thanh toán</label>
              <select id="salePayMethod" class="admin-select">
                <option value="BANK_TRANSFER">Chuyển khoản QR / Ngân hàng</option>
                <option value="CASH">Tiền mặt</option>
                <option value="CARD">Thẻ / VNPAY / Trả góp</option>
                <option value="DEBT">Ghi công nợ B2B</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Thuế VAT (%)</label>
              <select id="saleVat" class="admin-select">
                <option value="0" selected>Đã gồm VAT (0%)</option>
                <option value="8">Cộng thêm VAT 8%</option>
                <option value="10">Cộng thêm VAT 10%</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Phí vận chuyển / Bảo hiểm (VNĐ)</label>
              <input type="number" id="saleShipFee" class="admin-input" min="0" step="1" value="0" />
            </div>
            <div class="admin-field">
              <label>Số tiền khách trả ngay (VNĐ)</label>
              <input type="number" id="salePaidAmt" class="admin-input" min="0" step="1" placeholder="Để trống = thu đủ 100%" />
            </div>
            <div class="admin-field">
              <label>Trạng thái giao vận</label>
              <select id="saleFulfillSel" class="admin-select">
                <option value="COMPLETED">Giao ngay tại quầy (COMPLETED)</option>
                <option value="PROCESSING">Chờ lắp ráp / Stress-Test (PROCESSING)</option>
                <option value="DELIVERED">Đang giao vận chuyển (DELIVERED)</option>
              </select>
            </div>
            <div class="admin-field span-3">
              <label>Ghi chú hóa đơn / Giao hàng</label>
              <input type="text" id="saleNote" class="admin-input" placeholder="Ghi chú xuất VAT, thông tin người nhận..." />
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="font-size:0.82rem;text-transform:uppercase;color:var(--erp-ink);">Chi tiết Hàng hóa xuất bán</strong>
              <button type="button" class="erp-btn sm erp-btn-outline" id="saleAddLineBtn">+ Thêm dòng sản phẩm</button>
            </div>
            <div class="admin-table-wrap">
              <table class="erp-lines-table">
                <thead>
                  <tr>
                    <th style="width:34%;">Sản phẩm</th>
                    <th class="num" style="width:10%;">Tồn khả dụng</th>
                    <th style="width:10%;">SL xuất</th>
                    <th style="width:15%;">Đơn giá (VNĐ)</th>
                    <th style="width:8%;">CK %</th>
                    <th style="width:12%;">Serial / IMEI</th>
                    <th class="num" style="width:9%;">Thành tiền</th>
                    <th style="width:2%;"></th>
                  </tr>
                </thead>
                <tbody id="saleLinesBody"></tbody>
              </table>
            </div>
          </div>

          <div class="erp-totals-panel" id="saleTotalsPanel"></div>

          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="saleSubmitBtn">Xuất Hóa Đơn &amp; Trừ Tồn Kho</button>
            <button type="button" class="erp-btn erp-btn-outline" id="saleResetBtn">Làm mới Hóa đơn</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Lịch sử Hóa Đơn Bán Hàng &amp; Thu Công Nợ</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="saleSearchQ" class="admin-input" style="width:200px;" placeholder="Tìm mã HĐ, khách, SĐT..." />
            <select id="saleFilterChannel" class="admin-select" style="width:130px;">
              <option value="">Tất cả kênh</option>
              <option value="POS">POS</option>
              <option value="B2B">B2B</option>
              <option value="WEB3D">WEB3D</option>
            </select>
            <select id="saleFilterPay" class="admin-select" style="width:155px;">
              <option value="">Tất cả TT thanh toán</option>
              <option value="PAID">Đã TT đủ</option>
              <option value="PARTIAL">TT một phần</option>
              <option value="UNPAID">Chưa thanh toán</option>
            </select>
            <button type="button" class="erp-btn erp-btn-navy" id="saleSearchBtn">Lọc</button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã HĐ</th>
                <th>Ngày lập</th>
                <th>Khách hàng</th>
                <th>Kho xuất / Kênh</th>
                <th class="num">SL</th>
                <th class="num">Tổng tiền</th>
                <th class="num">Còn nợ (AR)</th>
                <th>TT / Giao vận</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="saleTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('saleCustSel').onchange = () => {
      updateCustomerHintAndPrices();
      renderSaleLines();
    };
    document.getElementById('saleWhSel').onchange = () => renderSaleLines();
    document.getElementById('saleVat').onchange = updateSaleTotals;
    document.getElementById('saleShipFee').oninput = updateSaleTotals;
    document.getElementById('salePaidAmt').oninput = updateSaleTotals;
    document.getElementById('salePayMethod').onchange = (e) => {
      if (e.target.value === 'DEBT') {
        document.getElementById('salePaidAmt').value = '0';
        updateSaleTotals();
      }
    };
    document.getElementById('saleAddLineBtn').onclick = () => {
      const cust = getCustomerById(document.getElementById('saleCustSel').value);
      saleLines.push(makeSaleLine(null, cust));
      renderSaleLines();
    };
    document.getElementById('saleSmartRouteBtn').onclick = runSmartWarehouseRouting;
    document.getElementById('saleForm').onsubmit = handleSubmitSale;
    document.getElementById('saleResetBtn').onclick = resetSaleForm;
    document.getElementById('saleSearchBtn').onclick = loadSalesTable;
  }

  populateSaleSelects();
  if (!saleLines.length) {
    const cust = getCustomerById(document.getElementById('saleCustSel').value);
    saleLines = [makeSaleLine(ERP.productsCache[0], cust)];
  }
  updateCustomerHintAndPrices(false);
  renderSaleLines();
  await loadSalesTable();
}

function populateSaleSelects() {
  document.getElementById('saleCustSel').innerHTML = (ERP.customersCache || [])
    .map((c) => `<option value="${c.id}">[${c.customer_type}] ${esc(c.name)} — ${esc(c.phone)} (${esc(c.region)})</option>`)
    .join('');
  document.getElementById('saleWhSel').innerHTML = (ERP.meta.warehouses || [])
    .map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)} (${esc(w.region)})</option>`)
    .join('');
  if (ERP.user?.warehouse_id) {
    document.getElementById('saleWhSel').value = String(ERP.user.warehouse_id);
  }
}

function updateCustomerHintAndPrices(repriceLines = true) {
  const cust = getCustomerById(document.getElementById('saleCustSel')?.value);
  const info = document.getElementById('saleCustInfo');
  if (!cust || !info) return;
  const remCredit = Math.max(0, Number(cust.credit_limit) - Number(cust.receivable_debt));
  info.textContent = `Hạng: ${cust.customer_type} • Khu vực: ${cust.region} • Nợ hiện tại: ${vnd(cust.receivable_debt)} / Hạn mức: ${vnd(cust.credit_limit)} (Còn cấp TD: ${vnd(remCredit)})`;

  if (cust.customer_type === 'B2B') {
    document.getElementById('saleChannelSel').value = 'B2B';
  }
  if (repriceLines) {
    saleLines.forEach((l) => {
      const p = ERP.productsCache.find((x) => x.id === Number(l.product_id));
      if (p) {
        l.unit_price = getEffectiveUnitPrice(p, cust);
        l.discount_pct = cust.customer_type === 'VIP' ? 3 : 0;
      }
    });
  }
}

async function runSmartWarehouseRouting() {
  const cust = getCustomerById(document.getElementById('saleCustSel').value);
  const region = cust?.region || 'Miền Bắc';
  const reqItems = saleLines.map((l) => ({ product_id: Number(l.product_id), qty: Number(l.qty || 1) }));
  const qs = new URLSearchParams({ region, items: JSON.stringify(reqItems) });
  try {
    const res = await apiFetch(`/api/sales/suggest-warehouse?${qs.toString()}`);
    if (res.recommended) {
      document.getElementById('saleWhSel').value = String(res.recommended.id);
      renderSaleLines();
      const note = res.canFulfillAll
        ? `Smart Routing chọn ${res.recommended.code} — ${res.recommended.name} (khớp khu vực ${region} & đủ 100% tồn kho khả dụng).`
        : `Đề xuất ${res.recommended.code} — ${res.recommended.name}, nhưng có mặt hàng chưa đủ tồn để xuất toàn bộ.`;
      setBanner('saleFormBanner', res.canFulfillAll ? 'ok' : 'err', note);
      showToast(note, res.canFulfillAll ? 'ok' : 'info');
    }
  } catch (err) {
    setBanner('saleFormBanner', 'err', err.message);
  }
}

function renderSaleLines() {
  const tbody = document.getElementById('saleLinesBody');
  const whId = Number(document.getElementById('saleWhSel')?.value || 1);
  const cust = getCustomerById(document.getElementById('saleCustSel')?.value);

  const prodOpts = ERP.productsCache
    .map((p) => `<option value="${p.id}">[${esc(p.sku)}] ${esc(p.name)} (Kho chọn: ${getWhAvail(p, whId)})</option>`)
    .join('');

  tbody.innerHTML = saleLines.map((row, idx) => {
    const prod = ERP.productsCache.find((x) => x.id === Number(row.product_id));
    const avail = getWhAvail(prod, whId);
    const over = Number(row.qty || 0) > avail;
    const gross = Number(row.qty || 0) * Number(row.unit_price || 0);
    const lineTotal = gross - Math.round(gross * Number(row.discount_pct || 0) / 100);
    return `
      <tr style="${over ? 'background:#fff1f2;' : ''}">
        <td><select class="admin-select" data-sline-prod="${idx}">${prodOpts}</select></td>
        <td class="num"><span class="erp-badge ${over ? 'danger' : avail > 0 ? 'ok' : 'warn'}">${num(avail)}</span></td>
        <td><input type="number" class="admin-input" min="1" max="100000" value="${row.qty}" data-sline-qty="${idx}" style="${over ? 'border-color:#be123c;' : ''}" /></td>
        <td><input type="number" class="admin-input" min="0" step="1" value="${row.unit_price}" data-sline-price="${idx}" /></td>
        <td><input type="number" class="admin-input" min="0" max="100" step="0.5" value="${row.discount_pct}" data-sline-disc="${idx}" /></td>
        <td><input type="text" class="admin-input" placeholder="SN-..." value="${esc(row.serial_numbers)}" data-sline-sn="${idx}" /></td>
        <td class="num" style="font-weight:800;">${vnd(lineTotal)}</td>
        <td><button type="button" class="erp-btn sm erp-btn-danger" data-sline-del="${idx}">&times;</button></td>
      </tr>`;
  }).join('');

  saleLines.forEach((row, idx) => {
    const sel = tbody.querySelector(`[data-sline-prod="${idx}"]`);
    if (sel) {
      sel.value = String(row.product_id);
      sel.onchange = () => {
        row.product_id = Number(sel.value);
        const p = ERP.productsCache.find((x) => x.id === row.product_id);
        row.unit_price = getEffectiveUnitPrice(p, cust);
        renderSaleLines();
      };
    }
    tbody.querySelector(`[data-sline-qty="${idx}"]`).oninput = (e) => {
      row.qty = Math.max(1, Number(e.target.value || 1));
      renderSaleLines();
    };
    tbody.querySelector(`[data-sline-price="${idx}"]`).oninput = (e) => {
      row.unit_price = Math.max(0, Number(e.target.value || 0));
      updateSaleTotals();
      const tr = tbody.children[idx];
      if (tr) {
        const g = row.qty * row.unit_price;
        tr.children[6].textContent = vnd(g - Math.round(g * row.discount_pct / 100));
      }
    };
    tbody.querySelector(`[data-sline-disc="${idx}"]`).oninput = (e) => {
      row.discount_pct = Math.min(100, Math.max(0, Number(e.target.value || 0)));
      updateSaleTotals();
      const tr = tbody.children[idx];
      if (tr) {
        const g = row.qty * row.unit_price;
        tr.children[6].textContent = vnd(g - Math.round(g * row.discount_pct / 100));
      }
    };
    tbody.querySelector(`[data-sline-sn="${idx}"]`).oninput = (e) => { row.serial_numbers = e.target.value.trim(); };
    tbody.querySelector(`[data-sline-del="${idx}"]`).onclick = () => {
      if (saleLines.length <= 1) return;
      saleLines.splice(idx, 1);
      renderSaleLines();
    };
  });

  updateSaleTotals();
}

function calcSaleTotals() {
  const subtotal = saleLines.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_price || 0), 0);
  const discount = saleLines.reduce((s, l) => s + Math.round(Number(l.qty || 0) * Number(l.unit_price || 0) * Number(l.discount_pct || 0) / 100), 0);
  const vatRate = Number(document.getElementById('saleVat')?.value || 0);
  const vat = Math.round((subtotal - discount) * vatRate / 100);
  const ship = Math.max(0, Number(document.getElementById('saleShipFee')?.value || 0));
  const total = subtotal - discount + vat + ship;
  const rawPaid = document.getElementById('salePaidAmt')?.value;
  const paid = rawPaid === '' || rawPaid === undefined ? total : Math.min(total, Math.max(0, Number(rawPaid)));
  const debt = Math.max(0, total - paid);
  return { subtotal, discount, vat, ship, total, paid, debt };
}

function updateSaleTotals() {
  const t = calcSaleTotals();
  document.getElementById('saleTotalsPanel').innerHTML = `
    <div class="erp-total-cell"><small>Tạm tính</small><strong>${vnd(t.subtotal)}</strong></div>
    <div class="erp-total-cell"><small>CK / VAT / Ship</small><strong>-${vnd(t.discount)} / +${vnd(t.vat + t.ship)}</strong></div>
    <div class="erp-total-cell highlight"><small>Tổng hóa đơn bán</small><strong>${vnd(t.total)}</strong></div>
    <div class="erp-total-cell"><small>Thu ngay / Công nợ phải thu</small><strong>${vnd(t.paid)} / <span style="color:${t.debt > 0 ? '#be123c' : '#047857'};">${vnd(t.debt)}</span></strong></div>
  `;
}

function resetSaleForm() {
  document.getElementById('saleForm').reset();
  const cust = getCustomerById(document.getElementById('saleCustSel').value);
  saleLines = [makeSaleLine(ERP.productsCache[0], cust)];
  setBanner('saleFormBanner', '', '');
  renderSaleLines();
}

async function handleSubmitSale(e) {
  e.preventDefault();
  setBanner('saleFormBanner', '', '');
  const t = calcSaleTotals();
  const rawPaid = document.getElementById('salePaidAmt').value;
  if (rawPaid !== '' && Number(rawPaid) > t.total) {
    setBanner('saleFormBanner', 'err', 'Số tiền khách thanh toán không được lớn hơn tổng hóa đơn.');
    return;
  }

  const btn = document.getElementById('saleSubmitBtn');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/sales', {
      method: 'POST',
      body: {
        customer_id: Number(document.getElementById('saleCustSel').value),
        warehouse_id: Number(document.getElementById('saleWhSel').value),
        sales_channel: document.getElementById('saleChannelSel').value,
        payment_method: document.getElementById('salePayMethod').value,
        fulfillment_status: document.getElementById('saleFulfillSel').value,
        vat_rate: Number(document.getElementById('saleVat').value),
        shipping_fee: Number(document.getElementById('saleShipFee').value || 0),
        paid_amount: rawPaid === '' ? t.total : Number(rawPaid),
        note: document.getElementById('saleNote').value.trim(),
        items: saleLines
      }
    });
    showToast(res.message || 'Đã xuất hóa đơn thành công.', 'ok');
    resetSaleForm();
    await Promise.all([refreshProductsCache(), refreshCustomersCache()]);
    populateSaleSelects();
    updateCustomerHintAndPrices(false);
    renderSaleLines();
    await loadSalesTable();
  } catch (err) {
    setBanner('saleFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function loadSalesTable() {
  const qs = new URLSearchParams();
  const q = document.getElementById('saleSearchQ')?.value?.trim();
  const ch = document.getElementById('saleFilterChannel')?.value;
  const pay = document.getElementById('saleFilterPay')?.value;
  if (q) qs.set('q', q);
  if (ch) qs.set('sales_channel', ch);
  if (pay) qs.set('payment_status', pay);

  const res = await apiFetch(`/api/sales?${qs.toString()}`);
  salesList = res.items || [];
  const tbody = document.getElementById('saleTableBody');
  if (!salesList.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--erp-muted);">Chưa có hóa đơn bán nào khớp lọc.</td></tr>';
    return;
  }
  tbody.innerHTML = salesList.map((s) => `
    <tr>
      <td><b>${esc(s.invoice_code)}</b></td>
      <td>${esc(s.created_at)}</td>
      <td>
        <div style="font-weight:800;">${esc(s.customer_name)}</div>
        <div style="font-size:0.71rem;color:var(--erp-muted);">${esc(s.customer_phone)} • ${esc(s.customer_type)}</div>
      </td>
      <td>
        <span class="erp-badge navy">${esc(s.sales_channel)}</span>
        <div style="font-size:0.72rem;color:var(--erp-muted);margin-top:3px;">${esc(s.warehouse_code)}</div>
      </td>
      <td class="num"><b>${num(s.total_qty)}</b></td>
      <td class="num">
        <b>${vnd(s.total_amount)}</b>
        <div style="font-size:0.7rem;color:#047857;">Lãi: ${vnd(s.est_profit)}</div>
      </td>
      <td class="num" style="color:${s.debt_amount > 0 ? '#be123c' : '#047857'};font-weight:800;">${vnd(s.debt_amount)}</td>
      <td>
        <div>${paymentBadge(s.payment_status)}</div>
        <div style="margin-top:4px;">${fulfillmentBadge(s.fulfillment_status)}</div>
      </td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="erp-btn sm erp-btn-outline" data-view-sale="${s.id}">Xem / In A4</button>
        ${s.debt_amount > 0 ? `<button type="button" class="erp-btn sm erp-btn-ok" data-collect-sale="${s.id}">Thu nợ</button>` : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-view-sale]').forEach((b) => {
    b.onclick = () => viewSaleDetail(Number(b.dataset.viewSale));
  });
  tbody.querySelectorAll('[data-collect-sale]').forEach((b) => {
    b.onclick = () => {
      const inv = salesList.find((x) => x.id === Number(b.dataset.collectSale));
      if (!inv) return;
      openPaymentModal({
        direction: 'RECEIPT_FROM_CUSTOMER',
        entityId: inv.customer_id,
        entityName: inv.customer_name,
        currentDebt: inv.debt_amount,
        refId: inv.id,
        refCode: inv.invoice_code,
        onDone: async () => {
          await refreshCustomersCache();
          populateSaleSelects();
          updateCustomerHintAndPrices(false);
          await loadSalesTable();
        }
      });
    };
  });
}

export async function viewSaleDetail(id) {
  const res = await apiFetch(`/api/sales/${id}`);
  const s = res.item;
  const rows = (s.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>
        <b>${esc(it.sku)}</b> — ${esc(it.product_name)}
        ${it.serial_numbers ? `<div style="font-size:0.71rem;color:#0369a1;">Serial: ${esc(it.serial_numbers)}</div>` : ''}
      </td>
      <td class="num">${it.warranty_months}T</td>
      <td class="num">${num(it.qty)}</td>
      <td class="num">${vnd(it.unit_price)}</td>
      <td class="num">${it.discount_pct}%</td>
      <td class="num"><b>${vnd(it.line_total)}</b></td>
    </tr>`).join('');

  openDetailModal(`Hóa Đơn Bán Hàng ${s.invoice_code}`, `
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #071a33;padding-bottom:12px;margin-bottom:14px;">
      <div>
        <div style="font-size:1.1rem;font-weight:800;color:#071a33;">SKYCRUMB STUDIO — HÓA ĐƠN BÁN HÀNG &amp; BẢO HÀNH</div>
        <div style="font-size:0.78rem;color:#476282;">Kênh bán: ${esc(s.sales_channel)} • Bảo hành điện tử chính hãng</div>
      </div>
      <div style="text-align:right;font-size:0.8rem;">
        <div><b>Mã hóa đơn:</b> ${esc(s.invoice_code)}</div>
        <div><b>Ngày lập:</b> ${esc(s.created_at)}</div>
        <div><b>NV bán hàng:</b> ${esc(s.created_by_name)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:0.81rem;background:#f8fbfe;padding:12px;border-radius:10px;border:1px solid #d7e4f2;">
      <div>
        <div><b>Khách hàng:</b> ${esc(s.customer_name)} (${esc(s.customer_type)})</div>
        <div><b>SĐT / Email:</b> ${esc(s.customer_phone)} ${s.customer_email ? '• ' + esc(s.customer_email) : ''}</div>
        <div><b>Địa chỉ:</b> ${esc(s.customer_address || '---')}</div>
      </div>
      <div>
        <div><b>Kho xuất:</b> ${esc(s.warehouse_code)} — ${esc(s.warehouse_name)}</div>
        <div><b>Phương thức TT:</b> ${esc(s.payment_method)}</div>
        <div><b>Trạng thái:</b> ${esc(s.payment_status)} / ${esc(s.fulfillment_status)}</div>
      </div>
    </div>
    <table class="admin-data-table" style="margin-bottom:14px;">
      <thead><tr><th>#</th><th>Sản phẩm / Serial</th><th class="num">BH</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">CK</th><th class="num">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;font-size:0.85rem;line-height:1.7;">
      <div>Tạm tính: <b>${vnd(s.subtotal)}</b> • Giảm giá: <b>-${vnd(s.discount_amount)}</b> • Ship: <b>+${vnd(s.shipping_fee)}</b> • VAT: <b>+${vnd(s.vat_amount)}</b></div>
      <div style="font-size:1.05rem;color:#0369a1;">TỔNG THANH TOÁN: <b>${vnd(s.total_amount)}</b></div>
      <div>Đã thu: <b>${vnd(s.paid_amount)}</b> • Công nợ còn lại: <b style="color:#be123c;">${vnd(s.debt_amount)}</b></div>
    </div>
  `);
}

/* ============================================================================
 *  TAB 5: OMNICHANNEL ORDERS FULFILLMENT QUEUE (WEB3D / B2B / POS)
 * ============================================================================ */
export async function renderOrdersTab() {
  const host = document.getElementById('tab-orders');
  if (!ordersInit) {
    ordersInit = true;
    const whOpts = (ERP.meta.warehouses || []).map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)}</option>`).join('');
    host.innerHTML = `
      <div class="admin-summary-cards" id="ordKpiHost"></div>
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Điều phối &amp; Xử lý Đơn hàng Đa kênh (Web 3D Storefront / B2B / POS)</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="ordQ" class="admin-input" style="width:190px;" placeholder="Mã đơn, tên khách, SĐT..." />
            <select id="ordChannel" class="admin-select" style="width:130px;">
              <option value="">Tất cả kênh</option>
              <option value="WEB3D">WEB3D Online</option>
              <option value="B2B">B2B Dự án</option>
              <option value="POS">POS Showroom</option>
            </select>
            <select id="ordFulfill" class="admin-select" style="width:165px;">
              <option value="">Tất cả trạng thái</option>
              <option value="PROCESSING">Đang xử lý / Lab</option>
              <option value="DELIVERED">Đang giao vận</option>
              <option value="COMPLETED">Hoàn tất</option>
            </select>
            <select id="ordWh" class="admin-select" style="width:190px;">
              <option value="">Tất cả 5 Kho</option>
              ${whOpts}
            </select>
            <button type="button" class="erp-btn erp-btn-navy" id="ordSearchBtn">Lọc đơn</button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã Đơn</th>
                <th>Kênh</th>
                <th>Khách hàng</th>
                <th>Kho điều phối</th>
                <th class="num">Tổng tiền</th>
                <th>Thanh toán</th>
                <th>Tiến độ xử lý</th>
                <th style="text-align:right;">Chuyển trạng thái</th>
              </tr>
            </thead>
            <tbody id="ordTableBody"></tbody>
          </table>
        </div>
      </div>
    `;
    document.getElementById('ordSearchBtn').onclick = loadOrdersTable;
  }

  await loadOrdersTable();
}

async function loadOrdersTable() {
  const qs = new URLSearchParams();
  const q = document.getElementById('ordQ')?.value?.trim();
  const ch = document.getElementById('ordChannel')?.value;
  const ful = document.getElementById('ordFulfill')?.value;
  const wh = document.getElementById('ordWh')?.value;
  if (q) qs.set('q', q);
  if (ch) qs.set('sales_channel', ch);
  if (ful) qs.set('fulfillment_status', ful);
  if (wh) qs.set('warehouse_id', wh);

  const res = await apiFetch(`/api/sales?${qs.toString()}`);
  ordersList = res.items || [];

  const procCnt = ordersList.filter((o) => o.fulfillment_status === 'PROCESSING').length;
  const delCnt = ordersList.filter((o) => o.fulfillment_status === 'DELIVERED').length;
  const compCnt = ordersList.filter((o) => o.fulfillment_status === 'COMPLETED').length;
  const webCnt = ordersList.filter((o) => o.sales_channel === 'WEB3D').length;

  document.getElementById('ordKpiHost').innerHTML = `
    <div class="sales-stat-card warn"><div class="sales-stat-label">Đang xử lý / Stress-Test</div><div class="sales-stat-value">${procCnt}</div><div class="sales-stat-sub">Chờ kỹ thuật &amp; đóng gói</div></div>
    <div class="sales-stat-card"><div class="sales-stat-label">Đang vận chuyển</div><div class="sales-stat-value">${delCnt}</div><div class="sales-stat-sub">Đã bàn giao vận đơn</div></div>
    <div class="sales-stat-card ok"><div class="sales-stat-label">Đã hoàn tất giao</div><div class="sales-stat-value">${compCnt}</div><div class="sales-stat-sub">Kích hoạt bảo hành 36T</div></div>
    <div class="sales-stat-card navy"><div class="sales-stat-label">Đơn Storefront Web 3D</div><div class="sales-stat-value">${webCnt}</div><div class="sales-stat-sub">Đồng bộ trực tiếp từ giỏ hàng</div></div>
  `;

  const tbody = document.getElementById('ordTableBody');
  if (!ordersList.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--erp-muted);">Không có đơn hàng nào khớp bộ lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = ordersList.map((o) => `
    <tr>
      <td><b>${esc(o.invoice_code)}</b><div style="font-size:0.7rem;color:var(--erp-muted);">${esc(o.created_at)}</div></td>
      <td><span class="erp-badge ${o.sales_channel === 'WEB3D' ? 'info' : o.sales_channel === 'B2B' ? 'navy' : 'ok'}">${esc(o.sales_channel)}</span></td>
      <td><b>${esc(o.customer_name)}</b><div style="font-size:0.71rem;color:var(--erp-muted);">${esc(o.customer_phone)}</div></td>
      <td><b>${esc(o.warehouse_code)}</b><div style="font-size:0.71rem;color:var(--erp-muted);">${esc(o.warehouse_name)}</div></td>
      <td class="num"><b>${vnd(o.total_amount)}</b></td>
      <td>${paymentBadge(o.payment_status)}</td>
      <td>${fulfillmentBadge(o.fulfillment_status)}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="erp-btn sm erp-btn-outline" data-ord-view="${o.id}">Chi tiết</button>
        ${o.fulfillment_status === 'PROCESSING' ? `<button type="button" class="erp-btn sm erp-btn-primary" data-ord-next="${o.id}" data-next-st="DELIVERED">Giao vận</button>` : ''}
        ${o.fulfillment_status !== 'COMPLETED' ? `<button type="button" class="erp-btn sm erp-btn-ok" data-ord-next="${o.id}" data-next-st="COMPLETED">Hoàn tất</button>` : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-ord-view]').forEach((b) => {
    b.onclick = () => viewSaleDetail(Number(b.dataset.ordView));
  });
  tbody.querySelectorAll('[data-ord-next]').forEach((b) => {
    b.onclick = async () => {
      try {
        const r = await apiFetch(`/api/sales/${b.dataset.ordNext}/fulfillment`, {
          method: 'PATCH',
          body: { fulfillment_status: b.dataset.nextSt }
        });
        showToast(r.message || 'Đã cập nhật tiến độ đơn.', 'ok');
        await loadOrdersTable();
      } catch (err) {
        showToast(err.message, 'err');
      }
    };
  });
}
