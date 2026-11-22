import {
  PLACEHOLDER_IMAGES,
  SITE_SVGS,
  MAIN_CATEGORIES,
  GROUP3D_LABELS,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSubcatLabel,
  formatSpecText,
  normalizeVi,
  resolveCatalogImgUrl,
  getProductImages
} from '../shared/catalog-helpers.js';

const SHARED_IMG_HARDWARE = PLACEHOLDER_IMAGES.hardwareWide;
const SHARED_IMG_DECOR = PLACEHOLDER_IMAGES.decorWide;
const resolveImgUrl = (dir, file) => resolveCatalogImgUrl(dir, file, SHARED_IMG_HARDWARE);
const getProductImgs = (item) => getProductImages(item, {
  hardwareFallback: SHARED_IMG_HARDWARE,
  decorFallback: SHARED_IMG_DECOR
});

const CART_STORAGE_KEY = 's25_cart_v1';
const THEME_STORAGE_KEY = 's25_theme_v1';


const CATALOG_ITEMS = [];
const CATALOG_BY_ID = {};
const CAT_COUNTS = {};
const SUBCAT_COUNTS = {};

(function hydrate() {
  const merged = Array.isArray(window.TTG_CATALOG_DATA) ? window.TTG_CATALOG_DATA : [];
  for (let i = 0; i < merged.length; i++) {
    const item = merged[i];
    item._idx = i;
    item._catLabel = CATEGORY_LABEL_MAP[item.c] || item.c;
    item._imgs = getProductImgs(item);
    item._discNum = parseInt(String(item.d || '').replace(/[^\d]/g, ''), 10) || 0;
    item._q = normalizeVi(`${item.id} ${item.n} ${item._catLabel} ${item.sc} ${(item.sp || []).join(' ')}`);
    CATALOG_ITEMS.push(item);
    CATALOG_BY_ID[item.id] = item;
    CAT_COUNTS[item.c] = (CAT_COUNTS[item.c] || 0) + 1;
    if (!SUBCAT_COUNTS[item.c]) SUBCAT_COUNTS[item.c] = {};
    SUBCAT_COUNTS[item.c][item.sc] = (SUBCAT_COUNTS[item.c][item.sc] || 0) + 1;
  }
  CAT_COUNTS.ALL = CATALOG_ITEMS.length;
})();

// Unified sky-blue studio theme
window.switchTheme = () => {
  document.body.setAttribute('data-theme', 'sky');
  try { localStorage.setItem(THEME_STORAGE_KEY, 'sky'); } catch {}
};

const urlParams = new URLSearchParams(location.search);
window.switchTheme('sky');

// Shared Cart State backed by localStorage
const cartState = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }
})();

function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartState)); } catch {}
}

function syncCartBadges() {
  saveCart();
  const totalQty = cartState.reduce((s, it) => s + (it.qty || 1), 0);
  const badge = document.getElementById('tbCartBadge');
  if (badge) badge.textContent = totalQty;
}
syncCartBadges();

window.addEventListener('storage', (e) => {
  if (e.key !== CART_STORAGE_KEY) return;
  try {
    const next = JSON.parse(e.newValue || '[]');
    if (Array.isArray(next)) {
      cartState.splice(0, cartState.length, ...next);
      syncCartBadges();
      if (document.getElementById('cartDrawer').classList.contains('open')) renderCartDrawerContent();
    }
  } catch {}
});

function pushItemToCart(item) {
  if (!item || !item.name) return;
  const key = String(item.id || item.name);
  const existing = cartState.find((x) => String(x.id) === key);
  if (existing) {
    existing.qty += (item.qty || 1);
    if (item.img && !existing.img) existing.img = item.img;
  } else {
    cartState.push({ id: key, name: item.name, sub: item.sub || '', priceNum: item.priceNum || 0, img: item.img || '', variant: item.variant || '', qty: item.qty || 1 });
  }
  syncCartBadges();
  if (window.S25) window.S25.emitSync();
}

window.addCatalogProductToCart = (itemId, opts = {}) => {
  const item = CATALOG_BY_ID[itemId];
  if (!item) return;
  const imgs = getProductImgs(item);
  const addFee = Number(opts.extraFee || 0);
  const variantLabel = opts.variantLabel || '';
  const subParts = [item.sc];
  if (item.w) subParts.push('BH ' + item.w);
  if (variantLabel) subParts.push(variantLabel);
  pushItemToCart({
    id: variantLabel ? `${item.id}:${variantLabel}` : item.id,
    name: item.n,
    sub: subParts.join(' • '),
    variant: variantLabel,
    priceNum: (item.p || 0) + addFee,
    img: imgs[0] || ''
  });
};

window.toggleShopItemWishlist = (itemId) => {
  const item = CATALOG_BY_ID[itemId];
  if (!item || !window.S25) return;
  const imgs = getProductImgs(item);
  window.S25.toggleWish({ id: item.id, name: item.n, sub: item.sc, priceNum: item.p || 0, img: imgs[0] || '' });
  if (shopState.wishOnly) renderShopGrid({ resetLimit: false });
};

window.updateCartQty = (idx, delta) => {
  const item = cartState[idx];
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cartState.splice(idx, 1);
  syncCartBadges();
  if (window.S25) window.S25.emitSync();
  renderCartDrawerContent();
};

function renderCartDrawerContent() {
  const bodyEl = document.getElementById('cartDrawerBody');
  const titleEl = document.getElementById('cartDrawerTitle');
  if (window.S25 && bodyEl) {
    window.S25.renderCartDrawerBody({
      bodyEl,
      titleEl,
      noteId: 'cartSaveMsg',
      onChange: () => {
        try {
          const next = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
          if (Array.isArray(next)) cartState.splice(0, cartState.length, ...next);
        } catch {}
        syncCartBadges();
      }
    });
    return;
  }
  const totalQty = cartState.reduce((s, it) => s + (it.qty || 1), 0);
  titleEl.textContent = `Giỏ hàng (${totalQty})`;
}

