/* ============================================================================
   S25 // SKYCRUMB — SECTION 3 (CUSTOM PC BUILDER STUDIO)
   ============================================================================ */

import {
  SITE_SVGS,
  TTG_SVGS,
  SHARED_IMG_HARDWARE,
  GROUPS_CONFIG,
  escHtml,
  normalizeVi
} from './config.js';
import { GROUP_COUNTS, ensureFullCatalogLoaded } from './catalog-store.js';
import { parseVndPrice, pushItemToCart } from './drawer-cart.js';

let builderLinkageHook = null;
export function setBuilderLinkageHook(fn) {
  builderLinkageHook = typeof fn === 'function' ? fn : null;
}

// =========================================================================
// 11B. SECTION 3 — CUSTOM PC & DECOR STUDIO ENGINE
// =========================================================================
export const sec3BuilderEl = document.getElementById('sec3Builder');
const sec3CatsEl = document.getElementById('sec3Cats');
const sec3OptionsEl = document.getElementById('sec3Options');
const sec3OptionsTrayEl = document.getElementById('sec3OptionsTray');
const sec3TraySentinelEl = document.getElementById('sec3TraySentinel');
const sec3PagerEl = document.getElementById('sec3Pager');
const sec3SummaryEl = document.getElementById('sec3Summary');
const sec3SearchInputEl = document.getElementById('sec3SearchInput');
const sec3SearchClearEl = document.getElementById('sec3SearchClear');
const sec3SortSelectEl = document.getElementById('sec3SortSelect');
const sec3ResultCountEl = document.getElementById('sec3ResultCount');

const SEC3_BATCH_SIZE = 16;
export const BUILD_CAT_ORDER = [
  'Group_Case', 'Group_GPU', 'Group_CPU', 'Group_Mainboard',
  'Group_Cooling', 'Group_RAM', 'Group_SSD', 'Group_PSU'
];
const BUILD_CAT_LABELS = {
  Group_Case: 'Vỏ Case',
  Group_GPU: 'Card GPU',
  Group_CPU: 'CPU',
  Group_Mainboard: 'Mainboard',
  Group_Cooling: 'Tản nhiệt',
  Group_RAM: 'RAM',
  Group_SSD: 'SSD',
  Group_PSU: 'Nguồn PSU'
};

let activeBuilderCat = 'Group_GPU';
let builderSearch = '';
let builderSort = 'default';
let builderVisibleCount = SEC3_BATCH_SIZE;
let builderCurrentPool = [];
export const builderSelectedItem = {};

function getBuilderPoolForCat(catId) {
  const cfg = GROUPS_CONFIG[catId];
  if (!cfg) return [];
  const rawList = (cfg.catalogItems && cfg.catalogItems.length) ? cfg.catalogItems : [];
  if (rawList.length) {
    return rawList.map((item) => ({
      catalogId: item.id,
      badge: item.d || item.sc || BUILD_CAT_LABELS[catId],
      name: item.n,
      specs: (item.sp && item.sp[0]) ? item.sp[0] : `${item._catLabel} • ${item.sc}`,
      price: item.p > 0 ? item.ps : 'Liên hệ',
      priceNum: item.p || 0,
      st: item.st,
      img: item._imgs[0],
      altImg: item._imgs[1] || item._imgs[0],
      _q: item._q || normalizeVi(`${item.id} ${item.n} ${item.sc}`)
    }));
  }
  return (cfg.products || []).map((prod, idx) => ({
    catalogId: prod.catalogId || `${catId}:${idx}`,
    badge: prod.badge || BUILD_CAT_LABELS[catId],
    name: prod.name,
    specs: prod.specs || cfg.title,
    price: prod.price || 'Liên hệ',
    priceNum: parseVndPrice(prod.price),
    st: 1,
    img: prod.img || cfg.sharedImg,
    altImg: prod.altImg || prod.img || cfg.sharedImg,
    _q: normalizeVi(`${prod.name} ${prod.specs || ''} ${prod.badge || ''}`)
  }));
}

export function ensureBuilderSelectionSeeded() {
  BUILD_CAT_ORDER.forEach((catId) => {
    if (!builderSelectedItem[catId]) {
      const pool = getBuilderPoolForCat(catId);
      if (pool.length) builderSelectedItem[catId] = pool[0];
    }
  });
}
ensureBuilderSelectionSeeded();

