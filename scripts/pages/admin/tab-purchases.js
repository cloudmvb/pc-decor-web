import {
  ERP,
  apiFetch,
  refreshProductsCache,
  refreshSuppliersCache,
  esc,
  vnd,
  num,
  showToast,
  setBanner,
  openDetailModal,
  openPaymentModal,
  paymentBadge
} from './api.js';

let init = false;
let lineRows = [];
let purchasesList = [];
let ropList = [];

function createEmptyLine(prod = null, qty = 5) {
  return {
    product_id: prod ? prod.id : (ERP.productsCache[0]?.id || ''),
    qty: qty || 1,
    unit_cost: prod ? Number(prod.cost_price || 0) : Number(ERP.productsCache[0]?.cost_price || 0),
    discount_pct: 0,
    bin_location: prod?.wh_bin_location || 'A01-R01-B01'
  };
}

export async function renderPurchasesTab(opts = {}) {
  const host = document.getElementById('tab-purchases');
  if (!ERP.productsCache.length) await refreshProductsCache();
  await refreshSuppliersCache();

  if (!init) {
    init = true;
    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Đề xuất Nhập hàng Tự động theo Điểm Đặt Hàng (Auto-ROP)</h2>
          <span class="admin-card-sub" id="ropCountSub">Đang quét tồn kho 5 Hub...</span>
        </div>
        <div class="rop-strip" id="ropStripHost"></div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Lập Phiếu Nhập Hàng (Đa Dòng • Cộng Tồn &amp; Tính Giá Vốn Bình Quân MAC)</h2>
          <span class="admin-card-sub">Giao dịch ACID: Lưu phiếu nhập + Tăng tồn kho + Ghi sổ cái PURCHASE_IN + Cập nhật công nợ NCC</span>
        </div>
        <div id="purFormBanner" class="erp-alert-banner"></div>
        <form id="purForm">
          <div class="admin-form-grid">
            <div class="admin-field span-2">
              <label>Nhà cung cấp <span class="req">*</span></label>
              <select id="purSupSel" class="admin-select" required></select>
            </div>
            <div class="admin-field">
              <label>Kho nhận hàng <span class="req">*</span></label>
              <select id="purWhSel" class="admin-select" required></select>
            </div>
            <div class="admin-field">
              <label>Số hóa đơn đỏ / PO NCC</label>
              <input type="text" id="purSupInv" class="admin-input" placeholder="VD: HD-NCC-2026-089" />
            </div>
            <div class="admin-field">
              <label>Thuế suất VAT (%)</label>
              <select id="purVat" class="admin-select">
                <option value="8" selected>VAT 8%</option>
                <option value="10">VAT 10%</option>
                <option value="0">Không VAT (0%)</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Phương thức thanh toán</label>
              <select id="purPayMethod" class="admin-select">
                <option value="BANK_TRANSFER">Chuyển khoản Ngân hàng</option>
                <option value="CASH">Tiền mặt</option>
                <option value="DEBT_30D">Ghi công nợ theo hạn thanh toán</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Số tiền thanh toán ngay (VNĐ)</label>
              <input type="number" id="purPaidAmt" class="admin-input" min="0" step="1" placeholder="Để trống = trả đủ 100%" />
            </div>
            <div class="admin-field">
              <label>Ghi chú nhập kho</label>
              <input type="text" id="purNote" class="admin-input" placeholder="Lô nhập hàng bổ sung quý..." />
            </div>
          </div>

          <div style="margin-top:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <strong style="font-size:0.82rem;text-transform:uppercase;color:var(--erp-ink);">Danh sách Sản phẩm nhập kho</strong>
              <button type="button" class="erp-btn sm erp-btn-outline" id="purAddLineBtn">+ Thêm dòng sản phẩm</button>
            </div>
            <div class="admin-table-wrap">
              <table class="erp-lines-table">
                <thead>
                  <tr>
                    <th style="width:36%;">Sản phẩm (SKU - Tên)</th>
                    <th style="width:11%;">Số lượng</th>
                    <th style="width:16%;">Đơn giá nhập (VNĐ)</th>
                    <th style="width:10%;">CK (%)</th>
                    <th style="width:12%;">Vị trí kệ (Bin)</th>
                    <th class="num" style="width:12%;">Thành tiền</th>
                    <th style="width:3%;"></th>
                  </tr>
                </thead>
                <tbody id="purLinesBody"></tbody>
              </table>
            </div>
          </div>

          <div class="erp-totals-panel" id="purTotalsPanel"></div>

          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="purSubmitBtn">Lưu Phiếu Nhập &amp; Cộng Tồn Kho</button>
            <button type="button" class="erp-btn erp-btn-outline" id="purResetBtn">Làm mới Phiếu</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Lịch sử Phiếu Nhập Hàng &amp; Công nợ Nhà cung cấp</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="purSearchQ" class="admin-input" style="width:210px;" placeholder="Tìm mã phiếu, NCC, kho..." />
            <select id="purFilterPay" class="admin-select" style="width:165px;">
              <option value="">Tất cả TT thanh toán</option>
              <option value="PAID">Đã thanh toán đủ</option>
              <option value="PARTIAL">Thanh toán 1 phần</option>
              <option value="UNPAID">Còn nợ toàn bộ</option>
            </select>
            <button type="button" class="erp-btn erp-btn-navy" id="purSearchBtn">Lọc</button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã Phiếu</th>
                <th>Ngày lập</th>
                <th>Nhà cung cấp</th>
                <th>Kho nhận</th>
                <th class="num">SL nhập</th>
                <th class="num">Tổng tiền</th>
                <th class="num">Còn nợ NCC</th>
                <th>Trạng thái</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="purTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('purAddLineBtn').onclick = () => {
      lineRows.push(createEmptyLine());
      renderLineItems();
    };
    document.getElementById('purWhSel').onchange = () => loadRopSuggestions();
    document.getElementById('purVat').onchange = updatePurchaseTotals;
    document.getElementById('purPaidAmt').oninput = updatePurchaseTotals;
    document.getElementById('purPayMethod').onchange = (e) => {
      if (e.target.value === 'DEBT_30D') {
        document.getElementById('purPaidAmt').value = '0';
        updatePurchaseTotals();
      }
    };
    document.getElementById('purForm').onsubmit = handleSubmitPurchase;
    document.getElementById('purResetBtn').onclick = resetPurchaseForm;
    document.getElementById('purSearchBtn').onclick = loadPurchasesTable;
  }

  populatePurchaseSelects();
  if (!lineRows.length) lineRows = [createEmptyLine()];

  // Optional quick preload when jumping from Analytics ROP table
  if (opts.preloadProductId) {
    const p = ERP.productsCache.find((x) => x.id === Number(opts.preloadProductId));
    if (p) {
      const qty = Math.max(p.min_reorder_level * 2 - p.total_available, 5);
      lineRows = [createEmptyLine(p, qty)];
      if (p.supplier_id) document.getElementById('purSupSel').value = String(p.supplier_id);
      setBanner('purFormBanner', 'info', `Đã nạp nhanh sản phẩm cảnh báo ROP: [${p.sku}] ${p.name} (đề xuất nhập ${qty}).`);
    }
  }

  renderLineItems();
  await Promise.all([loadRopSuggestions(), loadPurchasesTable()]);
}

