import {
  ERP,
  apiFetch,
  refreshCustomersCache,
  refreshSuppliersCache,
  hasPerm,
  esc,
  vnd,
  num,
  showToast,
  setBanner,
  openPaymentModal
} from './api.js';

let partnersInit = false;
let usersInit = false;
let partnerMode = 'customers';
let editCustId = null;
let editSupId = null;
let editUserId = null;
let custRows = [];
let supRows = [];
let userRows = [];

/* ============================================================================
 *  TAB 7: CUSTOMERS & SUPPLIERS CRUD + AR/AP DEBT SETTLEMENT
 * ============================================================================ */
export async function renderPartnersTab() {
  const host = document.getElementById('tab-partners');
  const canCust = hasPerm(['CUSTOMERS', 'SALES']);
  const canSup = hasPerm(['SUPPLIERS', 'PURCHASES']);

  if (!partnersInit) {
    partnersInit = true;
    partnerMode = canCust ? 'customers' : 'suppliers';

    host.innerHTML = `
      <div class="erp-sub-pills" id="partnerSubPills">
        ${canCust ? `<button type="button" class="erp-sub-pill ${partnerMode === 'customers' ? 'active' : ''}" data-pmode="customers">Quản lý Khách hàng (CRM &amp; Công nợ Phải thu)</button>` : ''}
        ${canSup ? `<button type="button" class="erp-sub-pill ${partnerMode === 'suppliers' ? 'active' : ''}" data-pmode="suppliers">Quản lý Nhà cung cấp (Vendor &amp; Công nợ Phải trả)</button>` : ''}
      </div>

      <div id="partnerCustomersPane" style="display:${partnerMode === 'customers' ? 'block' : 'none'};">
        <div class="admin-card">
          <div class="admin-card-head">
            <h2 class="admin-card-title" id="custFormTitle">Quản lý Khách hàng — Thêm mới / Cập nhật</h2>
            <span class="admin-card-sub">Hỗ trợ phân hạng Lẻ (RETAIL), VIP và Doanh nghiệp (B2B) kèm hạn mức tín dụng</span>
          </div>
          <div id="custFormBanner" class="erp-alert-banner"></div>
          <form id="custForm">
            <div class="admin-form-grid">
              <div class="admin-field"><label>Mã KH (để trống tự sinh)</label><input type="text" id="cfCustCode" class="admin-input" placeholder="VD: KH-0099" /></div>
              <div class="admin-field span-2"><label>Tên khách hàng / Doanh nghiệp <span class="req">*</span></label><input type="text" id="cfCustName" class="admin-input" required /></div>
              <div class="admin-field"><label>Phân hạng</label><select id="cfCustType" class="admin-select"><option value="RETAIL">Khách lẻ (RETAIL)</option><option value="VIP">Khách VIP</option><option value="B2B">Doanh nghiệp (B2B)</option></select></div>
              <div class="admin-field"><label>Số điện thoại <span class="req">*</span></label><input type="tel" id="cfCustPhone" class="admin-input" placeholder="09xxxxxxxx" required /></div>
              <div class="admin-field"><label>Email</label><input type="email" id="cfCustEmail" class="admin-input" placeholder="email@domain.vn" /></div>
              <div class="admin-field"><label>Mã số thuế (B2B)</label><input type="text" id="cfCustTax" class="admin-input" placeholder="010xxxxxxx" /></div>
              <div class="admin-field"><label>Khu vực giao hàng</label><select id="cfCustRegion" class="admin-select"><option value="Miền Bắc">Miền Bắc</option><option value="Miền Trung">Miền Trung</option><option value="Miền Nam">Miền Nam</option><option value="Toàn Quốc">Toàn Quốc</option></select></div>
              <div class="admin-field"><label>Hạn mức công nợ (VNĐ)</label><input type="number" id="cfCustLimit" class="admin-input" min="0" step="1" value="50000000" /></div>
              <div class="admin-field span-2"><label>Địa chỉ</label><input type="text" id="cfCustAddr" class="admin-input" /></div>
              <div class="admin-field"><label>Trạng thái</label><select id="cfCustActive" class="admin-select"><option value="1">Đang hoạt động</option><option value="0">Tạm khóa</option></select></div>
            </div>
            <div class="admin-form-actions">
              <button type="submit" class="erp-btn erp-btn-primary" id="cfCustSubmit">Thêm mới Khách hàng</button>
              <button type="button" class="erp-btn erp-btn-danger" id="cfCustDelete" style="display:none;">Xóa Khách hàng</button>
              <button type="button" class="erp-btn erp-btn-outline" id="cfCustReset">Làm mới</button>
            </div>
          </form>
        </div>

        <div class="admin-card">
          <div class="admin-card-head">
            <h2 class="admin-card-title">Danh sách Khách hàng</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="csCustQ" class="admin-input" style="width:190px;" placeholder="Tên, mã, SĐT, email..." />
              <select id="csCustType" class="admin-select" style="width:130px;"><option value="">Tất cả hạng</option><option value="RETAIL">RETAIL</option><option value="VIP">VIP</option><option value="B2B">B2B</option></select>
              <select id="csCustRegion" class="admin-select" style="width:140px;"><option value="">Tất cả vùng</option><option value="Miền Bắc">Miền Bắc</option><option value="Miền Trung">Miền Trung</option><option value="Miền Nam">Miền Nam</option></select>
              <select id="csCustDebt" class="admin-select" style="width:145px;"><option value="">Tất cả công nợ</option><option value="1">Đang có công nợ</option><option value="0">Không có nợ</option></select>
              <button type="button" class="erp-btn erp-btn-navy" id="csCustBtn">Tìm kiếm</button>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Mã / Tên khách hàng</th>
                  <th>Liên hệ &amp; Khu vực</th>
                  <th>Hạng</th>
                  <th class="num">Tổng chi tiêu</th>
                  <th class="num">Hạn mức TD</th>
                  <th class="num">Nợ phải thu (AR)</th>
                  <th>TT</th>
                  <th style="text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody id="custTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="partnerSuppliersPane" style="display:${partnerMode === 'suppliers' ? 'block' : 'none'};">
        <div class="admin-card">
          <div class="admin-card-head">
            <h2 class="admin-card-title" id="supFormTitle">Quản lý Nhà cung cấp — Thêm mới / Cập nhật</h2>
            <span class="admin-card-sub">Theo dõi thời gian giao hàng (Lead time), hạn thanh toán và công nợ phải trả (AP)</span>
          </div>
          <div id="supFormBanner" class="erp-alert-banner"></div>
          <form id="supForm">
            <div class="admin-form-grid">
              <div class="admin-field"><label>Mã NCC <span class="req">*</span></label><input type="text" id="sfCode" class="admin-input" placeholder="VD: NCC-CORSAIR" required /></div>
              <div class="admin-field span-2"><label>Tên Nhà cung cấp <span class="req">*</span></label><input type="text" id="sfName" class="admin-input" required /></div>
              <div class="admin-field"><label>Mã số thuế</label><input type="text" id="sfTax" class="admin-input" /></div>
              <div class="admin-field"><label>Người liên hệ</label><input type="text" id="sfContact" class="admin-input" /></div>
              <div class="admin-field"><label>Số điện thoại <span class="req">*</span></label><input type="tel" id="sfPhone" class="admin-input" required /></div>
              <div class="admin-field"><label>Email <span class="req">*</span></label><input type="email" id="sfEmail" class="admin-input" required /></div>
              <div class="admin-field"><label>Hạn thanh toán (Ngày)</label><input type="number" id="sfTerms" class="admin-input" min="0" max="365" value="30" /></div>
              <div class="admin-field"><label>Lead Time giao hàng (Ngày)</label><input type="number" id="sfLead" class="admin-input" min="1" max="180" value="3" /></div>
              <div class="admin-field"><label>Đánh giá (1.0 – 5.0)</label><input type="number" id="sfRating" class="admin-input" min="1" max="5" step="0.1" value="5.0" /></div>
              <div class="admin-field span-2"><label>Địa chỉ</label><input type="text" id="sfAddr" class="admin-input" /></div>
            </div>
            <div class="admin-form-actions">
              <button type="submit" class="erp-btn erp-btn-primary" id="sfSubmit">Thêm mới Nhà cung cấp</button>
              <button type="button" class="erp-btn erp-btn-danger" id="sfDelete" style="display:none;">Xóa Nhà cung cấp</button>
              <button type="button" class="erp-btn erp-btn-outline" id="sfReset">Làm mới</button>
            </div>
          </form>
        </div>

        <div class="admin-card">
          <div class="admin-card-head">
            <h2 class="admin-card-title">Danh sách Nhà cung cấp</h2>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <input type="text" id="ssSupQ" class="admin-input" style="width:210px;" placeholder="Tìm mã, tên, liên hệ, SĐT..." />
              <select id="ssSupDebt" class="admin-select" style="width:155px;"><option value="">Tất cả công nợ</option><option value="1">Đang nợ NCC</option><option value="0">Không có nợ</option></select>
              <button type="button" class="erp-btn erp-btn-navy" id="ssSupBtn">Tìm kiếm</button>
            </div>
          </div>
          <div class="admin-table-wrap">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Mã / Tên Nhà cung cấp</th>
                  <th>Liên hệ &amp; Email</th>
                  <th class="num">Hạn TT / Lead</th>
                  <th class="num">Đánh giá</th>
                  <th class="num">Tổng đã nhập</th>
                  <th class="num">Nợ phải trả (AP)</th>
                  <th style="text-align:right;">Thao tác</th>
                </tr>
              </thead>
              <tbody id="supTableBody"></tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('#partnerSubPills [data-pmode]').forEach((b) => {
      b.onclick = () => {
        partnerMode = b.dataset.pmode;
        document.querySelectorAll('#partnerSubPills [data-pmode]').forEach((x) => x.classList.toggle('active', x === b));
        document.getElementById('partnerCustomersPane').style.display = partnerMode === 'customers' ? 'block' : 'none';
        document.getElementById('partnerSuppliersPane').style.display = partnerMode === 'suppliers' ? 'block' : 'none';
      };
    });

    document.getElementById('custForm').onsubmit = saveCustomer;
    document.getElementById('cfCustReset').onclick = resetCustForm;
    document.getElementById('cfCustDelete').onclick = () => { if (editCustId) deleteCustomer(editCustId); };
    document.getElementById('csCustBtn').onclick = loadCustomers;

    document.getElementById('supForm').onsubmit = saveSupplier;
    document.getElementById('sfReset').onclick = resetSupForm;
    document.getElementById('sfDelete').onclick = () => { if (editSupId) deleteSupplier(editSupId); };
    document.getElementById('ssSupBtn').onclick = loadSuppliers;
  }

  const jobs = [];
  if (canCust) jobs.push(loadCustomers());
  if (canSup) jobs.push(loadSuppliers());
  await Promise.all(jobs);
}

function resetCustForm() {
  editCustId = null;
  document.getElementById('custForm').reset();
  document.getElementById('cfCustLimit').value = '50000000';
  document.getElementById('custFormTitle').textContent = 'Quản lý Khách hàng — Thêm mới / Cập nhật';
  document.getElementById('cfCustSubmit').textContent = 'Thêm mới Khách hàng';
  document.getElementById('cfCustDelete').style.display = 'none';
  setBanner('custFormBanner', '', '');
}

async function saveCustomer(e) {
  e.preventDefault();
  setBanner('custFormBanner', '', '');
  const payload = {
    code: document.getElementById('cfCustCode').value.trim(),
    name: document.getElementById('cfCustName').value.trim(),
    customer_type: document.getElementById('cfCustType').value,
    phone: document.getElementById('cfCustPhone').value.trim(),
    email: document.getElementById('cfCustEmail').value.trim(),
    tax_code: document.getElementById('cfCustTax').value.trim(),
    region: document.getElementById('cfCustRegion').value,
    credit_limit: Number(document.getElementById('cfCustLimit').value || 0),
    address: document.getElementById('cfCustAddr').value.trim(),
    is_active: Number(document.getElementById('cfCustActive').value)
  };
  try {
    const res = editCustId
      ? await apiFetch(`/api/customers/${editCustId}`, { method: 'PUT', body: payload })
      : await apiFetch('/api/customers', { method: 'POST', body: payload });
    showToast(res.message || 'Đã lưu khách hàng.', 'ok');
    resetCustForm();
    await refreshCustomersCache();
    await loadCustomers();
  } catch (err) {
    setBanner('custFormBanner', 'err', err.message);
  }
}

async function deleteCustomer(id) {
  if (!confirm('Xác nhận xóa khách hàng này?')) return;
  try {
    const res = await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Đã xóa khách hàng.', 'ok');
    if (editCustId === id) resetCustForm();
    await refreshCustomersCache();
    await loadCustomers();
  } catch (err) {
    setBanner('custFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  }
}

async function loadCustomers() {
  const qs = new URLSearchParams();
  const q = document.getElementById('csCustQ')?.value?.trim();
  const t = document.getElementById('csCustType')?.value;
  const r = document.getElementById('csCustRegion')?.value;
  const d = document.getElementById('csCustDebt')?.value;
  if (q) qs.set('q', q);
  if (t) qs.set('customer_type', t);
  if (r) qs.set('region', r);
  if (d !== '') qs.set('has_debt', d);

  const res = await apiFetch(`/api/customers?${qs.toString()}`);
  custRows = res.items || [];
  const tbody = document.getElementById('custTableBody');
  tbody.innerHTML = custRows.map((c) => `
    <tr>
      <td><b>${esc(c.code)}</b> — ${esc(c.name)}${c.tax_code ? `<div style="font-size:0.7rem;color:var(--erp-muted);">MST: ${esc(c.tax_code)}</div>` : ''}</td>
      <td>${esc(c.phone)} • ${esc(c.email || '---')}<div style="font-size:0.7rem;color:var(--erp-muted);">${esc(c.region)} ${c.address ? '• ' + esc(c.address) : ''}</div></td>
      <td><span class="erp-badge ${c.customer_type === 'B2B' ? 'navy' : c.customer_type === 'VIP' ? 'info' : 'ok'}">${esc(c.customer_type)}</span></td>
      <td class="num"><b>${vnd(c.total_spent)}</b><div style="font-size:0.7rem;color:var(--erp-muted);">${c.order_count} đơn</div></td>
      <td class="num">${vnd(c.credit_limit)}</td>
      <td class="num" style="font-weight:800;color:${c.receivable_debt > 0 ? '#be123c' : '#047857'};">${vnd(c.receivable_debt)}</td>
      <td>${c.is_active ? '<span class="erp-badge ok">Active</span>' : '<span class="erp-badge navy">Khóa</span>'}</td>
      <td style="text-align:right;white-space:nowrap;">
        ${c.receivable_debt > 0 ? `<button type="button" class="erp-btn sm erp-btn-ok" data-pay-cust="${c.id}">Thu nợ</button>` : ''}
        <button type="button" class="erp-btn sm erp-btn-outline" data-edit-cust="${c.id}">Sửa</button>
        <button type="button" class="erp-btn sm erp-btn-danger" data-del-cust="${c.id}">Xóa</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-edit-cust]').forEach((b) => {
    b.onclick = () => {
      const c = custRows.find((x) => x.id === Number(b.dataset.editCust));
      if (!c) return;
      editCustId = c.id;
      document.getElementById('cfCustCode').value = c.code;
      document.getElementById('cfCustName').value = c.name;
      document.getElementById('cfCustType').value = c.customer_type;
      document.getElementById('cfCustPhone').value = c.phone;
      document.getElementById('cfCustEmail').value = c.email || '';
      document.getElementById('cfCustTax').value = c.tax_code || '';
      document.getElementById('cfCustRegion').value = c.region || 'Miền Bắc';
      document.getElementById('cfCustLimit').value = c.credit_limit;
      document.getElementById('cfCustAddr').value = c.address || '';
      document.getElementById('cfCustActive').value = String(c.is_active);
      document.getElementById('custFormTitle').textContent = `Đang sửa Khách hàng #${c.id} — ${c.code}`;
      document.getElementById('cfCustSubmit').textContent = 'Cập nhật Khách hàng';
      document.getElementById('cfCustDelete').style.display = 'inline-flex';
      setBanner('custFormBanner', '', '');
    };
  });
  tbody.querySelectorAll('[data-del-cust]').forEach((b) => { b.onclick = () => deleteCustomer(Number(b.dataset.delCust)); });
  tbody.querySelectorAll('[data-pay-cust]').forEach((b) => {
    b.onclick = () => {
      const c = custRows.find((x) => x.id === Number(b.dataset.payCust));
      if (!c) return;
      openPaymentModal({
        direction: 'RECEIPT_FROM_CUSTOMER',
        entityId: c.id,
        entityName: c.name,
        currentDebt: c.receivable_debt,
        onDone: async () => { await refreshCustomersCache(); await loadCustomers(); }
      });
    };
  });
}