function resetSec3TrayScroll() {
  builderVisibleCount = SEC3_BATCH_SIZE;
  if (sec3OptionsTrayEl) sec3OptionsTrayEl.scrollTop = 0;
}

window.setBuilderCat = (catId) => {
  if (!GROUPS_CONFIG[catId] || !BUILD_CAT_ORDER.includes(catId)) return;
  ensureFullCatalogLoaded();
  activeBuilderCat = catId;
  builderSearch = '';
  resetSec3TrayScroll();
  if (sec3SearchInputEl) sec3SearchInputEl.value = '';
  if (sec3SearchClearEl) sec3SearchClearEl.classList.remove('visible');
  renderSec3Builder();
};

window.loadMoreSec3Items = () => {
  ensureFullCatalogLoaded();
  if (builderVisibleCount >= builderCurrentPool.length) return false;
  const activeCfg = GROUPS_CONFIG[activeBuilderCat];
  if (!activeCfg || !sec3OptionsEl) return false;
  const prevCount = builderVisibleCount;
  builderVisibleCount = Math.min(builderCurrentPool.length, prevCount + SEC3_BATCH_SIZE);
  const nextSlice = builderCurrentPool.slice(prevCount, builderVisibleCount);
  if (nextSlice.length) {
    const selObj = builderSelectedItem[activeBuilderCat];
    const selKey = selObj ? String(selObj.catalogId || selObj.name) : '';
    sec3OptionsEl.insertAdjacentHTML('beforeend', nextSlice.map((p) => renderSec3CardHtml(p, activeCfg, selKey)).join(''));
    renderSec3TrayBar(builderVisibleCount, builderCurrentPool.length);
  }
  return true;
};

window.scrollSec3TrayTop = () => {
  if (sec3OptionsTrayEl) sec3OptionsTrayEl.scrollTo({ top: 0, behavior: 'smooth' });
};

window.pickBuilderOpt = (catId, encodedKey) => {
  const key = decodeURIComponent(encodedKey || '');
  const pool = getBuilderPoolForCat(catId);
  const found = pool.find((p) => String(p.catalogId) === key || p.name === key);
  if (found) builderSelectedItem[catId] = found;
  if (catId === activeBuilderCat && sec3OptionsEl) {
    const selObj = builderSelectedItem[catId];
    const selKey = selObj ? String(selObj.catalogId || selObj.name) : '';
    sec3OptionsEl.querySelectorAll('.sec3-opt').forEach((card) => {
      const isMatch = card.getAttribute('data-opt-key') === selKey;
      card.classList.toggle('selected', isMatch);
      const stEl = card.querySelector('.sec3-opt-state');
      if (stEl) stEl.textContent = isMatch ? 'Đang chọn' : 'Chọn';
    });
    renderSec3SummaryPanel();
    return;
  }
  renderSec3Builder();
};

window.addBuilderSetToCart = () => {
  ensureBuilderSelectionSeeded();
  let addedCount = 0;
  for (const catId of BUILD_CAT_ORDER) {
    const cfg = GROUPS_CONFIG[catId];
    const prod = builderSelectedItem[catId];
    if (!prod) continue;
    pushItemToCart({
      id: prod.catalogId || `${catId}:${prod.name}`,
      name: prod.name,
      sub: BUILD_CAT_LABELS[catId] || (cfg ? cfg.title : catId),
      priceNum: prod.priceNum || parseVndPrice(prod.price)
    });
    addedCount++;
  }
  const noteEl = document.getElementById('sec3CartNote');
  if (noteEl) noteEl.textContent = `Đã thêm ${addedCount} món vào Giỏ hàng.`;
};