function populatePurchaseSelects() {
  document.getElementById('purSupSel').innerHTML = (ERP.suppliersCache || [])
    .map((s) => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)} (Nợ: ${vnd(s.payable_debt)})</option>`)
    .join('');
  document.getElementById('purWhSel').innerHTML = (ERP.meta.warehouses || [])
    .map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)}</option>`)
    .join('');
  if (ERP.user?.warehouse_id) {
    document.getElementById('purWhSel').value = String(ERP.user.warehouse_id);
  }
}

function renderLineItems() {
  const tbody = document.getElementById('purLinesBody');
  const prodOptions = ERP.productsCache
    .map((p) => `<option value="${p.id}">[${esc(p.sku)}] ${esc(p.name)} (Tồn: ${p.total_available})</option>`)
    .join('');

  tbody.innerHTML = lineRows.map((row, idx) => {
    const gross = Number(row.qty || 0) * Number(row.unit_cost || 0);
    const lineTotal = gross - Math.round(gross * Number(row.discount_pct || 0) / 100);
    return `
      <tr>
        <td>
          <select class="admin-select" data-pline-prod="${idx}">${prodOptions}</select>
        </td>
        <td><input type="number" class="admin-input" min="1" max="100000" value="${row.qty}" data-pline-qty="${idx}" /></td>
        <td><input type="number" class="admin-input" min="0" step="1" value="${row.unit_cost}" data-pline-cost="${idx}" /></td>
        <td><input type="number" class="admin-input" min="0" max="100" step="0.5" value="${row.discount_pct}" data-pline-disc="${idx}" /></td>
        <td><input type="text" class="admin-input" value="${esc(row.bin_location)}" data-pline-bin="${idx}" /></td>
        <td class="num" style="font-weight:800;">${vnd(lineTotal)}</td>
        <td><button type="button" class="erp-btn sm erp-btn-danger" data-pline-del="${idx}" title="Xóa dòng">&times;</button></td>
      </tr>`;
  }).join('');

  lineRows.forEach((row, idx) => {
    const sel = tbody.querySelector(`[data-pline-prod="${idx}"]`);
    if (sel) {
      sel.value = String(row.product_id);
      sel.onchange = () => {
        row.product_id = Number(sel.value);
        const p = ERP.productsCache.find((x) => x.id === row.product_id);
        if (p) {
          row.unit_cost = Number(p.cost_price || 0);
          row.bin_location = p.wh_bin_location || 'A01-R01-B01';
        }
        renderLineItems();
      };
    }
    tbody.querySelector(`[data-pline-qty="${idx}"]`).oninput = (e) => { row.qty = Math.max(1, Number(e.target.value || 1)); updatePurchaseTotals(); renderLineTotalCell(idx); };
    tbody.querySelector(`[data-pline-cost="${idx}"]`).oninput = (e) => { row.unit_cost = Math.max(0, Number(e.target.value || 0)); updatePurchaseTotals(); renderLineTotalCell(idx); };
    tbody.querySelector(`[data-pline-disc="${idx}"]`).oninput = (e) => { row.discount_pct = Math.min(100, Math.max(0, Number(e.target.value || 0))); updatePurchaseTotals(); renderLineTotalCell(idx); };
    tbody.querySelector(`[data-pline-bin="${idx}"]`).oninput = (e) => { row.bin_location = e.target.value.trim() || 'A01-R01-B01'; };
    tbody.querySelector(`[data-pline-del="${idx}"]`).onclick = () => {
      if (lineRows.length <= 1) return;
      lineRows.splice(idx, 1);
      renderLineItems();
    };
  });

  updatePurchaseTotals();
}

