/* ============================================================================
   SKYCRUMB ERP — SHARED API CLIENT, STATE CACHE & MODAL HELPERS
   ============================================================================ */

export const ERP = {
  user: null,
  meta: {
    db_client: 'sqlite',
    roles: [],
    warehouses: [],
    categories: [],
    suppliers: []
  },
  productsCache: [],
  customersCache: [],
  suppliersCache: [],
  activeTab: 'analytics',
  switchTab: null
};

export function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (m) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

export function vnd(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('vi-VN')}đ`;
}

export function num(n) {
  return (Number(n) || 0).toLocaleString('vi-VN');
}

export function getToken() {
  return (window.S25 && window.S25.getToken && window.S25.getToken()) || localStorage.getItem('skycrumb_erp_token_v1') || '';
}

export function hasPerm(perms) {
  const u = ERP.user;
  if (!u || !u.is_staff) return false;
  if (u.role_code === 'ADMIN' || (u.permissions || []).includes('ALL')) return true;
  const list = Array.isArray(perms) ? perms : [perms];
  return list.some((p) => !p || (u.permissions || []).includes(p));
}

export function showToast(message, type = 'ok') {
  const host = document.getElementById('adminToastHost');
  if (!host) return;
  while (host.children.length >= 3) host.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `admin-toast ${type}`;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 260);
  }, 3000);
}

export async function apiFetch(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };
  const resp = await fetch(url, {
    ...options,
    headers,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  let data = {};
  try { data = await resp.json(); } catch (_) {}
  if (resp.status === 401) {
    if (window.S25 && window.S25.logoutUser) window.S25.logoutUser();
    window.location.href = './login.html?next=admin.html';
    throw new Error('Phiên đăng nhập đã hết hạn.');
  }
  if (!resp.ok) {
    const err = new Error(data.error || `Yêu cầu thất bại (HTTP ${resp.status}).`);
    err.status = resp.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function refreshMeta() {
  const meta = await apiFetch('/api/meta');
  ERP.meta = meta;
  ERP.suppliersCache = meta.suppliers || [];
  const badge = document.getElementById('erpDbEngineBadge');
  if (badge) {
    badge.textContent = meta.db_client === 'mssql' ? 'SQL SERVER (ACTIVE)' : 'SQLITE • DUAL-DB READY';
  }
  return meta;
}

export async function refreshProductsCache() {
  const res = await apiFetch('/api/products');
  ERP.productsCache = res.items || [];
  return ERP.productsCache;
}

export async function refreshCustomersCache() {
  const res = await apiFetch('/api/customers');
  ERP.customersCache = res.items || [];
  return ERP.customersCache;
}

export async function refreshSuppliersCache() {
  const res = await apiFetch('/api/suppliers');
  ERP.suppliersCache = res.items || [];
  return ERP.suppliersCache;
}

export function setBanner(elId, type, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!msg) {
    el.className = 'erp-alert-banner';
    el.textContent = '';
    return;
  }
  el.className = `erp-alert-banner show ${type}`;
  el.textContent = msg;
}

export function openDetailModal(title, htmlContent) {
  const modal = document.getElementById('adminDetailModal');
  document.getElementById('adminDetailTitle').textContent = title;
  document.getElementById('adminDetailBody').innerHTML = htmlContent;
  modal.classList.add('open');
}

export function closeDetailModal() {
  document.getElementById('adminDetailModal')?.classList.remove('open');
}

export function openPaymentModal({ direction, entityId, entityName, currentDebt, refId = null, refCode = '', onDone }) {
  const modal = document.getElementById('adminPaymentModal');
  const isCust = direction === 'RECEIPT_FROM_CUSTOMER';
  document.getElementById('adminPayTitle').textContent = isCust ? 'Thu hồi Công nợ Khách hàng' : 'Thanh toán Công nợ Nhà cung cấp';
  const body = document.getElementById('adminPayBody');
  body.innerHTML = `
    <div id="payModalErr" class="erp-alert-banner"></div>
    <form id="erpPayForm" style="display:flex;flex-direction:column;gap:12px;">
      <div style="padding:12px;border-radius:10px;background:#f0f9ff;border:1px solid #bae6fd;font-size:0.82rem;">
        <div><b>${isCust ? 'Khách hàng' : 'Nhà cung cấp'}:</b> ${esc(entityName)}</div>
        ${refCode ? `<div><b>Chứng từ áp dụng:</b> ${esc(refCode)}</div>` : ''}
        <div style="margin-top:4px;"><b>Số dư công nợ hiện tại:</b> <span style="color:#be123c;font-weight:800;">${vnd(currentDebt)}</span></div>
      </div>
      <div class="admin-field">
        <label>Số tiền ${isCust ? 'thu' : 'chi trả'} (VNĐ) <span class="req">*</span></label>
        <input type="number" id="payModalAmount" class="admin-input" min="1" max="${Math.round(currentDebt)}" step="1" value="${Math.round(currentDebt)}" required />
      </div>
      <div class="admin-field">
        <label>Phương thức thanh toán</label>
        <select id="payModalMethod" class="admin-select">
          <option value="BANK_TRANSFER">Chuyển khoản Ngân hàng</option>
          <option value="CASH">Tiền mặt tại quầy</option>
          <option value="CARD">Thẻ / VNPAY</option>
        </select>
      </div>
      <div class="admin-field">
        <label>Ghi chú chứng từ</label>
        <input type="text" id="payModalNote" class="admin-input" value="${esc(refCode ? `Thanh toán cho ${refCode}` : `Đối trừ công nợ ${entityName}`)}" />
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px;">
        <button type="button" class="erp-btn erp-btn-outline" id="payModalCancelBtn">Hủy</button>
        <button type="submit" class="erp-btn erp-btn-ok" id="payModalSubmitBtn">Xác nhận Ghi sổ</button>
      </div>
    </form>
  `;
  modal.classList.add('open');

  document.getElementById('payModalCancelBtn').onclick = () => modal.classList.remove('open');
  document.getElementById('erpPayForm').onsubmit = async (e) => {
    e.preventDefault();
    setBanner('payModalErr', '', '');
    const amount = Number(document.getElementById('payModalAmount').value);
    const payment_method = document.getElementById('payModalMethod').value;
    const note = document.getElementById('payModalNote').value.trim();
    const btn = document.getElementById('payModalSubmitBtn');
    btn.disabled = true;
    try {
      const payload = {
        tx_direction: direction,
        amount,
        payment_method,
        note,
        ...(isCust ? { customer_id: entityId, invoice_id: refId } : { supplier_id: entityId, receipt_id: refId })
      };
      const res = await apiFetch('/api/payments', { method: 'POST', body: payload });
      showToast(res.message || 'Đã ghi nhận thanh toán công nợ.', 'ok');
      modal.classList.remove('open');
      if (onDone) await onDone();
    } catch (err) {
      setBanner('payModalErr', 'err', err.message);
    } finally {
      btn.disabled = false;
    }
  };
}

export function bindSharedModals() {
  document.getElementById('adminDetailCloseBtn')?.addEventListener('click', closeDetailModal);
  document.getElementById('adminDetailCloseFoot')?.addEventListener('click', closeDetailModal);
  document.getElementById('adminDetailPrintBtn')?.addEventListener('click', () => window.print());
  document.getElementById('adminDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'adminDetailModal') closeDetailModal();
  });
  document.getElementById('adminPayCloseBtn')?.addEventListener('click', () => {
    document.getElementById('adminPaymentModal')?.classList.remove('open');
  });
  document.getElementById('adminPaymentModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'adminPaymentModal') e.target.classList.remove('open');
  });
}

export function paymentBadge(status) {
  if (status === 'PAID') return '<span class="erp-badge ok">Đã thanh toán</span>';
  if (status === 'PARTIAL') return '<span class="erp-badge warn">Thanh toán 1 phần</span>';
  return '<span class="erp-badge danger">Chưa thanh toán</span>';
}

export function fulfillmentBadge(status) {
  if (status === 'COMPLETED') return '<span class="erp-badge ok">Hoàn tất</span>';
  if (status === 'DELIVERED') return '<span class="erp-badge info">Đang vận chuyển</span>';
  return '<span class="erp-badge warn">Đang xử lý / Lab</span>';
}

export function paymentMethodLabel(method) {
  if (method === 'CASH') return 'Tiền mặt';
  if (method === 'CARD') return 'Thẻ / VNPAY';
  return 'Chuyển khoản';
}

export function cashDirectionMeta(dir) {
  switch (dir) {
    case 'RECEIPT_FROM_CUSTOMER':
      return { label: 'Thu công nợ KH', shortLabel: 'Thu nợ KH', badgeClass: 'ok', flowType: 'IN', prefix: 'PT', docTitle: 'PHIẾU THU TIỀN' };
    case 'OTHER_RECEIPT':
      return { label: 'Phiếu thu khác', shortLabel: 'Thu khác', badgeClass: 'info', flowType: 'IN', prefix: 'PT', docTitle: 'PHIẾU THU TIỀN' };
    case 'PAYMENT_TO_SUPPLIER':
      return { label: 'Chi trả nợ NCC', shortLabel: 'Trả nợ NCC', badgeClass: 'warn', flowType: 'OUT', prefix: 'PC', docTitle: 'PHIẾU CHI TIỀN' };
    case 'OPERATING_EXPENSE':
      return { label: 'Chi phí vận hành', shortLabel: 'Chi vận hành', badgeClass: 'danger', flowType: 'OUT', prefix: 'PC', docTitle: 'PHIẾU CHI TIỀN' };
    default:
      return { label: dir || '---', shortLabel: dir || '---', badgeClass: 'navy', flowType: 'IN', prefix: 'GD', docTitle: 'CHỨNG TỪ QUỸ' };
  }
}

function escapeCsvCell(val) {
  const s = String(val ?? '');
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function downloadCsvUtf8(filename, headers, rows) {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(','))
  ];
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const VN_DIGITS = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
const VN_SCALES = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

function readThreeDigits(num, fullZero) {
  const hundreds = Math.floor(num / 100);
  const tens = Math.floor((num % 100) / 10);
  const units = num % 10;
  const parts = [];

  if (hundreds > 0 || fullZero) {
    parts.push(`${VN_DIGITS[hundreds]} trăm`);
  }
  if (tens > 1) {
    parts.push(`${VN_DIGITS[tens]} mươi`);
    if (units === 1) parts.push('mốt');
    else if (units === 4) parts.push('bốn');
    else if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(VN_DIGITS[units]);
  } else if (tens === 1) {
    parts.push('mười');
    if (units === 5) parts.push('lăm');
    else if (units > 0) parts.push(VN_DIGITS[units]);
  } else if (units > 0) {
    if (hundreds > 0 || fullZero) parts.push('linh');
    parts.push(VN_DIGITS[units]);
  }
  return parts.join(' ').trim();
}

export function readMoneyVietnamese(amount) {
  const n = Math.round(Math.abs(Number(amount) || 0));
  if (n === 0) return 'Không đồng chẵn';

  const groups = [];
  let rem = n;
  while (rem > 0) {
    groups.push(rem % 1000);
    rem = Math.floor(rem / 1000);
  }

  const out = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    const isMostSignificant = i === groups.length - 1;
    const txt = readThreeDigits(g, !isMostSignificant);
    out.push(`${txt}${VN_SCALES[i] ? ` ${VN_SCALES[i]}` : ''}`);
  }
  const joined = out.join(' ').replace(/\s+/g, ' ').trim();
  const cap = joined.charAt(0).toUpperCase() + joined.slice(1);
  return `${cap} đồng chẵn`;
}
