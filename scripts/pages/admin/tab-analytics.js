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
  openPaymentModal,
  downloadCsvUtf8,
  cashDirectionMeta,
  refreshCustomersCache,
  refreshSuppliersCache
} from './api.js';

let initialized = false;
let currentPeriod = 'all';
let currentFrom = '';
let currentTo = '';
let currentWhId = '';
let currentMode = 'overview'; // 'overview' | 'revenue' | 'inventory' | 'debt_cashflow'
let currentQuery = '';
let lastOverviewData = null;
let lastReportData = null;

function describeFilterScope() {
  const wh = currentWhId
    ? (ERP.meta.warehouses || []).find((w) => Number(w.id) === Number(currentWhId))
    : null;
  const whText = wh ? `${wh.code} — ${wh.name}` : 'Tất cả 5 Kho Toàn Quốc';

  const periodLabels = {
    all: 'Toàn thời gian',
    today: 'Hôm nay',
    '7days': '7 ngày gần nhất',
    '30days': '30 ngày gần nhất',
    this_month: 'Tháng này',
    this_year: 'Năm nay'
  };
  const dateText = (currentFrom || currentTo)
    ? `Từ ${currentFrom || '...'} đến ${currentTo || '...'}`
    : (periodLabels[currentPeriod] || 'Toàn thời gian');

  return { whText, dateText };
}