function estimateBuilderTelemetry() {
  ensureBuilderSelectionSeeded();
  const gpuName = (builderSelectedItem.Group_GPU?.name || '').toUpperCase();
  const cpuName = (builderSelectedItem.Group_CPU?.name || '').toUpperCase();
  const ramName = (builderSelectedItem.Group_RAM?.name || '').toUpperCase();

  let gpuW = 240, fpsVal = 460, fpsWu = 112;
  let vramLabel = '12GB VRAM', fpsWukong = 66, fpsCp = 56, fpsAw2 = 72;
  let gpuCreative = 76, gpuAi = 72, fluxSpeed = '~3.4s / ảnh', llmBase = 36, llmFit = 'Qwen / Llama 8B';
  if (/5090|4090/.test(gpuName)) {
    gpuW = 450; fpsVal = 690; fpsWu = 195; vramLabel = '24–32GB VRAM';
    fpsWukong = 118; fpsCp = 106; fpsAw2 = 124;
    gpuCreative = 97; gpuAi = 99; fluxSpeed = '~1.1s / ảnh'; llmBase = 86; llmFit = 'Qwen / Llama 32B';
  } else if (/5080|4080|7900\s*XTX/.test(gpuName)) {
    gpuW = 360; fpsVal = 640; fpsWu = 172; vramLabel = '16–24GB VRAM';
    fpsWukong = 98; fpsCp = 89; fpsAw2 = 105;
    gpuCreative = 92; gpuAi = 92; fluxSpeed = '~1.6s / ảnh'; llmBase = 68; llmFit = 'Qwen / Llama 14B';
  } else if (/5070\s*TI|4070\s*TI|7900\s*XT|7900\s*GRE|9070\s*XT/.test(gpuName)) {
    gpuW = 300; fpsVal = 590; fpsWu = 150; vramLabel = '16GB VRAM';
    fpsWukong = 86; fpsCp = 76; fpsAw2 = 92;
    gpuCreative = 86; gpuAi = 85; fluxSpeed = '~2.2s / ảnh'; llmBase = 55; llmFit = 'Qwen / Llama 14B';
  } else if (/5070|4070|7800|9070/.test(gpuName)) {
    gpuW = 250; fpsVal = 530; fpsWu = 132; vramLabel = '12GB VRAM';
    fpsWukong = 74; fpsCp = 64; fpsAw2 = 81;
    gpuCreative = 80; gpuAi = 77; fluxSpeed = '~2.9s / ảnh'; llmBase = 44; llmFit = 'Qwen / Llama 8B';
  } else if (/5060|4060|3060|7600|7700|6700/.test(gpuName)) {
    gpuW = 185; fpsVal = 410; fpsWu = 98; vramLabel = '8–12GB VRAM';
    fpsWukong = 58; fpsCp = 48; fpsAw2 = 65;
    gpuCreative = 70; gpuAi = 65; fluxSpeed = '~4.5s / ảnh'; llmBase = 28; llmFit = 'Llama 8B Q4';
  } else if (/3050|1660|1650/.test(gpuName)) {
    gpuW = 130; fpsVal = 310; fpsWu = 68; vramLabel = '6–8GB VRAM';
    fpsWukong = 42; fpsCp = 34; fpsAw2 = 49;
    gpuCreative = 58; gpuAi = 46; fluxSpeed = '~7.8s / ảnh'; llmBase = 16; llmFit = 'Llama 3B / 7B';
  }

  let cpuW = 140, cpuBonus = 0, cpuEditBonus = 3, cpuAiBonus = 2;
  if (/9950|9800X3D|7800X3D|14900|285K|ULTRA 9|7950/.test(cpuName)) { cpuW = 210; cpuBonus = 45; cpuEditBonus = 10; cpuAiBonus = 5; }
  else if (/14700|265K|ULTRA 7|9700X|7700X|7900|13700/.test(cpuName)) { cpuW = 175; cpuBonus = 24; cpuEditBonus = 6; cpuAiBonus = 3; }
  else if (/14600|13600|245K|ULTRA 5|9600|7600|12600|5700/.test(cpuName)) { cpuW = 135; cpuBonus = 12; cpuEditBonus = 2; cpuAiBonus = 1; }
  else if (/12400|13400|14400|5600|7500|12100/.test(cpuName)) { cpuW = 95; cpuBonus = 0; cpuEditBonus = -3; cpuAiBonus = -2; }

  let ramBonus = 2;
  if (/64GB|96GB|128GB/.test(ramName)) ramBonus = 7;
  else if (/32GB/.test(ramName)) ramBonus = 4;
  else if (/16GB/.test(ramName)) ramBonus = -5;

  const clamp = (n, lo = 35, hi = 99) => Math.max(lo, Math.min(hi, Math.round(n)));
  const recPsuW = Math.ceil((gpuW + cpuW + 150) / 50) * 50;
  const wukong = Math.round(fpsWukong + cpuBonus * 0.25);
  const cp2077 = Math.round(fpsCp + cpuBonus * 0.22);
  const aw2 = Math.round(fpsAw2 + cpuBonus * 0.28);

  const editScore = clamp(gpuCreative + cpuEditBonus * 0.6 + ramBonus);
  const render3dScore = clamp(gpuCreative * 0.85 + 10 + cpuEditBonus * 0.9 + ramBonus * 0.5);
  const aiGenScore = clamp(gpuAi + cpuAiBonus * 0.5 + ramBonus * 0.3);
  const llmScore = clamp(llmBase + (ramBonus > 4 ? 8 : 0), 25, 98);
  const avgScore = Math.round((Math.min(100, wukong * 0.95) + editScore + aiGenScore) / 3);

  let tierBadge = 'Cân bằng Gaming & Work';
  let aaaBadge = '2K High–Ultra Mượt';
  let editLabel = 'Dựng 4K Mượt';
  let render3dLabel = 'Blender / UE5 Tốt';
  let summaryNote = 'Cân bằng tốt cho game AAA 2K, edit video Premiere/DaVinci 4K và chạy AI cục bộ vừa.';
  if (avgScore >= 90) {
    tierBadge = 'Flagship Studio & AI';
    aaaBadge = '2K/4K Max + Ray Tracing';
    editLabel = '8K/4K RAW Real-time';
    render3dLabel = 'OptiX / UE5 Tức thì';
    summaryNote = 'Sức mạnh đầu bảng: cân trọn game AAA max setting Ray Tracing, render 4K/8K RAW và train/chạy AI Flux, LLM local.';
  } else if (avgScore >= 80) {
    tierBadge = 'High-End Creator & AAA';
    aaaBadge = '2K Ultra RT 60–100+ FPS';
    editLabel = '4K 10-bit Đa lớp Mượt';
    render3dLabel = 'Cycles / Octane Nhanh';
    summaryNote = 'Chiến mượt mọi tựa game AAA độ phân giải 2K Ultra + Ray Tracing, xuất video 4K nhanh và xử lý Stable Diffusion/LLM ổn định.';
  } else if (avgScore < 66) {
    tierBadge = '1080p Pro & Văn phòng';
    aaaBadge = 'Full HD Medium–High';
    editLabel = '1080p / 2K Cơ bản';
    render3dLabel = 'Đồ họa 2D / 3D Nhẹ';
    summaryNote = 'Phù hợp game AAA Full HD, Photoshop/CapCut/Premiere Full HD và tác vụ AI nhẹ trên GPU.';
  }

  return {
    recPsuW,
    fpsVal: fpsVal + cpuBonus,
    fpsWu: fpsWu + Math.round(cpuBonus / 4),
    vramLabel,
    tierBadge,
    aaaBadge,
    fpsWukong: wukong,
    fpsCp: cp2077,
    fpsAw2: aw2,
    editScore,
    editLabel,
    render3dScore,
    render3dLabel,
    aiGenScore,
    fluxSpeed,
    llmFit,
    llmScore,
    summaryNote
  };
}