function resetSupForm() {
  editSupId = null;
  document.getElementById('supForm').reset();
  document.getElementById('sfTerms').value = '30';
  document.getElementById('sfLead').value = '3';
  document.getElementById('sfRating').value = '5.0';
  document.getElementById('supFormTitle').textContent = 'Quản lý Nhà cung cấp — Thêm mới / Cập nhật';
  document.getElementById('sfSubmit').textContent = 'Thêm mới Nhà cung cấp';
  document.getElementById('sfDelete').style.display = 'none';
  setBanner('supFormBanner', '', '');
}

async function saveSupplier(e) {
  e.preventDefault();
  setBanner('supFormBanner', '', '');
  const payload = {
    code: document.getElementById('sfCode').value.trim(),
    name: document.getElementById('sfName').value.trim(),
    tax_code: document.getElementById('sfTax').value.trim(),
    contact_person: document.getElementById('sfContact').value.trim(),
    phone: document.getElementById('sfPhone').value.trim(),
    email: document.getElementById('sfEmail').value.trim(),
    payment_terms_days: Number(document.getElementById('sfTerms').value),
    lead_time_days: Number(document.getElementById('sfLead').value),
    rating: Number(document.getElementById('sfRating').value),
    address: document.getElementById('sfAddr').value.trim()
  };
  try {
    const res = editSupId
      ? await apiFetch(`/api/suppliers/${editSupId}`, { method: 'PUT', body: payload })
      : await apiFetch('/api/suppliers', { method: 'POST', body: payload });
    showToast(res.message || 'Đã lưu nhà cung cấp.', 'ok');
    resetSupForm();
    await refreshSuppliersCache();
    await loadSuppliers();
  } catch (err) {
    setBanner('supFormBanner', 'err', err.message);
  }
}

