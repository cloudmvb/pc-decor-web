/* ============================================================================
   S25 // SKYCRUMB — SECTION 4 (SETUP ECOSYSTEM & 1:1 LAB BOOKING)
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import {
  SITE_SVGS,
  TTG_SVGS,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSubcatLabel,
  formatSpecText
} from './config.js';
import {
  CATALOG_ITEMS,
  CATALOG_BY_ID,
  CAT_COUNTS,
  SUBCAT_COUNTS,
  getProductImgs,
  ensureFullCatalogLoaded
} from './catalog-store.js';
import { parseVndPrice } from './drawer-cart.js';
import {
  BUILD_CAT_ORDER,
  builderSelectedItem,
  ensureBuilderSelectionSeeded
} from './sec3-builder.js';

export const sec4SetupEl = document.getElementById('sec4Setup');
const sec4TabsEl = document.getElementById('sec4Tabs');
const sec4GridEl = document.getElementById('sec4Grid');
const sec4SyncBtnEl = document.getElementById('sec4SyncBtn');
const sec4SyncBannerEl = document.getElementById('sec4SyncBanner');
const sec4ViewAllLinkEl = document.getElementById('sec4ViewAllLink');
const SEC4_BOOKING_STORAGE_KEY = 's25_bookings_v1';
const DECOR_PK_SUBCATS = new Set([
  'Đèn Bàn & Đèn Màn Hình',
  'Đồng Hồ & Setup Tech',
  'Cốc Giữ Nhiệt Decor',
  'Dây LED & Thanh LED RGB'
]);
const SEC4_TABS = [
  { key: 'decor-pk', label: 'Phụ Kiện Trang Trí', svgKey: 'decorLamp', defaultCount: 99, shopUrl: `./shop.html?cat=decor&sub=${encodeURIComponent('Phụ Kiện Trang Trí')}` },
  { key: 'decor-mh', label: 'Mô Hình', svgKey: 'decorBox', defaultCount: 243, shopUrl: `./shop.html?cat=decor&sub=${encodeURIComponent('Mô Hình')}` },
  { key: 'man-hinh-may-tinh', label: 'Màn Hình Gaming', svgKey: 'gpu', defaultCount: 126, shopUrl: './shop.html?cat=man-hinh-may-tinh' },
  { key: 'gaming-gear', label: 'Gaming Gear', svgKey: 'cables', defaultCount: 164, shopUrl: './shop.html?cat=gaming-gear' }
];
let activeSec4Cat = 'decor-pk';
let sec4SyncOpen = false;
let sec4BookMode = 'lab';
let sec4BookSlot = '09:00 - 11:30';

// =========================================================================
// 11C. SECTION 4 — SETUP ECOSYSTEM & LAB STUDIO BOOKING ENGINE
// =========================================================================

function sortByPreferredOrder(pool, preferredOrder) {
  return [...pool]
    .sort((a, b) => {
      const ia = preferredOrder.indexOf(a.id);
      const ib = preferredOrder.indexOf(b.id);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      if (b.st !== a.st) return b.st - a.st;
      return ((b._imgs && b._imgs.length) || 0) - ((a._imgs && a._imgs.length) || 0);
    });
}

function getSec4FeaturedItems(catKey) {
  if (catKey === 'decor-pk' || catKey === 'decor') {
    const pool = CATALOG_ITEMS.filter((item) => item.c === 'decor' && DECOR_PK_SUBCATS.has(item.sc));
    return sortByPreferredOrder(pool, ['ld-dh0024', 'ld-hpw0080', 'ld-pk0175', 'ld-led0015', 'ld-pk0239', 'ld-coc019']).slice(0, 4);
  }
  if (catKey === 'decor-mh') {
    const pool = CATALOG_ITEMS.filter((item) => item.c === 'decor' && !DECOR_PK_SUBCATS.has(item.sc));
    return sortByPreferredOrder(pool, ['ld-mh0564', 'ld-mh0444', 'ld-mh0473', 'ld-mh0450', 'ld-mh0429', 'ld-mh0110']).slice(0, 4);
  }
  const pool = CATALOG_ITEMS.filter((item) => item.c === catKey);
  return [...pool]
    .sort((a, b) => {
      if (b.st !== a.st) return b.st - a.st;
      const aHasPrice = a.p > 0 ? 1 : 0;
      const bHasPrice = b.p > 0 ? 1 : 0;
      if (bHasPrice !== aHasPrice) return bHasPrice - aHasPrice;
      const aImgs = (a._imgs && a._imgs.length > 1) ? 1 : 0;
      const bImgs = (b._imgs && b._imgs.length > 1) ? 1 : 0;
      if (bImgs !== aImgs) return bImgs - aImgs;
      if (catKey === 'man-hinh-may-tinh') {
        const aPro = /oled|240hz|300hz|360hz|qhd|2k|4k/i.test(a.n) ? 1 : 0;
        const bPro = /oled|240hz|300hz|360hz|qhd|2k|4k/i.test(b.n) ? 1 : 0;
        if (bPro !== aPro) return bPro - aPro;
      }
      return (b._discNum || 0) - (a._discNum || 0);
    })
    .slice(0, 4);
}

function renderSec4CardHtml(item) {
  const imgs = getProductImgs(item);
  const img0 = imgs[0];
  const img1 = imgs[1] && imgs[1] !== img0 ? imgs[1] : '';
  const hasAlt = Boolean(img1);
  const specText = (item.sp && item.sp.length)
    ? formatSpecText(item.sp[0])
    : `${item._catLabel} • Bảo hành ${item.w || '12 Tháng'}`;
  const priceText = item.p > 0 ? item.ps : 'Liên hệ';
  const oldPriceHtml = (item.pm > item.p && item.p > 0)
    ? `<span class="sec4-card-old">${item.pm.toLocaleString('vi-VN')}đ</span>`
    : '';
  const subLabel = formatSubcatLabel(item.sc);
  const badgeLabel = item.d || subLabel;
  const detailHref = `./product.html?id=${encodeURIComponent(item.id)}&cat=${encodeURIComponent(item.c)}`;
  const wished = window.S25 ? window.S25.hasWish(item.id) : false;
  const heartSvg = window.S25 ? (wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart) : '';

  const coverCls = '';
  return `
    <article class="sec4-card" data-sec4-id="${escHtml(item.id)}">
      <a class="sec4-card-media ${coverCls}" href="${detailHref}" aria-label="Xem chi tiết ${escHtml(item.n)}">
        <img class="primary-img ${hasAlt ? 'has-alt' : ''}" src="${escHtml(img0)}" alt="${escHtml(item.n)}" decoding="async" />
        ${hasAlt ? `<img class="alt-img" src="${escHtml(img1)}" alt="${escHtml(item.n)} góc khác" loading="lazy" decoding="async" />` : ''}
        <span class="sec4-card-badge">${escHtml(badgeLabel)}</span>
        <button type="button" class="card-wish-btn ${wished ? 'wished' : ''}" data-wish-id="${escHtml(item.id)}" aria-label="Lưu yêu thích" aria-pressed="${wished ? 'true' : 'false'}" onclick="event.preventDefault(); event.stopPropagation(); window.toggleItemWishlist('${escHtml(item.id)}')">${heartSvg}</button>
      </a>
      <div class="sec4-card-body">
        <div class="sec4-card-subcat">${escHtml(subLabel)}</div>
        <a class="sec4-card-title" href="${detailHref}" title="${escHtml(item.n)}">${escHtml(item.n)}</a>
        <div class="sec4-card-specs">${escHtml(specText)}</div>
        <div class="sec4-card-foot">
          <div class="sec4-card-price-col">
            ${oldPriceHtml}
            <span class="sec4-card-price">${escHtml(priceText)}</span>
          </div>
          <div class="sec4-card-actions">
            <a class="detail-mini-btn" href="${detailHref}">Chi tiết</a>
            <button type="button" class="sec4-add-btn" onclick="addCatalogProductToCart('${escHtml(item.id)}')">
              ${SITE_SVGS.plus}
              <span>Thêm vào Setup</span>
            </button>
          </div>
        </div>
      </div>
    </article>`;
}

function getSec4SyncRecommendation() {
  ensureBuilderSelectionSeeded();
  const gpuName = builderSelectedItem.Group_GPU?.name || 'Card VGA Hiệu Năng Cao';
  const caseName = builderSelectedItem.Group_Case?.name || 'Case Kính Panoramic';
  const upperGpu = gpuName.toUpperCase();
  const isWhiteTone = /white|trắng|snow|ice|pure/i.test(`${caseName} ${gpuName}`);

  let targetPattern = /200hz|180hz|165hz|ips/i;
  let tierTitle = 'Combo Full HD / 2K High-Refresh';
  let reason = `Phù hợp ${gpuName} & ${caseName}: tối ưu phản hồi nhanh, màu sắc chuẩn cân góc setup.`;

  if (/5090|4090|5080|4080|7900\s*XTX/.test(upperGpu)) {
    targetPattern = /oled|4k|300hz|360hz|240hz/i;
    tierTitle = 'Combo Flagship 4K / OLED 240Hz+';
    reason = `Khai thác tối đa sức mạnh ${gpuName} ở độ phân giải QHD/4K & giữ tông ${isWhiteTone ? 'Trắng Snow' : 'Studio'} cùng ${caseName}.`;
  } else if (/5070|4070|9070|7900\s*XT|7800/.test(upperGpu)) {
    targetPattern = /qhd|2k|240hz|300hz|180hz/i;
    tierTitle = 'Combo 2K QHD 180Hz-300Hz';
    reason = `Tối ưu dải FPS 2K Ultra cho ${gpuName}, đồng bộ ánh sáng với ${caseName}.`;
  }

  const monitors = CATALOG_ITEMS.filter((x) => x.c === 'man-hinh-may-tinh' && x.st === 1 && x.p > 0);
  const monMatch = monitors.find((m) => targetPattern.test(`${m.n} ${m.sc}`)) || monitors[0] || null;
  const pkPref = isWhiteTone ? ['ld-hpw0080', 'ld-led0015', 'ld-pk0239'] : ['ld-dh0024', 'ld-hpw0079', 'ld-led0014'];
  const mhPref = isWhiteTone ? ['ld-mh0472', 'ld-mh0450', 'ld-mh0564'] : ['ld-mh0564', 'ld-mh0444', 'ld-mh0473'];
  const pkMatch = pkPref.map((id) => CATALOG_BY_ID[id]).find(Boolean)
    || CATALOG_ITEMS.find((x) => x.c === 'decor' && DECOR_PK_SUBCATS.has(x.sc))
    || null;
  const mhMatch = mhPref.map((id) => CATALOG_BY_ID[id]).find(Boolean)
    || CATALOG_ITEMS.find((x) => x.c === 'decor' && !DECOR_PK_SUBCATS.has(x.sc))
    || null;
  const picks = [monMatch, pkMatch, mhMatch].filter(Boolean);

  return { tierTitle, reason, gpuName, caseName, picks };
}

function renderSec4SyncBanner() {
  if (!sec4SyncBannerEl || !sec4SyncBtnEl) return;
  sec4SyncBtnEl.classList.toggle('active', sec4SyncOpen);
  sec4SyncBtnEl.setAttribute('aria-expanded', sec4SyncOpen ? 'true' : 'false');
  sec4SyncBannerEl.classList.toggle('open', sec4SyncOpen);
  if (!sec4SyncOpen) return;

  if (!homeState.isFullCatalogLoaded) {
    ensureFullCatalogLoaded();
    sec4SyncBannerEl.innerHTML = `
      <div class="sec4-sync-summary">
        <span class="sec4-sync-eyebrow">ĐỒNG BỘ THEO SECTION 3</span>
        <div class="sec4-sync-title">Đang đồng bộ màn hình, phụ kiện &amp; mô hình...</div>
        <div class="sec4-sync-reason">Đang tải dữ liệu màn hình, phụ kiện trang trí &amp; mô hình chuẩn theo GPU Section 3.</div>
      </div>`;
    return;
  }

  const rec = getSec4SyncRecommendation();
  const picksHtml = rec.picks.map((item) => {
    const imgs = getProductImgs(item);
    const roleLabel = item.c === 'man-hinh-may-tinh'
      ? 'Màn hình khuyên dùng'
      : (DECOR_PK_SUBCATS.has(item.sc) ? 'Phụ kiện hợp tông' : 'Mô hình hợp tông');
    const href = `./product.html?id=${encodeURIComponent(item.id)}&cat=${encodeURIComponent(item.c)}`;
    return `
      <a class="sec4-sync-pick" href="${href}">
        <img src="${escHtml(imgs[0])}" alt="${escHtml(item.n)}" decoding="async" />
        <div class="sec4-sync-pick-meta">
          <div class="sec4-sync-pick-role">${roleLabel}</div>
          <div class="sec4-sync-pick-name">${escHtml(item.n)}</div>
          <div class="sec4-sync-pick-price">${escHtml(item.ps)}</div>
        </div>
      </a>`;
  }).join('');

  sec4SyncBannerEl.innerHTML = `
    <div class="sec4-sync-summary">
      <span class="sec4-sync-eyebrow">GỢI Ý THEO CASE &amp; GPU SECTION 3</span>
      <div class="sec4-sync-title">${escHtml(rec.tierTitle)}</div>
      <div class="sec4-sync-reason">${escHtml(rec.reason)}</div>
    </div>
    <div class="sec4-sync-picks">${picksHtml}</div>
    <div class="sec4-sync-cta">
      <button type="button" class="sec4-sync-add" onclick="addSec4RecPackToCart()">
        ${SITE_SVGS.plus}
        <span>Thêm bộ Setup đề xuất</span>
      </button>
      <div class="sec4-sync-note" id="sec4SyncNote"></div>
    </div>`;
}

export function updateSec4BuildLinkage() {
  const attachEl = document.getElementById('sec4BuildAttachSummary');
  if (attachEl) {
    ensureBuilderSelectionSeeded();
    let total = 0;
    BUILD_CAT_ORDER.forEach((cid) => {
      const it = builderSelectedItem[cid];
      if (it) total += it.priceNum || parseVndPrice(it.price);
    });
    const clipWords = (str, maxLen) => {
      const s = String(str || '').trim();
      if (s.length <= maxLen) return s;
      const cut = s.slice(0, maxLen).replace(/\s+\S*$/, '').trim();
      return (cut || s.slice(0, maxLen)) + '...';
    };
    const cpuShort = clipWords(builderSelectedItem.Group_CPU?.name || 'CPU Tùy Chọn', 30);
    const gpuShort = clipWords(builderSelectedItem.Group_GPU?.name || 'GPU Tùy Chọn', 34);
    attachEl.textContent = `${cpuShort} + ${gpuShort} (${total.toLocaleString('vi-VN')}đ)`;
  }
  if (sec4SyncOpen) renderSec4SyncBanner();
}

function getSec4TabCount(tab) {
  if (tab.key === 'decor-pk' || tab.key === 'decor-mh') {
    const subMap = SUBCAT_COUNTS.decor || {};
    const entries = Object.entries(subMap);
    if (entries.length) {
      const sum = entries.reduce((acc, [sc, cnt]) => {
        const isPk = DECOR_PK_SUBCATS.has(sc);
        return acc + ((tab.key === 'decor-pk' ? isPk : !isPk) ? Number(cnt || 0) : 0);
      }, 0);
      if (sum > 0) return sum;
    }
    return tab.defaultCount;
  }
  return Number(CAT_COUNTS[tab.key] || tab.defaultCount || 0);
}

export function renderSec4Setup() {
  if (!sec4TabsEl || !sec4GridEl) return;
  sec4TabsEl.innerHTML = SEC4_TABS.map((t) => {
    const count = getSec4TabCount(t);
    return `
      <button type="button" role="tab" aria-selected="${activeSec4Cat === t.key ? 'true' : 'false'}" class="sec4-tab ${activeSec4Cat === t.key ? 'active' : ''}" data-sec4-cat="${t.key}" onclick="setSec4Tab('${t.key}')">
        ${SITE_SVGS[t.svgKey] || SITE_SVGS.expand}
        <span>${escHtml(t.label)}</span>
        <small>${count.toLocaleString('vi-VN')}</small>
      </button>`;
  }).join('');

  const activeMeta = SEC4_TABS.find((t) => t.key === activeSec4Cat);
  if (sec4ViewAllLinkEl) {
    sec4ViewAllLinkEl.setAttribute('href', (activeMeta && activeMeta.shopUrl) || `./shop.html?cat=${encodeURIComponent(activeSec4Cat)}`);
  }

  const items = getSec4FeaturedItems(activeSec4Cat);
  if (!items.length && !homeState.isFullCatalogLoaded) {
    ensureFullCatalogLoaded();
    const loadingLabel = (activeMeta && activeMeta.label) || CATEGORY_LABEL_MAP[activeSec4Cat] || activeSec4Cat;
    sec4GridEl.innerHTML = Array.from({ length: 4 }, () => `
      <div class="sec4-loading-card">Đang tải danh mục ${escHtml(loadingLabel)}...</div>
    `).join('');
  } else if (!items.length) {
    sec4GridEl.innerHTML = `<div class="sec4-loading-card" style="grid-column:1/-1;">Chưa có sản phẩm trong nhóm này.</div>`;
  } else {
    sec4GridEl.innerHTML = items.map(renderSec4CardHtml).join('');
  }

  updateSec4BuildLinkage();
}

window.setSec4Tab = (catKey) => {
  activeSec4Cat = catKey === 'decor' ? 'decor-pk' : catKey;
  if ((activeSec4Cat === 'man-hinh-may-tinh' || activeSec4Cat === 'gaming-gear') && !homeState.isFullCatalogLoaded) {
    ensureFullCatalogLoaded();
  }
  renderSec4Setup();
};

window.toggleSec4Sync = () => {
  sec4SyncOpen = !sec4SyncOpen;
  if (sec4SyncOpen && !homeState.isFullCatalogLoaded) ensureFullCatalogLoaded();
  renderSec4SyncBanner();
};

window.addSec4RecPackToCart = () => {
  const rec = getSec4SyncRecommendation();
  let count = 0;
  rec.picks.forEach((item) => {
    if (item && item.id) {
      window.addCatalogProductToCart(item.id);
      count++;
    }
  });
  const noteEl = document.getElementById('sec4SyncNote');
  if (noteEl) noteEl.textContent = count > 0 ? `Đã thêm ${count} sản phẩm đồng bộ vào Giỏ hàng.` : 'Chưa có sản phẩm để thêm.';
};

function readSec4Bookings() {
  try {
    const raw = localStorage.getItem(SEC4_BOOKING_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSec4Booking(rec) {
  const list = readSec4Bookings();
  list.unshift(rec);
  try { localStorage.setItem(SEC4_BOOKING_STORAGE_KEY, JSON.stringify(list.slice(0, 12))); } catch {}
}

function renderSec4BookingHistory() {
  const histEl = document.getElementById('sec4BookHistory');
  if (!histEl) return;
  const list = readSec4Bookings();
  if (!list.length) {
    histEl.innerHTML = '<span>Hỗ trợ Lab Hà Nội &amp; TP.HCM • Không cần đặt cọc</span>';
    return;
  }
  const latest = list[0];
  histEl.innerHTML = `
    <span>Lịch gần nhất: <b>${escHtml(latest.code)}</b> (${escHtml(latest.slot)})</span>
    <button type="button" onclick="viewLastSec4Booking()">Xem phiếu hẹn</button>`;
}

function showSec4BookingConfirmation(rec) {
  const formEl = document.getElementById('sec4BookingForm');
  const confirmEl = document.getElementById('sec4BookConfirm');
  if (!formEl || !confirmEl || !rec) return;
  const shieldIco = window.S25 ? window.S25.ICONS.shieldCheck : '';
  const buildRowHtml = rec.buildSummary
    ? `<div><span>Cấu hình đính kèm</span><b>${escHtml(rec.buildSummary)}</b></div>`
    : '';
  const noteRowHtml = rec.note
    ? `<div><span>Ghi chú góc setup</span><b>${escHtml(rec.note)}</b></div>`
    : '';

  confirmEl.innerHTML = `
    <div class="sec4-confirm-head">
      <span class="sec4-confirm-badge">${shieldIco}<span>Đặt lịch thành công</span></span>
      <span class="sec4-confirm-code" id="sec4BookingCode">${escHtml(rec.code)}</span>
    </div>
    <div class="sec4-confirm-rows">
      <div><span>Hình thức</span><b>${escHtml(rec.modeLabel)}</b></div>
      <div><span>Khách hàng</span><b>${escHtml(rec.customerName)} • ${escHtml(rec.phone)}</b></div>
      <div><span>Khung giờ ưu tiên</span><b>${escHtml(rec.slot)}</b></div>
      ${buildRowHtml}
      ${noteRowHtml}
      <div><span>Thời gian ghi nhận</span><b>${escHtml(rec.createdAt)}</b></div>
    </div>
    <button type="button" class="sec4-confirm-reset" onclick="resetSec4Booking()">Đặt thêm lịch khác</button>`;
  formEl.hidden = true;
  confirmEl.hidden = false;
}

window.setSec4BookingMode = (mode) => {
  sec4BookMode = mode === 'video' ? 'video' : 'lab';
  document.querySelectorAll('#sec4ModeGroup .sec4-mode-btn').forEach((btn) => {
    const on = btn.getAttribute('data-book-mode') === sec4BookMode;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
};

window.setSec4BookingSlot = (slot) => {
  sec4BookSlot = slot;
  document.querySelectorAll('#sec4SlotPills .sec4-slot-pill').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-slot') === slot);
  });
};

window.submitSec4Booking = (e) => {
  if (e) e.preventDefault();
  const nameEl = document.getElementById('sec4BookName');
  const phoneEl = document.getElementById('sec4BookPhone');
  const noteEl = document.getElementById('sec4BookNote');
  const attachCheckEl = document.getElementById('sec4BookAttachBuild');
  const attachSummaryEl = document.getElementById('sec4BuildAttachSummary');
  const errEl = document.getElementById('sec4BookError');

  const customerName = String(nameEl ? nameEl.value : '').trim();
  const phoneRaw = String(phoneEl ? phoneEl.value : '').trim();
  const digits = phoneRaw.replace(/[^\d]/g, '');
  const note = String(noteEl ? noteEl.value : '').trim();

  if (customerName.length < 2) {
    if (errEl) errEl.textContent = 'Vui lòng nhập họ tên tối thiểu 2 ký tự.';
    if (nameEl) nameEl.focus();
    return;
  }
  if (digits.length < 8 || digits.length > 15) {
    if (errEl) errEl.textContent = 'Vui lòng nhập số điện thoại / Zalo hợp lệ (8–15 chữ số).';
    if (phoneEl) phoneEl.focus();
    return;
  }
  if (errEl) errEl.textContent = '';

  const code = 'LAB-' + String(Math.floor(10000 + Math.random() * 89999));
  const modeLabel = sec4BookMode === 'video'
    ? 'Tư vấn Video Call dựng góc setup 1:1'
    : 'Ghé SKYCRUMB Lab Stress-Test & chọn Decor';
  const buildSummary = (attachCheckEl && attachCheckEl.checked && attachSummaryEl)
    ? attachSummaryEl.textContent.trim()
    : '';

  const rec = {
    code,
    mode: sec4BookMode,
    modeLabel,
    slot: sec4BookSlot,
    customerName,
    phone: phoneRaw,
    note,
    buildSummary,
    createdAt: new Date().toLocaleString('vi-VN')
  };
  saveSec4Booking(rec);
  renderSec4BookingHistory();
  showSec4BookingConfirmation(rec);
};

window.resetSec4Booking = () => {
  const formEl = document.getElementById('sec4BookingForm');
  const confirmEl = document.getElementById('sec4BookConfirm');
  const errEl = document.getElementById('sec4BookError');
  if (confirmEl) confirmEl.hidden = true;
  if (formEl) formEl.hidden = false;
  if (errEl) errEl.textContent = '';
};

window.viewLastSec4Booking = () => {
  const list = readSec4Bookings();
  if (list.length) showSec4BookingConfirmation(list[0]);
};

export function initSec4BookingChrome() {
  const eyebrowEl = document.getElementById('sec4BookEyebrow');
  const syncBtnEl = document.getElementById('sec4SyncBtn');
  const viewAllEl = document.getElementById('sec4ViewAllLink');
  const modeGroupEl = document.getElementById('sec4ModeGroup');
  const perksEl = document.getElementById('sec4BookPerks');
  const submitBtnEl = document.getElementById('sec4BookSubmitBtn');
  const ico = window.S25 ? window.S25.ICONS : {};

  if (eyebrowEl && ico.sparkles) {
    eyebrowEl.innerHTML = `${ico.sparkles}<span>TRẢI NGHIỆM &amp; TƯ VẤN STUDIO 1:1</span>`;
  }
  if (syncBtnEl) {
    syncBtnEl.innerHTML = `${SITE_SVGS.orbit}<span>Gợi ý đồng bộ theo Case Section 3</span>`;
  }
  if (viewAllEl) {
    viewAllEl.innerHTML = `<span>Xem tất cả</span>${SITE_SVGS.arrowRight}`;
  }
  if (modeGroupEl) {
    const labBtn = modeGroupEl.querySelector('[data-book-mode="lab"]');
    const vidBtn = modeGroupEl.querySelector('[data-book-mode="video"]');
    if (labBtn) labBtn.innerHTML = `${ico.shieldCheck || ''}<span>Ghé SKYCRUMB Lab Stress-Test &amp; chọn Decor</span>`;
    if (vidBtn) vidBtn.innerHTML = `${ico.headset || ''}<span>Tư vấn Video Call dựng góc setup 1:1</span>`;
  }
  if (perksEl) {
    perksEl.innerHTML = `
      <span class="sec4-book-perk">${TTG_SVGS.location}<span>Studio Lab Hà Nội &amp; TP.HCM</span></span>
      <span class="sec4-book-perk">${TTG_SVGS.history}<span>Kỹ thuật viên 1:1 trong 30 phút</span></span>
      <span class="sec4-book-perk">${ico.clipboard || ''}<span>Xuất file đo nhiệt Full-load</span></span>`;
  }
  if (submitBtnEl) {
    submitBtnEl.innerHTML = `${ico.clipboard || ''}<span>Xác nhận đặt lịch 1:1</span>`;
  }
  renderSec4BookingHistory();
}

initSec4BookingChrome();
renderSec4Setup();