if (sec3SearchInputEl) {
  let s3Timer = null;
  sec3SearchInputEl.addEventListener('focus', () => ensureFullCatalogLoaded());
  sec3SearchInputEl.addEventListener('input', (e) => {
    ensureFullCatalogLoaded();
    builderSearch = e.target.value || '';
    resetSec3TrayScroll();
    if (sec3SearchClearEl) sec3SearchClearEl.classList.toggle('visible', Boolean(builderSearch));
    clearTimeout(s3Timer);
    s3Timer = setTimeout(() => renderSec3Builder(), 100);
  });
}
if (sec3SearchClearEl) {
  sec3SearchClearEl.addEventListener('click', () => {
    builderSearch = '';
    resetSec3TrayScroll();
    if (sec3SearchInputEl) { sec3SearchInputEl.value = ''; sec3SearchInputEl.focus(); }
    sec3SearchClearEl.classList.remove('visible');
    renderSec3Builder();
  });
}
if (sec3SortSelectEl) {
  sec3SortSelectEl.addEventListener('change', (e) => {
    ensureFullCatalogLoaded();
    builderSort = e.target.value || 'default';
    resetSec3TrayScroll();
    renderSec3Builder();
  });
}

function renderSec3TrayBar(shownCount, totalMatched) {
  if (sec3TraySentinelEl) {
    sec3TraySentinelEl.style.display = (shownCount < totalMatched) ? 'block' : 'none';
  }
  if (!sec3PagerEl) return;
  if (!totalMatched) {
    sec3PagerEl.innerHTML = '';
    return;
  }
  const hasMore = shownCount < totalMatched;
  const hint = hasMore
    ? `Hiển thị ${shownCount.toLocaleString('vi-VN')} / ${totalMatched.toLocaleString('vi-VN')} linh kiện • Cuộn chuột trong khay để xem tiếp`
    : `Đã hiển thị đủ ${totalMatched.toLocaleString('vi-VN')} linh kiện`;
  const actions = [];
  if (hasMore) {
    actions.push(`<button type="button" class="sec3-page-btn primary" onclick="loadMoreSec3Items()">+Xem thêm ${Math.min(SEC3_BATCH_SIZE, totalMatched - shownCount)} món</button>`);
  }
  if (sec3OptionsTrayEl && sec3OptionsTrayEl.scrollTop > 120) {
    actions.push(`<button type="button" class="sec3-page-btn" onclick="scrollSec3TrayTop()">↑ Đầu khay</button>`);
  }
  sec3PagerEl.innerHTML = `<span class="sec3-page-info">${hint}</span><div class="sec3-tray-actions">${actions.join('')}</div>`;
}

