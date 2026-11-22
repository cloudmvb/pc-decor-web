/* ============================================================================
   S25 // SKYCRUMB — SECTION 1 & 2 (CATEGORY STRIP & SIGNATURE BUILDS)
   ============================================================================ */

import { homeState, renderParams } from './state.js';
import {
  SITE_SVGS,
  TTG_SVGS,
  SHARED_IMG_HARDWARE,
  SHARED_IMG_DECOR,
  MAIN_CATEGORIES,
  escHtml
} from './config.js';
import {
  CATALOG_ITEMS,
  CATALOG_BY_ID,
  CAT_COUNTS,
  getProductImgs
} from './catalog-store.js';
import { pushItemToCart } from './drawer-cart.js';

function extractShortPcSpecs(item, fallbackSpecs) {
  if (!item) return fallbackSpecs;
  const cleanParens = (s) => String(s || '').replace(/\s*\([^)]{14,}\)/g, '').replace(/\s+/g, ' ').trim();
  const sp = item.sp || [];
  const cpuLine = cleanParens(sp.find((s) => /^cpu\b|ryzen|core\s*(i|ultra)/i.test(s)) || '');
  const ramLine = cleanParens(sp.find((s) => /\bram\b/i.test(s)) || '');
  const mbLine = cleanParens(sp.find((s) => /mainboard|bo mạch/i.test(s)) || '');
  const gpuMatch = item.n.match(/(RTX\s*\d{4}(?:\s*(?:Ti|Super))?(?:\s*\d+GB)?|RX\s*\d{4}(?:\s*XT)?(?:\s*\d+GB)?)/i);
  const imgs = getProductImgs(item);
  return {
    cpu: cpuLine ? cpuLine.slice(0, 38) : (fallbackSpecs.cpu || item.n.slice(0, 34)),
    gpu: gpuMatch ? gpuMatch[1].toUpperCase() : (fallbackSpecs.gpu || 'VGA Chính Hãng'),
    ram: ramLine ? ramLine.slice(0, 38) : (mbLine ? mbLine.slice(0, 38) : fallbackSpecs.ram),
    decor: `${imgs.length} ảnh thực tế • BH ${item.w || '36T'}`
  };
}

function makeBuildTier(catalogId, label, fps, fallback) {
  const item = CATALOG_BY_ID[catalogId];
  if (!item) {
    return {
      catalogId: '',
      label,
      price: fallback.price,
      old: fallback.old,
      fps,
      img: SHARED_IMG_HARDWARE,
      altImg: SHARED_IMG_DECOR,
      specs: fallback.specs
    };
  }
  const imgs = getProductImgs(item);
  return {
    catalogId: item.id,
    label,
    name: item.n,
    price: item.p || fallback.price,
    old: (item.pm && item.pm > item.p) ? item.pm : Math.round((item.p || fallback.price) * 1.08),
    fps,
    img: imgs[0] || SHARED_IMG_HARDWARE,
    altImg: imgs[1] || imgs[0] || SHARED_IMG_DECOR,
    specs: extractShortPcSpecs(item, fallback.specs)
  };
}

