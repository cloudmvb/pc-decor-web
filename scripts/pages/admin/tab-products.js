import {
  ERP,
  apiFetch,
  refreshMeta,
  refreshProductsCache,
  esc,
  vnd,
  num,
  showToast,
  setBanner
} from './api.js';

let prodInit = false;
let catInit = false;
let editingProductId = null;
let editingCategoryId = null;
let productsList = [];
let categoriesList = [];

function buildSelectOptions(items, valKey, labelFn, emptyLabel = '') {
  const head = emptyLabel ? `<option value="">${esc(emptyLabel)}</option>` : '';
  return head + (items || []).map((it) => `<option value="${esc(it[valKey])}">${esc(labelFn(it))}</option>`).join('');
}

/* ============================================================================
 *  TAB 1: PRODUCTS CRUD + IMAGE UPLOAD + MULTI-CRITERIA SEARCH
 * ============================================================================ */
export async function renderProductsTab() {
  const host = document.getElementById('tab-products');
  if (!prodInit) {
    prodInit = true;
    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title" id="prodFormHeading">Quản lý Sản phẩm — Thêm mới / Cập nhật</h2>
          <span class="admin-card-sub">Đồng bộ SKU danh mục chuẩn 3NF, tự động khởi tạo thẻ tồn kho tại 5 Hub toàn quốc</span>
        </div>
        <div id="prodFormBanner" class="erp-alert-banner"></div>
        <form id="prodForm">
          <div class="admin-form-grid">
            <div class="admin-field">
              <label>Mã SKU <span class="req">*</span></label>
              <input type="text" id="pfSku" class="admin-input" placeholder="VD: GPU-RTX5090-01" required />
            </div>
            <div class="admin-field span-2">
              <label>Tên sản phẩm <span class="req">*</span></label>
              <input type="text" id="pfName" class="admin-input" placeholder="Nhập tên đầy đủ sản phẩm..." required />
            </div>
            <div class="admin-field">
              <label>Loại hàng <span class="req">*</span></label>
              <select id="pfCategory" class="admin-select" required></select>
            </div>
            <div class="admin-field">
              <label>Nhà cung cấp chính</label>
              <select id="pfSupplier" class="admin-select"></select>
            </div>
            <div class="admin-field">
              <label>Đơn vị tính</label>
              <input type="text" id="pfUnit" class="admin-input" value="Chiếc" />
            </div>
            <div class="admin-field">
              <label>Giá vốn nhập (VNĐ) <span class="req">*</span></label>
              <input type="number" id="pfCost" class="admin-input" min="0" step="1" value="0" required />
            </div>
            <div class="admin-field">
              <label>Giá bán lẻ (VNĐ) <span class="req">*</span></label>
              <input type="number" id="pfRetail" class="admin-input" min="0" step="1" value="0" required />
            </div>
            <div class="admin-field">
              <label>Giá bán sỉ B2B (VNĐ)</label>
              <input type="number" id="pfWholesale" class="admin-input" min="0" step="1" value="0" />
            </div>
            <div class="admin-field">
              <label>Bảo hành (Tháng)</label>
              <input type="number" id="pfWarranty" class="admin-input" min="0" max="120" value="36" />
            </div>
            <div class="admin-field">
              <label>Ngưỡng tồn tối thiểu (ROP)</label>
              <input type="number" id="pfRop" class="admin-input" min="0" max="10000" value="5" />
            </div>
            <div class="admin-field">
              <label>Quản lý Serial / IMEI</label>
              <select id="pfSerial" class="admin-select">
                <option value="1">Có theo dõi Serial/IMEI</option>
                <option value="0">Không bắt buộc Serial</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Kho khởi tạo tồn (khi thêm mới)</label>
              <select id="pfInitWh" class="admin-select"></select>
            </div>
            <div class="admin-field">
              <label>Tồn kho ban đầu</label>
              <input type="number" id="pfInitQty" class="admin-input" min="0" max="100000" value="0" />
            </div>
            <div class="admin-field">
              <label>Trạng thái kinh doanh</label>
              <select id="pfActive" class="admin-select">
                <option value="1">Đang kinh doanh</option>
                <option value="0">Ngừng kinh doanh</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Ảnh sản phẩm (URL hoặc Tải lên)</label>
              <div style="display:flex;gap:6px;">
                <input type="text" id="pfImgUrl" class="admin-input" placeholder="./assets/images/..." />
                <label class="erp-btn erp-btn-outline" style="height:38px;padding:0 10px;cursor:pointer;">
                  <span>Tải ảnh</span>
                  <input type="file" id="pfImgFile" accept="image/png,image/jpeg,image/webp,image/gif" style="display:none;" />
                </label>
              </div>
            </div>
            <div class="admin-field span-3">
              <label>Thông số kỹ thuật tóm tắt</label>
              <input type="text" id="pfSpecs" class="admin-input" placeholder="VD: 24GB GDDR7 • PCIe 5.0 • 3 Quạt tản nhiệt..." />
            </div>
            <div class="admin-field">
              <label>Xem trước ảnh</label>
              <div style="display:flex;align-items:center;gap:10px;">
                <img id="pfImgPreview" class="erp-thumb" src="./assets/images/placeholders/hardware-wide.png" alt="Preview" />
                <span id="pfImgNote" style="font-size:0.72rem;color:var(--erp-muted);">Sẵn sàng</span>
              </div>
            </div>
          </div>

          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="pfSubmitBtn">Thêm mới Sản phẩm</button>
            <button type="button" class="erp-btn erp-btn-danger" id="pfDeleteBtn" style="display:none;">Xóa sản phẩm</button>
            <button type="button" class="erp-btn erp-btn-outline" id="pfResetBtn">Làm mới Form</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Tìm kiếm &amp; Lọc Sản phẩm Đa tiêu chí</h2>
          <span class="admin-card-sub" id="prodCountLabel">0 sản phẩm</span>
        </div>
        <div class="admin-form-grid">
          <div class="admin-field span-2">
            <label>Từ khóa (SKU, Tên SP, Thông số, NCC)</label>
            <input type="text" id="psQuery" class="admin-input" placeholder="Nhập tên, mã SKU hoặc thông số..." />
          </div>
          <div class="admin-field">
            <label>Loại hàng</label>
            <select id="psCat" class="admin-select"></select>
          </div>
          <div class="admin-field">
            <label>Nhà cung cấp</label>
            <select id="psSup" class="admin-select"></select>
          </div>
          <div class="admin-field">
            <label>Kho chi nhánh</label>
            <select id="psWh" class="admin-select"></select>
          </div>
          <div class="admin-field">
            <label>Trạng thái tồn kho</label>
            <select id="psStock" class="admin-select">
              <option value="">Tất cả mức tồn</option>
              <option value="ok">Tồn an toàn (&gt; ROP)</option>
              <option value="low">Sắp hết hàng (&le; ROP)</option>
              <option value="out">Hết hàng (0)</option>
              <option value="alert">Tất cả cảnh báo (Thấp + Hết)</option>
            </select>
          </div>
          <div class="admin-field">
            <label>Giá lẻ từ (VNĐ)</label>
            <input type="number" id="psMinPrice" class="admin-input" min="0" step="100000" placeholder="0" />
          </div>
          <div class="admin-field">
            <label>Đến giá lẻ (VNĐ)</label>
            <input type="number" id="psMaxPrice" class="admin-input" min="0" step="100000" placeholder="200000000" />
          </div>
        </div>
        <div class="admin-form-actions" style="margin-top:12px;">
          <button type="button" class="erp-btn erp-btn-navy" id="psSearchBtn">Tìm kiếm</button>
          <button type="button" class="erp-btn erp-btn-outline" id="psResetBtn">Hiển thị tất cả</button>
        </div>
      </div>

      <div class="admin-summary-cards" id="prodKpiCards"></div>

      <div class="admin-card">
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>SKU / Sản phẩm</th>
                <th>Loại hàng &amp; NCC</th>
                <th class="num">Giá vốn</th>
                <th class="num">Giá lẻ / Sỉ B2B</th>
                <th class="num">Khả dụng</th>
                <th>Trạng thái</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="prodTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    // Auto-calc wholesale price when retail changes in create mode
    document.getElementById('pfRetail').addEventListener('input', (e) => {
      if (!editingProductId) {
        const retail = Number(e.target.value || 0);
        document.getElementById('pfWholesale').value = Math.round(retail * 0.91);
      }
    });

    document.getElementById('pfImgUrl').addEventListener('input', (e) => {
      document.getElementById('pfImgPreview').src = e.target.value.trim() || './assets/images/placeholders/hardware-wide.png';
    });

    document.getElementById('pfImgFile').addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        setBanner('prodFormBanner', 'err', 'Ảnh vượt quá giới hạn 5MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          document.getElementById('pfImgNote').textContent = 'Đang tải lên...';
          const up = await apiFetch('/api/upload-image', {
            method: 'POST',
            body: { filename: file.name, dataUrl: reader.result }
          });
          document.getElementById('pfImgUrl').value = up.url;
          document.getElementById('pfImgPreview').src = up.url;
          document.getElementById('pfImgNote').textContent = 'Đã tải lên thành công';
          showToast('Đã tải ảnh sản phẩm lên máy chủ.', 'ok');
        } catch (err) {
          document.getElementById('pfImgNote').textContent = 'Lỗi tải ảnh';
          setBanner('prodFormBanner', 'err', err.message);
        }
      };
      reader.readAsDataURL(file);
    });

    document.getElementById('prodForm').onsubmit = handleSaveProduct;
    document.getElementById('pfResetBtn').onclick = resetProductForm;
    document.getElementById('pfDeleteBtn').onclick = () => {
      if (editingProductId) deleteProduct(editingProductId);
    };
    document.getElementById('psSearchBtn').onclick = loadProductsTable;
    document.getElementById('psResetBtn').onclick = () => {
      ['psQuery', 'psCat', 'psSup', 'psWh', 'psStock', 'psMinPrice', 'psMaxPrice'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      loadProductsTable();
    };
  }

  populateProductDropdowns();
  await loadProductsTable();
}