function renderSec3CardHtml(prod, activeCfg, selKey) {
  const optKey = String(prod.catalogId || prod.name);
  const isSel = selKey === optKey;
  const img0 = prod.img || activeCfg.sharedImg;
  const img1 = prod.altImg || img0;
  const detailHref = prod.catalogId
    ? `./product.html?id=${encodeURIComponent(prod.catalogId)}`
    : `./product.html?name=${encodeURIComponent(prod.name)}`;
  return `
    <div role="button" tabindex="0" class="sec3-opt ${isSel ? 'selected' : ''}" data-opt-key="${escHtml(optKey)}" onclick="pickBuilderOpt('${activeBuilderCat}', '${encodeURIComponent(optKey)}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pickBuilderOpt('${activeBuilderCat}', '${encodeURIComponent(optKey)}');}">
      <div class="sec3-opt-media">
        <img class="primary-img" src="${escHtml(img0)}" alt="${escHtml(prod.name)}" loading="lazy" decoding="async" />
        <img class="alt-img" src="${escHtml(img1)}" alt="${escHtml(prod.name)} góc khác" loading="lazy" decoding="async" />
        <span class="sec3-opt-badge">${escHtml(prod.badge)}</span>
      </div>
      <div class="sec3-opt-body">
        <div class="sec3-opt-name">${escHtml(prod.name)}</div>
        <div class="sec3-opt-specs">${escHtml(prod.specs)}</div>
        <div class="sec3-opt-foot">
          <span class="sec3-opt-price">${escHtml(prod.price)}</span>
          <div class="sec3-opt-actions">
            <a class="detail-mini-btn" href="${detailHref}" onclick="event.stopPropagation()">Chi tiết</a>
            <span class="sec3-opt-state">${isSel ? 'Đang chọn' : 'Chọn'}</span>
          </div>
        </div>
      </div>
    </div>`;
}