async function deleteSupplier(id) {
  if (!confirm('Xác nhận xóa nhà cung cấp này?')) return;
  try {
    const res = await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Đã xóa nhà cung cấp.', 'ok');
    if (editSupId === id) resetSupForm();
    await refreshSuppliersCache();
    await loadSuppliers();
  } catch (err) {
    setBanner('supFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  }
}

async function loadSuppliers() {
  const qs = new URLSearchParams();
  const q = document.getElementById('ssSupQ')?.value?.trim();
  const d = document.getElementById('ssSupDebt')?.value;
  if (q) qs.set('q', q);
  if (d !== '') qs.set('has_debt', d);

  const res = await apiFetch(`/api/suppliers?${qs.toString()}`);
  supRows = res.items || [];
  const tbody = document.getElementById('supTableBody');
  tbody.innerHTML = supRows.map((s) => `
    <tr>
      <td><b>${esc(s.code)}</b> — ${esc(s.name)}${s.tax_code ? `<div style="font-size:0.7rem;color:var(--erp-muted);">MST: ${esc(s.tax_code)}</div>` : ''}</td>
      <td>${esc(s.contact_person || '---')} • ${esc(s.phone)}<div style="font-size:0.7rem;color:var(--erp-muted);">${esc(s.email)}</div></td>
      <td class="num">${s.payment_terms_days} ngày / ${s.lead_time_days}d</td>
      <td class="num"><span class="erp-badge info">${Number(s.rating).toFixed(1)} / 5</span></td>
      <td class="num"><b>${vnd(s.total_purchased)}</b><div style="font-size:0.7rem;color:var(--erp-muted);">${s.receipt_count} phiếu</div></td>
      <td class="num" style="font-weight:800;color:${s.payable_debt > 0 ? '#be123c' : '#047857'};">${vnd(s.payable_debt)}</td>
      <td style="text-align:right;white-space:nowrap;">
        ${s.payable_debt > 0 ? `<button type="button" class="erp-btn sm erp-btn-ok" data-pay-sup="${s.id}">Trả nợ</button>` : ''}
        <button type="button" class="erp-btn sm erp-btn-outline" data-edit-sup="${s.id}">Sửa</button>
        <button type="button" class="erp-btn sm erp-btn-danger" data-del-sup="${s.id}">Xóa</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-edit-sup]').forEach((b) => {
    b.onclick = () => {
      const s = supRows.find((x) => x.id === Number(b.dataset.editSup));
      if (!s) return;
      editSupId = s.id;
      document.getElementById('sfCode').value = s.code;
      document.getElementById('sfName').value = s.name;
      document.getElementById('sfTax').value = s.tax_code || '';
      document.getElementById('sfContact').value = s.contact_person || '';
      document.getElementById('sfPhone').value = s.phone;
      document.getElementById('sfEmail').value = s.email;
      document.getElementById('sfTerms').value = s.payment_terms_days;
      document.getElementById('sfLead').value = s.lead_time_days;
      document.getElementById('sfRating').value = s.rating;
      document.getElementById('sfAddr').value = s.address || '';
      document.getElementById('supFormTitle').textContent = `Đang sửa Nhà cung cấp #${s.id} — ${s.code}`;
      document.getElementById('sfSubmit').textContent = 'Cập nhật Nhà cung cấp';
      document.getElementById('sfDelete').style.display = 'inline-flex';
      setBanner('supFormBanner', '', '');
    };
  });
  tbody.querySelectorAll('[data-del-sup]').forEach((b) => { b.onclick = () => deleteSupplier(Number(b.dataset.delSup)); });
  tbody.querySelectorAll('[data-pay-sup]').forEach((b) => {
    b.onclick = () => {
      const s = supRows.find((x) => x.id === Number(b.dataset.paySup));
      if (!s) return;
      openPaymentModal({
        direction: 'PAYMENT_TO_SUPPLIER',
        entityId: s.id,
        entityName: s.name,
        currentDebt: s.payable_debt,
        onDone: async () => { await refreshSuppliersCache(); await loadSuppliers(); }
      });
    };
  });
}