export async function renderAnalyticsTab() {
  const host = document.getElementById('tab-analytics');
  if (!initialized) {
    initialized = true;
    const whOpts = (ERP.meta.warehouses || [])
      .map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)}</option>`)
      .join('');

    host.innerHTML = `
      <div class="sales-toolbar">
        <div>
          <h2 style="margin:0;font-size:1.05rem;font-weight:800;letter-spacing:0.02em;">TRUNG TÂM ĐIỀU HÀNH &amp; BÁO CÁO QUẢN TRỊ ĐA KHO</h2>
          <div class="admin-card-sub">Theo dõi thời gian thực Doanh thu • Lãi gộp • Xuất–Nhập–Tồn kho (XNT) • Công nợ AR/AP &amp; Dòng tiền Thu–Chi</div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <select id="anPeriodSel" class="admin-select" style="width:168px;">
            <option value="all">Toàn thời gian</option>
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày gần nhất</option>
            <option value="30days">30 ngày gần nhất</option>
            <option value="this_month">Tháng này</option>
            <option value="this_year">Năm nay</option>
            <option value="custom">Tùy chọn ngày...</option>
          </select>
          <div class="erp-date-range">
            <label for="anDateFrom">Từ</label>
            <input type="date" id="anDateFrom" />
            <label for="anDateTo">Đến</label>
            <input type="date" id="anDateTo" />
          </div>
          <select id="anWhSel" class="admin-select" style="width:215px;">
            <option value="">Tất cả 5 Kho Toàn Quốc</option>
            ${whOpts}
          </select>
          <button type="button" class="erp-btn erp-btn-primary" id="anRefreshBtn">Lọc / Làm mới</button>
          <button type="button" class="erp-btn erp-btn-outline" id="anExportCsvBtn">Xuất Excel (.csv)</button>
          <button type="button" class="erp-btn erp-btn-navy" id="anPrintReportBtn">In Báo cáo (A4)</button>
        </div>
      </div>

      <div id="anFilterBanner" class="erp-alert-banner"></div>

      <div class="erp-sub-pills" id="anReportPills" role="tablist" aria-label="Chế độ Báo cáo">
        <button type="button" class="erp-sub-pill active" data-rep-mode="overview">Tổng quan Điều hành</button>
        <button type="button" class="erp-sub-pill" data-rep-mode="revenue">Báo cáo Doanh thu &amp; Lãi gộp</button>
        <button type="button" class="erp-sub-pill" data-rep-mode="inventory">Báo cáo Xuất – Nhập – Tồn (XNT)</button>
        <button type="button" class="erp-sub-pill" data-rep-mode="debt_cashflow">Công nợ AR/AP &amp; Dòng tiền</button>
      </div>

      <div id="anContentBody"></div>
    `;

    bindAnalyticsToolbarEvents();
  }

  await loadActiveAnalyticsView();
}

function bindAnalyticsToolbarEvents() {
  const periodEl = document.getElementById('anPeriodSel');
  const fromEl = document.getElementById('anDateFrom');
  const toEl = document.getElementById('anDateTo');
  const whEl = document.getElementById('anWhSel');

  periodEl.onchange = () => {
    currentPeriod = periodEl.value;
    if (currentPeriod !== 'custom') {
      currentFrom = '';
      currentTo = '';
      fromEl.value = '';
      toEl.value = '';
      loadActiveAnalyticsView();
    }
  };

  const onDateChange = () => {
    currentFrom = fromEl.value;
    currentTo = toEl.value;
    if (currentFrom || currentTo) {
      currentPeriod = 'custom';
      periodEl.value = 'custom';
    }
  };
  fromEl.onchange = onDateChange;
  toEl.onchange = onDateChange;

  whEl.onchange = () => {
    currentWhId = whEl.value;
    loadActiveAnalyticsView();
  };

  document.getElementById('anRefreshBtn').onclick = () => {
    currentFrom = fromEl.value;
    currentTo = toEl.value;
    currentPeriod = (currentFrom || currentTo) ? 'custom' : periodEl.value;
    loadActiveAnalyticsView();
  };

  document.getElementById('anExportCsvBtn').onclick = exportActiveReportCsv;
  document.getElementById('anPrintReportBtn').onclick = printActiveReportA4;

  document.querySelectorAll('#anReportPills .erp-sub-pill').forEach((btn) => {
    btn.onclick = () => {
      currentMode = btn.dataset.repMode || 'overview';
      currentQuery = '';
      document.querySelectorAll('#anReportPills .erp-sub-pill').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
      loadActiveAnalyticsView();
    };
  });
}

function buildFilterQueryParams(extra = {}) {
  const qs = new URLSearchParams();
  if (currentFrom || currentTo) {
    qs.set('period', 'custom');
    if (currentFrom) qs.set('from', currentFrom);
    if (currentTo) qs.set('to', currentTo);
  } else {
    qs.set('period', currentPeriod === 'custom' ? 'all' : currentPeriod);
  }
  if (currentWhId) qs.set('warehouse_id', currentWhId);
  if (currentQuery) qs.set('q', currentQuery);
  for (const [k, v] of Object.entries(extra)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, v);
  }
  return qs;
}

async function loadActiveAnalyticsView() {
  setBanner('anFilterBanner', '', '');
  if (currentFrom && currentTo && currentFrom > currentTo) {
    setBanner('anFilterBanner', 'err', 'Khoảng thời gian không hợp lệ: "Từ ngày" phải nhỏ hơn hoặc bằng "Đến ngày".');
    return;
  }

  try {
    if (currentMode === 'overview') {
      const qs = buildFilterQueryParams();
      const data = await apiFetch(`/api/analytics/overview?${qs.toString()}`);
      lastOverviewData = data;
      renderOverviewPanel(data);
      return;
    }

    const qs = buildFilterQueryParams({ type: currentMode });
    const rep = await apiFetch(`/api/reports/summary?${qs.toString()}`);
    lastReportData = rep;
    if (currentMode === 'revenue') renderRevenueReportPanel(rep);
    else if (currentMode === 'inventory') renderInventoryXntPanel(rep);
    else renderDebtCashflowPanel(rep);
  } catch (err) {
    setBanner('anFilterBanner', 'err', err.message);
  }
}

/* ============================================================================
 *  MODE 1: OVERVIEW DASHBOARD
 * ============================================================================ */
function renderOverviewPanel(data) {
  const body = document.getElementById('anContentBody');
  const k = data.kpi;
  const totalOrd = Math.max(1, k.total_orders);

  const chPos = data.channel_breakdown?.POS || { count: 0, revenue: 0 };
  const chB2b = data.channel_breakdown?.B2B || { count: 0, revenue: 0 };
  const chWeb = data.channel_breakdown?.WEB3D || { count: 0, revenue: 0 };
  const maxChRev = Math.max(1, chPos.revenue, chB2b.revenue, chWeb.revenue);

  const maxTrend = Math.max(1, ...(data.revenue_trend || []).map((x) => x.revenue));
  const trendBars = (data.revenue_trend || []).length
    ? data.revenue_trend.map((d) => {
      const pct = Math.max(8, Math.round((d.revenue / maxTrend) * 100));
      const shortVal = d.revenue >= 1000000 ? `${(d.revenue / 1000000).toFixed(1)}tr` : `${Math.round(d.revenue / 1000)}k`;
      return `
        <div class="sales-bar-col" title="${esc(d.date)}: ${vnd(d.revenue)} (${d.orders} đơn)">
          <span class="sales-bar-val">${shortVal}</span>
          <div class="sales-bar-fill" style="height:${pct}%;"></div>
          <span class="sales-bar-lbl">${esc(d.date.slice(5))}</span>
        </div>`;
    }).join('')
    : '<div style="margin:auto;font-size:0.82rem;color:var(--erp-muted);">Chưa có dữ liệu doanh thu trong kỳ đã chọn.</div>';

  const topProdHtml = (data.top_products || []).length
    ? data.top_products.map((p, idx) => `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #edf3fa;font-size:0.79rem;">
        <div style="min-width:0;flex:1;">
          <div style="font-weight:800;color:var(--erp-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">#${idx + 1} ${esc(p.name)}</div>
          <div style="font-size:0.71rem;color:var(--erp-muted);">SKU: ${esc(p.sku)} • Đã bán: <b>${num(p.qty)}</b></div>
        </div>
        <strong style="color:var(--erp-sky-dark);white-space:nowrap;">${vnd(p.revenue)}</strong>
      </div>`).join('')
    : '<div style="font-size:0.8rem;color:var(--erp-muted);">Chưa phát sinh đơn bán trong kỳ.</div>';

  const whPerfHtml = (data.warehouse_performance || []).map((w) => `
    <div class="erp-progress-row">
      <div class="erp-progress-top">
        <span>${esc(w.code)} • ${esc(w.region)}</span>
        <span>${num(w.units)} / ${num(w.capacity)} SP (${w.utilization_pct}%)</span>
      </div>
      <div class="erp-progress-track">
        <div class="erp-progress-fill ${w.utilization_pct > 80 ? 'warn' : ''}" style="width:${Math.min(100, Math.max(2, w.utilization_pct))}%;"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--erp-muted);margin-top:3px;">
        <span>Doanh thu: <b>${vnd(w.revenue)}</b> (${w.orders} đơn)</span>
        <span>Giá trị kho: <b>${vnd(w.valuation)}</b></span>
      </div>
    </div>`).join('');

  const ropRows = (data.low_stock_alerts || []).map((a) => `
    <tr>
      <td><b>${esc(a.sku)}</b></td>
      <td>${esc(a.name)}</td>
      <td class="num"><span class="erp-badge ${a.qty_available === 0 ? 'danger' : 'warn'}">${num(a.qty_available)}</span></td>
      <td class="num">${num(a.min_reorder_level)}</td>
      <td style="text-align:right;">
        ${hasPerm(['PURCHASES']) ? `<button type="button" class="erp-btn sm erp-btn-primary" data-jump-purchase="${a.product_id}">Nhập hàng ngay</button>` : '<span class="erp-badge warn">Cần bổ sung</span>'}
      </td>
    </tr>`).join('');

  body.innerHTML = `
    <div class="sales-stats-grid">
      <div class="sales-stat-card">
        <div class="sales-stat-label">Doanh thu bán hàng</div>
        <div class="sales-stat-value">${vnd(k.total_revenue)}</div>
        <div class="sales-stat-sub">Lãi gộp ước tính: <b style="color:var(--erp-ok);">${vnd(k.gross_profit)} (${k.gross_margin_pct}%)</b></div>
      </div>
      <div class="sales-stat-card navy">
        <div class="sales-stat-label">Đơn hàng &amp; Sổ quỹ ròng</div>
        <div class="sales-stat-value">${num(k.total_orders)} hóa đơn</div>
        <div class="sales-stat-sub">AOV: <b>${vnd(k.avg_order_value)}</b> • Quỹ ròng kỳ: <b>${vnd(k.net_cashflow_period || 0)}</b></div>
      </div>
      <div class="sales-stat-card ok">
        <div class="sales-stat-label">Định giá tồn kho</div>
        <div class="sales-stat-value">${vnd(k.inventory_valuation)}</div>
        <div class="sales-stat-sub">${num(k.total_units_in_stock)} đơn vị • ${num(k.total_products)} SKU</div>
      </div>
      <div class="sales-stat-card warn">
        <div class="sales-stat-label">Công nợ phải thu (AR)</div>
        <div class="sales-stat-value">${vnd(k.total_receivable_debt)}</div>
        <div class="sales-stat-sub">${num(k.total_customers)} khách hàng (B2B/VIP/Lẻ)</div>
      </div>
      <div class="sales-stat-card danger">
        <div class="sales-stat-label">Công nợ phải trả (AP)</div>
        <div class="sales-stat-value">${vnd(k.total_payable_debt)}</div>
        <div class="sales-stat-sub">Nhập kỳ: <b>${vnd(k.total_purchases)}</b> • ROP: <b>${k.low_stock_sku_count}</b></div>
      </div>
    </div>

    <div class="sales-charts-row">
      <div class="sales-chart-card">
        <h3>Phân bổ Kênh bán &amp; Trạng thái đơn</h3>
        <div class="erp-progress-row">
          <div class="erp-progress-top"><span>Kênh B2B (Dự án / Doanh nghiệp)</span><span>${chB2b.count} đơn • ${vnd(chB2b.revenue)}</span></div>
          <div class="erp-progress-track"><div class="erp-progress-fill navy" style="width:${Math.round((chB2b.revenue / maxChRev) * 100)}%;"></div></div>
        </div>
        <div class="erp-progress-row">
          <div class="erp-progress-top"><span>Kênh POS (Showroom / Quầy)</span><span>${chPos.count} đơn • ${vnd(chPos.revenue)}</span></div>
          <div class="erp-progress-track"><div class="erp-progress-fill" style="width:${Math.round((chPos.revenue / maxChRev) * 100)}%;"></div></div>
        </div>
        <div class="erp-progress-row">
          <div class="erp-progress-top"><span>Kênh WEB3D (Storefront Online)</span><span>${chWeb.count} đơn • ${vnd(chWeb.revenue)}</span></div>
          <div class="erp-progress-track"><div class="erp-progress-fill ok" style="width:${Math.round((chWeb.revenue / maxChRev) * 100)}%;"></div></div>
        </div>
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid #e6eff8;display:flex;gap:8px;flex-wrap:wrap;">
          <span class="erp-badge ok">Hoàn tất: ${data.fulfillment_breakdown.COMPLETED || 0}</span>
          <span class="erp-badge info">Đang giao: ${data.fulfillment_breakdown.DELIVERED || 0}</span>
          <span class="erp-badge warn">Đang xử lý: ${data.fulfillment_breakdown.PROCESSING || 0}</span>
          <span class="erp-badge navy">Đã TT: ${data.payment_breakdown.PAID || 0}/${totalOrd}</span>
        </div>
      </div>

      <div class="sales-chart-card">
        <h3>Sức chứa &amp; Hiệu suất 5 Kho Toàn Quốc</h3>
        ${whPerfHtml}
      </div>

      <div class="sales-chart-card">
        <h3>Top Sản phẩm Doanh thu Cao nhất</h3>
        ${topProdHtml}
      </div>
    </div>

    <div class="sales-charts-row cols-2">
      <div class="sales-chart-card">
        <h3>Xu hướng Doanh thu theo ngày phát sinh</h3>
        <div class="sales-bar-chart">${trendBars}</div>
      </div>

      <div class="sales-chart-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <h3 style="margin:0;">Cảnh báo Tồn tối thiểu (ROP)</h3>
          <span class="erp-badge ${k.low_stock_sku_count > 0 ? 'danger' : 'ok'}">${k.low_stock_sku_count} SKU cần chú ý</span>
        </div>
        ${ropRows ? `
          <div class="admin-table-wrap">
            <table class="admin-data-table">
              <thead><tr><th>SKU</th><th>Sản phẩm</th><th class="num">Khả dụng</th><th class="num">ROP</th><th></th></tr></thead>
              <tbody>${ropRows}</tbody>
            </table>
          </div>` : '<div style="font-size:0.82rem;color:var(--erp-ok);font-weight:700;">Tất cả SKU đều đạt ngưỡng tồn an toàn.</div>'}
      </div>
    </div>
  `;

  body.querySelectorAll('[data-jump-purchase]').forEach((btn) => {
    btn.onclick = () => {
      if (ERP.switchTab) ERP.switchTab('purchases', { preloadProductId: Number(btn.dataset.jumpPurchase) });
    };
  });
}

/* ============================================================================
 *  MODE 2: REVENUE & GROSS PROFIT REPORT
 * ============================================================================ */
function renderRevenueReportPanel(rep) {
  const body = document.getElementById('anContentBody');
  const s = rep.summary;

  const chRows = (rep.by_channel || []).map((c) => {
    const margin = c.revenue > 0 ? (Math.round((c.gross_profit / c.revenue) * 1000) / 10) : 0;
    return `
      <tr>
        <td><b>${esc(c.label)}</b></td>
        <td class="num">${num(c.orders)}</td>
        <td class="num">${num(c.qty)}</td>
        <td class="num"><b>${vnd(c.revenue)}</b></td>
        <td class="num">${vnd(c.cogs)}</td>
        <td class="num" style="color:#047857;font-weight:800;">${vnd(c.gross_profit)}</td>
        <td class="num"><span class="erp-badge ${margin >= 15 ? 'ok' : 'info'}">${margin}%</span></td>
      </tr>`;
  }).join('');

  const invRows = (rep.invoices || []).map((inv) => `
    <tr>
      <td><b>${esc(inv.invoice_code)}</b></td>
      <td style="white-space:nowrap;">${esc(inv.created_at)}</td>
      <td><span class="erp-badge navy">${esc(inv.sales_channel)}</span></td>
      <td><span class="erp-badge info">${esc(inv.warehouse_code)}</span></td>
      <td>${esc(inv.customer_name)}</td>
      <td class="num">${num(inv.total_qty)}</td>
      <td class="num"><b>${vnd(inv.total_amount)}</b></td>
      <td class="num">${vnd(inv.cogs)}</td>
      <td class="num" style="color:${inv.gross_profit >= 0 ? '#047857' : '#be123c'};font-weight:800;">${vnd(inv.gross_profit)}</td>
      <td class="num">${inv.margin_pct}%</td>
      <td class="num" style="color:${inv.debt_amount > 0 ? '#be123c' : '#047857'};">${vnd(inv.debt_amount)}</td>
    </tr>`).join('');

  body.innerHTML = `
    <div class="admin-summary-cards">
      <div class="sales-stat-card">
        <div class="sales-stat-label">Doanh thu thuần trong kỳ</div>
        <div class="sales-stat-value">${vnd(s.total_revenue)}</div>
        <div class="sales-stat-sub">${num(s.total_orders)} hóa đơn • ${num(s.total_qty)} sản phẩm</div>
      </div>
      <div class="sales-stat-card navy">
        <div class="sales-stat-label">Giá vốn hàng bán (COGS)</div>
        <div class="sales-stat-value">${vnd(s.total_cogs)}</div>
        <div class="sales-stat-sub">Tính theo giá vốn snapshot lúc xuất kho</div>
      </div>
      <div class="sales-stat-card ok">
        <div class="sales-stat-label">Lãi gộp trong kỳ</div>
        <div class="sales-stat-value">${vnd(s.gross_profit)}</div>
        <div class="sales-stat-sub">Biên lợi nhuận gộp: <b>${s.gross_margin_pct}%</b></div>
      </div>
      <div class="sales-stat-card warn">
        <div class="sales-stat-label">Thực thu / Dư nợ hóa đơn</div>
        <div class="sales-stat-value">${vnd(s.total_paid)}</div>
        <div class="sales-stat-sub">Còn phải thu trên kỳ: <b style="color:#be123c;">${vnd(s.total_debt)}</b></div>
      </div>
    </div>

    <section class="admin-card">
      <div class="admin-card-head">
        <h3 class="admin-card-title">Tổng hợp Doanh thu &amp; Biên lãi theo Kênh bán</h3>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>Kênh bán hàng</th><th class="num">Số đơn</th><th class="num">SL bán</th><th class="num">Doanh thu</th><th class="num">Giá vốn COGS</th><th class="num">Lãi gộp</th><th class="num">Biên lãi</th></tr></thead>
          <tbody>${chRows}</tbody>
        </table>
      </div>
    </section>

    <section class="admin-card">
      <div class="admin-card-head">
        <h3 class="admin-card-title">Bảng kê Chi tiết Hóa đơn Doanh thu &amp; Lãi gộp</h3>
        <form id="repRevSearchForm" style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="repRevSearchInput" class="admin-input" style="width:240px;height:34px;" value="${esc(currentQuery)}" placeholder="Tìm mã HĐ, khách hàng, kênh..." />
          <button type="submit" class="erp-btn sm erp-btn-primary">Tìm</button>
        </form>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table" id="repRevenueTable">
          <thead>
            <tr>
              <th>Mã HĐ</th><th>Ngày lập</th><th>Kênh</th><th>Kho xuất</th><th>Khách hàng</th>
              <th class="num">SL</th><th class="num">Doanh thu</th><th class="num">Giá vốn</th>
              <th class="num">Lãi gộp</th><th class="num">% Lãi</th><th class="num">Còn nợ</th>
            </tr>
          </thead>
          <tbody>${invRows || '<tr><td colspan="11" style="text-align:center;padding:22px;color:var(--erp-muted);">Không có hóa đơn nào trong khoảng thời gian đã chọn.</td></tr>'}</tbody>
          ${(rep.invoices || []).length ? `
          <tfoot>
            <tr>
              <td colspan="5">TỔNG CỘNG BÁO CÁO DOANH THU (${num(s.total_orders)} hóa đơn)</td>
              <td class="num">${num(s.total_qty)}</td>
              <td class="num">${vnd(s.total_revenue)}</td>
              <td class="num">${vnd(s.total_cogs)}</td>
              <td class="num">${vnd(s.gross_profit)}</td>
              <td class="num">${s.gross_margin_pct}%</td>
              <td class="num">${vnd(s.total_debt)}</td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </section>
  `;

  document.getElementById('repRevSearchForm').onsubmit = (e) => {
    e.preventDefault();
    currentQuery = document.getElementById('repRevSearchInput').value.trim();
    loadActiveAnalyticsView();
  };
}