export function renderSec3Builder() {
  if (!sec3CatsEl || !sec3OptionsEl || !sec3SummaryEl) return;
  ensureBuilderSelectionSeeded();

  sec3CatsEl.innerHTML = BUILD_CAT_ORDER.map((catId) => {
    const cfg = GROUPS_CONFIG[catId];
    if (!cfg) return '';
    return `
      <button class="sec3-cat-btn ${activeBuilderCat === catId ? 'active' : ''}" onclick="setBuilderCat('${catId}')">
        ${SITE_SVGS[cfg.svgKey] || SITE_SVGS.orbit}
        <span>${BUILD_CAT_LABELS[catId]}</span>
      </button>`;
  }).join('');

  const activeCfg = GROUPS_CONFIG[activeBuilderCat];
  if (activeCfg) {
    let pool = getBuilderPoolForCat(activeBuilderCat);
    const terms = normalizeVi(builderSearch).split(/\s+/).filter(Boolean);
    if (terms.length) {
      pool = pool.filter((item) => {
        for (let i = 0; i < terms.length; i++) {
          if (!item._q.includes(terms[i])) return false;
        }
        return true;
      });
    }
    if (builderSort === 'price-asc') {
      pool = [...pool].sort((a, b) => (a.priceNum || 9e12) - (b.priceNum || 9e12));
    } else if (builderSort === 'price-desc') {
      pool = [...pool].sort((a, b) => (b.priceNum || 0) - (a.priceNum || 0));
    } else if (builderSort === 'name-asc') {
      pool = [...pool].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    }

    const totalPoolCount = (!terms.length && GROUP_COUNTS[activeBuilderCat])
      ? Math.max(pool.length, GROUP_COUNTS[activeBuilderCat])
      : pool.length;
    if (sec3ResultCountEl) {
      sec3ResultCountEl.textContent = `${totalPoolCount.toLocaleString('vi-VN')} linh kiện`;
    }

    builderCurrentPool = pool;
    const selObj = builderSelectedItem[activeBuilderCat];
    const selKey = selObj ? String(selObj.catalogId || selObj.name) : '';
    const totalMatched = pool.length;
    builderVisibleCount = Math.max(SEC3_BATCH_SIZE, Math.min(totalMatched, builderVisibleCount));
    const shown = pool.slice(0, builderVisibleCount);

    if (!shown.length) {
      sec3OptionsEl.innerHTML = `
        <div style="grid-column:1/-1;padding:34px 20px;border-radius:20px;background:var(--drawer-card-bg);border:1px dashed var(--glass-border);text-align:center;">
          <div style="font-weight:800;font-size:0.95rem;margin-bottom:6px;">Không tìm thấy linh kiện khớp "${escHtml(builderSearch)}"</div>
          <div style="font-size:0.8rem;color:var(--text-muted);">Thử từ khóa khác hoặc mở kho đầy đủ tại trang Cửa hàng.</div>
        </div>`;
      renderSec3TrayBar(0, 0);
    } else {
      sec3OptionsEl.innerHTML = shown.map((prod) => renderSec3CardHtml(prod, activeCfg, selKey)).join('');
      renderSec3TrayBar(shown.length, totalMatched);
    }
  }
  renderSec3SummaryPanel();
}

