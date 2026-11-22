let authMode = 'login';

function initEyeButtons() {
  document.querySelectorAll('.auth-eye-btn').forEach((btn) => {
    btn.innerHTML = window.S25.ICONS.eye;
  });
}

window.togglePwdEye = (inputId, btn) => {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show ? window.S25.ICONS.eyeOff : window.S25.ICONS.eye;
};

window.setAuthMode = (mode) => {
  authMode = mode === 'register' ? 'register' : 'login';
  const isReg = authMode === 'register';
  document.getElementById('modeLoginLabel').classList.toggle('active', !isReg);
  document.getElementById('modeRegLabel').classList.toggle('active', isReg);
  document.getElementById('authHeadline').textContent = isReg ? 'Đăng ký tài khoản mới' : 'Đăng nhập tài khoản';
  document.getElementById('authSubmitBtn').textContent = isReg ? 'Tạo tài khoản mới' : 'Đăng nhập';
  document.getElementById('authEmailLabel').textContent = isReg ? 'Địa chỉ Email *' : 'Tên đăng nhập hoặc Email *';
  document.getElementById('authEmail').type = isReg ? 'email' : 'text';
  document.getElementById('regNameGroup').style.display = isReg ? 'block' : 'none';
  document.getElementById('regConfirmEmailGroup').style.display = isReg ? 'block' : 'none';
  document.getElementById('regExtras').style.display = isReg ? 'block' : 'none';
  document.getElementById('loginOptionsRow').style.display = isReg ? 'none' : 'flex';
  document.getElementById('authName').required = isReg;
  document.getElementById('authPhone').required = isReg;
  document.getElementById('authEmailConfirm').required = isReg;
  document.getElementById('authPasswordConfirm').required = isReg;
  const msg = document.getElementById('authMsgBox');
  msg.className = 'auth-msg-box';
  msg.textContent = '';
};

window.checkPwdRules = () => {
  const v = document.getElementById('authPassword').value || '';
  document.getElementById('ruleLen').classList.toggle('ok', v.length >= 6);
  document.getElementById('ruleCase').classList.toggle('ok', /[a-z]/.test(v) && /[A-Z]/.test(v));
  document.getElementById('ruleNum').classList.toggle('ok', /\d/.test(v));
};

window.toggleForgotBox = () => {
  const box = document.getElementById('forgotPwdPanel');
  box.style.display = box.style.display === 'none' ? 'block' : 'none';
};

function showAuthMsg(type, text) {
  const box = document.getElementById('authMsgBox');
  box.className = 'auth-msg-box ' + type;
  box.textContent = text;
}

function maybeRedirectAfterLogin(user) {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (next && /^[a-z0-9._-]+(\.html)?$/i.test(next)) {
    window.location.href = `./${next}`;
    return true;
  }
  return false;
}