/* ============================================================================
 *  MODE 3: INVENTORY XNT (XUẤT - NHẬP - TỒN) REPORT
 * ============================================================================ */
function renderInventoryXntPanel(rep) {
  const body = document.getElementById('anContentBody');
  const s = rep.summary;

  const xntRows = (rep.rows || []).map((r) => `
    <tr>
      <td><b>${esc(r.sku)}</b></td>
      <td style="font-weight:700;max-width:250px;">${esc(r.name)}</td>
      <td>${esc(r.category_name)}</td>
      <td>${esc(r.unit)}</td>
      <td class="num" data-xnt-open>${num(r.opening_qty)}</td>
      <td class="num" data-xnt-in style="color:#047857;font-weight:700;">+${num(r.in_qty)}</td>
      <td class="num" data-xnt-out style="color:#0369a1;font-weight:700;">-${num(r.out_qty)}</td>
      <td class="num" data-xnt-adj>${r.adj_qty >= 0 ? `+${num(r.adj_qty)}` : num(r.adj_qty)}</td>
      <td class="num" data-xnt-close><b>${num(r.closing_qty)}</b></td>
      <td class="num">${num(r.qty_available)}</td>
      <td class="num">${vnd(r.unit_cost)}</td>
      <td class="num"><b>${vnd(r.closing_value)}</b></td>
      <td>${r.is_low_stock ? `<span class="erp-badge danger">Dưới ROP (${r.min_reorder_level})</span>` : '<span class="erp-badge ok">An toàn</span>'}</td>
    </tr>`).join('');

  body.innerHTML = `
    <div class="admin-summary-cards">
      <div class="sales-stat-card">
        <div class="sales-stat-label">Tổng số SKU theo dõi</div>
        <div class="sales-stat-value">${num(s.sku_count)} SKU</div>
        <div class="sales-stat-sub">Đầu kỳ: <b>${num(s.total_opening_qty)}</b> • Cuối kỳ: <b>${num(s.total_closing_qty)}</b></div>
      </div>
      <div class="sales-stat-card ok">
        <div class="sales-stat-label">Tổng Nhập trong kỳ</div>
        <div class="sales-stat-value">+${num(s.total_in_qty)} ĐV</div>
        <div class="sales-stat-sub">Nhập mua NCC &amp; Nhận điều chuyển kho</div>
      </div>
      <div class="sales-stat-card navy">
        <div class="sales-stat-label">Tổng Xuất &amp; Điều chỉnh</div>
        <div class="sales-stat-value">-${num(s.total_out_qty)} ĐV</div>
        <div class="sales-stat-sub">Điều chỉnh kiểm kê kỳ: <b>${s.total_adj_qty >= 0 ? '+' : ''}${num(s.total_adj_qty)}</b></div>
      </div>
      <div class="sales-stat-card warn">
        <div class="sales-stat-label">Giá trị Tồn kho cuối kỳ</div>
        <div class="sales-stat-value">${vnd(s.total_closing_value)}</div>
        <div class="sales-stat-sub">SKU dưới ngưỡng ROP: <b style="color:#be123c;">${num(s.low_stock_count)}</b></div>
      </div>
    </div>

    <section class="admin-card">
      <div class="admin-card-head">
        <div>
          <h3 class="admin-card-title">Báo cáo Xuất – Nhập – Tồn Kho Chi Tiết Theo Kỳ (XNT)</h3>
          <div class="admin-card-sub">Kiểm toán cân đối thẻ kho: <b>Tồn cuối kỳ = Tồn đầu kỳ + Nhập − Xuất + Điều chỉnh</b></div>
        </div>
        <form id="repInvSearchForm" style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="repInvSearchInput" class="admin-input" style="width:240px;height:34px;" value="${esc(currentQuery)}" placeholder="Lọc theo SKU, tên hàng, danh mục..." />
          <button type="submit" class="erp-btn sm erp-btn-primary">Lọc SKU</button>
        </form>
      </div>

      <div class="admin-table-wrap">
        <table class="admin-data-table" id="repInventoryTable">
          <thead>
            <tr>
              <th>SKU</th><th>Tên hàng hóa</th><th>Danh mục</th><th>ĐVT</th>
              <th class="num">Đầu kỳ</th><th class="num">Nhập kỳ</th><th class="num">Xuất kỳ</th>
              <th class="num">Điều chỉnh</th><th class="num">Cuối kỳ</th><th class="num">Khả dụng</th>
              <th class="num">Giá vốn</th><th class="num">Giá trị tồn</th><th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>${xntRows || '<tr><td colspan="13" style="text-align:center;padding:22px;color:var(--erp-muted);">Không tìm thấy dữ liệu tồn kho phù hợp.</td></tr>'}</tbody>
          ${(rep.rows || []).length ? `
          <tfoot>
            <tr>
              <td colspan="4">TỔNG CỘNG XUẤT – NHẬP – TỒN (${num(s.sku_count)} SKU)</td>
              <td class="num">${num(s.total_opening_qty)}</td>
              <td class="num">+${num(s.total_in_qty)}</td>
              <td class="num">-${num(s.total_out_qty)}</td>
              <td class="num">${s.total_adj_qty >= 0 ? '+' : ''}${num(s.total_adj_qty)}</td>
              <td class="num">${num(s.total_closing_qty)}</td>
              <td class="num">-</td>
              <td class="num">-</td>
              <td class="num">${vnd(s.total_closing_value)}</td>
              <td></td>
            </tr>
          </tfoot>` : ''}
        </table>
      </div>
    </section>
  `;

  document.getElementById('repInvSearchForm').onsubmit = (e) => {
    e.preventDefault();
    currentQuery = document.getElementById('repInvSearchInput').value.trim();
    loadActiveAnalyticsView();
  };
}