function renderLineTotalCell(idx) {
  const row = lineRows[idx];
  const tr = document.getElementById('purLinesBody')?.children[idx];
  if (!row || !tr) return;
  const gross = Number(row.qty || 0) * Number(row.unit_cost || 0);
  const lineTotal = gross - Math.round(gross * Number(row.discount_pct || 0) / 100);
  tr.children[5].textContent = vnd(lineTotal);
}

function calcTotals() {
  const subtotal = lineRows.reduce((s, l) => s + Number(l.qty || 0) * Number(l.unit_cost || 0), 0);
  const discount = lineRows.reduce((s, l) => s + Math.round(Number(l.qty || 0) * Number(l.unit_cost || 0) * Number(l.discount_pct || 0) / 100), 0);
  const vatRate = Number(document.getElementById('purVat')?.value || 0);
  const vat = Math.round((subtotal - discount) * vatRate / 100);
  const total = subtotal - discount + vat;
  const rawPaid = document.getElementById('purPaidAmt')?.value;
  const paid = rawPaid === '' || rawPaid === undefined ? total : Math.min(total, Math.max(0, Number(rawPaid)));
  const debt = Math.max(0, total - paid);
  return { subtotal, discount, vat, total, paid, debt };
}

function updatePurchaseTotals() {
  const t = calcTotals();
  document.getElementById('purTotalsPanel').innerHTML = `
    <div class="erp-total-cell"><small>Tạm tính hàng hóa</small><strong>${vnd(t.subtotal)}</strong></div>
    <div class="erp-total-cell"><small>Chiết khấu / VAT</small><strong>-${vnd(t.discount)} / +${vnd(t.vat)}</strong></div>
    <div class="erp-total-cell highlight"><small>Tổng thanh toán phiếu nhập</small><strong>${vnd(t.total)}</strong></div>
    <div class="erp-total-cell"><small>Thanh toán ngay / Ghi nợ NCC</small><strong>${vnd(t.paid)} / <span style="color:${t.debt > 0 ? '#be123c' : '#047857'};">${vnd(t.debt)}</span></strong></div>
  `;
}

function resetPurchaseForm() {
  document.getElementById('purForm').reset();
  document.getElementById('purVat').value = '8';
  lineRows = [createEmptyLine()];
  setBanner('purFormBanner', '', '');
  renderLineItems();
}

