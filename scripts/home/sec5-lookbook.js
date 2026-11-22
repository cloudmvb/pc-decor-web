/* ============================================================================
   S25 // SKYCRUMB — SECTION 5 (DESK ART LOOKBOOK - SHOP THE SETUP)
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import {
  SITE_SVGS,
  SHARED_IMG_HARDWARE,
  escHtml
} from './config.js';
import {
  CATALOG_BY_ID,
  getProductImgs,
  ensureFullCatalogLoaded
} from './catalog-store.js';

// =========================================================================
// 11D. SECTION 5 — DESK ART LOOKBOOK (SHOP THE SETUP) ENGINE
// =========================================================================
export const sec5LookbookEl = document.getElementById('sec5Lookbook');
const sec5TabsEl = document.getElementById('sec5Tabs');
const sec5StageEl = document.getElementById('sec5Stage');
const sec5PanelEl = document.getElementById('sec5Panel');

const SEC5_CONCEPTS = [
  {
    key: 'snow-white',
    tag: 'LOOKBOOK 01 // TONE TRẮNG SNOW',
    label: 'Snow White Gear 5',
    budgetHint: '~42,5TR',
    svgKey: 'decorLamp',
    glow: 'rgba(125, 211, 252, 0.28)',
    swatches: ['#ffffff', '#bae6fd', '#0284c7'],
    paletteName: 'Glacier White • Ice Blue',
    title: 'Snow White Gear 5 Studio',
    desc: 'Bộ góc máy tông trắng sạch tối giản: PC RTX 5060 Ti White đi cùng màn 2K 200Hz, đèn bàn HyperWork Luna Trắng và chibi Gear 5.',
    shopUrl: './shop.html?cat=decor&tone=white',
    slots: [
      { role: 'Case & PC Trắng', id: '1072100912' },
      { role: 'Màn Hình 2K 200Hz', id: '1072100271' },
      { role: 'Phụ Kiện Decor', id: 'ld-hpw0080' },
      { role: 'Mô Hình Decor', id: 'ld-mh0472' },
      { role: 'Gaming Gear Trắng', id: '1072100994' }
    ]
  },
  {
    key: 'cyberpunk-oled',
    tag: 'LOOKBOOK 02 // OLED 4K FLAGSHIP',
    label: 'Cyberpunk IPSTube OLED',
    budgetHint: '~99,0TR',
    svgKey: 'orbit',
    glow: 'rgba(56, 189, 248, 0.26)',
    swatches: ['#0f172a', '#0284c7', '#ef4444'],
    paletteName: 'Obsidian • Neon Blue • Red',
    title: 'Cyberpunk IPSTube OLED',
    desc: 'Cấu hình đầu bảng Ryzen 7 9800X3D + RTX 5070 Ti ghép màn OLED 4K 240Hz, đồng hồ ống chân không IPSTube và tượng Hulk Buster 32cm.',
    shopUrl: './shop.html?cat=decor&sub=' + encodeURIComponent('Phụ Kiện Trang Trí'),
    slots: [
      { role: 'Case & PC Flagship', id: '1063688299' },
      { role: 'Màn Hình OLED 4K', id: '1072100986' },
      { role: 'Phụ Kiện Decor', id: 'ld-dh0024' },
      { role: 'Mô Hình Decor', id: 'ld-mh0444' },
      { role: 'Gaming Gear Pro', id: '1072100503' }
    ]
  },
  {
    key: 'shinobi-rgb',
    tag: 'LOOKBOOK 03 // ESPORT 300HZ',
    label: 'Shinobi 300Hz RGB',
    budgetHint: '~61,2TR',
    svgKey: 'decorBox',
    glow: 'rgba(14, 165, 233, 0.25)',
    swatches: ['#071a33', '#38bdf8', '#dc2626'],
    paletteName: 'Night Carbon • Crimson',
    title: 'Shinobi & Esports 300Hz Corner',
    desc: 'Combo chiến FPS tốc độ cao với màn 2K 300Hz, chuột Viper V3 Pro, thanh LED nháy theo nhạc D1 và figure Uchiha Itachi 28cm.',
    shopUrl: './shop.html?cat=decor&sub=' + encodeURIComponent('Mô Hình'),
    slots: [
      { role: 'PC Gaming RTX 5070', id: '1072100629' },
      { role: 'Màn Hình QHD 300Hz', id: '1072101045' },
      { role: 'Phụ Kiện Decor', id: 'ld-led0014' },
      { role: 'Mô Hình Decor', id: 'ld-mh0473' },
      { role: 'Gaming Gear Esport', id: '1072100497' }
    ]
  },
  {
    key: 'creator-studio',
    tag: 'LOOKBOOK 04 // WORKSTATION & AI',
    label: 'Creator Studio Ultrawide',
    budgetHint: '~100,0TR',
    svgKey: 'chamber',
    glow: 'rgba(148, 163, 184, 0.24)',
    swatches: ['#f8fafc', '#475569', '#0284c7'],
    paletteName: 'Studio Slate • Sky',
    title: 'Minimalist AI Creator Desk',
    desc: 'Trạm dựng 4K & chạy AI 16GB VRAM cùng màn cong OLED 34 inch, đèn treo màn hình chống chói TB301SGS6 và bảng điều khiển Stream Deck+.',
    shopUrl: './shop.html?cat=pc',
    slots: [
      { role: 'PC AI Local Pro 16', id: '1072101106' },
      { role: 'Màn Cong OLED 34"', id: '1072100987' },
      { role: 'Phụ Kiện Decor', id: 'ld-pk0175' },
      { role: 'Mô Hình Decor', id: 'ld-mh0450' },
      { role: 'Gaming Gear Studio', id: '1072100655' }
    ]
  }
];

let activeSec5Key = SEC5_CONCEPTS[0].key;
let activeSec5HotIdx = 0;
const sec5ExcludedByConcept = {};

function getSec5ActiveConcept() {
  return SEC5_CONCEPTS.find((c) => c.key === activeSec5Key) || SEC5_CONCEPTS[0];
}

function getSec5ExcludedSet(conceptKey) {
  if (!sec5ExcludedByConcept[conceptKey]) sec5ExcludedByConcept[conceptKey] = new Set();
  return sec5ExcludedByConcept[conceptKey];
}

function resolveSec5Items(concept) {
  return concept.slots.map((slot, idx) => {
    const item = CATALOG_BY_ID[slot.id] || null;
    return { idx, role: slot.role, id: slot.id, item };
  });
}

function updateSec5FocusDom() {
  if (!sec5StageEl || !sec5PanelEl) return;
  sec5StageEl.querySelectorAll('.sec5-zone').forEach((zoneEl) => {
    zoneEl.classList.toggle('is-hot', Number(zoneEl.getAttribute('data-sec5-idx')) === activeSec5HotIdx);
  });
  sec5PanelEl.querySelectorAll('.sec5-row').forEach((rowEl) => {
    rowEl.classList.toggle('is-hot', Number(rowEl.getAttribute('data-sec5-idx')) === activeSec5HotIdx);
  });
  const concept = getSec5ActiveConcept();
  const resolved = resolveSec5Items(concept);
  const cur = resolved[activeSec5HotIdx] || resolved[0];
  const spotRoleEl = document.getElementById('sec5SpotRole');
  const spotNameEl = document.getElementById('sec5SpotName');
  const spotLinkEl = document.getElementById('sec5SpotLink');
  if (spotRoleEl && cur) {
    spotRoleEl.textContent = `HOTSPOT 0${activeSec5HotIdx + 1} // ${cur.role}${cur.item ? ' • ' + cur.item.ps : ''}`;
  }
  if (spotNameEl && cur) {
    spotNameEl.textContent = cur.item ? cur.item.n : 'Đang đồng bộ từ kho dữ liệu...';
  }
  if (spotLinkEl && cur) {
    spotLinkEl.setAttribute('href', cur.item ? `./product.html?id=${encodeURIComponent(cur.item.id)}&cat=${encodeURIComponent(cur.item.c)}` : concept.shopUrl);
  }
}

export function renderSec5Lookbook() {
  if (!sec5TabsEl || !sec5StageEl || !sec5PanelEl) return;
  const concept = getSec5ActiveConcept();
  const excluded = getSec5ExcludedSet(concept.key);
  const resolved = resolveSec5Items(concept);
  const missingCatalog = resolved.some((r) => !r.item);
  if (missingCatalog && !homeState.isFullCatalogLoaded) ensureFullCatalogLoaded();

  sec5TabsEl.innerHTML = SEC5_CONCEPTS.map((c) => `
    <button type="button" role="tab" aria-selected="${c.key === concept.key ? 'true' : 'false'}" class="sec5-tab ${c.key === concept.key ? 'active' : ''}" data-sec5-concept="${c.key}" onclick="setSec5Concept('${c.key}')">
      ${SITE_SVGS[c.svgKey] || SITE_SVGS.decorBox}
      <span>${escHtml(c.label)}</span>
      <small>${escHtml(c.budgetHint)}</small>
    </button>`).join('');

  sec5StageEl.style.setProperty('--s5-glow', concept.glow);
  const sparkleSvg = (window.S25 && window.S25.ICONS && window.S25.ICONS.sparkles) || SITE_SVGS.orbit;
  const swatchDotsHtml = concept.swatches.map((hex) => `<span class="sec5-swatch-dot" style="background:${hex}"></span>`).join('');

  const zonesHtml = resolved.map(({ idx, role, item }) => {
    const isHero = idx < 2;
    const isSkipped = excluded.has(idx);
    const isHot = idx === activeSec5HotIdx;
    const imgUrl = item ? getProductImgs(item)[0] : SHARED_IMG_HARDWARE;
    const nameText = item ? item.n : 'Đang nạp dữ liệu sản phẩm...';
    const priceText = item ? item.ps : '—';
    return `
      <button type="button" class="sec5-zone ${isHero ? 'is-hero-zone' : ''} ${isHot ? 'is-hot' : ''} ${isSkipped ? 'is-skipped' : ''}" data-sec5-idx="${idx}" onclick="setSec5Hotspot(${idx})" onmouseenter="setSec5Hotspot(${idx})">
        <div class="sec5-zone-media">
          <span class="sec5-hotspot-pin"><span class="sec5-hotspot-dot"></span><span>0${idx + 1}</span></span>
          <img src="${escHtml(imgUrl)}" alt="${escHtml(nameText)}" decoding="sync" />
        </div>
        <div class="sec5-zone-meta">
          <span class="sec5-zone-role">${escHtml(role)}</span>
          <span class="sec5-zone-name">${escHtml(nameText)}</span>
          <span class="sec5-zone-price">${escHtml(priceText)}</span>
        </div>
      </button>`;
  }).join('');

  const focusEntry = resolved[activeSec5HotIdx] || resolved[0];
  const focusHref = focusEntry && focusEntry.item
    ? `./product.html?id=${encodeURIComponent(focusEntry.item.id)}&cat=${encodeURIComponent(focusEntry.item.c)}`
    : concept.shopUrl;

  sec5StageEl.innerHTML = `
    <div class="sec5-stage-head">
      <span class="sec5-stage-kicker">${sparkleSvg}<span>${escHtml(concept.tag)}</span></span>
      <span class="sec5-swatches">${swatchDotsHtml}<span>${escHtml(concept.paletteName)}</span></span>
    </div>
    <div class="sec5-diorama">${zonesHtml}</div>
    <div class="sec5-spotlight">
      <div class="sec5-spot-info">
        <span class="sec5-spot-role" id="sec5SpotRole">HOTSPOT 0${activeSec5HotIdx + 1} // ${escHtml(focusEntry.role)}${focusEntry.item ? ' • ' + escHtml(focusEntry.item.ps) : ''}</span>
        <span class="sec5-spot-name" id="sec5SpotName">${escHtml(focusEntry.item ? focusEntry.item.n : 'Đang đồng bộ từ kho dữ liệu...')}</span>
      </div>
      <a class="sec5-spot-link" id="sec5SpotLink" href="${focusHref}"><span>Chi tiết món này</span>${SITE_SVGS.arrowRight}</a>
    </div>`;

  const checkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>`;
  const heartSvg = window.S25 ? window.S25.ICONS.heart : '';
  let selectedCount = 0;
  let totalSelected = 0;
  let totalMarket = 0;

  const rowsHtml = resolved.map(({ idx, role, item }) => {
    const checked = !excluded.has(idx);
    const isHot = idx === activeSec5HotIdx;
    if (checked && item) {
      selectedCount++;
      totalSelected += Number(item.p || 0);
      totalMarket += Number(item.pm && item.pm > item.p ? item.pm : item.p || 0);
    }
    const imgUrl = item ? getProductImgs(item)[0] : SHARED_IMG_HARDWARE;
    const href = item ? `./product.html?id=${encodeURIComponent(item.id)}&cat=${encodeURIComponent(item.c)}` : concept.shopUrl;
    const wished = item && window.S25 ? window.S25.hasWish(item.id) : false;
    const oldHtml = item && item.pm > item.p ? `<span class="sec5-row-old">${Number(item.pm).toLocaleString('vi-VN')}đ</span>` : '';
    return `
      <div class="sec5-row ${checked ? '' : 'is-unchecked'} ${isHot ? 'is-hot' : ''}" data-sec5-idx="${idx}" onmouseenter="setSec5Hotspot(${idx})">
        <label class="sec5-check-label" aria-label="Chọn ${escHtml(item ? item.n : role)}">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="toggleSec5Item(${idx})" />
          <span class="sec5-check-box">${checkSvg}</span>
        </label>
        <img class="sec5-row-thumb" src="${escHtml(imgUrl)}" alt="${escHtml(item ? item.n : role)}" decoding="sync" />
        <div class="sec5-row-body">
          <div class="sec5-row-top">
            <span class="sec5-row-idx">0${idx + 1}</span>
            <span class="sec5-row-role">${escHtml(role)}</span>
          </div>
          <a class="sec5-row-name" href="${href}" title="${escHtml(item ? item.n : role)}">${escHtml(item ? item.n : 'Đang đồng bộ từ kho...')}</a>
          <div class="sec5-row-prices">
            <span class="sec5-row-price">${escHtml(item ? item.ps : '—')}</span>
            ${oldHtml}
          </div>
        </div>
        <div class="sec5-row-actions">
          <a class="detail-mini-btn" href="${href}">Chi tiết</a>
          ${item ? `<button type="button" class="card-wish-btn ${wished ? 'wished' : ''}" data-wish-id="${escHtml(item.id)}" aria-label="Lưu yêu thích" aria-pressed="${wished ? 'true' : 'false'}" onclick="event.preventDefault(); event.stopPropagation(); window.toggleItemWishlist('${escHtml(item.id)}')">${heartSvg}</button>` : ''}
        </div>
      </div>`;
  }).join('');

  const savedTotal = Math.max(0, totalMarket - totalSelected);
  const resetHtml = excluded.size > 0
    ? `<button type="button" class="sec5-reset-btn" onclick="resetSec5Checks()">Chọn lại cả 5 món</button>`
    : `<span class="sec5-count-pill">Đã chọn ${selectedCount}/5 món</span>`;

  sec5PanelEl.innerHTML = `
    <div class="sec5-panel-head">
      <div>
        <div class="sec5-panel-title">${escHtml(concept.title)}</div>
        <p class="sec5-panel-desc">${escHtml(concept.desc)}</p>
      </div>
      ${resetHtml}
    </div>
    <div class="sec5-list" id="sec5List">${rowsHtml}</div>
    <div class="sec5-foot">
      <div class="sec5-totals">
        <div>
          <span class="sec5-total-label">Tạm tính ${selectedCount}/5 món đã chọn</span>
          <span class="sec5-total-val" id="sec5TotalVal">${totalSelected.toLocaleString('vi-VN')}đ</span>
        </div>
        ${savedTotal > 0 ? `<span class="sec5-save-pill">Tiết kiệm ${savedTotal.toLocaleString('vi-VN')}đ</span>` : ''}
      </div>
      <div class="sec5-cta-row">
        <button type="button" class="sec5-add-all" id="sec5AddAllBtn" ${selectedCount === 0 || missingCatalog ? 'disabled' : ''} onclick="sec5AddSelectedToCart()">
          ${SITE_SVGS.plus}
          <span>Thêm ${selectedCount} món vào Giỏ hàng</span>
        </button>
        <a class="sec5-shop-btn" href="${concept.shopUrl}"><span>Mở kho Cửa hàng</span>${SITE_SVGS.arrowRight}</a>
      </div>
      <div class="sec5-cart-note" id="sec5CartNote"></div>
    </div>`;

  if (window.S25) window.S25.syncHeaderAuthAndWish();
}

window.setSec5Concept = (key) => {
  activeSec5Key = key;
  activeSec5HotIdx = 0;
  if (!homeState.isFullCatalogLoaded) ensureFullCatalogLoaded();
  renderSec5Lookbook();
};

window.setSec5Hotspot = (idx) => {
  const next = Math.max(0, Math.min(4, Number(idx) || 0));
  if (activeSec5HotIdx === next) return;
  activeSec5HotIdx = next;
  updateSec5FocusDom();
};

window.toggleSec5Item = (idx) => {
  const excluded = getSec5ExcludedSet(activeSec5Key);
  if (excluded.has(idx)) excluded.delete(idx);
  else excluded.add(idx);
  renderSec5Lookbook();
};

window.resetSec5Checks = () => {
  sec5ExcludedByConcept[activeSec5Key] = new Set();
  renderSec5Lookbook();
};

window.sec5AddSelectedToCart = () => {
  const concept = getSec5ActiveConcept();
  const excluded = getSec5ExcludedSet(concept.key);
  const resolved = resolveSec5Items(concept);
  let count = 0;
  resolved.forEach(({ idx, item }) => {
    if (!excluded.has(idx) && item && item.id) {
      window.addCatalogProductToCart(item.id);
      count++;
    }
  });
  const noteEl = document.getElementById('sec5CartNote');
  if (noteEl) {
    noteEl.textContent = count > 0
      ? `Đã thêm ${count} món của concept "${concept.label}" vào Giỏ hàng.`
      : 'Vui lòng chọn ít nhất 1 món để thêm vào Giỏ hàng.';
  }
};

renderSec5Lookbook();