window.addEventListener('s25:sync', () => {
  try {
    const next = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    if (Array.isArray(next)) {
      cartState.splice(0, cartState.length, ...next);
      syncCartBadges();
    }
  } catch {}
});

window.openCartDrawer = () => {
  renderCartDrawerContent();
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartBackdrop').classList.add('open');
};
window.closeCartDrawer = () => {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartBackdrop').classList.remove('open');
};

// Storefront Filtering State & Sync URL
const shopState = {
  catKey: urlParams.get('cat') || 'ALL',
  subCat: urlParams.get('sub') || 'ALL',
  group3d: urlParams.get('group') || '',
  search: urlParams.get('q') || '',
  inStockOnly: false,
  discountOnly: false,
  wishOnly: urlParams.get('wish') === '1',
  colorTone: urlParams.get('tone') || 'all',
  priceRange: 'all',
  sort: 'default',
  limit: 48,
  sidebarOpen: window.innerWidth > 980
};

function syncUrlParams() {
  const p = new URLSearchParams();
  if (shopState.catKey && shopState.catKey !== 'ALL') p.set('cat', shopState.catKey);
  if (shopState.subCat && shopState.subCat !== 'ALL') p.set('sub', shopState.subCat);
  if (shopState.group3d) p.set('group', shopState.group3d);
  if (shopState.search) p.set('q', shopState.search);
  if (shopState.wishOnly) p.set('wish', '1');
  if (shopState.colorTone && shopState.colorTone !== 'all') p.set('tone', shopState.colorTone);
  const qs = p.toString();
  history.replaceState(null, '', qs ? `./shop.html?${qs}` : './shop.html');
}

function renderTopbarDropdown() {
  const dd = document.getElementById('tbCatDropdown');
  if (!dd) return;
  const linksHtml = MAIN_CATEGORIES.map((cat, idx) => `
    <button type="button" class="tb-dd-item ${shopState.catKey === cat.key && !shopState.group3d ? 'active' : ''}" style="--di:${idx}" onclick="setShopCategory('${cat.key}')">
      <span class="tb-dd-left">${SITE_SVGS[cat.svgKey] || SITE_SVGS.orbit}<span>${cat.label}</span></span>
      <span class="tb-dd-count">${(CAT_COUNTS[cat.key] || 0).toLocaleString('vi-VN')}</span>
    </button>`).join('');
  dd.innerHTML = `
    <div class="tb-mega-links">${linksHtml}</div>
    <a class="tb-mega-spotlight" href="./product.html?id=1072100888&amp;cat=pc">
      <span class="tb-mega-spot-tag">Hàng Mới &amp; Nổi Bật</span>
      <img class="tb-mega-spot-img" src="./assets/images/placeholders/hardware-wide.png" alt="Snow White 9800X3D" loading="lazy" />
      <div>
        <div class="tb-mega-spot-title">Luxury Snow White 9800X3D • RTX 5070 Ti</div>
        <div class="tb-mega-spot-cta"><span>Xem chi tiết cấu hình &rarr;</span></div>
      </div>
    </a>`;
}

function matchColorTone(item, tone) {
  if (!tone || tone === 'all') return true;
  const q = item._q || '';
  if (tone === 'white') return /\b(white|trang|snow|silver|bac|glacial|ice)\b/.test(q);
  if (tone === 'black') return /\b(black|den|dark|carbon|stealth|matte|noir)\b/.test(q);
  if (tone === 'rgb') return /\b(rgb|argb|led|aura|mystic|sync|strimer)\b/.test(q);
  if (tone === 'silver') return /\b(silver|titan|gray|grey|xam|bac|alloy)\b/.test(q);
  return true;
}

function matchPriceRange(p, rangeKey) {
  if (rangeKey === 'all') return true;
  if (!p || p <= 0) return false;
  if (rangeKey === 'under200k') return p < 200000;
  if (rangeKey === '200kto2') return p >= 200000 && p < 2000000;
  if (rangeKey === 'under2') return p < 2000000;
  if (rangeKey === '2to10') return p >= 2000000 && p <= 10000000;
  if (rangeKey === '10to30') return p > 10000000 && p <= 30000000;
  if (rangeKey === '30to60') return p > 30000000 && p <= 60000000;
  if (rangeKey === 'over60') return p > 60000000;
  return true;
}

const DECOR_PK_SUBCATS = new Set([
  'Đèn Bàn & Đèn Màn Hình',
  'Đồng Hồ & Setup Tech',
  'Cốc Giữ Nhiệt Decor',
  'Dây LED & Thanh LED RGB'
]);
const DECOR_GROUP_FILTER = {
  'Phụ Kiện Trang Trí': (sc) => DECOR_PK_SUBCATS.has(sc),
  'Mô Hình': (sc) => !DECOR_PK_SUBCATS.has(sc)
};

function getDecorSplitCounts() {
  const entries = Object.entries(SUBCAT_COUNTS.decor || {});
  const pkCount = entries.reduce((s, [sc, c]) => s + (DECOR_PK_SUBCATS.has(sc) ? Number(c || 0) : 0), 0);
  const mhCount = entries.reduce((s, [sc, c]) => s + (!DECOR_PK_SUBCATS.has(sc) ? Number(c || 0) : 0), 0);
  return { pkCount, mhCount };
}