function renderSec3SummaryPanel() {
  if (!sec3SummaryEl) return;
  ensureBuilderSelectionSeeded();

  let totalPrice = 0;
  let totalCount = 0;
  const slotHtml = BUILD_CAT_ORDER.map((catId) => {
    const prod = builderSelectedItem[catId];
    if (!prod) return '';
    totalPrice += prod.priceNum || parseVndPrice(prod.price);
    totalCount++;
    const slotImg = prod.img || (GROUPS_CONFIG[catId] && GROUPS_CONFIG[catId].sharedImg) || SHARED_IMG_HARDWARE;
    return `
      <div class="sec3-slot" onclick="setBuilderCat('${catId}')" title="Nhấn để đổi ${BUILD_CAT_LABELS[catId]}">
        <img class="sec3-slot-thumb" src="${escHtml(slotImg)}" alt="${escHtml(prod.name)}" loading="lazy" />
        <div class="sec3-slot-left">
          <div class="sec3-slot-cat">${BUILD_CAT_LABELS[catId]}</div>
          <div class="sec3-slot-name">${escHtml(prod.name)}</div>
        </div>
        <div class="sec3-slot-price">${escHtml(prod.price)}</div>
      </div>`;
  }).join('');

  const tel = estimateBuilderTelemetry();
  const fpsPct = (f) => Math.max(25, Math.min(100, Math.round((f / 120) * 100)));
  sec3SummaryEl.innerHTML = `
    <div class="sec3-sum-top">
      <div class="sec3-sum-title">Cấu Hình Đang Phối</div>
      <span class="sec3-sum-pill">${totalCount} món</span>
    </div>
    <div class="sec3-slot-list">${slotHtml}</div>
    <div class="sec3-telemetry">
      <div class="sec3-tel-item"><small>Nguồn khuyến nghị</small><b>${tel.recPsuW}W Gold+</b></div>
      <div class="sec3-tel-item"><small>2K Ultra Dự Kiến</small><b>${tel.fpsVal} / ${tel.fpsWu} FPS</b></div>
    </div>
    <div class="sec3-perf-card" id="sec3PerfCard" aria-label="Đánh giá hiệu năng Game AAA, Chỉnh sửa và AI">
      <div class="sec3-perf-head">
        <span class="sec3-perf-title">Đánh Giá Hiệu Năng</span>
        <span class="sec3-perf-tier">${tel.tierBadge}</span>
      </div>
      <div class="sec3-perf-verdict">${tel.summaryNote}</div>
      <div class="sec3-perf-groups">
        <div class="sec3-perf-group">
          <div class="sec3-perf-ghead">
            <span class="sec3-perf-gtitle"><i></i>Game AAA (2K / Ray Tracing)</span>
            <span class="sec3-perf-gbadge">${tel.aaaBadge}</span>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>Black Myth: Wukong (2K Ultra)</span><b>~${tel.fpsWukong} FPS</b></div>
            <div class="sec3-perf-bar"><i style="width:${fpsPct(tel.fpsWukong)}%"></i></div>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>Cyberpunk 2077 (2K RT Ultra)</span><b>~${tel.fpsCp} FPS</b></div>
            <div class="sec3-perf-bar"><i style="width:${fpsPct(tel.fpsCp)}%"></i></div>
          </div>
        </div>
        <div class="sec3-perf-group">
          <div class="sec3-perf-ghead">
            <span class="sec3-perf-gtitle"><i></i>Phần mềm Chỉnh sửa &amp; 3D</span>
            <span class="sec3-perf-gbadge">${tel.editLabel}</span>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>Premiere / DaVinci Resolve</span><b>${tel.editScore}/100</b></div>
            <div class="sec3-perf-bar"><i style="width:${tel.editScore}%"></i></div>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>After Effects / Blender (${tel.render3dLabel})</span><b>${tel.render3dScore}/100</b></div>
            <div class="sec3-perf-bar"><i style="width:${tel.render3dScore}%"></i></div>
          </div>
        </div>
        <div class="sec3-perf-group">
          <div class="sec3-perf-ghead">
            <span class="sec3-perf-gtitle"><i></i>AI Chuyên Dụng (${tel.vramLabel})</span>
            <span class="sec3-perf-gbadge">${tel.fluxSpeed}</span>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>Stable Diffusion XL / Flux.1</span><b>${tel.aiGenScore}/100</b></div>
            <div class="sec3-perf-bar"><i style="width:${tel.aiGenScore}%"></i></div>
          </div>
          <div class="sec3-perf-row">
            <div class="sec3-perf-rtop"><span>LLM Local (${tel.llmFit})</span><b>${tel.llmScore}/100</b></div>
            <div class="sec3-perf-bar"><i style="width:${tel.llmScore}%"></i></div>
          </div>
        </div>
      </div>
    </div>
    <div class="sec3-sum-total">
      <span>Tổng cộng</span>
      <b>${totalPrice.toLocaleString('vi-VN')}đ</b>
    </div>
    <div class="sec3-sum-actions">
      <button class="sec3-btn-primary" onclick="addBuilderSetToCart()">${TTG_SVGS.cart}<span>Đưa cả bộ vào Giỏ hàng</span></button>
      <a class="sec3-btn-secondary" href="./shop.html?cat=linh-kien-may-tinh">${SITE_SVGS.expand}<span>Mở kho linh kiện đầy đủ</span></a>
      <div id="sec3CartNote" style="font-size:0.76rem;color:var(--accent);font-weight:700;text-align:center;"></div>
    </div>`;
  if (typeof builderLinkageHook === 'function') builderLinkageHook();
}


renderSec3Builder();

if (sec3OptionsTrayEl) {
  let trayScrollTimer = 0;
  sec3OptionsTrayEl.addEventListener('pointerenter', () => ensureFullCatalogLoaded(), { passive: true });
  sec3OptionsTrayEl.addEventListener('scroll', () => {
    ensureFullCatalogLoaded();
    if (sec3OptionsTrayEl.scrollTop + sec3OptionsTrayEl.clientHeight >= sec3OptionsTrayEl.scrollHeight - 240) {
      loadMoreSec3Items();
    }
    clearTimeout(trayScrollTimer);
    trayScrollTimer = setTimeout(() => {
      renderSec3TrayBar(Math.min(builderVisibleCount, builderCurrentPool.length), builderCurrentPool.length);
    }, 120);
  }, { passive: true });
  if (sec3TraySentinelEl && 'IntersectionObserver' in window) {
    const trayIo = new IntersectionObserver((entries) => {
      if (entries.some((ent) => ent.isIntersecting)) loadMoreSec3Items();
    }, { root: sec3OptionsTrayEl, rootMargin: '220px' });
    trayIo.observe(sec3TraySentinelEl);
  }
}