async function handleSubmitPurchase(e) {
  e.preventDefault();
  setBanner('purFormBanner', '', '');
  const t = calcTotals();
  const rawPaid = document.getElementById('purPaidAmt').value;
  if (rawPaid !== '' && Number(rawPaid) > t.total) {
    setBanner('purFormBanner', 'err', 'Số tiền thanh toán ngay không được vượt quá tổng giá trị phiếu nhập.');
    return;
  }

  const btn = document.getElementById('purSubmitBtn');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/purchases', {
      method: 'POST',
      body: {
        supplier_id: Number(document.getElementById('purSupSel').value),
        warehouse_id: Number(document.getElementById('purWhSel').value),
        supplier_invoice_no: document.getElementById('purSupInv').value.trim(),
        vat_rate: Number(document.getElementById('purVat').value),
        payment_method: document.getElementById('purPayMethod').value,
        paid_amount: rawPaid === '' ? t.total : Number(rawPaid),
        note: document.getElementById('purNote').value.trim(),
        items: lineRows
      }
    });
    showToast(res.message || 'Đã lưu phiếu nhập hàng.', 'ok');
    resetPurchaseForm();
    await Promise.all([refreshProductsCache(), refreshSuppliersCache()]);
    populatePurchaseSelects();
    await Promise.all([loadRopSuggestions(), loadPurchasesTable()]);
  } catch (err) {
    setBanner('purFormBanner', 'err', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function loadRopSuggestions() {
  const whId = document.getElementById('purWhSel')?.value || '';
  const res = await apiFetch(`/api/purchases/reorder-suggestions${whId ? `?warehouse_id=${encodeURIComponent(whId)}` : ''}`);
  ropList = res.items || [];
  document.getElementById('ropCountSub').textContent = ropList.length
    ? `${ropList.length} SKU đang dưới ngưỡng ROP tại kho nhận — bấm để nạp ngay vào phiếu nhập`
    : 'Toàn bộ sản phẩm tại kho này đều đạt mức tồn an toàn';

  const host = document.getElementById('ropStripHost');
  if (!ropList.length) {
    host.innerHTML = '<div style="font-size:0.81rem;color:var(--erp-ok);font-weight:700;padding:8px 0;">Không có SKU nào dưới ngưỡng ROP.</div>';
    return;
  }
  host.innerHTML = ropList.slice(0, 12).map((r) => `
    <div class="rop-chip">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;">
        <span class="erp-badge ${r.qty_available === 0 ? 'danger' : 'warn'}">Khả dụng: ${r.qty_available} / ROP ${r.min_reorder_level}</span>
        <span style="font-size:0.69rem;color:var(--erp-muted);font-weight:700;">Lead ${r.lead_time_days}d</span>
      </div>
      <div class="rop-chip-title">[${esc(r.sku)}] ${esc(r.name)}</div>
      <div class="rop-chip-meta">NCC: ${esc(r.supplier_name)} • Đề xuất nhập: <b>+${r.suggested_qty}</b></div>
      <button type="button" class="erp-btn sm erp-btn-primary" style="margin-top:auto;" data-rop-add="${r.product_id}">+ Đưa vào phiếu nhập (${r.suggested_qty})</button>
    </div>`).join('');

  host.querySelectorAll('[data-rop-add]').forEach((b) => {
    b.onclick = () => {
      const r = ropList.find((x) => x.product_id === Number(b.dataset.ropAdd));
      if (!r) return;
      const ex = lineRows.find((l) => l.product_id === r.product_id);
      if (ex) ex.qty += r.suggested_qty;
      else lineRows.push({ product_id: r.product_id, qty: r.suggested_qty, unit_cost: r.cost_price, discount_pct: 0, bin_location: r.bin_location });
      if (r.supplier_id) document.getElementById('purSupSel').value = String(r.supplier_id);
      renderLineItems();
      showToast(`Đã thêm [${r.sku}] x${r.suggested_qty} vào phiếu nhập.`, 'info');
    };
  });
}

async function loadPurchasesTable() {
  const qs = new URLSearchParams();
  const q = document.getElementById('purSearchQ')?.value?.trim();
  const pay = document.getElementById('purFilterPay')?.value;
  if (q) qs.set('q', q);
  if (pay) qs.set('payment_status', pay);

  const res = await apiFetch(`/api/purchases?${qs.toString()}`);
  purchasesList = res.items || [];
  const tbody = document.getElementById('purTableBody');
  if (!purchasesList.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:22px;color:var(--erp-muted);">Chưa có phiếu nhập nào khớp điều kiện lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = purchasesList.map((p) => `
    <tr>
      <td><b>${esc(p.receipt_code)}</b>${p.supplier_invoice_no ? `<div style="font-size:0.7rem;color:var(--erp-muted);">PO: ${esc(p.supplier_invoice_no)}</div>` : ''}</td>
      <td>${esc(p.created_at)}</td>
      <td><b>${esc(p.supplier_name)}</b></td>
      <td><span class="erp-badge info">${esc(p.warehouse_code)}</span> ${esc(p.warehouse_name)}</td>
      <td class="num"><b>${num(p.total_qty)}</b> (${p.line_count} dòng)</td>
      <td class="num"><b>${vnd(p.total_amount)}</b></td>
      <td class="num" style="color:${p.debt_amount > 0 ? '#be123c' : '#047857'};font-weight:800;">${vnd(p.debt_amount)}</td>
      <td>${paymentBadge(p.payment_status)}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="erp-btn sm erp-btn-outline" data-view-pur="${p.id}">Xem / In A4</button>
        ${p.debt_amount > 0 ? `<button type="button" class="erp-btn sm erp-btn-ok" data-pay-pur="${p.id}">Trả nợ</button>` : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-view-pur]').forEach((b) => {
    b.onclick = () => viewPurchaseDetail(Number(b.dataset.viewPur));
  });
  tbody.querySelectorAll('[data-pay-pur]').forEach((b) => {
    b.onclick = () => {
      const p = purchasesList.find((x) => x.id === Number(b.dataset.payPur));
      if (!p) return;
      openPaymentModal({
        direction: 'PAYMENT_TO_SUPPLIER',
        entityId: p.supplier_id,
        entityName: p.supplier_name,
        currentDebt: p.debt_amount,
        refId: p.id,
        refCode: p.receipt_code,
        onDone: async () => {
          await refreshSuppliersCache();
          populatePurchaseSelects();
          await loadPurchasesTable();
        }
      });
    };
  });
}

async function viewPurchaseDetail(id) {
  const res = await apiFetch(`/api/purchases/${id}`);
  const r = res.item;
  const rows = (r.items || []).map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><b>${esc(it.sku)}</b> — ${esc(it.product_name)}</td>
      <td>${esc(it.bin_location)}</td>
      <td class="num">${num(it.qty)}</td>
      <td class="num">${vnd(it.unit_cost)}</td>
      <td class="num">${it.discount_pct}%</td>
      <td class="num"><b>${vnd(it.line_total)}</b></td>
    </tr>`).join('');

  openDetailModal(`Phiếu Nhập Hàng ${r.receipt_code}`, `
    <div style="display:flex;justify-content:space-between;border-bottom:2px solid #071a33;padding-bottom:12px;margin-bottom:14px;">
      <div>
        <div style="font-size:1.1rem;font-weight:800;color:#071a33;">SKYCRUMB STUDIO — PHIẾU NHẬP KHO HÀNG HÓA</div>
        <div style="font-size:0.78rem;color:#476282;">Hệ thống Quản lý Đa kho Toàn quốc (5 Hubs)</div>
      </div>
      <div style="text-align:right;font-size:0.8rem;">
        <div><b>Số phiếu:</b> ${esc(r.receipt_code)}</div>
        <div><b>Ngày lập:</b> ${esc(r.created_at)}</div>
        <div><b>Người lập:</b> ${esc(r.created_by_name)}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;font-size:0.81rem;background:#f8fbfe;padding:12px;border-radius:10px;border:1px solid #d7e4f2;">
      <div>
        <div><b>Nhà cung cấp:</b> ${esc(r.supplier_name)}</div>
        <div><b>MST / SĐT:</b> ${esc(r.supplier_tax_code || '---')} • ${esc(r.supplier_phone)}</div>
        <div><b>Hóa đơn NCC:</b> ${esc(r.supplier_invoice_no || '---')}</div>
      </div>
      <div>
        <div><b>Kho nhập:</b> ${esc(r.warehouse_code)} — ${esc(r.warehouse_name)}</div>
        <div><b>Địa chỉ kho:</b> ${esc(r.warehouse_address)}</div>
        <div><b>Trạng thái TT:</b> ${esc(r.payment_status)}</div>
      </div>
    </div>
    <table class="admin-data-table" style="margin-bottom:14px;">
      <thead><tr><th>#</th><th>Sản phẩm</th><th>Kệ Bin</th><th class="num">SL</th><th class="num">Đơn giá</th><th class="num">CK</th><th class="num">Thành tiền</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="text-align:right;font-size:0.85rem;line-height:1.7;">
      <div>Tạm tính: <b>${vnd(r.subtotal)}</b> • Chiết khấu: <b>-${vnd(r.discount_amount)}</b> • VAT: <b>+${vnd(r.vat_amount)}</b></div>
      <div style="font-size:1.05rem;color:#0369a1;">TỔNG CỘNG: <b>${vnd(r.total_amount)}</b></div>
      <div>Đã thanh toán: <b>${vnd(r.paid_amount)}</b> • Còn nợ NCC: <b style="color:#be123c;">${vnd(r.debt_amount)}</b></div>
    </div>
  `);
}