function getFilteredCatalogItems() {
  let base = CATALOG_ITEMS;
  if (shopState.group3d) {
    base = base.filter((x) => x.g3d === shopState.group3d);
  } else {
    if (shopState.catKey && shopState.catKey !== 'ALL') base = base.filter((x) => x.c === shopState.catKey);
    if (shopState.subCat && shopState.subCat !== 'ALL') {
      const groupPred = DECOR_GROUP_FILTER[shopState.subCat];
      base = groupPred
        ? base.filter((x) => x.c === 'decor' && groupPred(x.sc))
        : base.filter((x) => x.sc === shopState.subCat);
    }
  }
  const wishIds = shopState.wishOnly && window.S25
    ? new Set(window.S25.getWishlist().map((w) => String(w.id)))
    : null;
  const terms = normalizeVi(shopState.search).split(/\s+/).filter(Boolean);
  let out = base.filter((x) => {
    if (shopState.inStockOnly && x.st !== 1) return false;
    if (shopState.discountOnly && !(x.pm > x.p && x.p > 0)) return false;
    if (wishIds && !wishIds.has(String(x.id))) return false;
    if (!matchColorTone(x, shopState.colorTone)) return false;
    if (!matchPriceRange(x.p, shopState.priceRange)) return false;
    if (terms.length) {
      for (const t of terms) if (!x._q.includes(t)) return false;
    }
    return true;
  });
  if (shopState.sort === 'price-asc') out = [...out].sort((a, b) => (a.p || 9e12) - (b.p || 9e12));
  else if (shopState.sort === 'price-desc') out = [...out].sort((a, b) => b.p - a.p);
  else if (shopState.sort === 'discount') out = [...out].sort((a, b) => b._discNum - a._discNum || b._imgs.length - a._imgs.length);
  else if (shopState.sort === 'photos') out = [...out].sort((a, b) => b._imgs.length - a._imgs.length || (b.st - a.st));
  return out;
}

const COLOR_SWATCHES = [
  { key: 'all', label: 'Mọi tông', bg: 'linear-gradient(135deg,#bae6fd,#0284c7)' },
  { key: 'white', label: 'Trắng', bg: '#ffffff' },
  { key: 'black', label: 'Đen', bg: '#0f172a' },
  { key: 'silver', label: 'Bạc / Xám', bg: '#cbd5e1' },
  { key: 'rgb', label: 'RGB / LED', bg: 'conic-gradient(#38bdf8,#818cf8,#f472b6,#34d399,#38bdf8)' }
];