window.handleAuthSubmit = async (e) => {
  e.preventDefault();
  const identifier = document.getElementById('authEmail').value.trim();
  const pwd = document.getElementById('authPassword').value;
  const btn = document.getElementById('authSubmitBtn');

  if (authMode === 'register') {
    const name = document.getElementById('authName').value.trim();
    const phone = document.getElementById('authPhone').value.trim();
    const email2 = document.getElementById('authEmailConfirm').value.trim();
    const pwd2 = document.getElementById('authPasswordConfirm').value;
    const region = document.getElementById('authRegion').value || 'Miền Bắc';

    if (name.length < 2) { showAuthMsg('err', 'Họ và tên cần tối thiểu 2 ký tự.'); return false; }
    if (!/^0\d{8,10}$/.test(phone.replace(/[\s.-]/g, ''))) {
      showAuthMsg('err', 'Số điện thoại không hợp lệ (bắt đầu bằng 0, 9–11 số).');
      return false;
    }
    if (identifier.toLowerCase() !== email2.toLowerCase()) {
      showAuthMsg('err', 'Email xác nhận không trùng khớp.');
      return false;
    }
    if (pwd.length < 6) {
      showAuthMsg('err', 'Mật khẩu cần tối thiểu 6 ký tự.');
      return false;
    }
    if (pwd !== pwd2) {
      showAuthMsg('err', 'Mật khẩu xác nhận không khớp.');
      return false;
    }

    btn.disabled = true;
    btn.textContent = 'Đang tạo tài khoản...';
    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: name,
          email: identifier,
          phone,
          password: pwd,
          region,
          address: document.getElementById('authCompany')?.value.trim() || ''
        })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Đăng ký không thành công.');
      window.S25.setSession(data.token, data.user);
      if (!maybeRedirectAfterLogin(data.user)) renderAuthView();
    } catch (err) {
      showAuthMsg('err', err.message || 'Lỗi kết nối máy chủ.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Tạo tài khoản mới';
    }
  } else {
    if (!identifier || !pwd) {
      showAuthMsg('err', 'Vui lòng nhập đầy đủ Tên đăng nhập / Email và Mật khẩu.');
      return false;
    }
    btn.disabled = true;
    btn.textContent = 'Đang xác thực...';
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pwd })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Đăng nhập không thành công.');
      window.S25.setSession(data.token, data.user);
      if (!maybeRedirectAfterLogin(data.user)) renderAuthView();
    } catch (err) {
      showAuthMsg('err', err.message || 'Lỗi xác thực máy chủ.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Đăng nhập';
    }
  }
  return false;
};

window.quickApiDemoLogin = async (identifier, password, autoRedirectToAdmin = false) => {
  showAuthMsg('ok', `Đang đăng nhập tài khoản mẫu (${identifier})...`);
  try {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Không thể đăng nhập tài khoản mẫu.');
    window.S25.setSession(data.token, data.user);
    if (maybeRedirectAfterLogin(data.user)) return;
    renderAuthView();
  } catch (err) {
    showAuthMsg('err', err.message || 'Lỗi kết nối API đăng nhập.');
  }
};

window.quickDemoLogin = (email, name, isB2B) => {
  if (isB2B) window.S25.registerUser({ name, email, b2b: true, company: 'TechLab Studio VAT', newsletter: true });
  else window.S25.loginUser({ email, name, remember: true });
  renderAuthView();
};

const FULFILLMENT_LABELS = {
  PROCESSING: 'Đang xử lý & Stress-Test 24h tại Lab',
  DELIVERED: 'Đang giao vận chuyển liên vùng',
  COMPLETED: 'Đã giao hàng & hoàn tất đơn'
};

