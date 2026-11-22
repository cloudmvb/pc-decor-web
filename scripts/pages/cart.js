const I = window.S25.ICONS;
document.getElementById('ltIco1').innerHTML = I.cpuUp;
document.getElementById('ltIco2').innerHTML = I.truck;
document.getElementById('ltIco3').innerHTML = I.shieldCheck;

function renderCartPage() {
  const host = document.getElementById('cartPageHost');
  const items = window.S25.getCart();
  const meta = window.S25.getCartMeta();
  const sum = window.S25.computeSummary(items, meta);

  if (!items.length) {
    host.innerHTML = `
      <section class="cart-empty-hero">
        <div class="cart-empty-ico">${I.cart}</div>
        <h2 style="font-size:1.45rem;font-weight:800;">Giỏ hàng của bạn đang trống</h2>
        <p style="font-size:0.86rem;color:var(--text-muted);max-width:520px;line-height:1.55;">
          Hãy khám phá hàng nghìn linh kiện PC, cấu hình Gaming RTX 50 dựng sẵn hoặc thử thêm nhanh một cấu hình mẫu bên dưới để trải nghiệm tính năng tính bảo hiểm vận chuyển &amp; mã ưu đãi.
        </p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:4px;">
          <a href="./shop.html?cat=ALL" class="sec3-btn-primary">Tiếp tục mua sắm ${I.arrowRight}</a>
          <button type="button" class="sec3-btn-secondary" onclick="seedDemoBuild()">+ Thêm nhanh PC RTX 5070 Ti Mẫu</button>
        </div>
      </section>`;
    return;
  }

  const itemsHtml = items.map((it, idx) => `
    <div class="cart-row">
      <img class="cart-row-thumb" style="width:68px;height:68px;" src="${window.S25.esc(window.S25.resolveThumb(it))}" alt="${window.S25.esc(it.name)}" />
      <div class="cart-row-info">
        <div class="cart-row-title">${window.S25.esc(it.name)}${it.variant ? ` <span class="product-badge">${window.S25.esc(it.variant)}</span>` : ''}</div>
        <div class="cart-row-sub">${window.S25.esc(it.sub || 'SKYCRUMB Studio')} • Đơn giá: ${window.S25.vnd(it.priceNum)}</div>
      </div>
      <div class="cart-qty-ctrl">
        <button type="button" aria-label="Giảm" onclick="stepCartPage(${idx}, -1)">-</button>
        <input type="number" class="cart-qty-input" min="1" max="99" value="${it.qty || 1}" aria-label="Số lượng" onchange="setCartQtyPage(${idx}, this.value)" />
        <button type="button" aria-label="Tăng" onclick="stepCartPage(${idx}, 1)">+</button>
      </div>
      <div style="min-width:110px;text-align:right;font-weight:800;font-size:0.95rem;color:var(--text-dark);font-variant-numeric:tabular-nums;">
        ${window.S25.vnd((it.priceNum || 0) * (it.qty || 1))}
      </div>
      <button type="button" class="cart-remove-btn" aria-label="Xóa ${window.S25.esc(it.name)}" onclick="removeCartPage(${idx})" title="Xóa khỏi giỏ">${I.trash}</button>
    </div>`).join('');

  host.innerHTML = `
    <div class="s25-cart-layout">
      <div class="s25-cart-items-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:10px;flex-wrap:wrap;">
          <h2 style="font-size:1.1rem;font-weight:800;">Sản phẩm đã chọn (${sum.itemCount} món)</h2>
          <button type="button" class="sec3-btn-secondary" style="padding:7px 12px;font-size:0.74rem;" onclick="if(confirm('Xóa toàn bộ giỏ hàng?')){window.S25.saveCart([]);renderCartPage();}">Xóa toàn bộ</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${itemsHtml}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;padding-top:14px;border-top:1px solid rgba(2,132,199,0.14);flex-wrap:wrap;gap:10px;">
          <a href="./index.html?sec=3" class="sec3-btn-secondary" style="padding:9px 14px;font-size:0.78rem;">+ Phối thêm linh kiện Studio</a>
          <button type="button" class="sec3-btn-secondary" style="padding:9px 14px;font-size:0.78rem;" onclick="renderCartPage()">Cập nhật giỏ hàng</button>
        </div>
      </div>

      <aside class="cart-summary-card" aria-label="Tóm tắt đơn hàng">
        <div class="drawer-category-tag">TÓM TẮT ĐƠN HÀNG // ORDER SUMMARY</div>
        <div class="cart-sum-line">
          <span>Tạm tính (${sum.itemCount} sản phẩm)</span>
          <b>${window.S25.vnd(sum.subtotal)}</b>
        </div>

        <div class="cart-protection-box">
          <div class="cart-prot-left">
            <input type="checkbox" id="pageProtChk" ${sum.protectionSelected ? 'checked' : ''} onchange="window.S25.setCartMeta({shippingProtection:this.checked});renderCartPage();" />
            <div>
              <label for="pageProtChk" class="cart-prot-title">
                ${I.shieldAlert}
                <span>Bảo hiểm Vận chuyển Bổ sung</span>
                <span class="cart-info-tip" title="Áp dụng theo mô hình Apex Shipping Protection (~1.5%): chèn túi khí đa tầng cố định VGA, đền bù/đổi mới 100% tức thì nếu va đập vận chuyển.">i</span>
              </label>
              <div class="cart-prot-sub">Chèn chống sốc buồng máy &amp; bảo vệ rơi vỡ 100%.</div>
            </div>
          </div>
          <span class="cart-prot-fee">${sum.promoInfo && sum.promoInfo.freeProt ? 'Miễn phí' : '+' + window.S25.vnd(sum.baseProtFee)}</span>
        </div>

        <div>
          <div style="font-size:0.74rem;font-weight:800;margin-bottom:6px;color:var(--text-muted);">Mã giảm giá / Ưu đãi</div>
          <form class="cart-promo-row" onsubmit="event.preventDefault();applyPagePromo(this.querySelector('input').value);">
            <input type="text" id="pagePromoInp" class="cart-promo-input" value="${window.S25.esc(sum.promoCode)}" placeholder="VD: SKY10, SKYVIP, FREESHIP" />
            <button type="submit" class="cart-promo-btn">Áp dụng</button>
          </form>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
            <button type="button" class="promo-quick-chip" onclick="applyPagePromo('SKY10')">SKY10 (-10%)</button>
            <button type="button" class="promo-quick-chip" onclick="applyPagePromo('SKYVIP')">SKYVIP (-500K)</button>
            <button type="button" class="promo-quick-chip" onclick="applyPagePromo('FREESHIP')">FREESHIP</button>
          </div>
          ${sum.promoCode ? `<div style="font-size:0.74rem;margin-top:6px;font-weight:700;color:${sum.promoInfo ? '#047857' : '#be123c'};">${sum.promoInfo ? 'Đã áp dụng: ' + sum.promoInfo.label : 'Mã không hợp lệ.'}</div>` : ''}
        </div>

        ${sum.protectionSelected ? `<div class="cart-sum-line"><span>Bảo hiểm vận chuyển</span><b>${window.S25.vnd(sum.protectionFee)}</b></div>` : ''}
        ${sum.discountAmount > 0 ? `<div class="cart-sum-line" style="color:#047857;"><span>Giảm giá (${window.S25.esc(sum.promoCode)})</span><b>-${window.S25.vnd(sum.discountAmount)}</b></div>` : ''}

        <div class="cart-sum-line total">
          <span>Tổng thanh toán</span>
          <b>${window.S25.vnd(sum.total)}</b>
        </div>

        <button type="button" class="sec3-btn-primary" style="width:100%;height:50px;" onclick="openCheckoutModal()">
          ${I.lock}<span>Thanh toán Bảo mật</span>
        </button>
        <div style="font-size:0.72rem;color:var(--text-muted);text-align:center;">Hỗ trợ Visa, Mastercard, Napas, VNPAY, MoMo &amp; Trả góp 0%</div>
      </aside>
    </div>
  `;
}