function populateProductDropdowns() {
  const cats = ERP.meta.categories || [];
  const sups = ERP.meta.suppliers || [];
  const whs = ERP.meta.warehouses || [];

  document.getElementById('pfCategory').innerHTML = buildSelectOptions(cats, 'id', (c) => `${c.code} — ${c.name}`);
  document.getElementById('pfSupplier').innerHTML = buildSelectOptions(sups, 'id', (s) => `${s.code} — ${s.name}`, '-- Chưa gắn NCC --');
  document.getElementById('pfInitWh').innerHTML = buildSelectOptions(whs, 'id', (w) => `${w.code} — ${w.name}`);

  document.getElementById('psCat').innerHTML = buildSelectOptions(cats, 'id', (c) => c.name, 'Tất cả loại hàng');
  document.getElementById('psSup').innerHTML = buildSelectOptions(sups, 'id', (s) => s.name, 'Tất cả nhà cung cấp');
  document.getElementById('psWh').innerHTML = buildSelectOptions(whs, 'id', (w) => `${w.code} (${w.region})`, 'Tổng hợp 5 kho');
}

function resetProductForm() {
  editingProductId = null;
  document.getElementById('prodForm').reset();
  document.getElementById('pfUnit').value = 'Chiếc';
  document.getElementById('pfWarranty').value = '36';
  document.getElementById('pfRop').value = '5';
  document.getElementById('pfActive').value = '1';
  document.getElementById('pfInitQty').disabled = false;
  document.getElementById('pfInitWh').disabled = false;
  document.getElementById('pfImgPreview').src = './assets/images/placeholders/hardware-wide.png';
  document.getElementById('pfImgNote').textContent = 'Sẵn sàng';
  document.getElementById('prodFormHeading').textContent = 'Quản lý Sản phẩm — Thêm mới / Cập nhật';
  document.getElementById('pfSubmitBtn').textContent = 'Thêm mới Sản phẩm';
  document.getElementById('pfDeleteBtn').style.display = 'none';
  setBanner('prodFormBanner', '', '');
}