const SIGNATURE_BUILDS = [
  {
    name: 'Pure White RTX 5060 Ti',
    badge: 'Best White',
    tiers: [
      makeBuildTier('1072100912', 'R5 7500F • 8GB OC', [380, 96, 82], { price: 35280000, old: 36990000, specs: { cpu: 'Ryzen 5 7500F', gpu: 'RTX 5060 Ti 8GB', ram: '16GB DDR5 6000', decor: 'Tông trắng toàn bộ' } }),
      makeBuildTier('1072100756', 'i5 14400F • 16GB OC', [395, 108, 92], { price: 37280000, old: 38990000, specs: { cpu: 'Core i5-14400F', gpu: 'RTX 5060 Ti 16GB', ram: '16GB DDR4 3200', decor: 'Tông trắng toàn bộ' } })
    ]
  },
  {
    name: 'Luxury Snow White 9800X3D',
    badge: 'Flagship White',
    tiers: [
      makeBuildTier('1072100888', 'RTX 5070 Ti White', [590, 152, 130], { price: 83980000, old: 89990000, specs: { cpu: 'Ryzen 7 9800X3D', gpu: 'RTX 5070 Ti 16GB', ram: '32GB DDR5 White', decor: '7 ảnh thực tế' } }),
      makeBuildTier('1072101082', 'RTX 5080 White OC', [650, 178, 154], { price: 105680000, old: 109990000, specs: { cpu: 'Ryzen 7 9800X3D', gpu: 'RTX 5080 16GB White', ram: '32GB DDR5 RGB', decor: '8 ảnh thực tế' } })
    ]
  },
  {
    name: 'AI & 3D Render Core Ultra',
    badge: 'Studio Pro',
    tiers: [
      makeBuildTier('1072101106', 'Ultra 7 • RTX 5070 Ti', [510, 148, 126], { price: 72980000, old: 75990000, specs: { cpu: 'Core Ultra 7 270K+', gpu: 'RTX 5070 Ti 16GB', ram: '32GB DDR5 5200', decor: '6 ảnh thực tế' } }),
      makeBuildTier('1067690313', 'Ultra 9 • RTX 5080', [610, 182, 158], { price: 94680000, old: 95990000, specs: { cpu: 'Core Ultra 9 285K', gpu: 'RTX 5080 16GB', ram: '32GB DDR5 5200', decor: '15 ảnh thực tế' } })
    ]
  },
  {
    name: 'Gaming Quốc Dân RTX 50',
    badge: 'Hot Value',
    tiers: [
      makeBuildTier('1072100840', 'R5 5500 • RTX 5050', [290, 68, 56], { price: 20480000, old: 24990000, specs: { cpu: 'Ryzen 5 5500', gpu: 'RTX 5050 8GB OC', ram: '16GB DDR4 3200', decor: '15 ảnh thực tế' } }),
      makeBuildTier('1072089536', 'i5 12400F • RTX 5060', [340, 86, 72], { price: 25280000, old: 28990000, specs: { cpu: 'Core i5-12400F', gpu: 'RTX 5060 8GB', ram: '16GB DDR4 3200', decor: '25 ảnh thực tế' } })
    ]
  },
  {
    name: 'Esport X3D High-FPS',
    badge: '240Hz+Ready',
    tiers: [
      makeBuildTier('1067952500', '7800X3D • 5060 Ti', [520, 102, 88], { price: 35980000, old: 37990000, specs: { cpu: 'Ryzen 7 7800X3D', gpu: 'RTX 5060 Ti 8GB', ram: '16GB DDR5 5200', decor: '15 ảnh thực tế' } }),
      makeBuildTier('1064329771', '7800X3D • RTX 5070', [565, 134, 114], { price: 48680000, old: 53990000, specs: { cpu: 'Ryzen 7 7800X3D', gpu: 'RTX 5070 12GB', ram: '16GB DDR5 5200', decor: '11 ảnh thực tế' } })
    ]
  },
  {
    name: 'ROG 20th Anniversary Ultimate',
    badge: 'Collector 5090',
    tiers: [
      makeBuildTier('1072100460', '9950X3D2 • RTX 5080', [645, 185, 162], { price: 116980000, old: 129990000, specs: { cpu: 'Ryzen 9 9950X3D2', gpu: 'RTX 5080 16GB', ram: '32GB DDR5 RGB', decor: '6 ảnh thực tế' } }),
      makeBuildTier('1072100896', 'ROG 20th • RTX 5090', [700, 245, 210], { price: 532000000, old: 559900000, specs: { cpu: 'Ryzen 9 9950X3D2', gpu: 'RTX 5090 32GB OC', ram: '128GB DDR5 6400', decor: '16 ảnh thực tế' } })
    ]
  },
  {
    name: 'PC Office Full Set Màn Hình',
    badge: 'Văn Phòng',
    tiers: [
      makeBuildTier('1072100754', 'i3 10105 • Kèm Màn', [145, 32, 28], { price: 12980000, old: 15990000, specs: { cpu: 'Core i3-10105', gpu: 'UHD + Màn Hình', ram: '8GB DDR4 3200', decor: '10 ảnh thực tế' } }),
      makeBuildTier('1072100644', 'i5 10400 • Kèm Màn', [180, 40, 34], { price: 13680000, old: 15990000, specs: { cpu: 'Core i5-10400', gpu: 'Kèm Màn Hình + Win11', ram: '8GB DDR4 3200', decor: '10 ảnh thực tế' } })
    ]
  }
];
const FPS_GAMES = ['Valorant', 'Cyberpunk', 'Wukong'];
const FPS_MAX = 700;
const buildTierState = SIGNATURE_BUILDS.map(() => 0);
const vnd = (n) => n.toLocaleString('vi-VN') + 'đ';

