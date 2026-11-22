const S = window.S25;
const I = S.ICONS;

const FULFILL_MAP = {
  PROCESSING: { label: 'Đang xử lý & Stress-Test Lab', cls: 'warn' },
  DELIVERED: { label: 'Đang vận chuyển liên vùng', cls: 'info' },
  COMPLETED: { label: 'Đã giao hàng & Hoàn tất', cls: 'ok' }
};

const PAY_MAP = {
  PAID: { label: 'Đã thanh toán đủ', cls: 'ok' },
  PARTIAL: { label: 'Thanh toán một phần', cls: 'warn' },
  UNPAID: { label: 'Chưa thanh toán / Công nợ', cls: 'warn' }
};

function renderSidebar(user) {
  const host = document.getElementById('accSidebar');
  if (!user) {
    host.innerHTML = `
      <div style="text-align:center;padding:12px 4px;">
        <div class="acc-avatar-lg" style="margin:0 auto 12px;">SK</div>
        <h2 style="font-size:1.1rem;font-weight:800;margin-bottom:6px;">Bạn chưa đăng nhập</h2>
        <p style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;margin-bottom:16px;">Đăng nhập để đồng bộ lịch sử mua hàng, bảo hành điện tử và truy cập hệ thống quản lý (nếu là nhân sự).</p>
        <a href="./login.html?next=account.html" class="sec3-btn-primary" style="width:100%;text-decoration:none;justify-content:center;">Đăng nhập ngay</a>
      </div>`;
    return;
  }

  const staff = S.isStaff(user);
  const roleText = user.role_name || (staff ? user.role_code : 'Khách Hàng Thành Viên');
  host.innerHTML = `
    <div class="acc-profile-top">
      <div class="acc-avatar-lg">${S.esc(user.initials || 'SK')}</div>
      <div style="min-width:0;flex:1;">
        <div style="font-weight:800;font-size:0.98rem;color:#071a33;word-break:break-word;">${S.esc(user.full_name || user.name)}</div>
        <div style="font-size:0.76rem;color:#476282;margin-top:2px;word-break:break-all;">${S.esc(user.email || user.username)}</div>
        <span class="sky-ad-role-pill ${staff ? 'is-staff' : ''}" style="margin-top:6px;">${S.esc(roleText)}</span>
      </div>
    </div>
    ${user.warehouse_name ? `<div style="font-size:0.76rem;color:#476282;margin-bottom:14px;padding:9px 11px;border-radius:11px;background:#f0f9ff;border:1px solid rgba(2,132,199,0.16);"><b>${staff ? 'Kho phụ trách' : 'Khu vực'}:</b> ${S.esc(user.warehouse_name)}</div>` : ''}
    <nav class="acc-nav-list" aria-label="Điều hướng tài khoản">
      ${staff ? `<a href="./admin.html" class="acc-nav-btn is-admin">${I.settings}<span>QUẢN LÝ HỆ THỐNG ERP</span></a>` : ''}
      <a href="#accOrdersCard" class="acc-nav-btn active">${I.clipboard}<span>Lịch sử đơn hàng</span></a>
      <a href="#track" class="acc-nav-btn">${I.truck}<span>Tra cứu vận đơn</span></a>
      <button type="button" class="acc-nav-btn" onclick="window.S25.openWishDrawer()">${I.heart}<span>Sản phẩm Yêu thích (${S.getWishlist().length})</span></button>
      <a href="./cart.html" class="acc-nav-btn">${I.cart}<span>Giỏ hàng (${S.computeSummary().itemCount})</span></a>
      <button type="button" class="acc-nav-btn is-danger" id="accLogoutBtn">${I.logout}<span>Đăng xuất</span></button>
    </nav>
  `;
  const outBtn = document.getElementById('accLogoutBtn');
  if (outBtn) {
    outBtn.onclick = () => {
      S.logoutUser();
      window.location.href = './index.html';
    };
  }
}