window.handleTrackOrder = async (e) => {
  e.preventDefault();
  const code = document.getElementById('trackCodeInp').value.trim();
  const contact = document.getElementById('trackEmailInp').value.trim();
  const out = document.getElementById('trackResultBox');

  try {
    const qs = new URLSearchParams();
    if (code) qs.set('code', code);
    else if (contact) qs.set('phone', contact);
    const resp = await fetch(`/api/storefront/orders/track?${qs.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      const ord = data.order;
      out.innerHTML = `
        <div class="auth-order-result">
          <div style="font-weight:800;color:var(--accent);">Đơn ${window.S25.esc(ord.invoice_code)} • ${window.S25.vnd(ord.total_amount)}</div>
          <div><b>Khách hàng:</b> ${window.S25.esc(ord.customer_name)} (${window.S25.esc(ord.customer_phone)})</div>
          <div><b>Kho điều phối:</b> ${window.S25.esc(ord.warehouse_name)} • Kênh ${window.S25.esc(ord.sales_channel)}</div>
          <div><b>Trạng thái:</b> ${window.S25.esc(FULFILLMENT_LABELS[ord.fulfillment_status] || ord.fulfillment_status)}</div>
          <div><b>Thanh toán:</b> ${ord.payment_status === 'PAID' ? 'Đã thanh toán đủ' : ord.payment_status === 'PARTIAL' ? `Đã trả ${window.S25.vnd(ord.paid_amount)} / Còn nợ ${window.S25.vnd(ord.debt_amount)}` : 'Chưa thanh toán (COD / Công nợ)'}</div>
        </div>`;
      return false;
    }
  } catch (_) {}

  // Fallback localStorage lookup
  const found = window.S25.findOrder(code, contact);
  if (!found) {
    out.innerHTML = `<div class="auth-order-result" style="border-color:#fb7185;color:#be123c;">Không tìm thấy mã đơn <b>${window.S25.esc(code)}</b>. Thử mã mẫu <b>SKY-88921</b> hoặc <b>HD-B2B-2026-01</b>.</div>`;
    return false;
  }
  out.innerHTML = `
    <div class="auth-order-result">
      <div style="font-weight:800;color:var(--accent);">Đơn ${window.S25.esc(found.code)} • ${window.S25.vnd(found.total)}</div>
      <div><b>Khách hàng:</b> ${window.S25.esc(found.customerName)} (${window.S25.esc(found.email)})</div>
      <div><b>Trạng thái:</b> ${window.S25.esc(found.status)}</div>
      <div><b>Thời gian dự kiến:</b> ${window.S25.esc(found.eta)}</div>
    </div>`;
  return false;
};

async function renderAuthView() {
  const user = window.S25.getUser();
  const signed = document.getElementById('signedInCard');
  const guest = document.getElementById('guestAuthCard');
  if (user) {
    signed.style.display = 'block';
    guest.style.display = 'none';
    const staff = window.S25.isStaff(user);
    document.getElementById('dashWelcome').textContent = `Xin chào, ${user.full_name || user.name}${user.b2b ? ' (B2B VAT)' : ''}`;
    document.getElementById('dashEmail').textContent = `${user.email || user.username}${user.role_name ? ' • ' + user.role_name : ''}${staff && user.warehouse_name ? ' • ' + user.warehouse_name : ''}`;
    document.getElementById('dashAdminCtaWrap').style.display = staff ? 'block' : 'none';
    document.getElementById('dashWishCount').textContent = window.S25.getWishlist().length;
    document.getElementById('dashCartCount').textContent = window.S25.computeSummary().itemCount;

    const listEl = document.getElementById('dashOrdersList');
    const token = window.S25.getToken();
    let renderedFromApi = false;
    if (token) {
      try {
        const resp = await fetch('/api/storefront/orders/my', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.items) && data.items.length) {
            listEl.innerHTML = data.items.slice(0, 4).map((o) => `
              <div style="padding:10px 12px;border-radius:12px;background:rgba(240,249,255,0.85);border:1px solid rgba(2,132,199,0.16);font-size:0.78rem;">
                <b>${window.S25.esc(o.invoice_code)}</b> — ${window.S25.vnd(o.total_amount)} <span style="color:#0369a1;font-weight:700;">(${window.S25.esc(o.sales_channel)})</span><br/>
                <span style="color:var(--text-muted);">${window.S25.esc(FULFILLMENT_LABELS[o.fulfillment_status] || o.fulfillment_status)} • ${window.S25.esc(o.warehouse_name)}</span>
              </div>`).join('');
            renderedFromApi = true;
          }
        }
      } catch (_) {}
    }

    if (!renderedFromApi) {
      const orders = window.S25.getOrders();
      listEl.innerHTML = orders.slice(0, 4).map((o) => `
        <div style="padding:10px 12px;border-radius:12px;background:rgba(240,249,255,0.85);border:1px solid rgba(2,132,199,0.16);font-size:0.78rem;">
          <b>${window.S25.esc(o.code)}</b> — ${window.S25.vnd(o.total)}<br/>
          <span style="color:var(--text-muted);">${window.S25.esc(o.status)}</span>
        </div>`).join('');
    }
  } else {
    signed.style.display = 'none';
    guest.style.display = 'block';
  }
  window.S25.syncHeaderAuthAndWish();
}

window.S25.renderUspStrip(document.getElementById('authUspHost'));
window.S25.renderFooter(document.getElementById('s25FooterHost'));
initEyeButtons();
renderAuthView();

window.renderAuthView = renderAuthView;
