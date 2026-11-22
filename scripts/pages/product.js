import {
  PLACEHOLDER_IMAGES,
  CATEGORY_LABEL_MAP,
  escHtml as esc,
  formatSubcatLabel,
  formatSpecText,
  normalizeVi as norm,
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

const LEGACY_DECOR_ALIAS = {
  'decor-1': 'ld-mh0110',
  'decor-2': 'ld-led0015',
  'decor-3': 'ld-mh0564',
  'decor-4': 'ld-mh0444',
  'decor-5': 'ld-dh0024'
};


const ALL_ITEMS = [];
const BY_ID = {};
(function hydrateCatalog() {
  const merged = Array.isArray(window.TTG_CATALOG_DATA) ? window.TTG_CATALOG_DATA : [];
  for (const item of merged) {
    item._catLabel = CATEGORY_LABEL_MAP[item.c] || item.c;
    item._imgs = getProductImgs(item);
    ALL_ITEMS.push(item);
    BY_ID[String(item.id)] = item;
  }
})();

const urlParams = new URLSearchParams(window.location.search);
const reqId = String(urlParams.get('id') || '').trim();
const reqName = String(urlParams.get('name') || '').trim();
const reqCat = String(urlParams.get('cat') || '').trim();

function resolveRequestedProduct() {
  const resolvedId = LEGACY_DECOR_ALIAS[reqId] || reqId;
  if (resolvedId && BY_ID[resolvedId]) return BY_ID[resolvedId];
  if (reqName) {
    const qn = norm(reqName);
    const match = ALL_ITEMS.find((x) => norm(x.n).includes(qn) || qn.includes(norm(x.n)));
    if (match) return match;
  }
  if (reqCat && reqCat !== 'ALL') {
    const matchCat = ALL_ITEMS.find((x) => x.c === reqCat);
    if (matchCat) return matchCat;
  }
  return BY_ID['1072100888'] || ALL_ITEMS[0] || null;
}

const pdpState = {
  item: resolveRequestedProduct(),
  imgs: [],
  photoIdx: 0,
  careIdx: 0,
  toneIdx: 0
};

function renderGalleryStage() {
  const mainImg = document.getElementById('pdpMainImg');
  const safe = Math.max(0, Math.min(pdpState.imgs.length - 1, pdpState.photoIdx));
  pdpState.photoIdx = safe;
  mainImg.src = pdpState.imgs[safe] || SHARED_IMG_HARDWARE;
  mainImg.alt = pdpState.item ? pdpState.item.n : 'Sản phẩm Studio';
  document.getElementById('pdpPhotoCounter').textContent = `${safe + 1} / ${pdpState.imgs.length}`;
  document.querySelectorAll('.s25-pdp-thumb').forEach((btn, idx) => btn.classList.toggle('active', idx === safe));
}

window.stepPdpPhoto = (delta) => {
  if (!pdpState.imgs.length) return;
  pdpState.photoIdx = (pdpState.photoIdx + delta + pdpState.imgs.length) % pdpState.imgs.length;
  renderGalleryStage();
};
window.setPdpPhoto = (idx) => {
  pdpState.photoIdx = idx;
  renderGalleryStage();
};

function addCurrentProductToCart(goCart = false) {
  const item = pdpState.item;
  if (!item || !window.S25) return;
  const careFee = (item.p || 0) >= 8000000 ? 490000 : 250000;
  const fee = pdpState.careIdx > 0 ? careFee : 0;
  const tones = ['Màu gốc NSX', 'Đồng bộ Tông Trắng', 'Đồng bộ Tông Đen'];
  const variantLabel = [
    pdpState.careIdx > 0 ? 'Care+ 1 đổi 1' : '',
    pdpState.toneIdx > 0 ? tones[pdpState.toneIdx] : ''
  ].filter(Boolean).join(' / ');

  const key = variantLabel ? `${item.id}__${variantLabel}` : String(item.id);
  const unitPrice = (item.p || 0) > 0 ? (item.p + fee) : 0;
  const cart = window.S25.getCart();
  const ex = cart.find((x) => x.id === key);
  if (ex) {
    ex.qty = (ex.qty || 1) + 1;
  } else {
    cart.push({
      id: key,
      name: item.n,
      sub: `${item.sc}${item.w ? ' • BH ' + item.w : ''}`,
      priceNum: unitPrice,
      img: pdpState.imgs[0] || SHARED_IMG_HARDWARE,
      qty: 1,
      variant: variantLabel
    });
  }
  window.S25.saveCart(cart);

  const tbBtn = document.getElementById('tbCartBtn');
  if (tbBtn) {
    tbBtn.classList.remove('cart-pulse');
    void tbBtn.offsetWidth;
    tbBtn.classList.add('cart-pulse');
    setTimeout(() => tbBtn.classList.remove('cart-pulse'), 550);
  }

  if (goCart) {
    window.location.href = './cart.html';
    return;
  }

  const toast = document.getElementById('pdpAddedToast');
  const txt = document.getElementById('pdpAddedText');
  if (txt) txt.textContent = `Đã thêm "${item.n}" vào giỏ hàng!`;
  if (toast) toast.classList.add('show');
}

function renderVariantsAndActions() {
  const item = pdpState.item;
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
  const selCare = careTiers[pdpState.careIdx] || careTiers[0];
  const finalPrice = (item.p || 0) > 0 ? (item.p + selCare.fee) : 0;
  document.getElementById('pdpPrice').textContent = finalPrice > 0 ? `${finalPrice.toLocaleString('vi-VN')}đ` : 'Liên hệ';

  document.getElementById('pdpVariantsBox').innerHTML = `
    <div class="detail-variant-group">
      <span class="detail-variant-label">Phiên bản bảo hành</span>
      <div class="detail-pill-row">
        ${careTiers.map((ct, idx) => `<button type="button" class="detail-pill-opt ${idx === pdpState.careIdx ? 'active' : ''}" onclick="setPdpVariant('care', ${idx})">${esc(ct.label)}</button>`).join('')}
      </div>
    </div>
    <div class="detail-variant-group">
      <span class="detail-variant-label">Gợi ý phối màu Case / Setup</span>
      <div class="detail-pill-row">
        ${tones.map((tn, idx) => `<button type="button" class="detail-pill-opt ${idx === pdpState.toneIdx ? 'active' : ''}" onclick="setPdpVariant('tone', ${idx})"><span style="display:inline-block;width:11px;height:11px;border-radius:50%;border:1px solid rgba(7,26,51,.25);background:${tn.color};"></span><span>${esc(tn.label)}</span></button>`).join('')}
      </div>
    </div>`;

  document.getElementById('pdpAddCartBtn').onclick = () => addCurrentProductToCart(false);
  document.getElementById('pdpBuyNowBtn').onclick = () => addCurrentProductToCart(true);
}

window.setPdpVariant = (kind, idx) => {
  if (kind === 'care') pdpState.careIdx = idx;
  if (kind === 'tone') pdpState.toneIdx = idx;
  renderVariantsAndActions();
};

function syncPdpWishBtn() {
  const btn = document.getElementById('pdpWishBtn');
  const item = pdpState.item;
  if (!btn || !item || !window.S25) return;
  const wished = window.S25.hasWish(item.id);
  btn.classList.toggle('wished', wished);
  btn.innerHTML = wished ? window.S25.ICONS.heartFilled : window.S25.ICONS.heart;
  btn.setAttribute('aria-pressed', wished ? 'true' : 'false');
}

function renderRelatedProducts(item) {
  const host = document.getElementById('pdpRelatedGrid');
  if (!host || !item) return;
  const sameSub = ALL_ITEMS.filter((x) => String(x.id) !== String(item.id) && x.c === item.c && x.sc === item.sc);
  const sameCat = ALL_ITEMS.filter((x) => String(x.id) !== String(item.id) && x.c === item.c && x.sc !== item.sc);
  const pool = [...sameSub, ...sameCat, ...ALL_ITEMS.filter((x) => String(x.id) !== String(item.id))].slice(0, 4);
  host.innerHTML = pool.map((rel) => {
    const imgs = getProductImgs(rel);
    return `
      <a class="s25-pdp-rel-card" href="./product.html?id=${encodeURIComponent(rel.id)}&amp;cat=${encodeURIComponent(rel.c)}">
        <img src="${esc(imgs[0])}" alt="${esc(rel.n)}" loading="lazy" />
        <span class="product-badge" style="align-self:flex-start;">${esc(rel.sc)}</span>
        <div class="s25-pdp-rel-title">${esc(rel.n)}</div>
        <div class="s25-pdp-rel-price">${rel.p > 0 ? esc(rel.ps) : 'Liên hệ'}</div>
      </a>`;
  }).join('');
}

function initPage() {
  if (window.S25) {
    window.S25.renderUspStrip(document.getElementById('pdpUspHost'));
    window.S25.renderFooter(document.getElementById('pdpFooterHost'));
    window.S25.syncHeaderAuthAndWish();
    const shipIco = document.getElementById('pdpShipIco');
    if (shipIco) shipIco.innerHTML = window.S25.ICONS.truck;
  }

  const item = pdpState.item;
  if (!item) {
    document.getElementById('pdpCardShell').innerHTML = `
      <div style="text-align:center;padding:48px 16px;">
        <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:8px;">Không tìm thấy sản phẩm</h1>
        <p style="font-size:0.86rem;color:var(--text-muted);margin-bottom:18px;">Sản phẩm có thể đã thay đổi mã hoặc chưa sẵn sàng trong kho.</p>
        <a href="./shop.html?cat=ALL" class="sec3-btn-primary" style="text-decoration:none;">Quay lại Cửa hàng</a>
      </div>`;
    return;
  }

  document.title = `${item.n} — SKYCRUMB Studio`;
  pdpState.imgs = getProductImgs(item);

  const subLabel = formatSubcatLabel(item.sc);
  document.getElementById('pdpBreadcrumb').innerHTML = `
    <a href="./index.html">Trang chủ</a> <span>&rsaquo;</span>
    <a href="./shop.html?cat=${encodeURIComponent(item.c)}">${esc(item._catLabel)}</a> <span>&rsaquo;</span>
    <a href="./shop.html?cat=${encodeURIComponent(item.c)}&amp;sub=${encodeURIComponent(item.sc)}">${esc(subLabel)}</a> <span>&rsaquo;</span>
    <span style="color:var(--text-dark);">${esc(item.n)}</span>`;

  document.getElementById('pdpCatBadge').textContent = `${item._catLabel} › ${subLabel}`;
  document.getElementById('pdpStockBadge').textContent = item.st === 1 ? 'Còn hàng sẵn giao' : 'Tạm hết hàng / Đặt trước';
  const discEl = document.getElementById('pdpDiscBadge');
  if (item.d) { discEl.textContent = item.d; discEl.style.display = 'inline-flex'; }
  document.getElementById('pdpTitle').textContent = item.n;
  document.getElementById('pdpMeta').textContent = `Mã SP: ${item.id}${item.w ? ' • Bảo hành: ' + item.w : ''} • ${pdpState.imgs.length} ảnh thực tế`;
  document.getElementById('pdpOldPrice').textContent = (item.pm > item.p && item.p > 0) ? `Giá niêm yết: ${item.pm.toLocaleString('vi-VN')}đ` : '';

  document.getElementById('pdpThumbsStrip').innerHTML = pdpState.imgs.map((u, idx) => `
    <button type="button" class="s25-pdp-thumb ${idx === 0 ? 'active' : ''}" onclick="setPdpPhoto(${idx})" aria-label="Ảnh ${idx + 1}">
      <img src="${esc(u)}" alt="${esc(item.n)} #${idx + 1}" loading="lazy" />
    </button>`).join('');
  renderGalleryStage();
  renderVariantsAndActions();
  syncPdpWishBtn();

  document.getElementById('pdpWishBtn').onclick = () => {
    if (!window.S25) return;
    window.S25.toggleWish({
      id: item.id,
      name: item.n,
      sub: item.sc,
      priceNum: item.p || 0,
      img: pdpState.imgs[0] || SHARED_IMG_HARDWARE
    });
    syncPdpWishBtn();
  };

  const lines = (item.sp && item.sp.length)
    ? item.sp.map(formatSpecText).filter(Boolean)
    : [`Danh mục: ${item._catLabel} — ${subLabel}`, `Tình trạng: ${item.st === 1 ? 'Còn hàng mới 100%' : 'Đặt hàng'}`];
  const specRowsHtml = lines.map((line, idx) => {
    const colon = line.indexOf(':');
    if (colon > 1 && colon < 28) {
      return `<div class="pdp-spec-row"><b>${esc(line.slice(0, colon))}</b><span>${esc(line.slice(colon + 1).trim())}</span></div>`;
    }
    return `<div class="pdp-spec-row"><b>Thông số #${idx + 1}</b><span>${esc(line)}</span></div>`;
  }).join('');

  const isDecor = item.c === 'decor';
  const ICONS = window.S25 ? window.S25.ICONS : {};
  const accordions = [
    { ico: ICONS.clipboard || '', title: 'Thông số kỹ thuật (Key Specs)', body: `<div class="pdp-spec-table">${specRowsHtml}</div>`, open: true },
    {
      ico: ICONS.box || '',
      title: 'Trong hộp gồm có (Inside the Box)',
      body: isDecor
        ? `<p>01 × ${esc(item.n)} nguyên hộp, phụ kiện đế trưng bày / dây cấp nguồn (nếu có theo mẫu) và tem bảo hành điện tử SKYCRUMB Studio.</p>`
        : `<p>01 × ${esc(item.n)} nguyên seal NSX, tem bảo hành điện tử SKYCRUMB Studio, bộ phụ kiện &amp; ốc gắn tiêu chuẩn theo hãng, hướng dẫn kích hoạt Care+.</p>`,
      open: false
    },
    {
      ico: ICONS.info || '',
      title: 'Bảo hành & Đổi trả 30 ngày',
      body: isDecor
        ? `<p>Bảo hành chính hãng ${esc(item.w || '1–6 tháng')} cho mạch LED, đồng hồ &amp; pin sạc. Đổi mới nếu lỗi vận chuyển hoặc lỗi NSX trong 30 ngày đầu.</p>`
        : `<p>Bảo hành chính hãng ${esc(item.w || '12–36 tháng')}. Lỗi phần cứng NSX trong 30 ngày đầu được 1 đổi 1 ngay. Miễn phí vệ sinh &amp; tra keo tản nhiệt trọn đời tại SKYCRUMB Lab.</p>`,
      open: false
    },
    {
      ico: ICONS.doc || '',
      title: 'Hỗ trợ Lắp ráp & Thời gian giao',
      body: isDecor
        ? `<p>Giao hỏa tốc 2h tại Hà Nội &amp; TP.HCM (đóng gói chống sốc hộp mô hình). Hỗ trợ tư vấn đặt vừa lưng VGA, nóc Case hoặc bàn setup 1:1.</p>`
        : `<p>Linh kiện rời giao hỏa tốc 2h tại Hà Nội &amp; TP.HCM; trọn bộ PC Stress-Test 24h hoàn thiện sau 2–3 ngày làm việc. Liên hệ kỹ thuật 1:1 qua mục Tài khoản hoặc Giỏ hàng.</p>`,
      open: false
    }
  ];
  document.getElementById('pdpAccordions').innerHTML = accordions.map((a) => `
    <div class="pdp-acc-item ${a.open ? 'open' : ''}">
      <button type="button" class="pdp-acc-btn" aria-expanded="${a.open ? 'true' : 'false'}" onclick="var p=this.parentElement;var on=p.classList.toggle('open');this.setAttribute('aria-expanded',on);this.querySelector('.pdp-acc-pm').innerHTML=on?'&minus;':'+';">
        <span class="pdp-acc-btn-left">${a.ico}<span>${esc(a.title)}</span></span>
        <span class="pdp-acc-pm">${a.open ? '&minus;' : '+'}</span>
      </button>
      <div class="pdp-acc-panel">${a.body}</div>
    </div>`).join('');

  document.getElementById('pdpBrowseCatLink').href = `./shop.html?cat=${encodeURIComponent(item.c)}&sub=${encodeURIComponent(item.sc)}`;
  const ext = document.getElementById('pdpExternalLink');
  if (ext) {
    ext.style.display = 'none';
  }
  renderRelatedProducts(item);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') window.stepPdpPhoto(-1);
  if (e.key === 'ArrowRight') window.stepPdpPhoto(1);
});
window.addEventListener('s25:sync', syncPdpWishBtn);
initPage();
