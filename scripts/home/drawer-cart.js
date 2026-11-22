/* ============================================================================
   S25 // SKYCRUMB — COMPACT 3D CATEGORY DRAWER & LOCALSTORAGE CART SYNC
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import {
  SITE_SVGS,
  TTG_SVGS,
  GROUPS_CONFIG,
  GROUP3D_TO_SUBCAT,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSubcatLabel,
  formatSpecText,
  normalizeVi
} from './config.js';
import {
  CATALOG_ITEMS,
  CATALOG_BY_ID,
  CAT_COUNTS,
  GROUP_COUNTS,
  getProductImgs,
  ensureFullCatalogLoaded
} from './catalog-store.js';
import { isGroupUnlocked, mark3DActive } from './studio-engine.js';

// =========================================================================
// 7. COMPACT 3D CATEGORY DRAWER, SHARED LOCALSTORAGE CART & SHOP.HTML ROUTER
// =========================================================================
const CART_STORAGE_KEY = 's25_cart_v1';
let cartItems = 0;

const shopState = {
  mode: 'group', // 'group' | 'cart'
  search: '',
  limit: 24,
  lastFiltered: []
};

function renderExpandBtnState() {
  const iconEl = document.getElementById('expandShopBtnIcon');
  const textEl = document.getElementById('expandShopBtnText');
  if (!iconEl || !textEl) return;
  iconEl.innerHTML = SITE_SVGS.expand;
  textEl.textContent = 'Kho đầy đủ';
}


window.openProductDetailPage = (itemId) => {
  const item = CATALOG_BY_ID[itemId];
  const qs = new URLSearchParams();
  if (itemId) qs.set('id', itemId);
  if (item && item.c) qs.set('cat', item.c);
  window.location.href = `./product.html?${qs.toString()}`;
};
window.openProductDetailModal = window.openProductDetailPage;

window.openFullShop = (initialFilter = 'ALL', opts = {}) => {
  const qs = new URLSearchParams();
  const filterId = initialFilter || 'ALL';
  if (GROUP3D_TO_SUBCAT[filterId]) {
    const mapped = GROUP3D_TO_SUBCAT[filterId];
    qs.set('cat', mapped.c);
    if (mapped.sc && mapped.sc !== 'ALL') qs.set('sub', mapped.sc);
    qs.set('group', filterId);
  } else if (CATEGORY_LABEL_MAP[filterId] || filterId === 'ALL') {
    qs.set('cat', filterId);
  } else {
    qs.set('cat', 'ALL');
  }
  if (opts && opts.search) qs.set('q', opts.search);
  if (opts && opts.focusSearch) qs.set('focus', 'search');
  window.location.href = `./shop.html?${qs.toString()}`;
};

window.filterFullShop = (filterId) => window.openFullShop(filterId || 'ALL');
window.toggleExpandFullShop = () => window.openFullShop(homeState.focusedGroupId || 'ALL');

function getFilteredCatalogItems() {
  const cfg = (homeState.focusedGroupId && GROUPS_CONFIG[homeState.focusedGroupId]) ? GROUPS_CONFIG[homeState.focusedGroupId] : null;
  const base = cfg
    ? ((cfg.catalogItems && cfg.catalogItems.length) ? cfg.catalogItems : CATALOG_ITEMS.filter((x) => x.g3d === cfg.id))
    : CATALOG_ITEMS;

  const terms = normalizeVi(shopState.search).split(/\s+/).filter(Boolean);
  if (!terms.length) return base;
  return base.filter((x) => {
    for (let i = 0; i < terms.length; i++) {
      if (!x._q.includes(terms[i])) return false;
    }
    return true;
  });
}

function renderCatalogCardHtml(item) {
  const imgs = getProductImgs(item);
  const img0 = imgs[0];
  const img1 = imgs[1] && imgs[1] !== img0 ? imgs[1] : '';
  const hasAlt = Boolean(img1);
  const specText = (item.sp && item.sp.length)
    ? formatSpecText(item.sp[0])
    : `${item._catLabel} • ${formatSubcatLabel(item.sc)}`;
  const oldPriceHtml = (item.pm > item.p && item.p > 0)
    ? `<div class="product-old-price">${item.pm.toLocaleString('vi-VN')}đ</div>`
    : '';
  const priceText = item.p > 0 ? item.ps : 'Liên hệ';
  const discBadge = item.d ? `<span class="product-badge disc">${escHtml(item.d)}</span>` : '';
  const stockClass = item.st === 1 ? 'in' : 'out';
  const stockLabel = item.st === 1 ? 'Còn hàng' : 'Hết hàng';

  const wished = window.S25 ? window.S25.hasWish(item.id) : false;
  const heartSvg = window.S25 ? (wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart) : '';

  return `
    <article class="product-item">
      <div class="product-thumb" onclick="openProductDetailPage('${escHtml(item.id)}')" title="Xem album ${imgs.length} ảnh &amp; thông số tại Cửa hàng">
        <img class="primary-img ${hasAlt ? 'has-alt' : ''}" src="${escHtml(img0)}" alt="${escHtml(item.n)}" decoding="async" />
        ${hasAlt ? `<img class="alt-img" src="${escHtml(img1)}" alt="${escHtml(item.n)} góc khác" loading="lazy" decoding="async" />` : ''}
        <button type="button" class="card-wish-btn ${wished ? 'wished' : ''}" data-wish-id="${escHtml(item.id)}" aria-label="Lưu yêu thích" onclick="event.stopPropagation(); window.toggleItemWishlist('${escHtml(item.id)}')">${heartSvg}</button>
        <div class="product-thumb-pills">
          <span class="product-pill-photo">${imgs.length} ảnh</span>
          <span class="product-pill-stock ${stockClass}">${stockLabel}</span>
        </div>
      </div>
      <div class="product-meta">
        <div class="product-badges-line">
          <span class="product-badge">${escHtml(formatSubcatLabel(item.sc))}</span>
          ${discBadge}
          ${imgs.length > 1 ? `<span class="product-badge">${imgs.length} ảnh</span>` : ''}
        </div>
        <div class="product-name" onclick="openProductDetailPage('${escHtml(item.id)}')" title="${escHtml(item.n)}">${escHtml(item.n)}</div>
        <div class="product-specs">${escHtml(specText)}</div>
        <div class="product-bottom">
          <div class="product-price-col">
            ${oldPriceHtml}
            <div class="product-price">${escHtml(priceText)}</div>
          </div>
          <div class="product-card-actions">
            <button type="button" class="detail-mini-btn" onclick="openProductDetailPage('${escHtml(item.id)}')">Chi tiết</button>
            <button type="button" class="add-btn" onclick="addCatalogProductToCart('${escHtml(item.id)}')">
              ${SITE_SVGS.plus}
              <span>Giỏ</span>
            </button>
          </div>
        </div>
      </div>
    </article>`;
}

export function renderActiveCatalogList(opts = {}) {
  const listEl = document.getElementById('drawerProducts');
  if (!listEl || shopState.mode === 'cart') return;

  const batchSize = 24;
  if (opts.resetLimit) shopState.limit = batchSize;

  const filtered = getFilteredCatalogItems();
  shopState.lastFiltered = filtered;
  const shown = filtered.slice(0, shopState.limit);

  const cfg = (homeState.focusedGroupId && GROUPS_CONFIG[homeState.focusedGroupId]) ? GROUPS_CONFIG[homeState.focusedGroupId] : null;
  const totalGroupCount = (!shopState.search && cfg)
    ? Math.max(filtered.length, GROUP_COUNTS[cfg.id] || 0)
    : filtered.length;
  const compactCountEl = document.getElementById('compactDrawerCount');
  if (compactCountEl) compactCountEl.textContent = `${totalGroupCount.toLocaleString('vi-VN')} SP`;

  if (!shown.length) {
    listEl.innerHTML = `
      <div style="text-align:center;padding:38px 16px;display:flex;flex-direction:column;align-items:center;gap:10px;">
        <div style="font-weight:800;font-size:0.96rem;color:var(--text-dark);">Không tìm thấy linh kiện phù hợp</div>
        <div style="font-size:0.8rem;color:var(--text-muted);">Thử từ khóa khác hoặc mở trang Cửa hàng đầy đủ để lọc theo nhánh.</div>
        <button type="button" class="detail-mini-btn" onclick="resetShopFilters()">Xóa tìm kiếm</button>
      </div>`;
    return;
  }

  const cardsHtml = shown.map((item) => renderCatalogCardHtml(item)).join('');
  let footerBar = '';
  if (filtered.length > shown.length) {
    const rem = filtered.length - shown.length;
    const nextAdd = Math.min(batchSize, rem);
    footerBar = `
      <div style="display:flex;justify-content:center;gap:10px;padding:14px 4px;">
        <button type="button" class="detail-mini-btn" onclick="loadMoreCatalogItems(${batchSize})">
          Xem thêm ${nextAdd} sản phẩm (còn ${rem.toLocaleString('vi-VN')} SP)
        </button>
      </div>`;
  } else if (totalGroupCount > filtered.length && !shopState.search && homeState.focusedGroupId) {
    footerBar = `
      <div style="display:flex;justify-content:center;padding:12px 4px;">
        <button type="button" class="detail-mini-btn" onclick="openFullShop('${escHtml(homeState.focusedGroupId)}')">
          Xem đủ ${totalGroupCount.toLocaleString('vi-VN')} sản phẩm tại Cửa hàng
        </button>
      </div>`;
  }

  listEl.innerHTML = cardsHtml + footerBar;
  if (opts.resetScroll) listEl.scrollTop = 0;
}

window.renderDrawer = () => renderActiveCatalogList({ resetLimit: false, resetScroll: false });

window.loadMoreCatalogItems = (step = 24) => {
  ensureFullCatalogLoaded();
  shopState.limit += step;
  renderActiveCatalogList({ resetLimit: false, resetScroll: false });
};

window.resetShopFilters = () => {
  shopState.search = '';
  const compactInput = document.getElementById('compactDrawerSearch');
  if (compactInput) compactInput.value = '';
  renderActiveCatalogList({ resetLimit: true, resetScroll: true });
};

let searchDebounceTimer = null;
function bindCompactSearch() {
  const compactInput = document.getElementById('compactDrawerSearch');
  if (!compactInput) return;
  compactInput.addEventListener('focus', () => ensureFullCatalogLoaded());
  compactInput.addEventListener('input', (e) => {
    ensureFullCatalogLoaded();
    shopState.search = e.target.value || '';
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      renderActiveCatalogList({ resetLimit: true, resetScroll: true });
    }, 120);
  });
}

window.openCategoryDrawer = (groupId) => {
  const cfg = GROUPS_CONFIG[groupId];
  if (!cfg) return;
  if (!isGroupUnlocked(groupId, homeState.scrollProgress) && !renderParams.get('drawer')) return;

  homeState.focusedGroupId = groupId;
  window.focusedGroupId = groupId;
  mark3DActive();
  shopState.mode = 'group';
  shopState.search = '';

  const compactTools = document.getElementById('drawerCompactTools');
  const compactInput = document.getElementById('compactDrawerSearch');
  if (compactTools) compactTools.classList.remove('is-hidden');
  if (compactInput) compactInput.value = '';

  const drawer = document.getElementById('productDrawer');
  drawer.classList.remove('expanded-shop');
  renderExpandBtnState();

  const groupCount = Math.max(
    (cfg.catalogItems && cfg.catalogItems.length) || 0,
    GROUP_COUNTS[groupId] || 0,
    cfg.products ? cfg.products.length : 0
  );
  document.getElementById('drawerTag').textContent = cfg.sub;
  document.getElementById('drawerTitle').innerHTML = `${SITE_SVGS[cfg.svgKey] || SITE_SVGS.orbit}<span>${cfg.title}</span>`;
  document.getElementById('drawerDesc').textContent = cfg.desc;
  const footerTxt = document.getElementById('drawerFooterFullText');
  if (footerTxt) {
    footerTxt.textContent = `Mở kho ${groupCount.toLocaleString('vi-VN')} ${cfg.title} tại Cửa hàng`;
  }

  renderActiveCatalogList({ resetLimit: true, resetScroll: true });

  window.drawerReturnFocus = document.activeElement;
  drawer.inert = false;
  drawer.classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
};

window.closeDrawer = () => {
  const drawer = document.getElementById('productDrawer');
  if (!drawer) return;
  drawer.inert = true;
  drawer.classList.remove('open', 'expanded-shop');
  renderExpandBtnState();
  document.getElementById('drawerBackdrop').classList.remove('open');
  homeState.focusedGroupId = null;
  window.focusedGroupId = null;
  mark3DActive();
  window.drawerReturnFocus?.focus();
};

function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => x && x.name) : [];
  } catch (_) {
    return [];
  }
}

const cartState = loadCartFromStorage();
export const parseVndPrice = (str) => parseInt(String(str || '0').replace(/[^\d]/g, ''), 10) || 0;

export function syncCartBadges(shouldPersist = true) {
  if (shouldPersist) {
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState)); } catch (_) {}
  }
  cartItems = cartState.reduce((sum, item) => sum + (item.qty || 1), 0);
  const countEl = document.getElementById('cartCount');
  const tbBadgeEl = document.getElementById('tbCartBadge');
  const tbBtnEl = document.getElementById('tbCartBtn');
  if (countEl) countEl.textContent = cartItems;
  if (tbBadgeEl) tbBadgeEl.textContent = cartItems;
  if (tbBtnEl && shouldPersist) {
    tbBtnEl.classList.remove('cart-pulse');
    void tbBtnEl.offsetWidth;
    tbBtnEl.classList.add('cart-pulse');
    setTimeout(() => tbBtnEl.classList.remove('cart-pulse'), 550);
  }
}


function reloadCartState() {
  const fresh = loadCartFromStorage();
  cartState.splice(0, cartState.length, ...fresh);
}

export function pushItemToCart(item) {
  if (!item || !item.name) return;
  const key = item.id || item.name;
  const existing = cartState.find(x => x.id === key);
  if (existing) {
    existing.qty += (item.qty || 1);
    if (item.img && !existing.img) existing.img = item.img;
  } else {
    cartState.push({
      id: key,
      name: item.name,
      sub: item.sub || '',
      priceNum: item.priceNum || 0,
      img: item.img || '',
      qty: item.qty || 1
    });
  }
  syncCartBadges(true);
  if (window.S25) window.S25.syncHeaderAuthAndWish();
}

window.addCatalogProductToCart = (itemId) => {
  const item = CATALOG_BY_ID[itemId];
  if (!item) return;
  const imgs = getProductImgs(item);
  pushItemToCart({
    id: item.id,
    name: item.n,
    sub: `${item.sc}${item.w ? ' • BH ' + item.w : ''}`,
    priceNum: item.p || 0,
    img: imgs[0] || ''
  });
};

window.toggleItemWishlist = (itemId, customItem) => {
  if (!window.S25) return;
  const catItem = CATALOG_BY_ID[itemId];
  const payload = catItem
    ? { id: catItem.id, name: catItem.n, sub: catItem.sc, priceNum: catItem.p || 0, img: getProductImgs(catItem)[0] }
    : customItem;
  if (payload) window.S25.toggleWish(payload);
};

window.addGroupProductToCart = (groupId, prodIdx) => {
  const cfg = GROUPS_CONFIG[groupId];
  const prod = cfg && cfg.products && cfg.products[prodIdx];
  if (!prod) return;
  if (prod.catalogId && CATALOG_BY_ID[prod.catalogId]) {
    window.addCatalogProductToCart(prod.catalogId);
    return;
  }
  pushItemToCart({
    id: `${groupId}:${prodIdx}`,
    name: prod.name,
    sub: cfg.title,
    priceNum: parseVndPrice(prod.price)
  });
};

window.addToCart = (item) => {
  if (item && typeof item === 'object') {
    pushItemToCart(item);
  } else {
    pushItemToCart({ id: 'custom-pc-item', name: 'Cấu hình PC Decor Tùy Chọn', sub: 'SKYCRUMB Studio', priceNum: 24490000 });
  }
};

window.updateCartQty = (idx, delta) => {
  const item = cartState[idx];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cartState.splice(idx, 1);
  syncCartBadges(true);
  renderCartDrawerContent();
};

export function renderCartDrawerContent() {
  const listEl = document.getElementById('drawerProducts');
  const titleEl = document.getElementById('drawerTitle');
  if (window.S25 && listEl) {
    window.S25.renderCartDrawerBody({
      bodyEl: listEl,
      titleEl,
      noteId: 'cartConfirmNote',
      onChange: () => {
        const fresh = loadCartFromStorage();
        cartState.splice(0, cartState.length, ...fresh);
        syncCartBadges(false);
      }
    });
    return;
  }
  if (titleEl) titleEl.innerHTML = `${TTG_SVGS.cart}<span>Giỏ hàng (${cartItems})</span>`;
}



window.openCartDrawer = () => {
  const drawer = document.getElementById('productDrawer');
  if (!drawer) return;
  shopState.mode = 'cart';
  const compactTools = document.getElementById('drawerCompactTools');
  if (compactTools) compactTools.classList.add('is-hidden');
  drawer.classList.remove('expanded-shop');
  renderExpandBtnState();
  document.getElementById('drawerTag').textContent = 'SKYCRUMB // GIỎ HÀNG & BÁO GIÁ';
  document.getElementById('drawerTitle').innerHTML = `${TTG_SVGS.cart}<span>Giỏ hàng (${cartItems})</span>`;
  document.getElementById('drawerDesc').textContent = 'Danh sách linh kiện và cấu hình được đồng bộ với trang Cửa hàng.';
  const footerTxt = document.getElementById('drawerFooterFullText');
  if (footerTxt) footerTxt.textContent = `Mở trang Cửa hàng đầy đủ (${(CAT_COUNTS.ALL || 2326).toLocaleString('vi-VN')} SP)`;
  renderCartDrawerContent();
  window.drawerReturnFocus = document.activeElement;
  drawer.inert = false;
  drawer.classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
};




export const renderDrawer = () => window.renderDrawer?.();

export function initDrawerCart() {
  renderExpandBtnState();
  bindCompactSearch();
  syncCartBadges(false);

  window.addEventListener('storage', (e) => {
    if (e.key === CART_STORAGE_KEY) {
      reloadCartState();
      syncCartBadges(false);
      if (shopState.mode === 'cart') renderCartDrawerContent();
    } else if (e.key === 's25_theme_v1' && e.newValue) {
      window.switchTheme(e.newValue);
    }
    if (e.key === 's25_wishlist_v1' && shopState.mode === 'group' && homeState.focusedGroupId) {
      renderActiveCatalogList({ resetLimit: false, resetScroll: false });
    }
    const el = document.getElementById('cartCount');
    if (el && Number(el.textContent) > 0) el.style.display = '';
  });

  window.addEventListener('s25:sync', () => {
    reloadCartState();
    syncCartBadges(false);
    if (shopState.mode === 'group' && homeState.focusedGroupId) {
      renderActiveCatalogList({ resetLimit: false, resetScroll: false });
    }
    if (shopState.mode === 'cart' && document.getElementById('productDrawer')?.classList.contains('open')) {
      renderCartDrawerContent();
    }
  });

  document.addEventListener('keydown', (e) => {
    const drawer = document.getElementById('productDrawer');
    if (!drawer || !drawer.classList.contains('open')) return;
    if (e.key === 'Escape') window.closeDrawer();
  });
}