function renderShopSidebarAndChips() {
  const layout = document.getElementById('shopMainLayout');
  const toggleBtn = document.getElementById('shopSidebarToggle');
  if (layout) layout.classList.toggle('sidebar-collapsed', !shopState.sidebarOpen);
  if (toggleBtn) toggleBtn.classList.toggle('active', shopState.sidebarOpen);

  const chev = window.S25 ? window.S25.ICONS.chevronDown : '';
  const activeList = [];
  if (shopState.catKey !== 'ALL') activeList.push({ label: CATEGORY_LABEL_MAP[shopState.catKey] || shopState.catKey, clear: "setShopCategory('ALL')" });
  if (shopState.subCat !== 'ALL') activeList.push({ label: formatSubcatLabel(shopState.subCat), clear: "setShopSubCat('ALL')" });
  if (shopState.group3d) activeList.push({ label: GROUP3D_LABELS[shopState.group3d] || shopState.group3d, clear: "clearGroupFilter()" });
  if (shopState.inStockOnly) activeList.push({ label: 'Chỉ còn hàng', clear: "toggleShopInStock()" });
  if (shopState.discountOnly) activeList.push({ label: 'Đang giảm giá', clear: "toggleShopDiscountOnly()" });
  if (shopState.wishOnly) activeList.push({ label: 'Đã yêu thích', clear: "toggleShopWishlistOnly()" });
  if (shopState.colorTone !== 'all') {
    const sw = COLOR_SWATCHES.find((s) => s.key === shopState.colorTone);
    activeList.push({ label: `Tông: ${sw ? sw.label : shopState.colorTone}`, clear: "setShopColorTone('all')" });
  }
  if (shopState.priceRange !== 'all') {
    const pMap = { under200k: '< 200.000đ', '200kto2': '200k – 2 triệu', under2: '< 2 triệu', '2to10': '2 – 10 triệu', '10to30': '10 – 30 triệu', '30to60': '30 – 60 triệu', over60: '> 60 triệu' };
    activeList.push({ label: `Giá: ${pMap[shopState.priceRange] || shopState.priceRange}`, clear: "setShopPriceRange('all')" });
  }
  if (shopState.search) activeList.push({ label: `"${shopState.search}"`, clear: "shopState.search='';renderShopGrid({resetLimit:true})" });

  const badgeEl = document.getElementById('shopFilterBadge');
  if (badgeEl) badgeEl.textContent = activeList.length;

  const chipsEl = document.getElementById('shopActiveChips');
  if (chipsEl) {
    chipsEl.innerHTML = activeList.length
      ? activeList.map((ch) => `<span class="filter-active-chip"><span>${escHtml(ch.label)}</span><button type="button" aria-label="Bỏ lọc ${escHtml(ch.label)}" onclick="${ch.clear}">&times;</button></span>`).join('') +
        `<button type="button" class="filter-clear-all-link" onclick="resetShopFilters()">Xóa tất cả bộ lọc</button>`
      : '';
  }

  const sb = document.getElementById('shopSidebar');
  if (!sb) return;
  const decorGroupOptions = shopState.catKey === 'decor'
    ? (() => {
        const { pkCount, mhCount } = getDecorSplitCounts();
        return [
          { key: 'Phụ Kiện Trang Trí', label: 'Phụ Kiện Trang Trí', cnt: pkCount, isCat: false },
          { key: 'Mô Hình', label: 'Mô Hình', cnt: mhCount, isCat: false }
        ];
      })()
    : [];
  const subMap = shopState.catKey === 'ALL'
    ? Object.entries(CAT_COUNTS).filter(([k]) => k !== 'ALL').map(([k, cnt]) => ({ key: k, label: CATEGORY_LABEL_MAP[k] || k, cnt, isCat: true }))
    : [
        ...decorGroupOptions,
        ...Object.entries(SUBCAT_COUNTS[shopState.catKey] || {}).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([sc, cnt]) => ({ key: sc, label: formatSubcatLabel(sc), cnt, isCat: false }))
      ];

  const priceOpts = [
    { k: 'all', l: 'Tất cả mức giá' },
    { k: 'under200k', l: 'Dưới 200.000đ' },
    { k: '200kto2', l: '200.000đ – 2 triệu' },
    { k: 'under2', l: 'Dưới 2 triệu' },
    { k: '2to10', l: '2 – 10 triệu' },
    { k: '10to30', l: '10 – 30 triệu' },
    { k: '30to60', l: '30 – 60 triệu' },
    { k: 'over60', l: 'Trên 60 triệu' }
  ];

  sb.innerHTML = `
    <div class="shop-sidebar-head">
      <h3>Bộ lọc NZXT</h3>
      ${activeList.length ? `<button type="button" class="filter-clear-all-link" onclick="resetShopFilters()">Đặt lại</button>` : ''}
    </div>
    <div class="filter-acc-group open">
      <button type="button" class="filter-acc-btn" onclick="this.parentElement.classList.toggle('open')">
        <span>Tình trạng &amp; Ưu đãi</span>${chev}
      </button>
      <div class="filter-acc-body">
        <label class="filter-check-row ${shopState.inStockOnly ? 'active' : ''}">
          <span class="filter-check-left"><input type="checkbox" ${shopState.inStockOnly ? 'checked' : ''} onchange="toggleShopInStock()" /><span>Sẵn hàng giao ngay</span></span>
        </label>
        <label class="filter-check-row ${shopState.discountOnly ? 'active' : ''}">
          <span class="filter-check-left"><input type="checkbox" ${shopState.discountOnly ? 'checked' : ''} onchange="toggleShopDiscountOnly()" /><span>Đang có giá ưu đãi</span></span>
        </label>
        <label class="filter-check-row ${shopState.wishOnly ? 'active' : ''}">
          <span class="filter-check-left"><input type="checkbox" ${shopState.wishOnly ? 'checked' : ''} onchange="toggleShopWishlistOnly()" /><span>Trong Wishlist (${window.S25 ? window.S25.getWishlist().length : 0})</span></span>
        </label>
      </div>
    </div>
    <div class="filter-acc-group open">
      <button type="button" class="filter-acc-btn" onclick="this.parentElement.classList.toggle('open')">
        <span>Màu sắc &amp; Phong cách</span>${chev}
      </button>
      <div class="filter-acc-body">
        <div class="filter-swatch-row">
          ${COLOR_SWATCHES.map((sw) => `
            <button type="button" class="filter-swatch-btn ${shopState.colorTone === sw.key ? 'active' : ''}" onclick="setShopColorTone('${sw.key}')">
              <span class="swatch-dot" style="background:${sw.bg};"></span>
              <span>${sw.label}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>
    <div class="filter-acc-group open">
      <button type="button" class="filter-acc-btn" onclick="this.parentElement.classList.toggle('open')">
        <span>Khoảng ngân sách</span>${chev}
      </button>
      <div class="filter-acc-body">
        ${priceOpts.map((po) => `
          <label class="filter-check-row ${shopState.priceRange === po.k ? 'active' : ''}">
            <span class="filter-check-left"><input type="radio" name="sbPrice" ${shopState.priceRange === po.k ? 'checked' : ''} onchange="setShopPriceRange('${po.k}')" /><span>${po.l}</span></span>
          </label>`).join('')}
      </div>
    </div>
    ${subMap.length ? `
      <div class="filter-acc-group open">
        <button type="button" class="filter-acc-btn" onclick="this.parentElement.classList.toggle('open')">
          <span>${shopState.catKey === 'ALL' ? 'Danh mục chính' : 'Nhánh chuyên sâu'}</span>${chev}
        </button>
        <div class="filter-acc-body">
          ${subMap.map((s) => {
            const isAct = s.isCat ? (shopState.catKey === s.key) : (shopState.subCat === s.key);
            const actCall = s.isCat ? `setShopCategory('${s.key}')` : `setShopSubCat('${escHtml(s.key)}')`;
            return `
              <label class="filter-check-row ${isAct ? 'active' : ''}">
                <span class="filter-check-left"><input type="radio" name="sbSubCat" ${isAct ? 'checked' : ''} onchange="${actCall}" /><span>${escHtml(s.label)}</span></span>
                <span class="filter-cnt">${s.cnt}</span>
              </label>`;
          }).join('')}
        </div>
      </div>` : ''}
  `;
}

function renderShopTabs() {
  renderTopbarDropdown();
  const stockBtn = document.getElementById('shopStockBtn');
  const priceSel = document.getElementById('shopPriceSelect');
  const sortSel = document.getElementById('shopSortSelect');
  const searchEl = document.getElementById('shopSearchInput');
  const clearEl = document.getElementById('shopSearchClear');

  stockBtn.classList.toggle('active', shopState.inStockOnly);
  const wishFilterBtn = document.getElementById('shopWishFilterBtn');
  if (wishFilterBtn) wishFilterBtn.classList.toggle('active', shopState.wishOnly);
  priceSel.value = shopState.priceRange;
  sortSel.value = shopState.sort;
  if (searchEl.value !== shopState.search) searchEl.value = shopState.search;
  clearEl.classList.toggle('visible', Boolean(shopState.search));
  renderShopSidebarAndChips();

  document.getElementById('shopCatTabs').innerHTML = MAIN_CATEGORIES.map((cat) => {
    const count = CAT_COUNTS[cat.key] || 0;
    const isAct = !shopState.group3d && shopState.catKey === cat.key;
    return `
      <button type="button" class="shop-filter-tab ${isAct ? 'active' : ''}" onclick="setShopCategory('${cat.key}')">
        ${SITE_SVGS[cat.svgKey] || SITE_SVGS.orbit}
        <span>${cat.short} (${count.toLocaleString('vi-VN')})</span>
      </button>`;
  }).join('');

  const subRow = document.getElementById('shopSubTabs');
  if (shopState.group3d) {
    const gLabel = GROUP3D_LABELS[shopState.group3d] || shopState.group3d;
    subRow.innerHTML = `<span class="shop-group-pill"><span>Đang lọc theo cụm 3D: ${escHtml(gLabel)}</span><button type="button" aria-label="Bỏ lọc 3D" onclick="clearGroupFilter()">x</button></span>`;
  } else if (shopState.catKey === 'ALL') {
    const quickSubs = [
      { c: 'linh-kien-may-tinh', sc: 'Card Màn Hình (VGA)', label: 'VGA Card' },
      { c: 'linh-kien-may-tinh', sc: 'Vi Xử Lý (CPU)', label: 'CPU' },
      { c: 'linh-kien-may-tinh', sc: 'Bo Mạch Chủ (Mainboard)', label: 'Mainboard' },
      { c: 'linh-kien-may-tinh', sc: 'Tản Nhiệt & Fan', label: 'Tản nhiệt & Fan' },
      { c: 'linh-kien-may-tinh', sc: 'Vỏ Case Máy Tính', label: 'Vỏ Case' },
      { c: 'linh-kien-may-tinh', sc: 'Bộ Nhớ RAM', label: 'RAM' },
      { c: 'linh-kien-may-tinh', sc: 'Ổ Cứng SSD / HDD', label: 'SSD / HDD' },
      { c: 'linh-kien-may-tinh', sc: 'Nguồn Máy Tính (PSU)', label: 'Nguồn PSU' },
      { c: 'gaming-gear', sc: 'Bàn phím', label: 'Bàn phím' },
      { c: 'gaming-gear', sc: 'Chuột Gaming', label: 'Chuột Gaming' },
      { c: 'man-hinh-may-tinh', sc: 'OLED / QD-OLED', label: 'Màn Hình OLED' }
    ];
    subRow.innerHTML = quickSubs.map((q) => {
      const cnt = (SUBCAT_COUNTS[q.c] && SUBCAT_COUNTS[q.c][q.sc]) || 0;
      return `<button type="button" class="shop-filter-tab sub" onclick="setShopCategory('${q.c}', '${escHtml(q.sc)}')">${q.label} (${cnt})</button>`;
    }).join('');
  } else {
    const map = SUBCAT_COUNTS[shopState.catKey] || {};
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    if (entries.length <= 1) subRow.innerHTML = '';
    else {
      const allCnt = CAT_COUNTS[shopState.catKey] || 0;
      const decorGroupTabs = shopState.catKey === 'decor'
        ? (() => {
            const { pkCount, mhCount } = getDecorSplitCounts();
            return `<button type="button" class="shop-filter-tab sub ${shopState.subCat === 'Phụ Kiện Trang Trí' ? 'active' : ''}" onclick="setShopSubCat('Phụ Kiện Trang Trí')">Phụ Kiện Trang Trí (${pkCount})</button>` +
                   `<button type="button" class="shop-filter-tab sub ${shopState.subCat === 'Mô Hình' ? 'active' : ''}" onclick="setShopSubCat('Mô Hình')">Mô Hình (${mhCount})</button>`;
          })()
        : '';
      subRow.innerHTML = `<button type="button" class="shop-filter-tab sub ${shopState.subCat === 'ALL' ? 'active' : ''}" onclick="setShopSubCat('ALL')">Tất cả nhánh (${allCnt})</button>` +
        decorGroupTabs +
        entries.map(([scName, cnt]) => `<button type="button" class="shop-filter-tab sub ${shopState.subCat === scName ? 'active' : ''}" onclick="setShopSubCat('${escHtml(scName)}')">${escHtml(formatSubcatLabel(scName))} (${cnt})</button>`).join('');
    }
  }
}

function renderShopGrid(opts = {}) {
  if (opts.resetLimit) shopState.limit = 48;
  renderShopTabs();
  syncUrlParams();

  const catMeta = MAIN_CATEGORIES.find((m) => m.key === shopState.catKey);
  if (shopState.group3d) {
    document.getElementById('shopKicker').textContent = `SKYCRUMB // CỤM LINH KIỆN 3D > ${(GROUP3D_LABELS[shopState.group3d] || '').toUpperCase()}`;
    document.getElementById('shopHeroTitle').textContent = GROUP3D_LABELS[shopState.group3d] || 'Linh kiện 3D';
  } else {
    document.getElementById('shopKicker').textContent = shopState.subCat !== 'ALL'
      ? `SKYCRUMB // ${(catMeta ? catMeta.short : 'CỬA HÀNG').toUpperCase()} > ${formatSubcatLabel(shopState.subCat).toUpperCase()}`
      : `SKYCRUMB // KHO SẢN PHẨM CHÍNH HÃNG (${CATALOG_ITEMS.length.toLocaleString('vi-VN')} SP)`;
    document.getElementById('shopHeroTitle').textContent = shopState.subCat !== 'ALL'
      ? formatSubcatLabel(shopState.subCat)
      : (catMeta ? catMeta.label : 'Tất cả sản phẩm');
  }

  const filtered = getFilteredCatalogItems();
  const shown = filtered.slice(0, shopState.limit);
  document.getElementById('shopResultCount').textContent = `${filtered.length.toLocaleString('vi-VN')} sản phẩm`;

  const host = document.getElementById('shopGridHost');
  if (!shown.length) {
    host.innerHTML = `
      <div class="shop-pagination-bar" style="flex-direction:column;padding:64px 16px;">
        <div style="font-weight:800;font-size:1.1rem;">Không tìm thấy sản phẩm khớp bộ lọc</div>
        <div style="font-size:0.86rem;color:var(--text-muted);">Thử xóa từ khóa hoặc chuyển về tất cả danh mục.</div>
        <button type="button" class="shop-more-btn" onclick="resetShopFilters()">Đặt lại bộ lọc</button>
      </div>`;
    return;
  }

  const cards = shown.map((item, idx) => {
    const imgs = getProductImgs(item);
    const img0 = imgs[0];
    const img1 = imgs[1] && imgs[1] !== img0 ? imgs[1] : '';
    const specText = (item.sp && item.sp.length)
      ? item.sp.slice(0, 2).map(formatSpecText).filter(Boolean).join(' • ')
      : `${item._catLabel} • ${formatSubcatLabel(item.sc)}`;
    const oldPriceHtml = (item.pm > item.p && item.p > 0) ? `<div class="product-old-price">${item.pm.toLocaleString('vi-VN')}đ</div>` : '';
    const eager = idx < 12;
    const wished = window.S25 ? window.S25.hasWish(item.id) : false;
    const heartSvg = window.S25 ? (wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart) : '';
    return `
      <article class="product-item">
        <a class="product-thumb" href="./product.html?id=${encodeURIComponent(item.id)}&amp;cat=${encodeURIComponent(item.c)}" title="Xem album ${imgs.length} ảnh &amp; thông số">
          <img class="primary-img ${img1 ? 'has-alt' : ''}" src="${escHtml(img0)}" alt="${escHtml(item.n)}" loading="${eager ? 'eager' : 'lazy'}" decoding="${eager ? 'sync' : 'async'}" />
          ${img1 ? `<img class="alt-img" src="${escHtml(img1)}" alt="${escHtml(item.n)} góc khác" loading="lazy" decoding="async" />` : ''}
          <button type="button" class="card-wish-btn ${wished ? 'wished' : ''}" data-wish-id="${escHtml(item.id)}" aria-label="Lưu yêu thích" onclick="event.preventDefault(); event.stopPropagation(); toggleShopItemWishlist('${escHtml(item.id)}')">${heartSvg}</button>
          <div class="product-thumb-pills">
            <span class="product-pill-photo">${imgs.length} ảnh</span>
            <span class="product-pill-stock ${item.st === 1 ? 'in' : 'out'}">${item.st === 1 ? 'Còn hàng' : 'Hết hàng'}</span>
          </div>
        </a>
        <div class="product-meta">
          <div class="product-badges-line">
            <span class="product-badge">${escHtml(formatSubcatLabel(item.sc))}</span>
            ${item.d ? `<span class="product-badge disc">${escHtml(item.d)}</span>` : ''}
          </div>
          <a class="product-name" href="./product.html?id=${encodeURIComponent(item.id)}&amp;cat=${encodeURIComponent(item.c)}" style="color:inherit;text-decoration:none;">${escHtml(item.n)}</a>
          <div class="product-specs">${escHtml(specText)}</div>
          <div class="product-bottom">
            <div>
              ${oldPriceHtml}
              <div class="product-price">${escHtml(item.p > 0 ? item.ps : 'Liên hệ')}</div>
            </div>
            <div class="product-card-actions">
              <a class="detail-mini-btn" href="./product.html?id=${encodeURIComponent(item.id)}&amp;cat=${encodeURIComponent(item.c)}">Chi tiết</a>
              <button type="button" class="add-btn" onclick="addCatalogProductToCart('${escHtml(item.id)}')">${SITE_SVGS.plus}<span>Giỏ</span></button>
            </div>
          </div>
        </div>
      </article>`;
  }).join('');

  let footer = '';
  if (filtered.length > shown.length) {
    const rem = filtered.length - shown.length;
    const step = Math.min(48, rem);
    footer = `<div class="shop-pagination-bar"><button type="button" class="shop-more-btn" onclick="loadMoreItems()">Xem thêm ${step} sản phẩm (còn ${rem.toLocaleString('vi-VN')} SP)</button><button type="button" class="detail-mini-btn" onclick="window.scrollTo({top:0,behavior:'smooth'})">Lên đầu</button></div>`;
  } else if (filtered.length > 48) {
    footer = `<div class="shop-pagination-bar"><span style="font-size:0.8rem;color:var(--text-muted);">Đã hiển thị toàn bộ ${filtered.length.toLocaleString('vi-VN')} sản phẩm phù hợp</span><button type="button" class="detail-mini-btn" onclick="window.scrollTo({top:0,behavior:'smooth'})">Lên đầu</button></div>`;
  }
  host.innerHTML = `<div class="shop-grid-inner">${cards}</div>${footer}`;
  if (opts.scrollTop) window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.setShopCategory = (catKey, subCat = 'ALL') => {
  shopState.group3d = '';
  shopState.catKey = catKey || 'ALL';
  shopState.subCat = subCat || 'ALL';
  renderShopGrid({ resetLimit: true, scrollTop: true });
};
window.setShopSubCat = (subCat) => {
  shopState.subCat = subCat || 'ALL';
  renderShopGrid({ resetLimit: true });
};
window.clearGroupFilter = () => {
  shopState.group3d = '';
  shopState.catKey = 'ALL';
  shopState.subCat = 'ALL';
  renderShopGrid({ resetLimit: true });
};
window.toggleShopSidebar = () => { shopState.sidebarOpen = !shopState.sidebarOpen; renderShopSidebarAndChips(); };
window.toggleShopInStock = () => { shopState.inStockOnly = !shopState.inStockOnly; renderShopGrid({ resetLimit: true }); };
window.toggleShopDiscountOnly = () => { shopState.discountOnly = !shopState.discountOnly; renderShopGrid({ resetLimit: true }); };
window.toggleShopWishlistOnly = () => { shopState.wishOnly = !shopState.wishOnly; renderShopGrid({ resetLimit: true }); };
window.setShopColorTone = (t) => { shopState.colorTone = t || 'all'; renderShopGrid({ resetLimit: true }); };
window.setShopPriceRange = (v) => { shopState.priceRange = v || 'all'; renderShopGrid({ resetLimit: true }); };
window.setShopSort = (v) => { shopState.sort = v || 'default'; renderShopGrid({ resetLimit: true }); };
window.loadMoreItems = () => { shopState.limit += 48; renderShopGrid({ resetLimit: false }); };
window.resetShopFilters = () => {
  shopState.catKey = 'ALL'; shopState.subCat = 'ALL'; shopState.group3d = '';
  shopState.search = ''; shopState.inStockOnly = false; shopState.discountOnly = false;
  shopState.wishOnly = false; shopState.colorTone = 'all'; shopState.priceRange = 'all'; shopState.sort = 'default';
  renderShopGrid({ resetLimit: true });
};