window.stepCartPage = (idx, delta) => {
  const list = window.S25.getCart();
  if (!list[idx]) return;
  list[idx].qty = (list[idx].qty || 1) + delta;
  if (list[idx].qty <= 0) list.splice(idx, 1);
  window.S25.saveCart(list);
  renderCartPage();
};
window.setCartQtyPage = (idx, val) => {
  const list = window.S25.getCart();
  if (!list[idx]) return;
  list[idx].qty = Math.max(1, Math.min(99, parseInt(val, 10) || 1));
  window.S25.saveCart(list);
  renderCartPage();
};
window.removeCartPage = (idx) => {
  const list = window.S25.getCart();
  list.splice(idx, 1);
  window.S25.saveCart(list);
  renderCartPage();
};
window.applyPagePromo = (code) => {
  window.S25.setCartMeta({ promoCode: String(code || '').trim().toUpperCase() });
  renderCartPage();
};
window.seedDemoBuild = () => {
  const list = window.S25.getCart();
  list.push({
    id: '1072100888',
    name: 'Luxury Snow White Ryzen 7 9800X3D • RTX 5070 Ti',
    sub: 'Signature Build • BH 36 Tháng',
    priceNum: 83980000,
    img: './assets/images/placeholders/hardware-wide.png',
    qty: 1
  });
  window.S25.saveCart(list);
  window.S25.setCartMeta({ shippingProtection: true });
  renderCartPage();
};