function renderOrderCard(ord) {
  const f = FULFILL_MAP[ord.fulfillment_status] || { label: ord.fulfillment_status || 'Đang xử lý', cls: 'info' };
  const p = PAY_MAP[ord.payment_status] || { label: ord.payment_status || 'Đã ghi nhận', cls: 'info' };
  const itemsHtml = Array.isArray(ord.items) && ord.items.length
    ? ord.items.map((it) => `
      <div style="display:flex;justify-content:space-between;gap:10px;font-size:0.8rem;padding:6px 0;border-bottom:1px dashed rgba(2,132,199,0.14);">
        <span><b>${S.esc(it.product_name || it.name)}</b> <span style="color:#476282;">(x${Number(it.qty || 1)})</span></span>
        <b style="white-space:nowrap;">${S.vnd(it.line_total || (it.unit_price * it.qty))}</b>
      </div>`).join('')
    : '<div style="font-size:0.78rem;color:#476282;">Đơn hàng tổng hợp cấu hình Studio.</div>';

  return `
    <article class="acc-order-item">
      <div class="acc-order-top">
        <div>
          <strong style="font-size:0.95rem;color:#071a33;">${S.esc(ord.invoice_code || ord.code)}</strong>
          <span style="font-size:0.75rem;color:#476282;margin-left:8px;">${S.esc(ord.created_at || ord.createdAt || '')}</span>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span class="acc-pill info">Kênh ${S.esc(ord.sales_channel || 'WEB3D')}</span>
          <span class="acc-pill ${f.cls}">${S.esc(f.label)}</span>
          <span class="acc-pill ${p.cls}">${S.esc(p.label)}</span>
        </div>
      </div>
      ${ord.warehouse_name ? `<div style="font-size:0.78rem;color:#0369a1;font-weight:700;margin-bottom:8px;">Kho xuất điều phối: ${S.esc(ord.warehouse_name)}</div>` : ''}
      <div style="margin-bottom:10px;">${itemsHtml}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;font-size:0.84rem;">
        <span style="color:#476282;">Khách hàng: <b>${S.esc(ord.customer_name || ord.customerName || '')}</b></span>
        <span style="font-size:1.02rem;font-weight:800;color:#0284c7;">Tổng: ${S.vnd(ord.total_amount ?? ord.total ?? 0)}</span>
      </div>
    </article>`;
}

async function loadOrders(user) {
  const kpiHost = document.getElementById('accKpiRow');
  const bodyHost = document.getElementById('accOrdersBody');
  const token = S.getToken();

  let orders = [];
  if (user && token) {
    try {
      const resp = await fetch('/api/storefront/orders/my', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        orders = data.items || [];
      }
    } catch (_) {}
  }

  if (!orders.length && user) {
    orders = S.getOrders().map((o) => ({
      invoice_code: o.code,
      created_at: o.createdAt,
      sales_channel: 'WEB3D',
      fulfillment_status: 'PROCESSING',
      payment_status: 'PAID',
      customer_name: o.customerName,
      total_amount: o.total,
      items: []
    }));
  }

  const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const activeCount = orders.filter((o) => o.fulfillment_status !== 'COMPLETED').length;

  kpiHost.innerHTML = `
    <div class="acc-kpi-box"><small>Tổng đơn hàng</small><strong>${orders.length}</strong></div>
    <div class="acc-kpi-box"><small>Đang xử lý / Giao</small><strong>${activeCount}</strong></div>
    <div class="acc-kpi-box"><small>Tổng giá trị giao dịch</small><strong style="color:#0284c7;">${S.vnd(totalSpent)}</strong></div>
  `;

  if (!user) {
    bodyHost.innerHTML = `
      <div style="padding:26px;text-align:center;border-radius:14px;background:#f8fafc;border:1px dashed rgba(2,132,199,0.28);">
        <p style="font-size:0.86rem;color:#476282;margin-bottom:12px;">Vui lòng đăng nhập để xem lịch sử đơn hàng cá nhân, hoặc sử dụng khung Tra cứu bên dưới.</p>
        <a href="./login.html?next=account.html" class="sec3-btn-primary" style="text-decoration:none;">Đi tới trang Đăng nhập</a>
      </div>`;
    return;
  }

  if (!orders.length) {
    bodyHost.innerHTML = `
      <div style="padding:26px;text-align:center;border-radius:14px;background:#f8fafc;border:1px dashed rgba(2,132,199,0.28);">
        <p style="font-size:0.86rem;color:#476282;">Chưa có đơn hàng nào gắn với tài khoản này.</p>
      </div>`;
    return;
  }

  bodyHost.innerHTML = orders.map(renderOrderCard).join('');
}

async function handleTrack(e) {
  e.preventDefault();
  const code = document.getElementById('accTrackCode').value.trim();
  const phone = document.getElementById('accTrackPhone').value.trim();
  const out = document.getElementById('accTrackResult');
  out.innerHTML = '<div style="font-size:0.82rem;color:#476282;">Đang truy vấn cơ sở dữ liệu đơn hàng...</div>';

  try {
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    if (phone) qs.set('phone', phone);
    const resp = await fetch(`/api/storefront/orders/track?${qs.toString()}`);
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Không tìm thấy đơn hàng.');
    out.innerHTML = (data.items || [data.order]).map(renderOrderCard).join('');
  } catch (err) {
    out.innerHTML = `<div style="padding:12px 14px;border-radius:12px;background:#fff1f2;border:1px solid #fecdd3;color:#be123c;font-size:0.82rem;font-weight:700;">${S.esc(err.message)}</div>`;
  }
}

document.getElementById('accTrackForm')?.addEventListener('submit', handleTrack);

S.renderFooter(document.getElementById('s25FooterHost'));
S.syncHeaderAuthAndWish();

const currentUser = S.getUser();
renderSidebar(currentUser);
loadOrders(currentUser);