let searchDeb = null;
document.getElementById('shopSearchInput').addEventListener('input', (e) => {
  shopState.search = e.target.value || '';
  clearTimeout(searchDeb);
  searchDeb = setTimeout(() => renderShopGrid({ resetLimit: true }), 120);
});
document.getElementById('shopSearchClear').addEventListener('click', () => {
  const inp = document.getElementById('shopSearchInput');
  inp.value = ''; inp.focus();
  shopState.search = '';
  renderShopGrid({ resetLimit: true });
});

// Product Detail Lightbox (NZXT PDP Layout: Breadcrumb, Pills/Swatches, 4 Iconed Accordions)
const detailState = { item: null, imgs: [], idx: 0, careIdx: 0, toneIdx: 0 };
function renderDetailStage() {
  const mainImg = document.getElementById('detailMainImg');
  const safe = Math.max(0, Math.min(detailState.imgs.length - 1, detailState.idx));
  detailState.idx = safe;
  mainImg.src = detailState.imgs[safe];
  mainImg.alt = detailState.item ? detailState.item.n : '';
  document.getElementById('detailPhotoCounter').textContent = `${safe + 1} / ${detailState.imgs.length}`;
  document.querySelectorAll('.detail-thumb-btn').forEach((b, j) => b.classList.toggle('active', j === safe));
}
window.stepDetailPhoto = (d) => { if (detailState.imgs.length) { detailState.idx = (detailState.idx + d + detailState.imgs.length) % detailState.imgs.length; renderDetailStage(); } };
window.setDetailPhoto = (i) => { detailState.idx = i; renderDetailStage(); };