function buildCardHtml(b, i) {
  const t = b.tiers[buildTierState[i]];
  const hasAlt = Boolean(t.altImg && t.altImg !== t.img);
  const dispName = t.name || b.name;
  const img = `<img class="primary-img ${hasAlt ? 'has-alt' : ''}" data-pimg src="${escHtml(t.img)}" alt="${escHtml(dispName)}" draggable="false" loading="eager" decoding="sync" />`;
  const wishId = t.catalogId || `build:${i}:${buildTierState[i] || 0}`;
  const wished = window.S25 ? window.S25.hasWish(wishId) : false;
  const heartSvg = window.S25 ? (wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart) : '';
  return `
    <article class="build-card" data-idx="${i}">
      <div class="build-media" style="cursor:pointer;" onclick="openBuildDetail(${i})">
        ${img}
        ${hasAlt ? `<img class="alt-img" data-aimg src="${escHtml(t.altImg)}" alt="${escHtml(dispName)} góc khác" draggable="false" loading="lazy" decoding="async" />` : `<img class="alt-img" data-aimg src="${escHtml(t.img)}" alt="${escHtml(dispName)}" draggable="false" loading="lazy" decoding="async" />`}
        <button type="button" class="card-wish-btn ${wished ? 'wished' : ''}" data-wish-id="${escHtml(wishId)}" style="top:14px;right:14px;" aria-label="Lưu yêu thích" onclick="event.stopPropagation(); window.toggleBuildWish(${i})">${heartSvg}</button>
        <span class="build-badge">${escHtml(b.badge)}</span>
        <span class="build-index">${String(i + 1).padStart(2, '0')} / ${String(SIGNATURE_BUILDS.length).padStart(2, '0')}</span>
      </div>
      <div class="build-body">
        <div class="build-name">${escHtml(b.name)}</div>
        <div class="build-specs">
          <div class="build-spec">${SITE_SVGS.cpu}<span data-spec="0">${escHtml(t.specs.cpu)}</span></div>
          <div class="build-spec">${SITE_SVGS.gpu}<span data-spec="1">${escHtml(t.specs.gpu)}</span></div>
          <div class="build-spec">${SITE_SVGS.bars}<span data-spec="2">${escHtml(t.specs.ram)}</span></div>
          <div class="build-spec">${SITE_SVGS.decorBox}<span data-spec="3">${escHtml(t.specs.decor)}</span></div>
        </div>
        <div class="build-tier" role="tablist">
          ${b.tiers.map((tt, k) => `<button class="${k === buildTierState[i] ? 'active' : ''}" onclick="setBuildTier(${i}, ${k})">${escHtml(tt.label)}</button>`).join('')}
        </div>
        <div class="build-fps">
          <div class="build-fps-head">${SITE_SVGS.gpu}<span>FPS ước tính • 2K Ultra</span></div>
          ${FPS_GAMES.map((g, k) => `
            <div class="fps-row"><span>${g}</span><div class="fps-bar"><i data-fps="${k}" style="width:${Math.min(100, t.fps[k] / FPS_MAX * 100)}%"></i></div><span class="fps-val" data-fpsv="${k}">${t.fps[k]}</span></div>
          `).join('')}
        </div>
        <div class="build-bottom">
          <div>
            <div class="build-old" data-old>${vnd(t.old)}</div>
            <div class="build-price" data-price>${vnd(t.price)}</div>
          </div>
          <div class="build-actions">
            <button class="btn-detail" onclick="openBuildDetail(${i})">${TTG_SVGS.chevrons}<span>Chi tiết</span></button>
            <button class="btn-cart" onclick="addBuildToCart(${i})">${TTG_SVGS.cart}<span>Thêm</span></button>
          </div>
        </div>
      </div>
    </article>`;
}

window.setBuildTier = (i, k) => {
  buildTierState[i] = k;
  const card = document.querySelector(`.build-card[data-idx="${i}"]`);
  if (!card) return;
  const t = SIGNATURE_BUILDS[i].tiers[k];
  card.querySelectorAll('.build-tier button').forEach((b, j) => b.classList.toggle('active', j === k));
  const wishBtn = card.querySelector('.card-wish-btn');
  if (wishBtn) {
    wishBtn.setAttribute('data-wish-id', t.catalogId || `build:${i}:${k}`);
    if (window.S25) window.S25.syncHeaderAuthAndWish();
  }
  card.querySelector('[data-price]').textContent = vnd(t.price);
  card.querySelector('[data-old]').textContent = vnd(t.old);
  const pImg = card.querySelector('[data-pimg]');
  const aImg = card.querySelector('[data-aimg]');
  const hasAlt = Boolean(t.altImg && t.altImg !== t.img);
  if (pImg) {
    pImg.src = t.img;
    pImg.classList.toggle('has-alt', hasAlt);
  }
  if (aImg) aImg.src = t.altImg || t.img;
  const specVals = [t.specs.cpu, t.specs.gpu, t.specs.ram, t.specs.decor];
  specVals.forEach((val, idx) => {
    const el = card.querySelector(`[data-spec="${idx}"]`);
    if (el) el.textContent = val;
  });
  FPS_GAMES.forEach((_, g) => {
    card.querySelector(`[data-fps="${g}"]`).style.width = `${Math.min(100, t.fps[g] / FPS_MAX * 100)}%`;
    card.querySelector(`[data-fpsv="${g}"]`).textContent = t.fps[g];
  });
};

