/* ============================================================================
   S25 // SKYCRUMB — SHARED COMMERCE, WISHLIST, AUTH & TRUST ENGINE
   Single source of truth synced via localStorage across:
   index.html, shop.html, cart.html, login.html
   ============================================================================ */
(function () {
  'use strict';

  const KEYS = {
    CART: 's25_cart_v1',
    CART_META: 's25_cart_meta_v1',
    WISH: 's25_wishlist_v1',
    USER: 's25_user_v1',
    TOKEN: 'skycrumb_erp_token_v1',
    ORDERS: 's25_orders_v1',
    PROMO_DISMISSED: 's25_promo_bar_closed'
  };

  const FALLBACK_HW = './assets/images/placeholders/hardware-wide.png';
  const FALLBACK_DECOR = './assets/images/placeholders/decor-wide.png';

  const ICONS = {
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    heartFilled: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
    user: '<svg class="tb-svg-stroke nzxt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="8.75" rx="4.13" ry="4.5"/><path d="M3 20.75a9.1 6.5 0 0 1 18 0"/></svg>',
    cart: '<svg class="tb-svg-stroke nzxt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1,3 5,3 7.5,16 19,16 23,7 10,7"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>',
    shieldCheck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
    shieldAlert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/></svg>',
    clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>',
    box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>',
    filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
    arrowRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
    chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    award: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/></svg>',
    cpuUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>',
    creditCard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
    headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5Zm0 0a9 9 0 1 1 18 0m0 0v5a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3Z"/><path d="M21 16v2a4 4 0 0 1-4 4h-5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>'
  };

  function esc(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
    ));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  function emitSync() {
    window.dispatchEvent(new CustomEvent('s25:sync'));
    syncHeaderAuthAndWish();
  }

  function vnd(n) {
    return (Number(n) || 0).toLocaleString('vi-VN') + 'đ';
  }

  function productUrl(id, cat) {
    if (!id) return './shop.html';
    const qs = new URLSearchParams();
    qs.set('id', String(id));
    if (cat) qs.set('cat', String(cat));
    return `./product.html?${qs.toString()}`;
  }

  /* ===== CART & PROMO ENGINE ===== */
  const PROMOS = {
    SKY10: { code: 'SKY10', label: 'Giảm 10% (Tối đa 2.000.000đ)', calc: (sub) => Math.min(Math.round(sub * 0.10), 2000000) },
    SKYVIP: { code: 'SKYVIP', label: 'Giảm 500.000đ đơn từ 3 triệu', calc: (sub) => (sub >= 3000000 ? 500000 : 0) },
    FREESHIP: { code: 'FREESHIP', label: 'Miễn phí Bảo hiểm Vận chuyển 100%', freeProt: true, calc: () => 0 },
    CASE100: { code: 'CASE100', label: 'Giảm 100.000đ đơn từ 2 triệu (Thưởng Lắp Case)', calc: (sub) => (sub >= 2000000 ? 100000 : 0) },
    CASE200: { code: 'CASE200', label: 'Giảm 200.000đ đơn từ 3 triệu (Thưởng Lắp Case)', calc: (sub) => (sub >= 3000000 ? 200000 : 0) },
    CASE500: { code: 'CASE500', label: 'Giảm 500.000đ đơn từ 10 triệu (Thưởng Lắp Case)', calc: (sub) => (sub >= 10000000 ? 500000 : 0) },
    CASE1TR: { code: 'CASE1TR', label: 'Giảm 1.000.000đ đơn từ 25 triệu (Jackpot Lắp Case)', calc: (sub) => (sub >= 25000000 ? 1000000 : 0) }
  };

  function getCart() {
    const arr = readJson(KEYS.CART, []);
    return Array.isArray(arr) ? arr : [];
  }

  function saveCart(arr) {
    writeJson(KEYS.CART, Array.isArray(arr) ? arr : []);
    emitSync();
  }

  function getCartMeta() {
    const meta = readJson(KEYS.CART_META, {});
    return {
      shippingProtection: Boolean(meta && meta.shippingProtection),
      promoCode: String((meta && meta.promoCode) || '').trim().toUpperCase()
    };
  }

  function setCartMeta(patch) {
    const next = Object.assign({}, getCartMeta(), patch || {});
    if (next.promoCode) next.promoCode = String(next.promoCode).trim().toUpperCase();
    writeJson(KEYS.CART_META, next);
    emitSync();
    return next;
  }

  function calcProtectionFee(subtotal) {
    if (!subtotal || subtotal <= 0) return 0;
    const raw = Math.round((subtotal * 0.015) / 1000) * 1000;
    return Math.min(Math.max(raw, 49000), 690000);
  }

  function computeSummary(items, meta) {
    const list = Array.isArray(items) ? items : getCart();
    const m = meta || getCartMeta();
    const itemCount = list.reduce((s, it) => s + Math.max(1, Number(it.qty) || 1), 0);
    const subtotal = list.reduce((s, it) => s + (Number(it.priceNum) || 0) * Math.max(1, Number(it.qty) || 1), 0);
    const baseProtFee = calcProtectionFee(subtotal);
    const promo = m.promoCode ? (PROMOS[m.promoCode] || null) : null;
    const protectionFee = m.shippingProtection ? (promo && promo.freeProt ? 0 : baseProtFee) : 0;
    const discountAmount = promo ? promo.calc(subtotal) : 0;
    const total = Math.max(0, subtotal + protectionFee - discountAmount);
    return {
      itemCount,
      subtotal,
      baseProtFee,
      protectionSelected: m.shippingProtection,
      protectionFee,
      promoCode: m.promoCode,
      promoInfo: promo,
      discountAmount,
      total
    };
  }

  function resolveThumb(item) {
    if (item && item.img) return item.img;
    if (item && String(item.sub || item.name || '').toLowerCase().includes('decor')) return FALLBACK_DECOR;
    return FALLBACK_HW;
  }

  function renderCartDrawerBody({ bodyEl, titleEl, noteId = 'cartDrawerNote', onChange }) {
    if (!bodyEl) return;
    const items = getCart();
    const meta = getCartMeta();
    const sum = computeSummary(items, meta);
    if (titleEl) {
      if (titleEl.querySelector('span')) {
        titleEl.innerHTML = `${ICONS.cart}<span>Giỏ hàng (${sum.itemCount})</span>`;
      } else {
        titleEl.textContent = `Giỏ hàng (${sum.itemCount})`;
      }
    }

    if (!items.length) {
      bodyEl.innerHTML = `
        <div class="cart-empty-hero" style="padding:36px 20px;">
          <div class="cart-empty-ico">${ICONS.cart}</div>
          <div style="font-weight:800;font-size:1.05rem;">Giỏ hàng của bạn đang trống</div>
          <div style="font-size:0.8rem;color:var(--text-muted);line-height:1.5;">Khám phá hơn 2.326 sản phẩm PC Gaming, linh kiện chính hãng, Mô Hình &amp; Decor hoặc phối cấu hình trực quan từ Case 3D.</div>
          <a href="./shop.html" class="sec3-btn-primary" style="text-decoration:none;width:100%;">Tiếp tục mua sắm ${ICONS.arrowRight}</a>
        </div>`;
      return;
    }

    const rowsHtml = items.map((it, idx) => `
      <div class="cart-row" style="align-items:center;">
        <a href="${esc(productUrl(it.id))}" aria-label="${esc(it.name)}"><img class="cart-row-thumb" src="${esc(resolveThumb(it))}" alt="${esc(it.name)}" loading="lazy" /></a>
        <div class="cart-row-info">
          <div class="cart-row-title"><a href="${esc(productUrl(it.id))}" style="color:inherit;text-decoration:none;">${esc(it.name)}</a>${it.variant ? ` <span class="product-badge" style="font-size:0.65rem;">${esc(it.variant)}</span>` : ''}</div>
          <div class="cart-row-sub">${it.sub ? esc(it.sub) + ' • ' : ''}${vnd((it.priceNum || 0) * (it.qty || 1))}</div>
        </div>
        <div class="cart-qty-ctrl">
          <button type="button" aria-label="Giảm số lượng" onclick="window.__s25DrawerStep(${idx}, -1)">-</button>
          <span>${it.qty || 1}</span>
          <button type="button" aria-label="Tăng số lượng" onclick="window.__s25DrawerStep(${idx}, 1)">+</button>
        </div>
        <button type="button" class="cart-remove-btn" aria-label="Xóa sản phẩm" onclick="window.__s25DrawerRemove(${idx})" title="Xóa khỏi giỏ">${ICONS.trash}</button>
      </div>`).join('');

    bodyEl.innerHTML = `
      <div class="s25-leadtime-banner" style="grid-template-columns:1fr;gap:8px;padding:11px 14px;margin-bottom:4px;">
        <div class="s25-lt-cell" style="border-right:none;padding-right:0;">
          <div class="s25-lt-ico" style="width:32px;height:32px;">${ICONS.truck}</div>
          <div><small>THỜI GIAN XỬ LÝ DỰ KIẾN</small><b>PC Lắp Ráp: 2–3 ngày • Linh kiện rời: Giao 2h</b></div>
        </div>
      </div>
      ${rowsHtml}
      <div class="cart-protection-box">
        <div class="cart-prot-left">
          <input type="checkbox" id="drawerProtChk" ${sum.protectionSelected ? 'checked' : ''} onchange="window.__s25DrawerToggleProt(this.checked)" />
          <div>
            <label for="drawerProtChk" class="cart-prot-title">
              ${ICONS.shieldCheck}
              <span>Bảo hiểm Vận chuyển 100%</span>
              <span class="cart-info-tip" title="Đóng gói chống sốc 2 lớp, bảo vệ VGA rời và bồi hoàn/đổi mới ngay 100% nếu có va đập vận chuyển.">i</span>
            </label>
            <div class="cart-prot-sub">Bảo vệ chống sốc VGA &amp; đền bù 100% khi ship tỉnh.</div>
          </div>
        </div>
        <span class="cart-prot-fee">${sum.promoInfo && sum.promoInfo.freeProt ? 'Miễn phí' : '+' + vnd(sum.baseProtFee)}</span>
      </div>
      <form class="cart-promo-row" onsubmit="event.preventDefault(); window.__s25DrawerApplyPromo(this.querySelector('input').value);">
        <input type="text" class="cart-promo-input" value="${esc(sum.promoCode)}" placeholder="Mã giảm giá (SKY10, SKYVIP, FREESHIP)" aria-label="Mã giảm giá" />
        <button type="submit" class="cart-promo-btn">Áp dụng</button>
      </form>
      <div class="cart-row" style="flex-direction:column;align-items:stretch;gap:10px;border-color:var(--accent);">
        <div class="cart-sum-line"><span>Tạm tính (${sum.itemCount} món)</span><b>${vnd(sum.subtotal)}</b></div>
        ${sum.protectionSelected ? `<div class="cart-sum-line"><span>Bảo hiểm vận chuyển (1.5%)</span><b>${vnd(sum.protectionFee)}</b></div>` : ''}
        ${sum.discountAmount > 0 ? `<div class="cart-sum-line" style="color:#047857;"><span>Ưu đãi (${esc(sum.promoCode)})</span><b>-${vnd(sum.discountAmount)}</b></div>` : ''}
        <div class="cart-sum-line total"><span>Tổng cộng</span><b>${vnd(sum.total)}</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;">
          <button type="button" class="sec3-btn-secondary" style="flex:1;padding:10px 12px;" onclick="document.getElementById('${esc(noteId)}').textContent='Đã đồng bộ báo giá & cấu hình giỏ hàng trên trình duyệt.'">Lưu báo giá</button>
          <a href="./cart.html" class="sec3-btn-primary" style="flex:1.25;text-decoration:none;padding:10px 12px;">${ICONS.lock}<span>Trang Giỏ hàng</span></a>
        </div>
      </div>
      <div id="${esc(noteId)}" style="font-size:0.76rem;color:var(--accent);font-weight:700;padding:0 4px;">${sum.promoCode && !sum.promoInfo ? 'Mã không hợp lệ. Thử: SKY10, SKYVIP, FREESHIP hoặc mã từ Game Lắp Case.' : (sum.promoInfo ? 'Đang áp dụng mã ' + sum.promoInfo.code + ': ' + sum.promoInfo.label : '')}</div>
    `;

    window.__s25DrawerStep = (idx, d) => {
      if (typeof window.updateCartQty === 'function') window.updateCartQty(idx, d);
      else {
        const list = getCart();
        if (!list[idx]) return;
        list[idx].qty = (list[idx].qty || 1) + d;
        if (list[idx].qty <= 0) list.splice(idx, 1);
        saveCart(list);
      }
      if (onChange) onChange();
    };
    window.__s25DrawerRemove = (idx) => {
      const list = getCart();
      list.splice(idx, 1);
      saveCart(list);
      if (onChange) onChange();
      else renderCartDrawerBody({ bodyEl, titleEl, noteId, onChange });
    };
    window.__s25DrawerToggleProt = (checked) => {
      setCartMeta({ shippingProtection: Boolean(checked) });
      renderCartDrawerBody({ bodyEl, titleEl, noteId, onChange });
    };
    window.__s25DrawerApplyPromo = (code) => {
      setCartMeta({ promoCode: String(code || '').trim().toUpperCase() });
      renderCartDrawerBody({ bodyEl, titleEl, noteId, onChange });
    };
  }

  /* ===== WISHLIST ENGINE ===== */
  function getWishlist() {
    const arr = readJson(KEYS.WISH, []);
    return Array.isArray(arr) ? arr : [];
  }

  function hasWish(id) {
    const sid = String(id || '');
    return getWishlist().some((w) => String(w.id) === sid);
  }

  function toggleWish(item) {
    if (!item || !item.id) return false;
    const list = getWishlist();
    const sid = String(item.id);
    const idx = list.findIndex((w) => String(w.id) === sid);
    let added = false;
    if (idx >= 0) {
      list.splice(idx, 1);
    } else {
      list.unshift({
        id: sid,
        name: item.name || item.n || 'Sản phẩm Studio',
        sub: item.sub || item.sc || 'SKYCRUMB Studio',
        priceNum: Number(item.priceNum || item.p || 0),
        img: item.img || resolveThumb(item)
      });
      added = true;
    }
    writeJson(KEYS.WISH, list);
    emitSync();
    return added;
  }

  function ensureWishDrawerDom() {
    if (document.getElementById('s25WishDrawer')) return;
    const bd = document.createElement('div');
    bd.id = 's25WishBackdrop';
    bd.className = 's25-wish-backdrop';
    bd.onclick = closeWishDrawer;

    const drawer = document.createElement('aside');
    drawer.id = 's25WishDrawer';
    drawer.className = 's25-wish-drawer';
    drawer.setAttribute('role', 'dialog');
    drawer.setAttribute('aria-modal', 'true');
    drawer.setAttribute('aria-label', 'Danh sách yêu thích');
    drawer.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div>
          <div class="drawer-category-tag">SKYCRUMB // WISHLIST ĐÃ LƯU</div>
          <h2 id="s25WishTitle" style="font-size:1.28rem;font-weight:800;margin-top:4px;">Yêu thích (0)</h2>
        </div>
        <button type="button" class="drawer-close" aria-label="Đóng danh sách yêu thích" onclick="window.S25.closeWishDrawer()">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4 12 12"/><path d="m4 12 8-8"/></svg>
        </button>
      </div>
      <div class="s25-wish-body" id="s25WishBody"></div>
    `;
    document.body.appendChild(bd);
    document.body.appendChild(drawer);
  }

  function renderWishDrawerContent() {
    const body = document.getElementById('s25WishBody');
    const title = document.getElementById('s25WishTitle');
    if (!body) return;
    const list = getWishlist();
    if (title) title.textContent = `Yêu thích (${list.length})`;
    if (!list.length) {
      body.innerHTML = `
        <div class="cart-empty-hero" style="padding:36px 20px;">
          <div class="cart-empty-ico" style="color:#e11d48;background:#fff1f2;">${ICONS.heart}</div>
          <div style="font-weight:800;">Chưa có sản phẩm yêu thích</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">Bấm biểu tượng trái tim trên bất kỳ PC hoặc linh kiện nào để lưu so sánh sau.</div>
          <a href="./shop.html" class="sec3-btn-primary" style="text-decoration:none;width:100%;">Khám phá Cửa hàng ${ICONS.arrowRight}</a>
        </div>`;
      return;
    }
    body.innerHTML = list.map((it) => `
      <div class="cart-row">
        <a href="${esc(productUrl(it.id))}" aria-label="${esc(it.name)}"><img class="cart-row-thumb" src="${esc(resolveThumb(it))}" alt="${esc(it.name)}" /></a>
        <div class="cart-row-info">
          <div class="cart-row-title"><a href="${esc(productUrl(it.id))}" style="color:inherit;text-decoration:none;">${esc(it.name)}</a></div>
          <div class="cart-row-sub">${esc(it.sub)} • ${it.priceNum > 0 ? vnd(it.priceNum) : 'Liên hệ'}</div>
        </div>
        <button type="button" class="add-btn" onclick="window.S25.moveWishToCart('${esc(it.id)}')">+ Giỏ</button>
        <button type="button" class="cart-remove-btn" aria-label="Bỏ yêu thích" onclick="window.S25.removeWish('${esc(it.id)}')">${ICONS.trash}</button>
      </div>`).join('') + `
      <a href="./shop.html?wish=1" class="sec3-btn-secondary" style="text-decoration:none;margin-top:6px;">Lọc các món đã thích tại Cửa hàng ${ICONS.arrowRight}</a>`;
  }

  function openWishDrawer() {
    ensureWishDrawerDom();
    renderWishDrawerContent();
    document.getElementById('s25WishBackdrop').classList.add('open');
    document.getElementById('s25WishDrawer').classList.add('open');
  }

  function closeWishDrawer() {
    const bd = document.getElementById('s25WishBackdrop');
    const dr = document.getElementById('s25WishDrawer');
    if (bd) bd.classList.remove('open');
    if (dr) dr.classList.remove('open');
  }

  function removeWish(id) {
    const list = getWishlist().filter((x) => String(x.id) !== String(id));
    writeJson(KEYS.WISH, list);
    renderWishDrawerContent();
    emitSync();
  }

  function moveWishToCart(id) {
    const w = getWishlist().find((x) => String(x.id) === String(id));
    if (!w) return;
    if (typeof window.addToCart === 'function') {
      window.addToCart({ id: w.id, name: w.name, sub: w.sub, priceNum: w.priceNum, img: w.img, qty: 1 });
    } else {
      const cart = getCart();
      const ex = cart.find((x) => String(x.id) === String(w.id));
      if (ex) ex.qty = (ex.qty || 1) + 1;
      else cart.push({ id: w.id, name: w.name, sub: w.sub, priceNum: w.priceNum, img: w.img, qty: 1 });
      saveCart(cart);
    }
    emitSync();
  }

  /* ===== AUTH, SESSION & ACCOUNT DROPDOWN ENGINE ===== */
  function getUser() {
    return readJson(KEYS.USER, null);
  }

  function getToken() {
    try { return localStorage.getItem(KEYS.TOKEN) || ''; } catch { return ''; }
  }

  function isStaff(u) {
    const user = u || getUser();
    return Boolean(user && (user.is_staff === true || ['ADMIN', 'WAREHOUSE_MGR', 'SALES_STAFF', 'PURCHASE_STAFF'].includes(user.role_code)));
  }

  function canAccessAdmin(u) {
    return isStaff(u) && Boolean(getToken());
  }

  function hasPermission(perm, u) {
    const user = u || getUser();
    if (!isStaff(user)) return false;
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (user.role_code === 'ADMIN' || perms.includes('ALL')) return true;
    return perms.includes(perm);
  }

  function setSession(token, apiUser) {
    if (token) {
      try { localStorage.setItem(KEYS.TOKEN, token); } catch (_) {}
    }
    const displayName = String(apiUser.full_name || apiUser.name || apiUser.username || apiUser.email || 'Thành viên').trim();
    const baseName = displayName.replace(/\s*\([^)]*\)\s*/g, ' ').trim() || displayName;
    const parts = baseName.split(/\s+/).filter(Boolean);
    const shortName = (parts[parts.length - 1] || baseName).slice(0, 14);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : baseName.slice(0, 2).toUpperCase();
    const user = {
      ...apiUser,
      name: displayName,
      full_name: displayName,
      shortName,
      initials,
      email: String(apiUser.email || '').trim().toLowerCase(),
      b2b: apiUser.customer_type === 'B2B' || Boolean(apiUser.b2b),
      signedInAt: new Date().toISOString()
    };
    writeJson(KEYS.USER, user);
    emitSync();
    return user;
  }

  function loginUser({ email, name, remember, shortName, initials }) {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const displayName = name || shortName || cleanEmail.split('@')[0] || 'Khách hàng';
    const user = {
      email: cleanEmail,
      name: displayName,
      full_name: displayName,
      shortName: shortName || displayName.split(/\s+/).slice(-1)[0].slice(0, 12),
      initials: initials || displayName.slice(0, 2).toUpperCase(),
      role_code: 'CUSTOMER',
      role_name: 'Khách Hàng Thành Viên',
      is_staff: false,
      permissions: [],
      b2b: false,
      remember: Boolean(remember),
      signedInAt: new Date().toISOString()
    };
    writeJson(KEYS.USER, user);
    emitSync();
    return user;
  }

  function registerUser({ name, email, b2b, company, newsletter }) {
    const cleanName = String(name || '').trim() || 'Thành viên SKYCRUMB';
    const cleanEmail = String(email || '').trim().toLowerCase();
    const user = {
      email: cleanEmail,
      name: cleanName,
      full_name: cleanName,
      shortName: cleanName.split(/\s+/).slice(-1)[0].slice(0, 12),
      initials: cleanName.slice(0, 2).toUpperCase(),
      role_code: 'CUSTOMER',
      role_name: b2b ? 'Khách Hàng Doanh Nghiệp (B2B)' : 'Khách Hàng Thành Viên',
      is_staff: false,
      permissions: [],
      b2b: Boolean(b2b),
      company: company || '',
      newsletter: Boolean(newsletter),
      signedInAt: new Date().toISOString()
    };
    writeJson(KEYS.USER, user);
    emitSync();
    return user;
  }

  function logoutUser() {
    try {
      localStorage.removeItem(KEYS.USER);
      localStorage.removeItem(KEYS.TOKEN);
    } catch (_) {}
    closeAccountDropdown();
    emitSync();
  }

  /* ===== BINH-STORE INSPIRED ACCOUNT DROPDOWN POPUP ===== */
  let dropdownDocListenerBound = false;

  function ensureAccountDropdownDom() {
    let menu = document.getElementById('skyAccountDropdown');
    if (!menu) {
      menu = document.createElement('div');
      menu.id = 'skyAccountDropdown';
      menu.className = 'sky-account-dropdown';
      menu.setAttribute('role', 'menu');
      menu.setAttribute('aria-label', 'Tùy chọn tài khoản');
      document.body.appendChild(menu);
    }
    if (!dropdownDocListenerBound) {
      dropdownDocListenerBound = true;
      document.addEventListener('click', (e) => {
        const dd = document.getElementById('skyAccountDropdown');
        const btn = document.getElementById('tbAuthLink');
        if (!dd || !dd.classList.contains('open')) return;
        if (dd.contains(e.target) || (btn && btn.contains(e.target))) return;
        closeAccountDropdown();
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAccountDropdown();
      });
      window.addEventListener('resize', () => {
        const dd = document.getElementById('skyAccountDropdown');
        const btn = document.getElementById('tbAuthLink');
        if (dd && dd.classList.contains('open') && btn) positionAccountDropdown(dd, btn);
      });
    }
    return menu;
  }

  function positionAccountDropdown(menu, anchor) {
    const r = anchor.getBoundingClientRect();
    const top = Math.round(r.bottom + 10);
    const right = Math.max(12, Math.round(window.innerWidth - r.right));
    menu.style.top = `${top}px`;
    menu.style.right = `${right}px`;
  }

  function renderAccountDropdownContent(menu, user) {
    const wishCount = getWishlist().length;
    const staff = isStaff(user);
    const roleLabel = staff
      ? `${user.role_code || 'STAFF'}${user.warehouse_code ? ' • ' + user.warehouse_code : ''}`
      : (user.role_name || (user.b2b ? 'Doanh Nghiệp B2B' : 'Thành viên Studio'));
    menu.innerHTML = `
      <div class="sky-ad-head">
        <div class="sky-ad-avatar">${esc(user.initials || 'SK')}</div>
        <div class="sky-ad-meta">
          <div class="sky-ad-name" title="${esc(user.full_name || user.name)}">${esc(user.full_name || user.name)}</div>
          <div class="sky-ad-email" title="${esc(user.email || user.username)}">${esc(user.email || user.username || '')}</div>
          <span class="sky-ad-role-pill ${staff ? 'is-staff' : ''}">${esc(roleLabel)}</span>
        </div>
      </div>
      <div class="sky-ad-menu">
        ${staff ? `
          <a href="./admin.html" class="sky-ad-item is-admin-cta" role="menuitem">
            ${ICONS.settings}
            <span>QUẢN LÝ HỆ THỐNG</span>
          </a>
        ` : ''}
        <a href="./account.html" class="sky-ad-item" role="menuitem">
          ${ICONS.clipboard}
          <span>Hồ sơ &amp; Lịch sử đơn hàng</span>
        </a>
        <button type="button" class="sky-ad-item" role="menuitem" id="skyAdWishBtn">
          ${ICONS.heart}
          <span>Sản phẩm Yêu thích</span>
          <span class="sky-ad-count">${wishCount}</span>
        </button>
        <a href="./account.html#track" class="sky-ad-item" role="menuitem">
          ${ICONS.truck}
          <span>Tra cứu đơn hàng</span>
        </a>
        <div class="sky-ad-divider"></div>
        <button type="button" class="sky-ad-item is-danger" role="menuitem" id="skyAdLogoutBtn">
          ${ICONS.logout}
          <span>Đăng xuất</span>
        </button>
      </div>
    `;

    const wishBtn = menu.querySelector('#skyAdWishBtn');
    if (wishBtn) {
      wishBtn.onclick = () => {
        closeAccountDropdown();
        openWishDrawer();
      };
    }
    const logoutBtn = menu.querySelector('#skyAdLogoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        logoutUser();
        if (/\/(admin|account)\.html$/i.test(window.location.pathname)) {
          window.location.href = './index.html';
        } else if (typeof window.renderAuthView === 'function') {
          window.renderAuthView();
        }
      };
    }
  }

  function closeAccountDropdown() {
    const menu = document.getElementById('skyAccountDropdown');
    if (menu) menu.classList.remove('open');
    const btn = document.getElementById('tbAuthLink');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function toggleAccountDropdown(anchorEl) {
    const user = getUser();
    if (!user) return false;
    const menu = ensureAccountDropdownDom();
    const isOpen = menu.classList.contains('open');
    if (isOpen) {
      closeAccountDropdown();
      return false;
    }
    renderAccountDropdownContent(menu, user);
    positionAccountDropdown(menu, anchorEl);
    menu.classList.add('open');
    anchorEl.setAttribute('aria-expanded', 'true');
    return true;
  }

  function getOrders() {
    let list = readJson(KEYS.ORDERS, null);
    if (!Array.isArray(list) || !list.length) {
      list = [{
        code: 'SKY-88921',
        email: 'guest@skycrumb.vn',
        customerName: 'Minh Khôi (Demo)',
        status: 'Đang Stress-Test 24h tại SKYCRUMB Lab (Bước 3/4)',
        eta: 'Dự kiến giao trong 24–48 giờ tới',
        createdAt: '2026-11-12 14:20',
        total: 35280000,
        itemsCount: 1
      }];
      writeJson(KEYS.ORDERS, list);
    } else {
      let dirty = false;
      list = list.map((o) => {
        if (o && o.code === 'S25-88921') {
          dirty = true;
          return { ...o, code: 'SKY-88921', status: 'Đang Stress-Test 24h tại SKYCRUMB Lab (Bước 3/4)' };
        }
        return o;
      });
      if (dirty) writeJson(KEYS.ORDERS, list);
    }
    return list;
  }

  function createOrder({ customerName, email, phone, address, note, summary, items }) {
    const orders = getOrders();
    const code = 'SKY-' + String(Math.floor(10000 + Math.random() * 89999));
    const rec = {
      code,
      email: String(email || '').trim().toLowerCase(),
      customerName: customerName || 'Khách hàng SKYCRUMB',
      phone: phone || '',
      address: address || '',
      note: note || '',
      status: 'Đã tiếp nhận đơn & chờ kỹ thuật lắp ráp',
      eta: '2–3 ngày làm việc (PC Build) hoặc Giao 2h (Linh kiện)',
      createdAt: new Date().toLocaleString('vi-VN'),
      total: summary ? summary.total : 0,
      itemsCount: summary ? summary.itemCount : (items ? items.length : 0),
      protection: summary ? summary.protectionSelected : false
    };
    orders.unshift(rec);
    writeJson(KEYS.ORDERS, orders);
    saveCart([]);
    setCartMeta({ shippingProtection: false, promoCode: '' });
    return rec;
  }

  function findOrder(code, email) {
    const c = String(code || '').trim().toUpperCase();
    const e = String(email || '').trim().toLowerCase();
    if (!c) return null;
    return getOrders().find((o) => String(o.code).toUpperCase() === c && (!e || String(o.email).toLowerCase() === e)) || null;
  }

  /* ===== HEADER & SHARED CHROME SYNC ===== */
  function syncHeaderAuthAndWish() {
    const wishCount = getWishlist().length;
    const wishBadge = document.getElementById('tbWishBadge');
    if (wishBadge) wishBadge.textContent = wishCount;

    const cartCount = computeSummary().itemCount;
    document.querySelectorAll('#tbCartBadge, #cartCount, [data-s25-cart-badge]').forEach((el) => {
      el.textContent = cartCount;
    });

    const user = getUser();
    const authEl = document.getElementById('tbAuthLink');
    if (authEl) {
      authEl.classList.add('icon');
      if (user) {
        authEl.innerHTML = `${ICONS.user}<span class="tb-auth-dot" aria-hidden="true"></span>`;
        authEl.classList.add('tb-auth-signed');
        authEl.setAttribute('aria-label', `Tài khoản: ${user.email || user.username}`);
        authEl.setAttribute('aria-haspopup', 'menu');
        authEl.setAttribute('aria-expanded', document.getElementById('skyAccountDropdown')?.classList.contains('open') ? 'true' : 'false');
        authEl.title = `Tài khoản: ${user.full_name || user.shortName} (${user.email || user.username})`;
      } else {
        authEl.innerHTML = ICONS.user;
        authEl.classList.remove('tb-auth-signed');
        authEl.setAttribute('aria-label', 'Tài khoản & Tra cứu đơn hàng');
        authEl.removeAttribute('aria-haspopup');
        authEl.removeAttribute('aria-expanded');
        authEl.title = 'Đăng nhập / Đăng ký hoặc Tra cứu đơn hàng';
        closeAccountDropdown();
      }
      if (!authEl.dataset.skyAuthBound) {
        authEl.dataset.skyAuthBound = '1';
        authEl.addEventListener('click', (e) => {
          if (getUser()) {
            e.preventDefault();
            e.stopPropagation();
            toggleAccountDropdown(authEl);
          }
        });
      }
    }

    document.querySelectorAll('.card-wish-btn[data-wish-id]').forEach((btn) => {
      const wished = hasWish(btn.getAttribute('data-wish-id'));
      btn.classList.toggle('wished', wished);
      btn.innerHTML = wished ? ICONS.heartFilled : ICONS.heart;
      btn.setAttribute('aria-pressed', wished ? 'true' : 'false');
    });
  }

  function mountPromoBar() {
    const existing = document.getElementById('s25PromoBar');
    if (existing) existing.remove();
  }

  function renderUspStrip(targetEl) {
    if (!targetEl) return;
    targetEl.className = 's25-usp-strip';
    targetEl.innerHTML = `
      <div class="s25-usp-item">${ICONS.shieldCheck}<div><b>Bảo hành 36 Tháng</b> <span>1 đổi 1 chuẩn hãng</span></div></div>
      <div class="s25-usp-item">${ICONS.truck}<div><b>Giao nhanh 2H</b> <span>Đóng gói chống sốc VGA</span></div></div>
      <div class="s25-usp-item">${ICONS.cpuUp}<div><b>Stress-Test 24 Giờ</b> <span>Kèm file báo cáo nhiệt</span></div></div>
      <div class="s25-usp-item">${ICONS.headset}<div><b>Hỗ trợ kỹ thuật 1:1</b> <span>Tư vấn &amp; UltraView 8h–22h</span></div></div>
    `;
  }

  /* ===== UNIFIED MULTI-COLUMN STUDIO FOOTER ===== */
  function renderFooter(el) {
    if (!el) return;
    el.className = 's25-footer';
    el.innerHTML = `
      <div class="s25-footer-inner">
        <div class="s25-footer-grid">
          <div>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
              <span style="width:32px;height:32px;border-radius:50%;background:#0284c7;color:#fff;display:grid;place-items:center;font-size:0.72rem;font-weight:800;">SKY</span>
              <strong style="font-size:1.05rem;letter-spacing:0.06em;">SKYCRUMB STUDIO</strong>
            </div>
            <p style="font-size:0.8rem;line-height:1.6;color:rgba(226,241,252,0.75);max-width:300px;">
              Kết hợp trải nghiệm 3D trực quan cùng kho phần cứng &amp; mô hình decor tuyển chọn. Thiết kế vì đam mê góc máy hoàn hảo.
            </p>
            <div class="s25-footer-social" aria-label="Kênh kết nối">
              <a class="s25-social-btn" href="./shop.html?cat=pc" aria-label="PC Studio">${ICONS.cpuUp}</a>
              <a class="s25-social-btn" href="./shop.html?cat=decor" aria-label="Decor Figure">${ICONS.sparkles}</a>
              <a class="s25-social-btn" href="./cart.html" aria-label="Giỏ hàng">${ICONS.cart}</a>
              <a class="s25-social-btn" href="./login.html" aria-label="Tài khoản">${ICONS.user}</a>
            </div>
          </div>

          <div>
            <h4>Khám phá nhanh</h4>
            <ul>
              <li><a href="./index.html">Case 3D Tương Tác</a></li>
              <li><a href="./index.html?sec=2">Signature Builds 2026</a></li>
              <li><a href="./index.html?sec=3">Tự Phối Cấu Hình Studio</a></li>
              <li><a href="./index.html?sec=4">Phối Trọn Góc Máy &amp; Đặt Lịch</a></li>
              <li><a href="./index.html?sec=5">Lookbook Góc Máy Thành Phẩm</a></li>
              <li><a href="./index.html?sec=6">Lắp Case Săn Voucher</a></li>
              <li><a href="./shop.html?cat=ALL">Toàn bộ Cửa Hàng (2.326+)</a></li>
            </ul>
          </div>

          <div>
            <h4>Danh mục nổi bật</h4>
            <ul>
              <li><a href="./shop.html?cat=pc">PC Gaming &amp; Đồ Họa RTX 50</a></li>
              <li><a href="./shop.html?cat=linh-kien-may-tinh">Linh Kiện CPU / VGA / Main</a></li>
              <li><a href="./shop.html?cat=man-hinh-may-tinh">Màn Hình OLED 240Hz+</a></li>
              <li><a href="./shop.html?cat=decor">Mô Hình &amp; Decor Setup</a></li>
            </ul>
          </div>

          <div>
            <h4>Khách hàng &amp; Đơn hàng</h4>
            <ul>
              <li><a href="./login.html">Đăng nhập / Đăng ký B2B</a></li>
              <li><a href="./login.html#guest-track">Tra cứu Đơn hàng (SKY-88921)</a></li>
              <li><a href="./cart.html">Giỏ hàng &amp; Bảo hiểm Ship</a></li>
              <li><a href="./shop.html?wish=1">Danh sách Yêu thích</a></li>
            </ul>
          </div>

          <div>
            <h4>Nhận Deal Cấu Hình</h4>
            <p style="font-size:0.78rem;color:rgba(226,241,252,0.75);line-height:1.5;">Đăng ký nhận thông báo RTX thế hệ mới và mã ưu đãi độc quyền cuối tuần.</p>
            <form class="s25-footer-news-form" onsubmit="event.preventDefault(); var out=this.nextElementSibling; var inp=this.querySelector('input'); if(inp.value.includes('@')){out.textContent='Đã đăng ký: '+inp.value+' — Tặng mã SKY10!'; inp.value='';}else{out.textContent='Vui lòng nhập email hợp lệ.';}">
              <input type="email" placeholder="Email của bạn..." required aria-label="Email nhận bản tin" />
              <button type="submit">Đăng ký</button>
            </form>
            <div style="font-size:0.74rem;color:#7dd3fc;margin-top:8px;min-height:1.1em;"></div>
          </div>
        </div>

        <div class="s25-footer-bottom">
          <span>&copy; 2026 SKYCRUMB Studio • Bảo hành điện tử chính hãng 36 tháng</span>
          <span>Credits: Tư liệu &amp; hình ảnh sản phẩm tham khảo từ TTGShop, Lắc Đầu</span>
        </div>
      </div>
    `;
  }

  window.S25 = {
    KEYS,
    ICONS,
    PROMOS,
    esc,
    vnd,
    productUrl,
    getCart,
    saveCart,
    getCartMeta,
    setCartMeta,
    calcProtectionFee,
    computeSummary,
    resolveThumb,
    renderCartDrawerBody,
    getWishlist,
    hasWish,
    toggleWish,
    openWishDrawer,
    closeWishDrawer,
    removeWish,
    moveWishToCart,
    getUser,
    getToken,
    isStaff,
    canAccessAdmin,
    hasPermission,
    setSession,
    loginUser,
    registerUser,
    logoutUser,
    toggleAccountDropdown,
    closeAccountDropdown,
    getOrders,
    createOrder,
    findOrder,
    syncHeaderAuthAndWish,
    mountPromoBar,
    renderUspStrip,
    renderFooter,
    emitSync
  };

  window.addEventListener('storage', (e) => {
    if (Object.values(KEYS).includes(e.key)) {
      syncHeaderAuthAndWish();
    }
  });
  window.addEventListener('DOMContentLoaded', syncHeaderAuthAndWish);
})();
