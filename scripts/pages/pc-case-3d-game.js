/* ============================================================================
   SKYCRUMB STUDIO — DEDICATED 3D PC CASE GAME PAGE CONTROLLER
   ============================================================================ */

const SEC6_VOUCHER_STORAGE_KEY = 's25_case_game_voucher_v1';
const UNITY_BUILD_MANIFEST_URL = './assets/unity-pc-builder/manifest.json';

const VOUCHER_MAP = {
  CASE1TR: { code: 'CASE1TR', title: 'Giảm 1.000.000đ', tier: 'JACKPOT LAB (0 GỢI Ý)', cond: 'Áp dụng bộ PC / Setup từ 25TR' },
  SKY10:   { code: 'SKY10',   title: 'Giảm 10% (Tối đa 2TR)', tier: 'SIÊU HIẾM (0 GỢI Ý)', cond: 'Trừ trực tiếp tổng Giỏ hàng' },
  CASE500: { code: 'CASE500', title: 'Giảm 500.000đ', tier: 'HẠNG CAO', cond: 'Áp dụng đơn từ 10.000.000đ' },
  CASE200: { code: 'CASE200', title: 'Giảm 200.000đ', tier: 'PHỔ THÔNG', cond: 'Áp dụng đơn từ 3.000.000đ' },
  CASE100: { code: 'CASE100', title: 'Giảm 100.000đ', tier: 'KHỞI ĐỘNG', cond: 'Áp dụng đơn từ 2.000.000đ' },
  FREESHIP:{ code: 'FREESHIP',title: 'Miễn Phí Bảo Hiểm Ship', tier: 'VẬN CHUYỂN', cond: 'Miễn 100% phí chống sốc VGA' }
};

let unityInstance = null;
let drawInterval = null;
let activeWonVoucher = null;

const progressPillEl = document.getElementById('gameProgressPill');
const tierPillEl = document.getElementById('gameVoucherTierPill');
const canvasEl = document.getElementById('unityGameCanvas');
const loaderEl = document.getElementById('unityGameLoader');
const fillEl = document.getElementById('loaderBarFill');
const pctEl = document.getElementById('loaderPct');
const statusEl = document.getElementById('loaderStatus');
const errEl = document.getElementById('loaderError');

const modalEl = document.getElementById('voucherModal');
const rollStageEl = document.getElementById('voucherRollStage');
const resultStageEl = document.getElementById('voucherResultStage');
const rollCodeEl = document.getElementById('rollCodeText');
const wonTierBadgeEl = document.getElementById('wonTierBadge');
const wonHintSummaryBadgeEl = document.getElementById('wonHintSummaryBadge');
const wonTitleEl = document.getElementById('wonVoucherTitle');
const wonCondEl = document.getElementById('wonVoucherCond');
const wonCodeEl = document.getElementById('wonVoucherCode');
const wonStatsEl = document.getElementById('wonStatsLine');
const wonPenaltyEl = document.getElementById('wonPenaltyNote');
const applyBtnEl = document.getElementById('applyWonVoucherBtn');
const copyBtnEl = document.getElementById('copyWonVoucherBtn');
const appliedNoteEl = document.getElementById('wonAppliedNote');

function loadExternalScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-unity-loader="${src}"]`);
    if (existing && typeof window.createUnityInstance === 'function') {
      resolve();
      return;
    }
    const sc = document.createElement('script');
    sc.src = src;
    sc.async = true;
    sc.dataset.unityLoader = src;
    sc.onload = () => resolve();
    sc.onerror = () => reject(new Error(`Không thể tải loader Unity WebGL: ${src}`));
    document.head.appendChild(sc);
  });
}

function setLoadUi(pct, msg) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (fillEl) fillEl.style.width = `${Math.max(4, clamped)}%`;
  if (pctEl) pctEl.textContent = `${clamped}%`;
  if (statusEl && msg) statusEl.textContent = msg;
}

function updateVoucherTierPill(hintsUsed) {
  if (!tierPillEl) return;
  const h = Math.max(0, Number(hintsUsed) || 0);
  tierPillEl.classList.remove('is-tier-max', 'is-tier-warn', 'is-tier-low');

  if (h === 0) {
    tierPillEl.classList.add('is-tier-max');
    tierPillEl.innerHTML = 'Hạng thưởng tối đa: <b>1.000.000đ</b> (0 Gợi ý)';
  } else if (h === 1) {
    tierPillEl.classList.add('is-tier-warn');
    tierPillEl.innerHTML = 'Đã giảm bậc thưởng: <b>Tối đa 500.000đ</b> (1 Gợi ý)';
  } else if (h === 2) {
    tierPillEl.classList.add('is-tier-warn');
    tierPillEl.innerHTML = 'Đã giảm bậc thưởng: <b>Tối đa 200.000đ</b> (2 Gợi ý)';
  } else {
    tierPillEl.classList.add('is-tier-low');
    tierPillEl.innerHTML = `Đã giảm bậc thưởng: <b>Mức cơ bản 100K</b> (${h} Gợi ý)`;
  }
}

function pickTieredVoucher(hintsUsed) {
  const h = Math.max(0, Number(hintsUsed) || 0);
  let pool;
  if (h === 0) {
    pool = [
      { code: 'CASE1TR', w: 40 },
      { code: 'SKY10', w: 35 },
      { code: 'CASE500', w: 25 }
    ];
  } else if (h === 1) {
    pool = [
      { code: 'CASE500', w: 55 },
      { code: 'CASE200', w: 45 }
    ];
  } else if (h === 2) {
    pool = [
      { code: 'CASE200', w: 65 },
      { code: 'FREESHIP', w: 35 }
    ];
  } else {
    pool = [
      { code: 'CASE100', w: 70 },
      { code: 'FREESHIP', w: 30 }
    ];
  }

  const sum = pool.reduce((acc, item) => acc + item.w, 0);
  let r = Math.random() * sum;
  for (const item of pool) {
    r -= item.w;
    if (r <= 0) return VOUCHER_MAP[item.code];
  }
  return VOUCHER_MAP[pool[0].code];
}

function saveVoucher(voucherPayload) {
  try {
    localStorage.setItem(SEC6_VOUCHER_STORAGE_KEY, JSON.stringify(voucherPayload));
  } catch {}
}

async function bootDedicatedUnityLab() {
  if (!canvasEl) return;
  try {
    setLoadUi(6, 'Đang đọc cấu hình gói Unity 6 URP...');
    const res = await fetch(`${UNITY_BUILD_MANIFEST_URL}?v=${Date.now()}`);
    if (!res.ok) {
      throw new Error('Không tìm thấy ./assets/unity-pc-builder/manifest.json.');
    }
    const meta = await res.json();
    const base = './assets/unity-pc-builder/Build/';

    setLoadUi(14, 'Đang nạp trình khởi chạy Unity WebGL...');
    await loadExternalScript(`${base}${meta.loaderUrl}`);
    if (typeof window.createUnityInstance !== 'function') {
      throw new Error('Thiếu hàm createUnityInstance sau khi tải loader.');
    }

    const config = {
      dataUrl: `${base}${meta.dataUrl}`,
      frameworkUrl: `${base}${meta.frameworkUrl}`,
      codeUrl: `${base}${meta.codeUrl}`,
      streamingAssetsUrl: './assets/unity-pc-builder/StreamingAssets',
      companyName: 'SKYCRUMB Studio',
      productName: 'SkyCrumb PC Case 3D Builder',
      productVersion: '2.0',
      devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2)
    };

    setLoadUi(20, 'Đang tải mô hình Case PC Blender 3D & Vật liệu PBR...');
    unityInstance = await window.createUnityInstance(canvasEl, config, (progress) => {
      const scaled = 20 + progress * 80;
      const msg = progress < 0.7
        ? 'Đang tải mô hình 14 linh kiện Blender 3D tỷ lệ 1:1...'
        : progress < 0.96
          ? 'Đang khởi tạo WebAssembly & hệ thống vật lý kéo thả...'
          : 'Đang đặt 14 linh kiện ngẫu nhiên lên bàn kỹ thuật...';
      setLoadUi(scaled, msg);
    });

    setLoadUi(100, 'Sẵn sàng lắp ráp!');
    if (loaderEl) loaderEl.classList.add('is-hidden');
  } catch (err) {
    const msg = err && err.message ? err.message : 'Lỗi không xác định khi khởi chạy Unity WebGL.';
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = msg;
    }
    if (statusEl) statusEl.textContent = 'Không thể khởi chạy phòng 3D';
  }
}

window.onUnityPCBuildProgress = (done, total) => {
  const d = Number(done) || 0;
  const t = Number(total) || 14;
  if (progressPillEl) {
    progressPillEl.innerHTML = `<b>${d}/${t}</b> Linh kiện 3D đã lắp`;
  }
};

window.onUnityPCHintUsed = (hintsUsed) => {
  updateVoucherTierPill(hintsUsed);
};

window.onUnityPCBuildComplete = (elapsedSec, accuracyPct, mistakes, hintsUsed) => {
  const safeElapsed = Math.max(0.5, Number(elapsedSec) || 15);
  const safeAcc = Math.min(100, Math.max(40, Math.round(Number(accuracyPct) || 100)));
  const safeMistakes = Math.max(0, Number(mistakes) || 0);
  const safeHints = Math.max(0, Number(hintsUsed) || 0);

  updateVoucherTierPill(safeHints);
  if (progressPillEl) progressPillEl.innerHTML = '<b>14/14</b> Linh kiện 3D đã lắp';

  if (modalEl) modalEl.hidden = false;
  if (rollStageEl) rollStageEl.hidden = false;
  if (resultStageEl) resultStageEl.hidden = true;
  if (appliedNoteEl) appliedNoteEl.textContent = '';

  clearInterval(drawInterval);
  const candidateCodes = safeHints === 0
    ? ['CASE1TR', 'SKY10', 'CASE500']
    : safeHints === 1
      ? ['CASE500', 'CASE200']
      : safeHints === 2
        ? ['CASE200', 'FREESHIP']
        : ['CASE100', 'FREESHIP'];

  let tick = 0;
  drawInterval = setInterval(() => {
    tick++;
    if (rollCodeEl) rollCodeEl.textContent = candidateCodes[tick % candidateCodes.length];
    if (tick >= 7) {
      clearInterval(drawInterval);
      drawInterval = null;
      const picked = pickTieredVoucher(safeHints);
      activeWonVoucher = {
        code: picked.code,
        title: picked.title,
        tier: picked.tier,
        cond: picked.cond,
        elapsedSec: Number(safeElapsed.toFixed(1)),
        accuracyPct: safeAcc,
        mistakes: safeMistakes,
        hintsUsed: safeHints,
        earnedAt: Date.now()
      };
      saveVoucher(activeWonVoucher);

      if (rollStageEl) rollStageEl.hidden = true;
      if (resultStageEl) resultStageEl.hidden = false;
      if (wonTierBadgeEl) wonTierBadgeEl.textContent = picked.tier;
      if (wonHintSummaryBadgeEl) {
        wonHintSummaryBadgeEl.textContent = safeHints === 0
          ? '0 lần dùng Gợi ý — Bảo toàn Jackpot!'
          : `Đã dùng ${safeHints} lần Gợi ý`;
      }
      if (wonTitleEl) wonTitleEl.textContent = picked.title;
      if (wonCondEl) wonCondEl.textContent = picked.cond;
      if (wonCodeEl) wonCodeEl.textContent = picked.code;
      if (wonStatsEl) {
        wonStatsEl.textContent = `Thời gian: ${safeElapsed.toFixed(1)}s • Độ chuẩn xác: ${safeAcc}% • Sai vị trí: ${safeMistakes} • Gợi ý: ${safeHints}`;
      }
      if (wonPenaltyEl) {
        if (safeHints > 0) {
          wonPenaltyEl.hidden = false;
          wonPenaltyEl.textContent = `Lưu ý bậc thưởng: Bạn đã sử dụng ${safeHints} lần Gợi ý nên giá trị Voucher tối đa đã bị giảm bậc. Hãy chơi lượt mới không dùng Gợi ý để săn Jackpot CASE1TR (1.000.000đ)!`;
        } else {
          wonPenaltyEl.hidden = true;
        }
      }
      if (applyBtnEl) applyBtnEl.textContent = 'Áp dụng ngay vào Giỏ';
    }
  }, 85);
};

function restartRound() {
  clearInterval(drawInterval);
  drawInterval = null;
  if (modalEl) modalEl.hidden = true;
  if (progressPillEl) progressPillEl.innerHTML = '<b>0/14</b> Linh kiện 3D đã lắp';
  updateVoucherTierPill(0);
  if (unityInstance && typeof unityInstance.SendMessage === 'function') {
    try {
      unityInstance.SendMessage('PCAssemblyManager', 'RestartFromWeb', '');
    } catch {}
  }
}

document.getElementById('fullscreenBtn')?.addEventListener('click', () => {
  if (unityInstance && typeof unityInstance.SetFullscreen === 'function') {
    unityInstance.SetFullscreen(1);
  }
});
document.getElementById('restartUnityBtn')?.addEventListener('click', restartRound);
document.getElementById('replayModalBtn')?.addEventListener('click', restartRound);

copyBtnEl?.addEventListener('click', () => {
  if (!activeWonVoucher) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(activeWonVoucher.code).catch(() => {});
  }
  copyBtnEl.textContent = 'Đã sao chép';
});

applyBtnEl?.addEventListener('click', () => {
  if (!activeWonVoucher || !window.S25) return;
  window.S25.setCartMeta({ promoCode: activeWonVoucher.code });
  applyBtnEl.textContent = 'Đang áp dụng trong Giỏ';
  if (appliedNoteEl) {
    appliedNoteEl.innerHTML = `Đã áp dụng mã <b>${activeWonVoucher.code}</b> (${activeWonVoucher.title}) vào Giỏ hàng — <a href="./cart.html" style="color:#38bdf8;">Kiểm tra Giỏ hàng ngay</a>.`;
  }
});

updateVoucherTierPill(0);
bootDedicatedUnityLab();