function renderDetailVariantsAndPrice() {
  const item = detailState.item;
  if (!item) return;
  const careFee = (item.p || 0) >= 8000000 ? 490000 : 250000;
  const careTiers = [
    { label: 'Tiêu chuẩn hãng', fee: 0 },
    { label: `Care+ 1 đổi 1 tại nhà (+${careFee.toLocaleString('vi-VN')}đ)`, fee: careFee }
  ];
  const tones = [
    { label: 'Màu gốc NSX', color: 'linear-gradient(135deg,#e0f2fe,#0284c7)' },
    { label: 'Đồng bộ Tông Trắng', color: '#ffffff' },
    { label: 'Đồng bộ Tông Đen', color: '#0f172a' }
  ];
  const selCare = careTiers[detailState.careIdx] || careTiers[0];
  const finalPrice = (item.p || 0) > 0 ? (item.p + selCare.fee) : 0;
  document.getElementById('detailModalPrice').textContent = finalPrice > 0 ? `${finalPrice.toLocaleString('vi-VN')}đ` : 'Liên hệ';

  const vbox = document.getElementById('detailVariantsBox');
  if (vbox) {
    vbox.innerHTML = `
      <div class="detail-variant-group">
        <span class="detail-variant-label">Phiên bản bảo hành</span>
        <div class="detail-pill-row">
          ${careTiers.map((ct, idx) => `<button type="button" class="detail-pill-opt ${idx === detailState.careIdx ? 'active' : ''}" onclick="setDetailVariant('care', ${idx})">${escHtml(ct.label)}</button>`).join('')}
        </div>
      </div>
      <div class="detail-variant-group">
        <span class="detail-variant-label">Gợi ý phối màu Case / Setup</span>
        <div class="detail-pill-row">
          ${tones.map((tn, idx) => `<button type="button" class="detail-pill-opt ${idx === detailState.toneIdx ? 'active' : ''}" onclick="setDetailVariant('tone', ${idx})"><span class="swatch-dot" style="background:${tn.color};width:11px;height:11px;"></span><span>${escHtml(tn.label)}</span></button>`).join('')}
        </div>
      </div>`;
  }
  const variantStr = [detailState.careIdx > 0 ? 'Care+ 1 đổi 1' : '', detailState.toneIdx > 0 ? tones[detailState.toneIdx].label : ''].filter(Boolean).join(' / ');
  document.getElementById('detailModalAddCartBtn').onclick = () => {
    window.addCatalogProductToCart(item.id, { extraFee: selCare.fee, variantLabel: variantStr });
    window.closeProductDetailModal();
    window.openCartDrawer();
  };
}