/* ============================================================================
 *  TAB 8: USERS CRUD & RBAC PERMISSIONS MATRIX (ADMIN ONLY)
 * ============================================================================ */
export async function renderUsersTab() {
  const host = document.getElementById('tab-users');
  if (!usersInit) {
    usersInit = true;
    const roleOpts = (ERP.meta.roles || []).map((r) => `<option value="${r.id}">${esc(r.code)} — ${esc(r.name)}</option>`).join('');
    const whOpts = '<option value="">Toàn hệ thống (5 kho)</option>' + (ERP.meta.warehouses || []).map((w) => `<option value="${w.id}">${esc(w.code)} — ${esc(w.name)}</option>`).join('');

    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title" id="usrFormTitle">Quản lý Người dùng &amp; Phân quyền RBAC — Thêm mới / Cập nhật</h2>
          <span class="admin-card-sub">Phân quyền chặt 2 lớp (Frontend UI + Backend API HTTP 403) theo Vai trò &amp; Kho trực thuộc</span>
        </div>
        <div id="usrFormBanner" class="erp-alert-banner"></div>
        <form id="usrForm">
          <div class="admin-form-grid">
            <div class="admin-field"><label>Tên đăng nhập <span class="req">*</span></label><input type="text" id="ufUser" class="admin-input" placeholder="VD: kho.dn" required /></div>
            <div class="admin-field"><label>Mật khẩu <span id="ufPwdReq" class="req">*</span></label><input type="password" id="ufPwd" class="admin-input" placeholder="Tối thiểu 6 ký tự" /></div>
            <div class="admin-field span-2"><label>Họ và tên nhân viên <span class="req">*</span></label><input type="text" id="ufName" class="admin-input" required /></div>
            <div class="admin-field"><label>Email nội bộ <span class="req">*</span></label><input type="email" id="ufEmail" class="admin-input" placeholder="ten@skycrumb.vn" required /></div>
            <div class="admin-field"><label>Số điện thoại <span class="req">*</span></label><input type="tel" id="ufPhone" class="admin-input" placeholder="09xxxxxxxx" required /></div>
            <div class="admin-field"><label>Vai trò phân quyền <span class="req">*</span></label><select id="ufRole" class="admin-select" required>${roleOpts}</select></div>
            <div class="admin-field"><label>Kho trực thuộc</label><select id="ufWh" class="admin-select">${whOpts}</select></div>
            <div class="admin-field"><label>Trạng thái tài khoản</label><select id="ufActive" class="admin-select"><option value="1">Đang hoạt động</option><option value="0">Khóa tài khoản</option></select></div>
          </div>
          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="ufSubmit">Tạo tài khoản nhân viên</button>
            <button type="button" class="erp-btn erp-btn-danger" id="ufDelete" style="display:none;">Xóa tài khoản</button>
            <button type="button" class="erp-btn erp-btn-outline" id="ufReset">Làm mới</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Danh sách Tài khoản Nhân sự</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="usQ" class="admin-input" style="width:200px;" placeholder="Tìm username, họ tên, email..." />
            <select id="usRole" class="admin-select" style="width:190px;"><option value="">Tất cả vai trò</option>${roleOpts}</select>
            <button type="button" class="erp-btn erp-btn-navy" id="usBtn">Tìm kiếm</button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Username</th>
                <th>Họ và tên</th>
                <th>Email / SĐT</th>
                <th>Vai trò RBAC</th>
                <th>Kho trực thuộc</th>
                <th>Đăng nhập cuối</th>
                <th>TT</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="usrTableBody"></tbody>
          </table>
        </div>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Ma trận Phân quyền Vai trò (RBAC Matrix)</h2>
          <span class="admin-card-sub">Áp dụng đồng thời trên giao diện Tab và từng API Route phía Server</span>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead><tr><th>Mã Vai trò</th><th>Tên Vai trò</th><th>Mô tả nghiệp vụ</th><th>Quyền hạn (Permissions)</th></tr></thead>
            <tbody>
              ${(ERP.meta.roles || []).map((r) => `
                <tr>
                  <td><span class="erp-badge navy">${esc(r.code)}</span></td>
                  <td><b>${esc(r.name)}</b></td>
                  <td>${esc(r.description)}</td>
                  <td>${(r.permissions || []).map((p) => `<span class="erp-badge info" style="margin:2px;">${esc(p)}</span>`).join('')}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('usrForm').onsubmit = saveUser;
    document.getElementById('ufReset').onclick = resetUserForm;
    document.getElementById('ufDelete').onclick = () => { if (editUserId) deleteUser(editUserId); };
    document.getElementById('usBtn').onclick = loadUsers;
  }

  await loadUsers();
}

function resetUserForm() {
  editUserId = null;
  document.getElementById('usrForm').reset();
  document.getElementById('ufUser').readOnly = false;
  document.getElementById('ufPwd').placeholder = 'Tối thiểu 6 ký tự';
  document.getElementById('usrFormTitle').textContent = 'Quản lý Người dùng & Phân quyền RBAC — Thêm mới / Cập nhật';
  document.getElementById('ufSubmit').textContent = 'Tạo tài khoản nhân viên';
  document.getElementById('ufDelete').style.display = 'none';
  setBanner('usrFormBanner', '', '');
}

async function saveUser(e) {
  e.preventDefault();
  setBanner('usrFormBanner', '', '');
  const pwd = document.getElementById('ufPwd').value;
  if (!editUserId && pwd.length < 6) {
    setBanner('usrFormBanner', 'err', 'Mật khẩu tạo mới phải có tối thiểu 6 ký tự.');
    return;
  }
  const payload = {
    username: document.getElementById('ufUser').value.trim(),
    ...(pwd ? { password: pwd } : {}),
    full_name: document.getElementById('ufName').value.trim(),
    email: document.getElementById('ufEmail').value.trim(),
    phone: document.getElementById('ufPhone').value.trim(),
    role_id: Number(document.getElementById('ufRole').value),
    warehouse_id: document.getElementById('ufWh').value ? Number(document.getElementById('ufWh').value) : null,
    is_active: Number(document.getElementById('ufActive').value)
  };
  try {
    const res = editUserId
      ? await apiFetch(`/api/users/${editUserId}`, { method: 'PUT', body: payload })
      : await apiFetch('/api/users', { method: 'POST', body: payload });
    showToast(res.message || 'Đã lưu người dùng.', 'ok');
    resetUserForm();
    await loadUsers();
  } catch (err) {
    setBanner('usrFormBanner', 'err', err.message);
  }
}

async function deleteUser(id) {
  if (!confirm('Xác nhận xóa tài khoản nhân viên này?')) return;
  try {
    const res = await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Đã xóa người dùng.', 'ok');
    if (editUserId === id) resetUserForm();
    await loadUsers();
  } catch (err) {
    setBanner('usrFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  }
}

async function loadUsers() {
  const qs = new URLSearchParams();
  const q = document.getElementById('usQ')?.value?.trim();
  const r = document.getElementById('usRole')?.value;
  if (q) qs.set('q', q);
  if (r) qs.set('role_id', r);
  const res = await apiFetch(`/api/users?${qs.toString()}`);
  userRows = res.items || [];
  const tbody = document.getElementById('usrTableBody');
  tbody.innerHTML = userRows.map((u) => `
    <tr>
      <td><b>${esc(u.username)}</b></td>
      <td><b>${esc(u.full_name)}</b></td>
      <td>${esc(u.email)}<div style="font-size:0.71rem;color:var(--erp-muted);">${esc(u.phone)}</div></td>
      <td><span class="erp-badge ${u.role_code === 'ADMIN' ? 'navy' : 'info'}">${esc(u.role_code)}</span><div style="font-size:0.7rem;color:var(--erp-muted);margin-top:2px;">${esc(u.role_name)}</div></td>
      <td>${esc(u.warehouse_code ? `${u.warehouse_code} — ${u.warehouse_name}` : 'Toàn hệ thống')}</td>
      <td style="font-size:0.74rem;">${esc(u.last_login_at || 'Chưa đăng nhập')}</td>
      <td>${u.is_active ? '<span class="erp-badge ok">Hoạt động</span>' : '<span class="erp-badge danger">Đã khóa</span>'}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="erp-btn sm erp-btn-outline" data-edit-usr="${u.id}">Sửa</button>
        ${u.id !== 1 && u.id !== ERP.user?.id ? `<button type="button" class="erp-btn sm erp-btn-danger" data-del-usr="${u.id}">Xóa</button>` : ''}
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-edit-usr]').forEach((b) => {
    b.onclick = () => {
      const u = userRows.find((x) => x.id === Number(b.dataset.editUsr));
      if (!u) return;
      editUserId = u.id;
      document.getElementById('ufUser').value = u.username;
      document.getElementById('ufUser').readOnly = true;
      document.getElementById('ufPwd').value = '';
      document.getElementById('ufPwd').placeholder = 'Để trống nếu giữ nguyên mật khẩu';
      document.getElementById('ufName').value = u.full_name;
      document.getElementById('ufEmail').value = u.email;
      document.getElementById('ufPhone').value = u.phone;
      document.getElementById('ufRole').value = String(u.role_id);
      document.getElementById('ufWh').value = u.warehouse_id ? String(u.warehouse_id) : '';
      document.getElementById('ufActive').value = String(u.is_active);
      document.getElementById('usrFormTitle').textContent = `Đang sửa Người dùng #${u.id} — ${u.username}`;
      document.getElementById('ufSubmit').textContent = 'Cập nhật Người dùng';
      document.getElementById('ufDelete').style.display = u.id !== 1 && u.id !== ERP.user?.id ? 'inline-flex' : 'none';
      setBanner('usrFormBanner', '', '');
    };
  });
  tbody.querySelectorAll('[data-del-usr]').forEach((b) => { b.onclick = () => deleteUser(Number(b.dataset.delUsr)); });
}