/* ============================================================================
 *  MODE 4: AR/AP DEBT & CASHFLOW REPORT
 * ============================================================================ */
function renderDebtCashflowPanel(rep) {
  const body = document.getElementById('anContentBody');
  const s = rep.summary;

  const arRows = (rep.receivables || []).map((c) => `
    <tr>
      <td><b>${esc(c.code)}</b></td>
      <td><b>${esc(c.name)}</b><div style="font-size:0.71rem;color:var(--erp-muted);">${esc(c.phone)}</div></td>
      <td><span class="erp-badge info">${esc(c.customer_type)}</span></td>
      <td class="num">${vnd(c.credit_limit)}</td>
      <td class="num" style="color:#be123c;font-weight:800;">${vnd(c.receivable_debt)}</td>
      <td style="text-align:right;">
        ${hasPerm(['SALES', 'CUSTOMERS']) ? `<button type="button" class="erp-btn sm erp-btn-ok" data-rep-collect="${c.id}">Thu nợ</button>` : ''}
      </td>
    </tr>`).join('');

  const apRows = (rep.payables || []).map((sup) => `
    <tr>
      <td><b>${esc(sup.code)}</b></td>
      <td><b>${esc(sup.name)}</b><div style="font-size:0.71rem;color:var(--erp-muted);">${esc(sup.phone)}</div></td>
      <td>${num(sup.payment_terms_days)} ngày</td>
      <td class="num" style="color:#be123c;font-weight:800;">${vnd(sup.payable_debt)}</td>
      <td style="text-align:right;">
        ${hasPerm(['PURCHASES', 'SUPPLIERS']) ? `<button type="button" class="erp-btn sm erp-btn-primary" data-rep-pay="${sup.id}">Trả nợ</button>` : ''}
      </td>
    </tr>`).join('');

  const catRows = (rep.cashflow_by_category || []).map((c) => {
    const meta = cashDirectionMeta(c.tx_direction);
    return `
      <tr>
        <td><span class="erp-badge ${meta.badgeClass}">${esc(meta.label)}</span></td>
        <td><b>${esc(c.category)}</b></td>
        <td class="num">${num(c.count)}</td>
        <td class="num" style="color:${c.flow_type === 'IN' ? '#047857' : '#be123c'};font-weight:800;">
          ${c.flow_type === 'IN' ? '+' : '-'}${vnd(c.amount)}
        </td>
      </tr>`;
  }).join('');

  body.innerHTML = `
    <div class="admin-summary-cards">
      <div class="sales-stat-card warn">
        <div class="sales-stat-label">Tổng Công nợ Phải thu (AR)</div>
        <div class="sales-stat-value">${vnd(s.total_receivable_debt)}</div>
        <div class="sales-stat-sub">${num(s.receivable_count)} khách hàng đang dư nợ</div>
      </div>
      <div class="sales-stat-card danger">
        <div class="sales-stat-label">Tổng Công nợ Phải trả (AP)</div>
        <div class="sales-stat-value">${vnd(s.total_payable_debt)}</div>
        <div class="sales-stat-sub">${num(s.payable_count)} nhà cung cấp cần thanh toán</div>
      </div>
      <div class="sales-stat-card ok">
        <div class="sales-stat-label">Thực Thu / Thực Chi trong kỳ</div>
        <div class="sales-stat-value">${vnd(s.total_in)}</div>
        <div class="sales-stat-sub">Tổng chi trong kỳ: <b style="color:#be123c;">${vnd(s.total_out)}</b> (${num(s.tx_count)} phiếu)</div>
      </div>
      <div class="sales-stat-card navy">
        <div class="sales-stat-label">Lưu chuyển tiền ròng kỳ</div>
        <div class="sales-stat-value">${s.net_cashflow >= 0 ? '' : '-'}${vnd(Math.abs(s.net_cashflow))}</div>
        <div class="sales-stat-sub">Chênh lệch Thu − Chi tại Sổ quỹ</div>
      </div>
    </div>

    <div class="admin-form-grid cols-2" style="margin-bottom:18px;">
      <section class="admin-card" style="margin:0;">
        <div class="admin-card-head">
          <h3 class="admin-card-title">Công nợ Phải thu Khách hàng (AR)</h3>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead><tr><th>Mã</th><th>Khách hàng</th><th>Hạng</th><th class="num">Hạn mức</th><th class="num">Dư nợ</th><th></th></tr></thead>
            <tbody>${arRows || '<tr><td colspan="6" style="text-align:center;padding:18px;color:var(--erp-ok);">Không có khách hàng nào đang nợ.</td></tr>'}</tbody>
          </table>
        </div>
      </section>

      <section class="admin-card" style="margin:0;">
        <div class="admin-card-head">
          <h3 class="admin-card-title">Công nợ Phải trả Nhà cung cấp (AP)</h3>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead><tr><th>Mã</th><th>Nhà cung cấp</th><th>Hạn TT</th><th class="num">Còn phải trả</th><th></th></tr></thead>
            <tbody>${apRows || '<tr><td colspan="5" style="text-align:center;padding:18px;color:var(--erp-ok);">Đã tất toán hết công nợ NCC.</td></tr>'}</tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="admin-card">
      <div class="admin-card-head">
        <h3 class="admin-card-title">Tổng hợp Dòng tiền Thu – Chi theo Hạng mục trong kỳ</h3>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>Phân loại phiếu</th><th>Hạng mục Thu / Chi</th><th class="num">Số chứng từ</th><th class="num">Tổng giá trị</th></tr></thead>
          <tbody>${catRows || '<tr><td colspan="4" style="text-align:center;padding:18px;color:var(--erp-muted);">Chưa phát sinh chứng từ thu chi trong kỳ.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;

  body.querySelectorAll('[data-rep-collect]').forEach((b) => {
    b.onclick = () => {
      const c = (rep.receivables || []).find((x) => x.id === Number(b.dataset.repCollect));
      if (!c) return;
      openPaymentModal({
        direction: 'RECEIPT_FROM_CUSTOMER',
        entityId: c.id,
        entityName: c.name,
        currentDebt: c.receivable_debt,
        onDone: async () => {
          await refreshCustomersCache();
          await loadActiveAnalyticsView();
        }
      });
    };
  });

  body.querySelectorAll('[data-rep-pay]').forEach((b) => {
    b.onclick = () => {
      const sup = (rep.payables || []).find((x) => x.id === Number(b.dataset.repPay));
      if (!sup) return;
      openPaymentModal({
        direction: 'PAYMENT_TO_SUPPLIER',
        entityId: sup.id,
        entityName: sup.name,
        currentDebt: sup.payable_debt,
        onDone: async () => {
          await refreshSuppliersCache();
          await loadActiveAnalyticsView();
        }
      });
    };
  });
}

/* ============================================================================
 *  CSV UTF-8 BOM EXPORT & A4 REPORT PRINT
 * ============================================================================ */
function exportActiveReportCsv() {
  const stamp = new Date().toISOString().slice(0, 10);

  if (currentMode === 'revenue' && lastReportData) {
    const rows = lastReportData.invoices || [];
    if (!rows.length) { showToast('Không có dữ liệu doanh thu để xuất CSV.', 'err'); return; }
    downloadCsvUtf8(
      `skycrumb_bao_cao_doanh_thu_${stamp}.csv`,
      ['Mã HĐ', 'Ngày lập', 'Kênh', 'Kho xuất', 'Khách hàng', 'SL', 'Doanh thu (VNĐ)', 'Giá vốn COGS (VNĐ)', 'Lãi gộp (VNĐ)', 'Biên lãi (%)', 'Đã TT (VNĐ)', 'Còn nợ (VNĐ)'],
      rows.map((r) => [r.invoice_code, r.created_at, r.sales_channel, `${r.warehouse_code} - ${r.warehouse_name}`, r.customer_name, r.total_qty, r.total_amount, r.cogs, r.gross_profit, r.margin_pct, r.paid_amount, r.debt_amount])
    );
    showToast(`Đã xuất Báo cáo Doanh thu (${rows.length} hóa đơn) ra Excel (.csv).`, 'ok');
    return;
  }

  if (currentMode === 'inventory' && lastReportData) {
    const rows = lastReportData.rows || [];
    if (!rows.length) { showToast('Không có dữ liệu Xuất-Nhập-Tồn để xuất CSV.', 'err'); return; }
    downloadCsvUtf8(
      `skycrumb_xuat_nhap_ton_${stamp}.csv`,
      ['SKU', 'Tên hàng hóa', 'Danh mục', 'ĐVT', 'Tồn đầu kỳ', 'Nhập trong kỳ', 'Xuất trong kỳ', 'Điều chỉnh', 'Tồn cuối kỳ', 'Khả dụng', 'Giá vốn (VNĐ)', 'Giá trị tồn cuối kỳ (VNĐ)'],
      rows.map((r) => [r.sku, r.name, r.category_name, r.unit, r.opening_qty, r.in_qty, r.out_qty, r.adj_qty, r.closing_qty, r.qty_available, r.unit_cost, r.closing_value])
    );
    showToast(`Đã xuất Báo cáo Xuất-Nhập-Tồn (${rows.length} SKU) ra Excel (.csv).`, 'ok');
    return;
  }

  if (currentMode === 'debt_cashflow' && lastReportData) {
    const ar = (lastReportData.receivables || []).map((c) => ['Công nợ Phải thu (AR)', c.code, c.name, c.phone, c.customer_type, c.receivable_debt]);
    const ap = (lastReportData.payables || []).map((s) => ['Công nợ Phải trả (AP)', s.code, s.name, s.phone, `Hạn ${s.payment_terms_days} ngày`, s.payable_debt]);
    const cf = (lastReportData.cashflow_by_category || []).map((x) => ['Dòng tiền Sổ quỹ', cashDirectionMeta(x.tx_direction).label, x.category, `${x.count} phiếu`, x.flow_type, x.flow_type === 'IN' ? x.amount : -x.amount]);
    downloadCsvUtf8(
      `skycrumb_cong_no_dong_tien_${stamp}.csv`,
      ['Nhóm dữ liệu', 'Mã / Loại', 'Đối tượng / Hạng mục', 'Liên hệ / Số lượng', 'Chi tiết', 'Số tiền (VNĐ)'],
      [...ar, ...ap, ...cf]
    );
    showToast('Đã xuất Báo cáo Công nợ & Dòng tiền ra Excel (.csv).', 'ok');
    return;
  }

  if (lastOverviewData) {
    const wh = lastOverviewData.warehouse_performance || [];
    downloadCsvUtf8(
      `skycrumb_tong_quan_da_kho_${stamp}.csv`,
      ['Mã kho', 'Tên kho', 'Khu vực', 'Số đơn bán', 'Doanh thu (VNĐ)', 'Tồn kho (ĐV)', 'Sức chứa', 'Tỷ lệ lấp đầy (%)', 'Giá trị tồn (VNĐ)'],
      wh.map((w) => [w.code, w.name, w.region, w.orders, w.revenue, w.units, w.capacity, w.utilization_pct, w.valuation])
    );
    showToast('Đã xuất Báo cáo Tổng quan Đa kho ra Excel (.csv).', 'ok');
  }
}

function printActiveReportA4() {
  const { whText, dateText } = describeFilterScope();
  const stamp = new Date().toLocaleString('vi-VN');
  const creator = ERP.user?.full_name || 'Quản trị hệ thống';
  let title = 'BÁO CÁO QUẢN TRỊ TỔNG QUAN ĐA KHO';
  let bodyHtml = '';

  if (currentMode === 'revenue' && lastReportData) {
    title = 'BÁO CÁO DOANH THU & LÃI GỘP CHI TIẾT';
    const s = lastReportData.summary;
    const rows = (lastReportData.invoices || []).map((inv, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${esc(inv.invoice_code)}</b></td>
        <td>${esc(inv.created_at)}</td>
        <td>${esc(inv.sales_channel)}</td>
        <td>${esc(inv.warehouse_code)}</td>
        <td>${esc(inv.customer_name)}</td>
        <td class="num">${num(inv.total_qty)}</td>
        <td class="num">${vnd(inv.total_amount)}</td>
        <td class="num">${vnd(inv.cogs)}</td>
        <td class="num">${vnd(inv.gross_profit)}</td>
      </tr>`).join('');
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;background:#f8fbfe;padding:10px 14px;border:1px solid #d7e4f2;border-radius:8px;">
        <div><small>Tổng Doanh thu (${num(s.total_orders)} đơn)</small><div style="font-weight:800;">${vnd(s.total_revenue)}</div></div>
        <div><small>Tổng Giá vốn (COGS)</small><div style="font-weight:800;">${vnd(s.total_cogs)}</div></div>
        <div><small>Lãi gộp (${s.gross_margin_pct}%)</small><div style="font-weight:800;color:#047857;">${vnd(s.gross_profit)}</div></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>#</th><th>Mã HĐ</th><th>Ngày</th><th>Kênh</th><th>Kho</th><th>Khách hàng</th><th class="num">SL</th><th class="num">Doanh thu</th><th class="num">Giá vốn</th><th class="num">Lãi gộp</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="10" style="text-align:center;">Không có phát sinh trong kỳ</td></tr>'}</tbody>
          <tfoot><tr><td colspan="6">TỔNG CỘNG</td><td class="num">${num(s.total_qty)}</td><td class="num">${vnd(s.total_revenue)}</td><td class="num">${vnd(s.total_cogs)}</td><td class="num">${vnd(s.gross_profit)}</td></tr></tfoot>
        </table>
      </div>`;
  } else if (currentMode === 'inventory' && lastReportData) {
    title = 'BÁO CÁO TỔNG HỢP XUẤT – NHẬP – TỒN KHO';
    const s = lastReportData.summary;
    const rows = (lastReportData.rows || []).map((r, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${esc(r.sku)}</b></td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.unit)}</td>
        <td class="num">${num(r.opening_qty)}</td>
        <td class="num">${num(r.in_qty)}</td>
        <td class="num">${num(r.out_qty)}</td>
        <td class="num">${num(r.adj_qty)}</td>
        <td class="num"><b>${num(r.closing_qty)}</b></td>
        <td class="num">${vnd(r.closing_value)}</td>
      </tr>`).join('');
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;background:#f8fbfe;padding:10px 14px;border:1px solid #d7e4f2;border-radius:8px;">
        <div><small>Tổng SKU đang kiểm kê</small><div style="font-weight:800;">${num(s.sku_count)} SKU</div></div>
        <div><small>Tổng tồn cuối kỳ</small><div style="font-weight:800;">${num(s.total_closing_qty)} sản phẩm</div></div>
        <div><small>Tổng Giá trị tồn kho</small><div style="font-weight:800;color:#0369a1;">${vnd(s.total_closing_value)}</div></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>#</th><th>SKU</th><th>Tên sản phẩm</th><th>ĐVT</th><th class="num">Đầu kỳ</th><th class="num">Nhập</th><th class="num">Xuất</th><th class="num">Điều chỉnh</th><th class="num">Cuối kỳ</th><th class="num">Giá trị tồn</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">TỔNG CỘNG</td><td class="num">${num(s.total_opening_qty)}</td><td class="num">${num(s.total_in_qty)}</td><td class="num">${num(s.total_out_qty)}</td><td class="num">${num(s.total_adj_qty)}</td><td class="num">${num(s.total_closing_qty)}</td><td class="num">${vnd(s.total_closing_value)}</td></tr></tfoot>
        </table>
      </div>`;
  } else if (currentMode === 'debt_cashflow' && lastReportData) {
    title = 'BÁO CÁO CÔNG NỢ & LƯU CHUYỂN TIỀN TỆ';
    const s = lastReportData.summary;
    const catRows = (lastReportData.cashflow_by_category || []).map((c, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td>${esc(cashDirectionMeta(c.tx_direction).label)}</td>
        <td><b>${esc(c.category)}</b></td>
        <td class="num">${num(c.count)}</td>
        <td class="num">${c.flow_type === 'IN' ? '+' : '-'}${vnd(c.amount)}</td>
      </tr>`).join('');
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px;background:#f8fbfe;padding:10px 14px;border:1px solid #d7e4f2;border-radius:8px;">
        <div><small>Phải thu Khách hàng (AR)</small><div style="font-weight:800;">${vnd(s.total_receivable_debt)} (${num(s.receivable_count)} KH)</div></div>
        <div><small>Phải trả NCC (AP)</small><div style="font-weight:800;">${vnd(s.total_payable_debt)} (${num(s.payable_count)} NCC)</div></div>
        <div><small>Tổng Thực thu / Thực chi kỳ</small><div style="font-weight:800;">+${vnd(s.total_in)} / -${vnd(s.total_out)}</div></div>
        <div><small>Dòng tiền ròng kỳ</small><div style="font-weight:800;">${s.net_cashflow >= 0 ? '' : '-'}${vnd(Math.abs(s.net_cashflow))}</div></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>#</th><th>Loại giao dịch</th><th>Hạng mục</th><th class="num">Số CT</th><th class="num">Số tiền</th></tr></thead>
          <tbody>${catRows}</tbody>
        </table>
      </div>`;
  } else if (lastOverviewData) {
    const k = lastOverviewData.kpi;
    const whRows = (lastOverviewData.warehouse_performance || []).map((w, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><b>${esc(w.code)}</b> — ${esc(w.name)}</td>
        <td>${esc(w.region)}</td>
        <td class="num">${num(w.orders)}</td>
        <td class="num">${vnd(w.revenue)}</td>
        <td class="num">${num(w.units)} / ${num(w.capacity)}</td>
        <td class="num">${vnd(w.valuation)}</td>
      </tr>`).join('');
    bodyHtml = `
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px;background:#f8fbfe;padding:10px 14px;border:1px solid #d7e4f2;border-radius:8px;">
        <div><small>Doanh thu kỳ</small><div style="font-weight:800;">${vnd(k.total_revenue)}</div></div>
        <div><small>Lãi gộp ước tính</small><div style="font-weight:800;">${vnd(k.gross_profit)} (${k.gross_margin_pct}%)</div></div>
        <div><small>Giá trị tồn kho</small><div style="font-weight:800;">${vnd(k.inventory_valuation)}</div></div>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-data-table">
          <thead><tr><th>#</th><th>Kho / Hub</th><th>Khu vực</th><th class="num">Đơn bán</th><th class="num">Doanh thu</th><th class="num">Tồn / Sức chứa</th><th class="num">Giá trị tồn</th></tr></thead>
          <tbody>${whRows}</tbody>
        </table>
      </div>`;
  }

  openDetailModal(title, `
    <div class="erp-voucher-a4">
      <div class="erp-voucher-a4-head">
        <div>
          <div style="font-size:1.05rem;font-weight:800;color:#071a33;">CÔNG TY TNHH CÔNG NGHỆ SKYCRUMB STUDIO</div>
          <div style="font-size:0.78rem;color:#476282;">Phạm vi kho: <b>${esc(whText)}</b> • Kỳ báo cáo: <b>${esc(dateText)}</b></div>
        </div>
        <div style="text-align:right;font-size:0.78rem;">
          <div><b>Ngày lập:</b> ${esc(stamp)}</div>
          <div><b>Người lập:</b> ${esc(creator)}</div>
        </div>
      </div>
      <div class="erp-voucher-a4-title"><h2>${esc(title)}</h2></div>
      ${bodyHtml}
      <div class="erp-sign-grid cols-3">
        <div class="erp-sign-box"><strong>Người lập báo cáo</strong><em>(Ký, họ tên)</em><div>${esc(creator)}</div></div>
        <div class="erp-sign-box"><strong>Kế toán trưởng</strong><em>(Ký, họ tên)</em><div>&nbsp;</div></div>
        <div class="erp-sign-box"><strong>Giám đốc</strong><em>(Ký, đóng dấu)</em><div>&nbsp;</div></div>
      </div>
    </div>
  `);
}