window.setDetailVariant = (kind, idx) => {
  if (kind === 'care') detailState.careIdx = idx;
  if (kind === 'tone') detailState.toneIdx = idx;
  renderDetailVariantsAndPrice();
};

window.openProductDetailModal = (itemId) => {
  const item = CATALOG_BY_ID[itemId];
  if (!item) return;
  detailState.item = item;
  detailState.imgs = getProductImgs(item);
  detailState.idx = 0;
  detailState.careIdx = 0;
  detailState.toneIdx = 0;

  const bc = document.getElementById('detailBreadcrumb');
  const subLabel = formatSubcatLabel(item.sc);
  if (bc) {
    bc.innerHTML = `<a href="./index.html">Trang chủ</a> <span>&rsaquo;</span> <button type="button" onclick="closeProductDetailModal();setShopCategory('${escHtml(item.c)}')">${escHtml(item._catLabel)}</button> <span>&rsaquo;</span> <button type="button" onclick="closeProductDetailModal();setShopCategory('${escHtml(item.c)}','${escHtml(item.sc)}')">${escHtml(subLabel)}</button>`;
  }

  document.getElementById('detailModalCat').textContent = `${item._catLabel} › ${subLabel}`;
  document.getElementById('detailModalTitle').textContent = item.n;
  document.getElementById('detailModalMeta').textContent = `Mã SP: ${item.id}${item.w ? ' • Bảo hành: ' + item.w : ''} • ${detailState.imgs.length} ảnh thực tế`;
  document.getElementById('detailModalOldPrice').textContent = (item.pm > item.p && item.p > 0) ? `${item.pm.toLocaleString('vi-VN')}đ ${item.d ? '(' + item.d + ')' : ''}` : '';
  document.getElementById('detailModalStockBadge').textContent = item.st === 1 ? 'Còn hàng sẵn giao' : 'Tạm hết hàng / Đặt trước';

  const wishBtn = document.getElementById('detailModalWishBtn');
  const renderPdpWish = () => {
    if (!wishBtn || !window.S25) return;
    const wished = window.S25.hasWish(item.id);
    wishBtn.innerHTML = wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart;
    wishBtn.style.color = wished ? '#e11d48' : '';
  };
  renderPdpWish();
  if (wishBtn) wishBtn.onclick = () => { window.toggleShopItemWishlist(item.id); renderPdpWish(); };

  renderDetailVariantsAndPrice();

  const lines = (item.sp && item.sp.length)
    ? item.sp.map(formatSpecText).filter(Boolean)
    : [`Danh mục: ${item._catLabel} — ${subLabel}`, `Tình trạng: ${item.st === 1 ? 'Còn hàng mới 100%' : 'Đặt hàng'}`];
  const specRowsHtml = lines.map((line, idx) => {
    const colon = line.indexOf(':');
    if (colon > 1 && colon < 28) {
      return `<div class="pdp-spec-row"><b>${escHtml(line.slice(0, colon))}</b><span>${escHtml(line.slice(colon + 1).trim())}</span></div>`;
    }
    return `<div class="pdp-spec-row"><b>Thông số #${idx + 1}</b><span>${escHtml(line)}</span></div>`;
  }).join('');

  const ICONS = window.S25 ? window.S25.ICONS : {};
  const accEl = document.getElementById('detailAccordions');
  if (accEl) {
    const accordions = [
      { ico: ICONS.clipboard || '', title: 'Thông số kỹ thuật (Key Specs)', body: `<div class="pdp-spec-table">${specRowsHtml}</div>`, open: true },
      { ico: ICONS.box || '', title: 'Trong hộp gồm có (Inside the Box)', body: `<p>01 × ${escHtml(item.n)} nguyên seal NSX, tem bảo hành điện tử SKYCRUMB Studio, bộ phụ kiện &amp; ốc gắn tiêu chuẩn theo hãng, hướng dẫn kích hoạt Care+.</p>`, open: false },
      { ico: ICONS.info || '', title: 'Bảo hành & Đổi trả 30 ngày', body: `<p>Bảo hành chính hãng ${escHtml(item.w || '12–36 tháng')}. Lỗi phần cứng NSX trong 30 ngày đầu được 1 đổi 1 ngay. Miễn phí vệ sinh &amp; tra keo tản nhiệt trọn đời tại SKYCRUMB Lab.</p>`, open: false },
      { ico: ICONS.doc || '', title: 'Hỗ trợ Lắp ráp & Thời gian giao', body: `<p>Linh kiện rời giao hỏa tốc 2h tại Hà Nội &amp; TP.HCM; trọn bộ PC Stress-Test 24h hoàn thiện sau 2–3 ngày làm việc. Liên hệ kỹ thuật 1:1 qua mục Tài khoản hoặc Giỏ hàng.</p>`, open: false }
    ];
    accEl.innerHTML = accordions.map((a) => `
      <div class="pdp-acc-item ${a.open ? 'open' : ''}">
        <button type="button" class="pdp-acc-btn" aria-expanded="${a.open ? 'true' : 'false'}" onclick="var p=this.parentElement;var on=p.classList.toggle('open');this.setAttribute('aria-expanded',on);this.querySelector('.pdp-acc-pm').innerHTML=on?'&minus;':'+';">
          <span class="pdp-acc-btn-left">${a.ico}<span>${escHtml(a.title)}</span></span>
          <span class="pdp-acc-pm">${a.open ? '&minus;' : '+'}</span>
        </button>
        <div class="pdp-acc-panel">${a.body}</div>
      </div>`).join('');
  }

  document.getElementById('detailThumbsStrip').innerHTML = detailState.imgs.map((url, idx) => `
    <button type="button" class="detail-thumb-btn ${idx === 0 ? 'active' : ''}" onclick="setDetailPhoto(${idx})" aria-label="Ảnh ${idx + 1}">
      <img src="${escHtml(url)}" alt="${escHtml(item.n)} #${idx + 1}" loading="lazy" />
    </button>`).join('');

  document.getElementById('detailModalBrowseCatBtn').onclick = () => {
    window.closeProductDetailModal();
    window.setShopCategory(item.c, item.sc);
  };
  const extLink = document.getElementById('detailModalExternalLink');
  if (extLink) {
    extLink.style.display = 'none';
  }
  renderDetailStage();
  const bd = document.getElementById('productDetailBackdrop');
  bd.setAttribute('aria-hidden', 'false');
  bd.classList.add('open');
};
window.closeProductDetailModal = () => {
  const bd = document.getElementById('productDetailBackdrop');
  bd.classList.remove('open');
  bd.setAttribute('aria-hidden', 'true');
};