window.openBuildDetail = (i) => {
  const b = SIGNATURE_BUILDS[i];
  if (!b) return;
  const t = b.tiers[buildTierState[i] || 0];
  if (t && t.catalogId) {
    window.location.href = `./product.html?id=${encodeURIComponent(t.catalogId)}&cat=pc`;
  } else {
    window.location.href = `./product.html?name=${encodeURIComponent((t && t.name) || b.name)}&cat=pc`;
  }
};

// Hydrate Section 1 Dynamic Kicker & Category Explorer Strip (routes directly to shop.html)
(function renderSec1CatStrip() {
  const kickerEl = document.getElementById('sec1Kicker');
  const totalCatalog = CAT_COUNTS.ALL || CATALOG_ITEMS.length;
  if (kickerEl) {
    kickerEl.textContent = `01 // Kho Linh Kiện & Decor — ${totalCatalog.toLocaleString('vi-VN')} Sản Phẩm`;
  }
  const stripEl = document.getElementById('sec1CatStrip');
  if (!stripEl) return;
  stripEl.innerHTML = MAIN_CATEGORIES.map((cat) => {
    const cnt = CAT_COUNTS[cat.key] || 0;
    const isAll = cat.key === 'ALL';
    const href = `./shop.html?cat=${encodeURIComponent(cat.key)}${isAll ? '&focus=search' : ''}`;
    return `
      <a class="s25-cat-chip ${isAll ? 'cta' : ''}" href="${href}">
        ${SITE_SVGS[cat.svgKey] || SITE_SVGS.orbit}
        <span>${cat.short}</span>
        <small>${cnt.toLocaleString('vi-VN')}</small>
      </a>`;
  }).join('');
})();

const POLICIES = [
  { icon: SITE_SVGS.mainboard, t: 'Miễn phí lắp ráp', s: 'Đi dây gọn, test 24h' },
  { icon: TTG_SVGS.history, t: 'Bảo hành 36 tháng', s: '1 đổi 1 trong 30 ngày' },
  { icon: TTG_SVGS.location, t: 'Giao nhanh 2h', s: 'Nội thành Hà Nội & HCM' },
  { icon: TTG_SVGS.map, t: 'Trả góp 0%', s: 'Duyệt hồ sơ 15 phút' },
  { icon: TTG_SVGS.phone, t: 'Tư vấn 1:1', s: 'Kỹ thuật viên 8h–22h' }
];

export const sec1EdEl = document.getElementById('sec1Editorial');
export const sec2BuildsEl = document.getElementById('sec2Builds');
const sec1Track = document.getElementById('sec1Track');
const sec1Wrap = document.getElementById('sec1Wrap');
const sec1Prog = document.getElementById('sec1Prog');
sec1Track.innerHTML = SIGNATURE_BUILDS.map(buildCardHtml).join('');
document.getElementById('sec1Policies').innerHTML = POLICIES.map(p => `<div class="policy">${p.icon}<div><b>${p.t}</b><small>${p.s}</small></div></div>`).join('');

window.toggleBuildWish = (i) => {
  const b = SIGNATURE_BUILDS[i];
  if (!b || !window.S25) return;
  const t = b.tiers[buildTierState[i] || 0];
  const wid = t.catalogId || `build:${i}:${buildTierState[i] || 0}`;
  window.S25.toggleWish({ id: wid, name: t.name || b.name, sub: `${b.badge} • ${t.label}`, priceNum: t.price, img: t.img });
};

if (window.S25) {
  window.S25.renderFooter(document.getElementById('s25FooterHost'));
  window.S25.syncHeaderAuthAndWish();
}