function fillProductForm(p) {
  editingProductId = p.id;
  document.getElementById('pfSku').value = p.sku;
  document.getElementById('pfName').value = p.name;
  document.getElementById('pfCategory').value = String(p.category_id);
  document.getElementById('pfSupplier').value = p.supplier_id ? String(p.supplier_id) : '';
  document.getElementById('pfUnit').value = p.unit || 'Chiếc';
  document.getElementById('pfCost').value = p.cost_price;
  document.getElementById('pfRetail').value = p.retail_price;
  document.getElementById('pfWholesale').value = p.wholesale_price;
  document.getElementById('pfWarranty').value = p.warranty_months;
  document.getElementById('pfRop').value = p.min_reorder_level;
  document.getElementById('pfSerial').value = String(p.track_serial ? 1 : 0);
  document.getElementById('pfActive').value = String(p.is_active ? 1 : 0);
  document.getElementById('pfImgUrl').value = p.image_url || '';
  document.getElementById('pfImgPreview').src = p.image_url || './assets/images/placeholders/hardware-wide.png';
  document.getElementById('pfSpecs').value = p.specs_summary || '';
  document.getElementById('pfInitQty').value = p.total_on_hand || 0;
  document.getElementById('pfInitQty').disabled = true;
  document.getElementById('pfInitWh').disabled = true;
  document.getElementById('prodFormHeading').textContent = `Đang chỉnh sửa Sản phẩm #${p.id} — ${p.sku}`;
  document.getElementById('pfSubmitBtn').textContent = 'Cập nhật Sản phẩm';
  document.getElementById('pfDeleteBtn').style.display = 'inline-flex';
  setBanner('prodFormBanner', 'info', `Đang sửa SKU ${p.sku}. Để thay đổi tồn kho thực tế, sử dụng tab Mua hàng hoặc Kiểm kê kho.`);
  document.getElementById('tab-products').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function handleSaveProduct(e) {
  e.preventDefault();
  setBanner('prodFormBanner', '', '');
  const payload = {
    sku: document.getElementById('pfSku').value.trim(),
    name: document.getElementById('pfName').value.trim(),
    category_id: Number(document.getElementById('pfCategory').value),
    supplier_id: document.getElementById('pfSupplier').value ? Number(document.getElementById('pfSupplier').value) : null,
    unit: document.getElementById('pfUnit').value.trim() || 'Chiếc',
    cost_price: Number(document.getElementById('pfCost').value),
    retail_price: Number(document.getElementById('pfRetail').value),
    wholesale_price: Number(document.getElementById('pfWholesale').value),
    warranty_months: Number(document.getElementById('pfWarranty').value),
    min_reorder_level: Number(document.getElementById('pfRop').value),
    track_serial: Number(document.getElementById('pfSerial').value),
    is_active: Number(document.getElementById('pfActive').value),
    image_url: document.getElementById('pfImgUrl').value.trim(),
    specs_summary: document.getElementById('pfSpecs').value.trim(),
    initial_warehouse_id: Number(document.getElementById('pfInitWh').value || 1),
    initial_qty: Number(document.getElementById('pfInitQty').value || 0)
  };

  if (payload.sku.length < 2 || payload.name.length < 2) {
    setBanner('prodFormBanner', 'err', 'Mã SKU và Tên sản phẩm cần tối thiểu 2 ký tự.');
    return;
  }
  if (payload.cost_price < 0 || payload.retail_price < 0) {
    setBanner('prodFormBanner', 'err', 'Giá vốn và Giá bán không được nhỏ hơn 0.');
    return;
  }

  const btn = document.getElementById('pfSubmitBtn');
  btn.disabled = true;
  try {
    const res = editingProductId
      ? await apiFetch(`/api/products/${editingProductId}`, { method: 'PUT', body: payload })
      : await apiFetch('/api/products', { method: 'POST', body: payload });
    showToast(res.message || 'Đã lưu sản phẩm.', 'ok');
    resetProductForm();
    await refreshProductsCache();
    await loadProductsTable();
  } catch (err) {
    setBanner('prodFormBanner', 'err', err.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct(id) {
  if (!confirm('Xác nhận xóa vĩnh viễn sản phẩm này khỏi danh mục?')) return;
  try {
    const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Đã xóa sản phẩm.', 'ok');
    if (editingProductId === id) resetProductForm();
    await refreshProductsCache();
    await loadProductsTable();
  } catch (err) {
    setBanner('prodFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  }
}

async function loadProductsTable() {
  const qs = new URLSearchParams();
  const map = {
    q: 'psQuery',
    category_id: 'psCat',
    supplier_id: 'psSup',
    warehouse_id: 'psWh',
    stock_state: 'psStock',
    min_price: 'psMinPrice',
    max_price: 'psMaxPrice'
  };
  for (const [k, id] of Object.entries(map)) {
    const v = document.getElementById(id)?.value?.trim();
    if (v) qs.set(k, v);
  }

  const res = await apiFetch(`/api/products?${qs.toString()}`);
  productsList = res.items || [];
  document.getElementById('prodCountLabel').textContent = `Hiển thị ${productsList.length} sản phẩm`;

  const totalUnits = productsList.reduce((s, p) => s + p.wh_qty_available, 0);
  const totalVal = productsList.reduce((s, p) => s + p.wh_qty_available * p.cost_price, 0);
  const lowCnt = productsList.filter((p) => p.wh_qty_available <= p.min_reorder_level).length;

  document.getElementById('prodKpiCards').innerHTML = `
    <div class="sales-stat-card"><div class="sales-stat-label">Tổng SKU khớp lọc</div><div class="sales-stat-value">${num(productsList.length)}</div><div class="sales-stat-sub">Danh mục đang theo dõi</div></div>
    <div class="sales-stat-card ok"><div class="sales-stat-label">Tồn khả dụng</div><div class="sales-stat-value">${num(totalUnits)}</div><div class="sales-stat-sub">Đơn vị sẵn sàng xuất bán</div></div>
    <div class="sales-stat-card navy"><div class="sales-stat-label">Giá trị vốn tồn</div><div class="sales-stat-value">${vnd(totalVal)}</div><div class="sales-stat-sub">Tính theo giá vốn bình quân MAC</div></div>
    <div class="sales-stat-card ${lowCnt > 0 ? 'danger' : 'ok'}"><div class="sales-stat-label">Cảnh báo ROP</div><div class="sales-stat-value">${num(lowCnt)} SKU</div><div class="sales-stat-sub">Dưới hoặc bằng ngưỡng tồn tối thiểu</div></div>
  `;

  const tbody = document.getElementById('prodTableBody');
  if (!productsList.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:24px;color:var(--erp-muted);">Không tìm thấy sản phẩm phù hợp điều kiện lọc.</td></tr>';
    return;
  }

  tbody.innerHTML = productsList.map((p) => {
    const img = p.image_url || './assets/images/placeholders/hardware-wide.png';
    const stCls = p.wh_qty_available === 0 ? 'danger' : p.wh_qty_available <= p.min_reorder_level ? 'warn' : 'ok';
    const whMini = (p.warehouse_stocks || []).filter((w) => w.qty_on_hand > 0).map((w) => `${w.warehouse_code.replace('WH-', '')}:${w.qty_available}`).join(' • ');
    return `
      <tr>
        <td><img class="erp-thumb" src="${esc(img)}" alt="${esc(p.name)}" loading="lazy" /></td>
        <td>
          <div style="font-weight:800;color:var(--erp-ink);">${esc(p.name)}</div>
          <div style="font-size:0.72rem;color:var(--erp-muted);">SKU: <b>${esc(p.sku)}</b> • BH ${p.warranty_months}T ${p.track_serial ? '• Serial/IMEI' : ''}</div>
          ${whMini ? `<div style="font-size:0.69rem;color:var(--erp-sky-dark);margin-top:2px;">${esc(whMini)}</div>` : ''}
        </td>
        <td>
          <div><span class="erp-badge info">${esc(p.category_name)}</span></div>
          <div style="font-size:0.72rem;color:var(--erp-muted);margin-top:3px;">${esc(p.supplier_name || 'Chưa gắn NCC')}</div>
        </td>
        <td class="num">${vnd(p.cost_price)}</td>
        <td class="num">
          <div style="font-weight:800;color:var(--erp-ink);">${vnd(p.retail_price)}</div>
          <div style="font-size:0.71rem;color:var(--erp-muted);">Sỉ: ${vnd(p.wholesale_price)}</div>
        </td>
        <td class="num">
          <span class="erp-badge ${stCls}">${num(p.wh_qty_available)} ${esc(p.unit)}</span>
          <div style="font-size:0.68rem;color:var(--erp-muted);margin-top:2px;">ROP: ${p.min_reorder_level}</div>
        </td>
        <td>${p.is_active ? '<span class="erp-badge ok">Đang bán</span>' : '<span class="erp-badge navy">Ngừng bán</span>'}</td>
        <td style="text-align:right;white-space:nowrap;">
          <button type="button" class="erp-btn sm erp-btn-outline" data-edit-prod="${p.id}">Sửa</button>
          <button type="button" class="erp-btn sm erp-btn-danger" data-del-prod="${p.id}">Xóa</button>
        </td>
      </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-prod]').forEach((b) => {
    b.onclick = () => {
      const found = productsList.find((x) => x.id === Number(b.dataset.editProd));
      if (found) fillProductForm(found);
    };
  });
  tbody.querySelectorAll('[data-del-prod]').forEach((b) => {
    b.onclick = () => deleteProduct(Number(b.dataset.delProd));
  });
}

/* ============================================================================
 *  TAB 2: CATEGORIES CRUD
 * ============================================================================ */
export async function renderCategoriesTab() {
  const host = document.getElementById('tab-categories');
  if (!catInit) {
    catInit = true;
    host.innerHTML = `
      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title" id="catFormHeading">Quản lý Loại hàng — Thêm mới / Cập nhật</h2>
          <span class="admin-card-sub">Chuẩn hóa nhóm sản phẩm, chính sách bảo hành &amp; ngưỡng ROP mặc định</span>
        </div>
        <div id="catFormBanner" class="erp-alert-banner"></div>
        <form id="catForm">
          <div class="admin-form-grid">
            <div class="admin-field">
              <label>Mã Loại hàng <span class="req">*</span></label>
              <input type="text" id="cfCode" class="admin-input" placeholder="VD: CAT-NET" required />
            </div>
            <div class="admin-field span-2">
              <label>Tên Loại hàng <span class="req">*</span></label>
              <input type="text" id="cfName" class="admin-input" placeholder="VD: Thiết Bị Mạng & NAS Studio" required />
            </div>
            <div class="admin-field">
              <label>Nhóm danh mục cha</label>
              <input type="text" id="cfParent" class="admin-input" value="Linh Kiện & Thiết Bị" />
            </div>
            <div class="admin-field">
              <label>Bảo hành mặc định (Tháng)</label>
              <input type="number" id="cfWarranty" class="admin-input" min="0" max="120" value="36" />
            </div>
            <div class="admin-field">
              <label>Mức tồn tối thiểu ROP mặc định</label>
              <input type="number" id="cfRop" class="admin-input" min="0" max="1000" value="5" />
            </div>
            <div class="admin-field">
              <label>Trạng thái</label>
              <select id="cfActive" class="admin-select">
                <option value="1">Đang áp dụng</option>
                <option value="0">Tạm khóa</option>
              </select>
            </div>
            <div class="admin-field">
              <label>Mô tả ngắn</label>
              <input type="text" id="cfDesc" class="admin-input" placeholder="Ghi chú phân nhóm sản phẩm..." />
            </div>
          </div>
          <div class="admin-form-actions">
            <button type="submit" class="erp-btn erp-btn-primary" id="cfSubmitBtn">Thêm mới Loại hàng</button>
            <button type="button" class="erp-btn erp-btn-danger" id="cfDeleteBtn" style="display:none;">Xóa Loại hàng</button>
            <button type="button" class="erp-btn erp-btn-outline" id="cfResetBtn">Làm mới Form</button>
          </div>
        </form>
      </div>

      <div class="admin-card">
        <div class="admin-card-head">
          <h2 class="admin-card-title">Danh sách Loại hàng</h2>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <input type="text" id="csQuery" class="admin-input" style="width:240px;" placeholder="Tìm mã, tên, nhóm cha..." />
            <button type="button" class="erp-btn erp-btn-navy" id="csSearchBtn">Tìm kiếm</button>
            <button type="button" class="erp-btn erp-btn-outline" id="csResetBtn">Tất cả</button>
          </div>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-data-table">
            <thead>
              <tr>
                <th>Mã Loại</th>
                <th>Tên Loại hàng</th>
                <th>Nhóm cha</th>
                <th class="num">BH mặc định</th>
                <th class="num">ROP mặc định</th>
                <th class="num">Số SKU</th>
                <th class="num">Tổng tồn</th>
                <th>Trạng thái</th>
                <th style="text-align:right;">Thao tác</th>
              </tr>
            </thead>
            <tbody id="catTableBody"></tbody>
          </table>
        </div>
      </div>
    `;

    document.getElementById('catForm').onsubmit = handleSaveCategory;
    document.getElementById('cfResetBtn').onclick = resetCategoryForm;
    document.getElementById('cfDeleteBtn').onclick = () => { if (editingCategoryId) deleteCategory(editingCategoryId); };
    document.getElementById('csSearchBtn').onclick = loadCategoriesTable;
    document.getElementById('csResetBtn').onclick = () => { document.getElementById('csQuery').value = ''; loadCategoriesTable(); };
  }

  await loadCategoriesTable();
}

function resetCategoryForm() {
  editingCategoryId = null;
  document.getElementById('catForm').reset();
  document.getElementById('cfParent').value = 'Linh Kiện & Thiết Bị';
  document.getElementById('cfWarranty').value = '36';
  document.getElementById('cfRop').value = '5';
  document.getElementById('cfActive').value = '1';
  document.getElementById('catFormHeading').textContent = 'Quản lý Loại hàng — Thêm mới / Cập nhật';
  document.getElementById('cfSubmitBtn').textContent = 'Thêm mới Loại hàng';
  document.getElementById('cfDeleteBtn').style.display = 'none';
  setBanner('catFormBanner', '', '');
}

async function handleSaveCategory(e) {
  e.preventDefault();
  setBanner('catFormBanner', '', '');
  const payload = {
    code: document.getElementById('cfCode').value.trim(),
    name: document.getElementById('cfName').value.trim(),
    parent_group: document.getElementById('cfParent').value.trim(),
    default_warranty_months: Number(document.getElementById('cfWarranty').value),
    min_stock_default: Number(document.getElementById('cfRop').value),
    is_active: Number(document.getElementById('cfActive').value),
    description: document.getElementById('cfDesc').value.trim()
  };
  try {
    const res = editingCategoryId
      ? await apiFetch(`/api/categories/${editingCategoryId}`, { method: 'PUT', body: payload })
      : await apiFetch('/api/categories', { method: 'POST', body: payload });
    showToast(res.message || 'Đã lưu loại hàng.', 'ok');
    resetCategoryForm();
    await refreshMeta();
    await loadCategoriesTable();
  } catch (err) {
    setBanner('catFormBanner', 'err', err.message);
  }
}

async function deleteCategory(id) {
  if (!confirm('Xác nhận xóa loại hàng này?')) return;
  try {
    const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    showToast(res.message || 'Đã xóa loại hàng.', 'ok');
    if (editingCategoryId === id) resetCategoryForm();
    await refreshMeta();
    await loadCategoriesTable();
  } catch (err) {
    setBanner('catFormBanner', 'err', err.message);
    showToast(err.message, 'err');
  }
}

async function loadCategoriesTable() {
  const q = document.getElementById('csQuery')?.value?.trim() || '';
  const res = await apiFetch(`/api/categories${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  categoriesList = res.items || [];
  const tbody = document.getElementById('catTableBody');
  tbody.innerHTML = categoriesList.map((c) => `
    <tr>
      <td><b>${esc(c.code)}</b></td>
      <td>
        <div style="font-weight:800;">${esc(c.name)}</div>
        ${c.description ? `<div style="font-size:0.71rem;color:var(--erp-muted);">${esc(c.description)}</div>` : ''}
      </td>
      <td>${esc(c.parent_group)}</td>
      <td class="num">${c.default_warranty_months}T</td>
      <td class="num">${c.min_stock_default}</td>
      <td class="num"><b>${num(c.product_count)}</b></td>
      <td class="num">${num(c.total_stock)}</td>
      <td>${c.is_active ? '<span class="erp-badge ok">Hoạt động</span>' : '<span class="erp-badge navy">Tạm khóa</span>'}</td>
      <td style="text-align:right;white-space:nowrap;">
        <button type="button" class="erp-btn sm erp-btn-outline" data-edit-cat="${c.id}">Sửa</button>
        <button type="button" class="erp-btn sm erp-btn-danger" data-del-cat="${c.id}">Xóa</button>
      </td>
    </tr>`).join('');

  tbody.querySelectorAll('[data-edit-cat]').forEach((b) => {
    b.onclick = () => {
      const c = categoriesList.find((x) => x.id === Number(b.dataset.editCat));
      if (!c) return;
      editingCategoryId = c.id;
      document.getElementById('cfCode').value = c.code;
      document.getElementById('cfName').value = c.name;
      document.getElementById('cfParent').value = c.parent_group;
      document.getElementById('cfWarranty').value = c.default_warranty_months;
      document.getElementById('cfRop').value = c.min_stock_default;
      document.getElementById('cfActive').value = String(c.is_active);
      document.getElementById('cfDesc').value = c.description || '';
      document.getElementById('catFormHeading').textContent = `Đang chỉnh sửa Loại hàng #${c.id} — ${c.code}`;
      document.getElementById('cfSubmitBtn').textContent = 'Cập nhật Loại hàng';
      document.getElementById('cfDeleteBtn').style.display = 'inline-flex';
      setBanner('catFormBanner', '', '');
    };
  });
  tbody.querySelectorAll('[data-del-cat]').forEach((b) => {
    b.onclick = () => deleteCategory(Number(b.dataset.delCat));
  });
}