document.addEventListener('keydown', (e) => {
  if (document.getElementById('productDetailBackdrop').classList.contains('open')) {
    if (e.key === 'Escape') return window.closeProductDetailModal();
    if (e.key === 'ArrowLeft') return window.stepDetailPhoto(-1);
    if (e.key === 'ArrowRight') return window.stepDetailPhoto(1);
  }
  if (document.getElementById('cartDrawer').classList.contains('open') && e.key === 'Escape') {
    window.closeCartDrawer();
  }
});

// Initial render & deep links
if (window.S25) {
  window.S25.renderUspStrip(document.getElementById('shopUspHost'));
  window.S25.renderFooter(document.getElementById('s25FooterHost'));
  window.S25.syncHeaderAuthAndWish();
}
renderShopGrid({ resetLimit: true });
const reqId = urlParams.get('id');
if (reqId && CATALOG_BY_ID[reqId]) {
  const it = CATALOG_BY_ID[reqId];
  window.location.replace(`./product.html?id=${encodeURIComponent(it.id)}&cat=${encodeURIComponent(it.c)}`);
}
if (urlParams.get('focus') === 'search') {
  setTimeout(() => document.getElementById('shopSearchInput').focus(), 80);
}
if (urlParams.get('cart') === '1') {
  window.location.replace('./cart.html');
}
