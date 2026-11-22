/* ============================================================================
   S25 // SKYCRUMB — HOMEPAGE CATALOG STORE & LAZY HYDRATION
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import {
  SITE_SVGS,
  SHARED_IMG_HARDWARE,
  SHARED_IMG_DECOR,
  GROUPS_CONFIG,
  MAIN_CATEGORIES,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSpecText,
  normalizeVi,
  getProductImages
} from './config.js';

export const getProductImgs = (item) => getProductImages(item, {
  hardwareFallback: SHARED_IMG_HARDWARE,
  decorFallback: SHARED_IMG_DECOR
});

const catalogRefreshListeners = [];
export function registerCatalogRefreshListener(fn) {
  if (typeof fn === 'function') catalogRefreshListeners.push(fn);
}

export const CATALOG_ITEMS = [];
export const CATALOG_BY_ID = {};
export const CAT_COUNTS = {};
export const SUBCAT_COUNTS = {};
export const GROUP_COUNTS = {};

export function renderTopbarDropdown() {
  const dd = document.getElementById('tbCatDropdown');
  if (!dd) return;
  const linksHtml = MAIN_CATEGORIES.map((cat, idx) => {
    const count = Number(CAT_COUNTS[cat.key] || 0);
    return `
      <a class="tb-dd-item" style="--di:${idx}" href="./shop.html?cat=${encodeURIComponent(cat.key)}" role="menuitem">
        <span class="tb-dd-left">${SITE_SVGS[cat.svgKey] || SITE_SVGS.expand}<span>${escHtml(cat.label)}</span></span>
        <span class="tb-dd-count">${count.toLocaleString('vi-VN')}</span>
      </a>`;
  }).join('');
  dd.innerHTML = `
    <div class="tb-mega-links">${linksHtml}</div>
    <a class="tb-mega-spotlight" href="./product.html?id=1072100888&amp;cat=pc">
      <span class="tb-mega-spot-tag">Hàng Mới &amp; Nổi Bật</span>
      <img class="tb-mega-spot-img" src="${SHARED_IMG_HARDWARE}" alt="Snow White 9800X3D" loading="lazy" />
      <div>
        <div class="tb-mega-spot-title">Luxury Snow White 9800X3D • RTX 5070 Ti</div>
        <div class="tb-mega-spot-cta"><span>Khám phá cấu hình</span>${SITE_SVGS.arrowRight}</div>
      </div>
    </a>`;
}

export function hydrateCatalogFromData(rawInput) {
  const merged = Array.isArray(rawInput) ? rawInput : [];

  CATALOG_ITEMS.length = 0;
  Object.keys(CATALOG_BY_ID).forEach((k) => delete CATALOG_BY_ID[k]);
  Object.keys(CAT_COUNTS).forEach((k) => delete CAT_COUNTS[k]);
  Object.keys(SUBCAT_COUNTS).forEach((k) => delete SUBCAT_COUNTS[k]);
  Object.keys(GROUP_COUNTS).forEach((k) => delete GROUP_COUNTS[k]);

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
    if (item.g3d) GROUP_COUNTS[item.g3d] = (GROUP_COUNTS[item.g3d] || 0) + 1;
  }

  // Preserve authoritative totals from home_data.js before full store_data.js is lazy-loaded
  const presetCats = window.TTG_CATEGORY_COUNTS;
  if (presetCats && typeof presetCats === 'object') {
    Object.entries(presetCats).forEach(([k, v]) => {
      if (typeof v === 'number' && v > (CAT_COUNTS[k] || 0)) CAT_COUNTS[k] = v;
    });
  }
  const presetSubs = window.TTG_SUBCAT_COUNTS;
  if (presetSubs && typeof presetSubs === 'object') {
    Object.entries(presetSubs).forEach(([ck, map]) => {
      if (!SUBCAT_COUNTS[ck]) SUBCAT_COUNTS[ck] = {};
      Object.entries(map || {}).forEach(([sk, v]) => {
        if (typeof v === 'number' && v > (SUBCAT_COUNTS[ck][sk] || 0)) SUBCAT_COUNTS[ck][sk] = v;
      });
    });
  }
  const presetGroups = window.TTG_GROUP_COUNTS;
  if (presetGroups && typeof presetGroups === 'object') {
    Object.entries(presetGroups).forEach(([gk, v]) => {
      if (typeof v === 'number' && v > (GROUP_COUNTS[gk] || 0)) GROUP_COUNTS[gk] = v;
    });
  }
  CAT_COUNTS.ALL = MAIN_CATEGORIES
    .filter((m) => m.key !== 'ALL')
    .reduce((sum, m) => sum + (CAT_COUNTS[m.key] || 0), 0);

  // Hydrate all 3D Component Hotspots + Section 3 Builder picks with real TTGShop items & real local photos
  Object.values(GROUPS_CONFIG).forEach((cfg) => {
    const matched = CATALOG_ITEMS
      .filter((x) => x.g3d === cfg.id)
      .sort((a, b) => {
        if (b.st !== a.st) return b.st - a.st;
        const aW = /white|trắng|snow|ice|pure/i.test(a.n) ? 1 : 0;
        const bW = /white|trắng|snow|ice|pure/i.test(b.n) ? 1 : 0;
        if (bW !== aW) return bW - aW;
        return (b._imgs.length > 1 ? 1 : 0) - (a._imgs.length > 1 ? 1 : 0);
      });
    cfg.catalogItems = matched;
    if (matched.length) {
      const totalInGroup = Math.max(matched.length, GROUP_COUNTS[cfg.id] || 0);
      const isDecorGrp = cfg.id === 'Group_Accessories';
      const prefDecorIds = isDecorGrp
        ? ['ld-dh0024', 'ld-hpw0080', 'ld-mh0564', 'ld-mh0444', 'ld-pk0175', 'ld-led0015']
        : [];
      const prefItems = prefDecorIds.map((id) => CATALOG_BY_ID[id]).filter(Boolean);
      const builderPool = matched.filter((x) => x.st === 1 && x.p > 0);
      const mergedPool = prefItems.length
        ? [...prefItems, ...builderPool.filter((x) => !prefDecorIds.includes(x.id))]
        : (builderPool.length >= 4 ? builderPool : matched);
      const srcPicks = mergedPool.slice(0, 6);
      cfg.sharedImg = (srcPicks[0] && srcPicks[0]._imgs[0]) || matched[0]._imgs[0] || SHARED_IMG_HARDWARE;
      cfg.sub = `${totalInGroup.toLocaleString('vi-VN')} sản phẩm ${isDecorGrp ? 'Decor & Mô Hình chọn lọc' : 'Linh Kiện chính hãng'}`;
      cfg.products = srcPicks.map((item) => ({
        catalogId: item.id,
        badge: item.d || item.sc,
        name: item.n,
        specs: (item.sp && item.sp[0]) ? formatSpecText(item.sp[0]) : `${item._catLabel} • ${item.sc}`,
        price: item.p > 0 ? item.ps : 'Liên hệ',
        img: item._imgs[0],
        altImg: item._imgs[1] || item._imgs[0]
      }));
    }
  });

  if (merged.length > 200) homeState.isFullCatalogLoaded = true;
  renderTopbarDropdown();
}

export function ensureFullCatalogLoaded() {
  if (homeState.isFullCatalogLoaded) return Promise.resolve();
  if (homeState.fullCatalogPromise) return homeState.fullCatalogPromise;
  homeState.fullCatalogPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = './data/catalog/store-catalog.js';
    script.async = true;
    script.onload = () => {
      hydrateCatalogFromData(window.TTG_CATALOG_DATA);
      catalogRefreshListeners.forEach((fn) => fn());
      resolve();
    };
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });
  return homeState.fullCatalogPromise;
}

hydrateCatalogFromData(window.TTG_CATALOG_DATA);