// Draggable carousel aligned to Section 2 left margin + inertia + spotlight
const sec1HeadEl = sec2BuildsEl ? sec2BuildsEl.querySelector('.sec1-head') : null;
let sec1LastX = 0;
let sec1Moved = 0;
function sec1Bounds() {
  const cards = sec1Track.children;
  if (!cards.length) return { min: 0, max: 0, step: 1, offset: 0 };
  const cardW = cards[0].offsetWidth;
  const step = cardW + 28;
  let offset = 24;
  if (sec1HeadEl && sec1Wrap) {
    const headRect = sec1HeadEl.getBoundingClientRect();
    const wrapRect = sec1Wrap.getBoundingClientRect();
    const padLeft = parseFloat(getComputedStyle(sec1HeadEl).paddingLeft) || 0;
    offset = Math.max(16, (headRect.left - wrapRect.left) + padLeft);
  }
  const trackW = cardW * cards.length + 28 * Math.max(0, cards.length - 1);
  const rightBound = sec1Wrap ? (sec1Wrap.clientWidth - trackW - offset) : (offset - step * (cards.length - 1));
  return { min: Math.min(offset, rightBound), max: offset, step, offset };
}
export function sec1SnapTo(idx) {
  const b = sec1Bounds();
  homeState.sec1Spot = Math.max(0, Math.min(SIGNATURE_BUILDS.length - 1, idx));
  homeState.sec1TargetX = Math.max(b.min, Math.min(b.max, b.offset - homeState.sec1Spot * b.step));
}
window.sec1Step = (d) => sec1SnapTo(homeState.sec1Spot + d);

sec1Wrap.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  homeState.sec1Dragging = true; sec1LastX = e.clientX; sec1Moved = 0; homeState.sec1Vel = 0;
  sec1Wrap.classList.add('dragging');
  sec1Wrap.setPointerCapture(e.pointerId);
});
sec1Wrap.addEventListener('pointermove', (e) => {
  if (!homeState.sec1Dragging) return;
  const dx = e.clientX - sec1LastX;
  sec1LastX = e.clientX;
  sec1Moved += Math.abs(dx);
  homeState.sec1TargetX += dx; homeState.sec1X += dx; homeState.sec1Vel = dx;
});
const endSec1Drag = (e) => {
  if (!homeState.sec1Dragging) return;
  homeState.sec1Dragging = false;
  sec1Wrap.classList.remove('dragging');
  if (sec1Moved < 6 && e && e.target) {
    const clickedCard = e.target.closest('.build-card');
    if (clickedCard && !e.target.closest('button')) {
      sec1SnapTo(Number(clickedCard.dataset.idx));
      return;
    }
  }
  const b = sec1Bounds();
  const projected = homeState.sec1TargetX + homeState.sec1Vel * 14;
  if (projected <= b.min + 4) {
    sec1SnapTo(SIGNATURE_BUILDS.length - 1);
  } else {
    sec1SnapTo(Math.round((b.offset - projected) / b.step));
  }
};
sec1Wrap.addEventListener('pointerup', endSec1Drag);
sec1Wrap.addEventListener('pointercancel', endSec1Drag);
window.addEventListener('resize', () => {
  sec1SnapTo(homeState.sec1Spot);
  if (!homeState.sec1Dragging) homeState.sec1X = homeState.sec1TargetX;
});

export function tickSec1() {
  if (!sec2BuildsEl) return;
  if (!homeState.sec1Dragging) homeState.sec1X += (homeState.sec1TargetX - homeState.sec1X) * Math.min(1, 0.14 * homeState.globalTickScale);
  sec1Track.style.transform = `translate3d(${homeState.sec1X.toFixed(2)}px,0,0)`;
  const b = sec1Bounds();
  const live = homeState.sec1Dragging
    ? Math.max(0, Math.min(SIGNATURE_BUILDS.length - 1, Math.round((b.offset - homeState.sec1X) / b.step)))
    : homeState.sec1Spot;
  [...sec1Track.children].forEach((c, i) => c.classList.toggle('spot', i === live));
  const w = 100 / SIGNATURE_BUILDS.length;
  sec1Prog.style.width = `${w}%`;
  sec1Prog.style.transform = `translateX(${live * 100}%)`;
}

window.addBuildToCart = (i) => {
  const b = SIGNATURE_BUILDS[i];
  if (!b) return;
  const t = b.tiers[buildTierState[i] || 0];
  if (t && t.catalogId && CATALOG_BY_ID[t.catalogId]) {
    window.addCatalogProductToCart(t.catalogId);
    return;
  }
  pushItemToCart({
    id: `build:${i}:${buildTierState[i] || 0}`,
    name: `${b.name} (${t.label})`,
    sub: `${t.specs.cpu} • ${t.specs.gpu}`,
    priceNum: t.price
  });
};