window.openCheckoutModal = () => {
  const user = window.S25.getUser();
  const sum = window.S25.computeSummary();
  const body = document.getElementById('checkoutModalBody');
  body.innerHTML = `
    <form onsubmit="return submitOrderDemo(event)" style="display:flex;flex-direction:column;gap:11px;">
      <input type="text" id="coName" value="${window.S25.esc(user ? (user.full_name || user.name) : '')}" placeholder="Họ và tên người nhận *" required style="height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--glass-border);" />
      <input type="email" id="coEmail" value="${window.S25.esc(user ? user.email : '')}" placeholder="Email nhận mã vận đơn *" required style="height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--glass-border);" />
      <input type="tel" id="coPhone" value="${window.S25.esc(user ? (user.phone || '') : '')}" placeholder="Số điện thoại liên hệ *" required style="height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--glass-border);" />
      <input type="text" id="coAddr" value="${window.S25.esc(user ? (user.address || '') : '')}" placeholder="Địa chỉ giao hàng chi tiết *" required style="height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--glass-border);" />
      <select id="coPayMethod" style="height:44px;padding:0 12px;border-radius:11px;border:1px solid var(--glass-border);background:#fff;font:inherit;">
        <option value="BANK_TRANSFER">Chuyển khoản QR Ngân hàng / VNPAY (Xử lý ưu tiên)</option>
        <option value="COD">Thanh toán khi nhận hàng (COD)</option>
        <option value="CARD">Thẻ Visa / Mastercard / Trả góp 0%</option>
      </select>
      <div style="padding:12px;border-radius:12px;background:#f0f9ff;font-size:0.82rem;display:flex;justify-content:space-between;">
        <span>Tổng thanh toán (${sum.itemCount} món)</span>
        <b style="color:var(--accent);font-size:1.05rem;">${window.S25.vnd(sum.total)}</b>
      </div>
      <div id="coErrorNote" style="display:none;padding:9px 12px;border-radius:10px;background:#fff1f2;color:#be123c;font-size:0.78rem;font-weight:700;"></div>
      <div style="display:flex;gap:8px;margin-top:4px;">
        <button type="button" class="sec3-btn-secondary" style="flex:1;" onclick="closeCheckoutModal()">Quay lại</button>
        <button type="submit" id="coSubmitBtn" class="sec3-btn-primary" style="flex:1.5;">${I.lock}<span>Xác nhận Đặt hàng</span></button>
      </div>
    </form>`;
  document.getElementById('checkoutBackdrop').classList.add('open');
};

window.closeCheckoutModal = () => {
  document.getElementById('checkoutBackdrop').classList.remove('open');
};

window.submitOrderDemo = async (e) => {
  e.preventDefault();
  const items = window.S25.getCart();
  const summary = window.S25.computeSummary(items);
  const customerName = document.getElementById('coName').value.trim();
  const email = document.getElementById('coEmail').value.trim();
  const phone = document.getElementById('coPhone').value.trim();
  const address = document.getElementById('coAddr').value.trim();
  const paymentMethod = document.getElementById('coPayMethod')?.value || 'BANK_TRANSFER';
  const btn = document.getElementById('coSubmitBtn');
  if (btn) btn.disabled = true;

  let erpOrder = null;
  try {
    const resp = await fetch('/api/storefront/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer: { name: customerName, email, phone, address },
        items: items.map((it) => ({
          sku: it.id,
          id: it.id,
          name: it.name,
          qty: Number(it.qty || 1),
          price: Number(it.priceNum || 0)
        })),
        promo_code: summary.promoCode || '',
        discount_amount: summary.discountAmount || 0,
        shipping_fee: summary.protectionFee || 0,
        payment_method: paymentMethod,
        note: `Đơn Web3D Storefront • Giao tới: ${address}`
      })
    });
    if (resp.ok) {
      const data = await resp.json();
      erpOrder = data.order || null;
    }
  } catch (_) {}

  const order = window.S25.createOrder({
    customerName,
    email,
    phone,
    address,
    summary,
    items
  });
  const finalCode = erpOrder?.invoice_code || order.code;
  const whText = erpOrder?.warehouse_name ? `<div style="font-size:0.78rem;color:#0369a1;font-weight:700;margin-bottom:10px;">Kho điều phối tự động: ${window.S25.esc(erpOrder.warehouse_name)}</div>` : '';

  document.getElementById('checkoutModalBody').innerHTML = `
    <div style="text-align:center;padding:12px 0;">
      <div style="font-size:1.25rem;font-weight:800;color:#047857;margin-bottom:6px;">Đặt hàng thành công!</div>
      <p style="font-size:0.84rem;color:var(--text-muted);margin-bottom:8px;">Mã theo dõi đơn hàng của bạn là <b style="color:var(--accent);">${window.S25.esc(finalCode)}</b> (${window.S25.esc(order.email)}).</p>
      ${whText}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="./account.html#track" class="sec3-btn-primary">Tra cứu trạng thái đơn</a>
        <button type="button" class="sec3-btn-secondary" onclick="closeCheckoutModal()">Đóng</button>
      </div>
    </div>`;
  renderCartPage();
  return false;
};

window.addEventListener('s25:sync', renderCartPage);
window.S25.renderFooter(document.getElementById('s25FooterHost'));
window.S25.syncHeaderAuthAndWish();
renderCartPage();

window.renderCartPage = renderCartPage;
