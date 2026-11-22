import {
  ERP,
  apiFetch,
  refreshProductsCache,
  hasPerm,
  esc,
  vnd,
  num,
  showToast,
  setBanner
} from './api.js';

let init = false;
let selectedWhId = '';
let activeSubView = 'matrix';
let currentMatrix = [];

function getProdAvailInWh(prodId, whId) {
  const p = ERP.productsCache.find((x) => Number(x.id) === Number(prodId));
  if (!p) return 0;
  const st = (p.warehouse_stocks || []).find((w) => Number(w.warehouse_id) === Number(whId));
  return st ? Number(st.qty_available || 0) : 0;
}

export async function renderInventoryTab() {
  const host = document.getElementById('tab-inventory');
  await refreshProductsCache();
  const canWrite = hasPerm(['INVENTORY']);

  if (!init) {
    init = true;
    const whOpts = (ERP.meta.warehouses || []).map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)}</option>`).join('');
    const catOpts = (ERP.meta.categories || []).map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');

    host.innerHTML = `
      <div class="wh-hub-grid" id="invWhCardsHost"></div>

      ${canWrite ? `
        <div class="sales-charts-row cols-2" style="grid-template-columns:1fr 1fr;">
          <div class="admin-card" style="margin-bottom:0;">
            <div class="admin-card-head">
              <h2 class="admin-card-title">Điều chuyển Liên kho (2 Bước: IN_TRANSIT &rarr; COMPLETED)</h2>
              <span class="admin-card-sub">Chặn xuất quá tồn khả dụng tại kho nguồn</span>
            </div>
            <div id="trFormBanner" class="erp-alert-banner"></div>
            <form id="trForm">
              <div class="admin-form-grid cols-2">
                <div class="admin-field">
                  <label>Kho xuất (Nguồn) <span class="req">*</span></label>
                  <select id="trFromWh" class="admin-select" required>${whOpts}</select>
                </div>
                <div class="admin-field">
                  <label>Kho nhận (Đích) <span class="req">*</span></label>
                  <select id="trToWh" class="admin-select" required>${whOpts}</select>
                </div>
                <div class="admin-field span-2">
                  <label>Sản phẩm cần điều chuyển <span class="req">*</span></label>
                  <select id="trProdSel" class="admin-select" required></select>
                  <div id="trAvailHint" style="font-size:0.72rem;color:var(--erp-sky-dark);font-weight:700;"></div>
                </div>
                <div class="admin-field">
                  <label>Số lượng chuyển <span class="req">*</span></label>
                  <input type="number" id="trQty" class="admin-input" min="1" max="50000" value="2" required />
                </div>
                <div class="admin-field">
                  <label>Chế độ xác nhận</label>
                  <select id="trStatus" class="admin-select">
                    <option value="IN_TRANSIT">Xuất đi đường (IN_TRANSIT — 2 bước)</option>
                    <option value="COMPLETED">Hoàn tất chuyển ngay (COMPLETED)</option>
                  </select>
                </div>
                <div class="admin-field span-2">
                  <label>Lý do điều chuyển <span class="req">*</span></label>
                  <input type="text" id="trReason" class="admin-input" value="Cân bằng tồn kho phục vụ đơn hàng liên vùng" required />
                </div>
              </div>
              <div class="admin-form-actions">
                <button type="submit" class="erp-btn erp-btn-primary" id="trSubmitBtn">Lập Phiếu Điều Chuyển</button>
              </div>
            </form>
          </div>

          <div class="admin-card" style="margin-bottom:0;">
            <div class="admin-card-head">
              <h2 class="admin-card-title">Kiểm kê &amp; Điều chỉnh Tồn kho (ADJUSTMENT)</h2>
              <span class="admin-card-sub">Cập nhật vị trí kệ Bin &amp; ghi nhận sổ cái kiểm kê</span>
            </div>
            <div id="adjFormBanner" class="erp-alert-banner"></div>
            <form id="adjForm">
              <div class="admin-form-grid cols-2">
                <div class="admin-field">
                  <label>Kho kiểm kê <span class="req">*</span></label>
                  <select id="adjWhSel" class="admin-select" required>${whOpts}</select>
                </div>
                <div class="admin-field">
                  <label>Vị trí kệ (Bin Location)</label>
                  <input type="text" id="adjBin" class="admin-input" value="A01-R01-B01" />
                </div>
                <div class="admin-field span-2">
                  <label>Sản phẩm kiểm kê <span class="req">*</span></label>
                  <select id="adjProdSel" class="admin-select" required></select>
                  <div id="adjCurrentHint" style="font-size:0.72rem;color:var(--erp-sky-dark);font-weight:700;"></div>
                </div>
                <div class="admin-field">
                  <label>Số lượng tồn vật lý thực tế <span class="req">*</span></label>
                  <input type="number" id="adjNewQty" class="admin-input" min="0" max="500000" value="10" required />
                </div>
                <div class="admin-field">
                  <label>Lý do kiểm kê / điều chỉnh <span class="req">*</span></label>
                  <input type="text" id="adjReason" class="admin-input" placeholder="VD: Kiểm kê định kỳ cuối tháng" required />
                </div>
              </div>
              <div class="admin-form-actions">
                <button type="submit" class="erp-btn erp-btn-navy" id="adjSubmitBtn">Ghi sổ Kiểm kê Kho</button>
              </div>
            </form>
          </div>
        </div>
      ` : '<div class="erp-alert-banner show info">Tài khoản của bạn có quyền xem tồn kho &amp; sổ cái đa điểm (INVENTORY_VIEW). Chức năng điều chuyển &amp; kiểm kê dành cho Quản trị &amp; Thủ kho.</div>'}

      <div class="admin-card" style="margin-top:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px;">
          <div class="erp-sub-pills" id="invSubPills">
            <button type="button" class="erp-sub-pill active" data-inv-view="matrix">Ma trận Tồn kho 5 Hub</button>
            <button type="button" class="erp-sub-pill" data-inv-view="transfers">Phiếu Điều chuyển Liên kho</button>
            <button type="button" class="erp-sub-pill" data-inv-view="ledger">Sổ cái Thẻ kho (Ledger)</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;" id="invFilterBar">
            <input type="text" id="invQ" class="admin-input" style="width:190px;" placeholder="Tìm SKU, tên SP, mã kệ..." />
            <select id="invWhFilter" class="admin-select" style="width:185px;">
              <option value="">Tất cả 5 Kho</option>
              ${whOpts}
            </select>
            <select id="invCatFilter" class="admin-select" style="width:165px;">
              <option value="">Tất cả Loại hàng</option>
              ${catOpts}
            </select>
            <label style="display:inline-flex;align-items:center;gap:5px;font-size:0.78rem;font-weight:700;cursor:pointer;">
              <input type="checkbox" id="invAlertOnly" /> Chỉ cảnh báo ROP
            </label>
            <button type="button" class="erp-btn erp-btn-navy" id="invFilterBtn">Lọc</button>
          </div>
        </div>
        <div id="invViewHost"></div>
      </div>
    `;

    if (canWrite) {
      document.getElementById('trToWh').value = String((ERP.meta.warehouses?.[1]?.id) || 2);
      document.getElementById('trFromWh').onchange = updateTransferHint;
      document.getElementById('trProdSel').onchange = updateTransferHint;
      document.getElementById('trForm').onsubmit = handleSubmitTransfer;

      document.getElementById('adjWhSel').onchange = updateAdjHint;
      document.getElementById('adjProdSel').onchange = updateAdjHint;
      document.getElementById('adjForm').onsubmit = handleSubmitAdjustment;
    }

    document.querySelectorAll('#invSubPills [data-inv-view]').forEach((b) => {
      b.onclick = () => {
        activeSubView = b.dataset.invView;
        document.querySelectorAll('#invSubPills [data-inv-view]').forEach((x) => x.classList.toggle('active', x === b));
        refreshCurrentSubView();
      };
    });
    document.getElementById('invFilterBtn').onclick = () => {
      selectedWhId = document.getElementById('invWhFilter').value;
      refreshCurrentSubView();
    };
  }

  populateInvProductSelects();
  await refreshCurrentSubView();
}

function populateInvProductSelects() {
  const opts = ERP.productsCache.map((p) => `<option value="${p.id}">[${esc(p.sku)}] ${esc(p.name)}</option>`).join('');
  const trSel = document.getElementById('trProdSel');
  const adjSel = document.getElementById('adjProdSel');
  if (trSel) {
    const prev = trSel.value;
    trSel.innerHTML = opts;
    if (prev) trSel.value = prev;
    updateTransferHint();
  }
  if (adjSel) {
    const prev = adjSel.value;
    adjSel.innerHTML = opts;
    if (prev) adjSel.value = prev;
    updateAdjHint();
  }
}

function updateTransferHint() {
  const whId = document.getElementById('trFromWh')?.value;
  const pid = document.getElementById('trProdSel')?.value;
  const avail = getProdAvailInWh(pid, whId);
  const el = document.getElementById('trAvailHint');
  if (el) el.textContent = `Tồn khả dụng tại kho nguồn đang chọn: ${num(avail)} đơn vị`;
}

function updateAdjHint() {
  const whId = document.getElementById('adjWhSel')?.value;
  const pid = document.getElementById('adjProdSel')?.value;
  const p = ERP.productsCache.find((x) => Number(x.id) === Number(pid));
  const st = (p?.warehouse_stocks || []).find((w) => Number(w.warehouse_id) === Number(whId));
  const onHand = Number(st?.qty_on_hand || 0);
  const resv = Number(st?.qty_reserved || 0);
  const el = document.getElementById('adjCurrentHint');
  if (el) el.textContent = `Hiện có: Tồn vật lý ${num(onHand)} • Giữ chỗ ${num(resv)} • Kệ ${st?.bin_location || 'A01-R01-B01'}`;
  const binEl = document.getElementById('adjBin');
  if (binEl && st?.bin_location) binEl.value = st.bin_location;
}

async function handleSubmitTransfer(e) {
  e.preventDefault();
  setBanner('trFormBanner', '', '');
  const from_warehouse_id = Number(document.getElementById('trFromWh').value);
  const to_warehouse_id = Number(document.getElementById('trToWh').value);
  if (from_warehouse_id === to_warehouse_id) {
    setBanner('trFormBanner', 'err', 'Kho xuất và Kho nhận phải là 2 kho khác nhau.');
    return;
  }
  const btn = document.getElementById('trSubmitBtn');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/transfers', {
      method: 'POST',
      body: {
        from_warehouse_id,
        to_warehouse_id,
        status: document.getElementById('trStatus').value,
        reason: document.getElementById('trReason').value.trim(),
        items: [{ product_id: Number(document.getElementById('trProdSel').value), qty: Number(document.getElementById('trQty').value) }]
      }
    });
    showToast(res.message || 'Đã lập phiếu điều chuyển.', 'ok');
    setBanner('trFormBanner', 'ok', res.message);
    await refreshProductsCache();
    populateInvProductSelects();
    await refreshCurrentSubView();
  } catch (err) {
    setBanner('trFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function handleSubmitAdjustment(e) {
  e.preventDefault();
  setBanner('adjFormBanner', '', '');
  const btn = document.getElementById('adjSubmitBtn');
  btn.disabled = true;
  try {
    const res = await apiFetch('/api/inventory/adjust', {
      method: 'POST',
      body: {
        warehouse_id: Number(document.getElementById('adjWhSel').value),
        product_id: Number(document.getElementById('adjProdSel').value),
        new_qty_on_hand: Number(document.getElementById('adjNewQty').value),
        bin_location: document.getElementById('adjBin').value.trim(),
        reason: document.getElementById('adjReason').value.trim()
      }
    });
    showToast(res.message || 'Đã cập nhật kiểm kê kho.', 'ok');
    setBanner('adjFormBanner', 'ok', res.message);
    document.getElementById('adjReason').value = '';
    await refreshProductsCache();
    populateInvProductSelects();
    await refreshCurrentSubView();
  } catch (err) {
    setBanner('adjFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  } finally {
    btn.disabled = false;
  }
}

async function refreshCurrentSubView() {
  const qs = new URLSearchParams();
  const q = document.getElementById('invQ')?.value?.trim();
  const wh = document.getElementById('invWhFilter')?.value || selectedWhId;
  const cat = document.getElementById('invCatFilter')?.value;
  const alertOnly = document.getElementById('invAlertOnly')?.checked;
  if (q) qs.set('q', q);
  if (wh) qs.set('warehouse_id', wh);
  if (cat) qs.set('category_id', cat);
  if (alertOnly) qs.set('alert_only', '1');

  const invData = await apiFetch(`/api/inventory?${qs.toString()}`);
  currentMatrix = invData.items || [];
  renderWarehouseHubCards(invData.warehouse_summary || []);

  if (activeSubView === 'matrix') {
    renderMatrixView(currentMatrix, invData.kpi);
  } else if (activeSubView === 'transfers') {
    await renderTransfersView();
  } else {
    await renderLedgerView(qs);
  }
}

function renderWarehouseHubCards(summary) {
  const host = document.getElementById('invWhCardsHost');
  host.innerHTML = summary.map((w) => {
    const active = String(selectedWhId) === String(w.id);
    return `
      <button type="button" class="wh-hub-card ${active ? 'active' : ''}" data-pick-wh="${w.id}">
        <div class="wh-hub-code">${esc(w.code)} • ${esc(w.region)}</div>
        <div class="wh-hub-name">${esc(w.name)}</div>
        <div style="font-size:0.75rem;display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>Tồn: <b>${num(w.total_on_hand)}</b></span>
          <span style="color:var(--erp-sky-dark);font-weight:800;">${w.utilization_pct}% sức chứa</span>
        </div>
        <div class="erp-progress-track" style="height:6px;margin-bottom:6px;">
          <div class="erp-progress-fill ${w.utilization_pct > 80 ? 'warn' : ''}" style="width:${Math.min(100, Math.max(3, w.utilization_pct))}%;"></div>
        </div>
        <div style="font-size:0.71rem;color:var(--erp-muted);">Giá trị: <b>${vnd(w.valuation)}</b> • Cảnh báo: <b style="color:${w.low_stock_count > 0 ? '#be123c' : '#047857'};">${w.low_stock_count}</b></div>
      </button>`;
  }).join('');

  host.querySelectorAll('[data-pick-wh]').forEach((b) => {
    b.onclick = () => {
      selectedWhId = String(selectedWhId) === b.dataset.pickWh ? '' : b.dataset.pickWh;
      const sel = document.getElementById('invWhFilter');
      if (sel) sel.value = selectedWhId;
      refreshCurrentSubView();
    };
  });
}

function renderMatrixView(rows, kpi) {
  const host = document.getElementById('invViewHost');
  host.dataset.invReady = 'matrix';
  const sliced = rows.slice(0, 150);
  host.innerHTML = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;font-size:0.79rem;">
      <span class="erp-badge info">Dòng hiển thị: ${sliced.length} / ${rows.length}</span>
      <span class="erp-badge ok">Tổng đơn vị tồn: ${num(kpi?.total_units || 0)}</span>
      <span class="erp-badge navy">Định giá kho lọc: ${vnd(kpi?.total_valuation || 0)}</span>
      <span class="erp-badge warn">Sắp hết: ${num(kpi?.low_stock_rows || 0)}</span>
      <span class="erp-badge danger">Hết hàng: ${num(kpi?.out_of_stock_rows || 0)}</span>
    </div>
    <div class="admin-table-wrap">
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Kho chi nhánh</th>
            <th>Vị trí Kệ (Bin)</th>
            <th>SKU / Sản phẩm</th>
            <th class="num">Tồn vật lý</th>
            <th class="num">Giữ chỗ</th>
            <th class="num">Khả dụng</th>
            <th class="num">Giá trị vốn</th>
            <th>Mức tồn</th>
          </tr>
        </thead>
        <tbody>
          ${sliced.map((r) => `
            <tr>
              <td><b>${esc(r.warehouse_code)}</b><div style="font-size:0.7rem;color:var(--erp-muted);">${esc(r.warehouse_region)}</div></td>
              <td><code>${esc(r.bin_location)}</code></td>
              <td><b>${esc(r.sku)}</b> — ${esc(r.product_name)}<div style="font-size:0.7rem;color:var(--erp-muted);">${esc(r.category_name)}</div></td>
              <td class="num"><b>${num(r.qty_on_hand)}</b></td>
              <td class="num">${num(r.qty_reserved)}</td>
              <td class="num"><b style="color:var(--erp-sky-dark);">${num(r.qty_available)}</b></td>
              <td class="num">${vnd(r.stock_value)}</td>
              <td>${r.stock_status === 'OUT' ? '<span class="erp-badge danger">Hết hàng</span>' : r.stock_status === 'LOW' ? '<span class="erp-badge warn">Dưới ROP</span>' : '<span class="erp-badge ok">An toàn</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function renderTransfersView() {
  const res = await apiFetch('/api/transfers');
  const items = res.items || [];
  const canWrite = hasPerm(['INVENTORY']);
  const host = document.getElementById('invViewHost');
  host.dataset.invReady = 'transfers';
  host.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Mã Phiếu</th>
            <th>Ngày lập</th>
            <th>Kho xuất &rarr; Kho nhận</th>
            <th>Danh sách SKU chuyển</th>
            <th>Lý do</th>
            <th>Trạng thái</th>
            <th style="text-align:right;">Xác nhận</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((t) => `
            <tr>
              <td><b>${esc(t.transfer_code)}</b><div style="font-size:0.7rem;color:var(--erp-muted);">${esc(t.created_by_name)}</div></td>
              <td>${esc(t.created_at)}</td>
              <td><b>${esc(t.from_warehouse_code)}</b> &rarr; <b>${esc(t.to_warehouse_code)}</b><div style="font-size:0.71rem;color:var(--erp-muted);">${esc(t.from_warehouse_name)} &rarr; ${esc(t.to_warehouse_name)}</div></td>
              <td>${(t.items || []).map((it) => `<div><b>${esc(it.sku)}</b> x${it.qty} <span style="color:var(--erp-muted);">(${esc(it.product_name.slice(0, 34))})</span></div>`).join('')}</td>
              <td>${esc(t.reason)}</td>
              <td>${t.status === 'COMPLETED' ? '<span class="erp-badge ok">Đã nhận đủ (COMPLETED)</span>' : '<span class="erp-badge warn">Đang đi đường (IN_TRANSIT)</span>'}</td>
              <td style="text-align:right;">
                ${t.status === 'IN_TRANSIT' && canWrite ? `<button type="button" class="erp-btn sm erp-btn-ok" data-complete-tr="${t.id}">Xác nhận nhận hàng</button>` : '<span style="font-size:0.73rem;color:var(--erp-muted);">Hoàn tất</span>'}
              </td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;

  host.querySelectorAll('[data-complete-tr]').forEach((b) => {
    b.onclick = async () => {
      try {
        const r = await apiFetch(`/api/transfers/${b.dataset.completeTr}/complete`, { method: 'PATCH' });
        showToast(r.message || 'Đã xác nhận kho đích nhận hàng.', 'ok');
        await refreshProductsCache();
        populateInvProductSelects();
        await refreshCurrentSubView();
      } catch (err) {
        showToast(err.message, 'err');
      }
    };
  });
}

const TX_BADGE = {
  PURCHASE_IN: '<span class="erp-badge ok">PURCHASE_IN</span>',
  SALE_OUT: '<span class="erp-badge info">SALE_OUT</span>',
  TRANSFER_OUT: '<span class="erp-badge warn">TRANSFER_OUT</span>',
  TRANSFER_IN: '<span class="erp-badge ok">TRANSFER_IN</span>',
  ADJUSTMENT: '<span class="erp-badge navy">ADJUSTMENT</span>'
};

async function renderLedgerView(qs) {
  const res = await apiFetch(`/api/inventory/ledger?${qs.toString()}`);
  const rows = res.items || [];
  const host = document.getElementById('invViewHost');
  host.dataset.invReady = 'ledger';
  host.innerHTML = `
    <div class="admin-table-wrap">
      <table class="admin-data-table">
        <thead>
          <tr>
            <th>Thời gian</th>
            <th>Loại bút toán</th>
            <th>Mã chứng từ</th>
            <th>Kho</th>
            <th>Sản phẩm</th>
            <th class="num">Biến động</th>
            <th class="num">Tồn sau GD</th>
            <th>Diễn giải &amp; Người lập</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((l) => `
            <tr>
              <td style="white-space:nowrap;">${esc(l.created_at)}</td>
              <td>${TX_BADGE[l.tx_type] || esc(l.tx_type)}</td>
              <td><b>${esc(l.ref_code)}</b></td>
              <td><b>${esc(l.warehouse_code)}</b></td>
              <td><b>${esc(l.sku)}</b> — ${esc(l.product_name)}</td>
              <td class="num" style="font-weight:800;color:${Number(l.qty_change) >= 0 ? '#047857' : '#be123c'};">${Number(l.qty_change) >= 0 ? '+' : ''}${num(l.qty_change)}</td>
              <td class="num"><b>${num(l.balance_after)}</b></td>
              <td>${esc(l.note)}<div style="font-size:0.7rem;color:var(--erp-muted);">${esc(l.created_by_name || 'Hệ thống')}</div></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}
