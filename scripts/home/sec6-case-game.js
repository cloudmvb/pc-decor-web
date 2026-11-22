/* ============================================================================
   SKYCRUMB STUDIO — SECTION 6 INVITE CARD (REDIRECTS TO DEDICATED 3D GAME PAGE)
   ============================================================================ */

import { SITE_SVGS, escHtml } from './config.js';
import { ensureFullCatalogLoaded } from './catalog-store.js';

export const sec6CaseGameEl = document.getElementById('sec6CaseGame');
const sec6BoardEl = document.getElementById('sec6Board');

const SEC6_VOUCHER_STORAGE_KEY = 's25_case_game_voucher_v1';

const SEC6_PARTS_PREVIEW = [
  { no: '01', code: 'Z790-MB', name: 'Bo mạch chủ Z790 ICE ATX' },
  { no: '02', code: 'CPU-i9', name: 'Vi xử lý Core i9-14900K' },
  { no: '03', code: 'DDR5-A', name: 'Thanh RAM DDR5 ARGB #1' },
  { no: '04', code: 'DDR5-B', name: 'Thanh RAM DDR5 ARGB #2' },
  { no: '05', code: 'M2-GEN5', name: 'SSD M.2 NVMe Gen5 2TB' },
  { no: '06', code: 'M2-AUX', name: 'SSD M.2 NVMe #2' },
  { no: '07', code: 'SATA-25', name: 'Ổ cứng SSD 2.5" SATA' },
  { no: '08', code: 'FAN-SIDE', name: 'Cụm 3 Quạt Hông ARGB' },
  { no: '09', code: 'FAN-BOT', name: 'Cụm 3 Quạt Đáy ARGB' },
  { no: '10', code: 'FAN-REAR', name: 'Quạt Sau 120mm ARGB' },
  { no: '11', code: 'AIO-360', name: 'Tản nước AIO 360 LCD' },
  { no: '12', code: 'RTX-GPU', name: 'Card RTX White 3 Quạt' },
  { no: '13', code: 'PSU-1000W', name: 'Nguồn 1000W Full-Modular' },
  { no: '14', code: 'CBL-STRM', name: 'Bộ Dây Cáp Sleeved ARGB' }
];

const SVG_PLAY = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 4 20 12 6 20 6 4"/></svg>`;

function readStoredVoucher() {
  try {
    const raw = localStorage.getItem(SEC6_VOUCHER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let activeReward = readStoredVoucher();
let appliedNote = '';

export function renderSec6CaseGame() {
  if (!sec6BoardEl) return;

  activeReward = readStoredVoucher();
  const voucher = activeReward;
  const isApplied = voucher && window.S25 && window.S25.getCartMeta && window.S25.getCartMeta().promoCode === voucher.code;

  const savedHtml = voucher
    ? `<div class="sec6-saved-pill" style="margin-top:14px;background:rgba(255,255,255,0.08);border-color:rgba(56,189,248,0.34);color:#e2e8f0;">
         <span>Voucher vừa săn: <b style="color:#38bdf8;" id="sec6VoucherCode">${escHtml(voucher.code)}</b> (${escHtml(voucher.title)})</span>
         <button type="button" onclick="applySec6VoucherToCart()">${isApplied ? 'Đang áp dụng' : 'Dùng ngay'}</button>
       </div>
       ${appliedNote ? `<div class="sec6-reward-note" id="sec6RewardNote" style="margin-top:8px;color:#7dd3fc;">${appliedNote}</div>` : ''}`
    : '';

  sec6BoardEl.innerHTML = `
    <div class="sec6-invite-card" id="sec6InviteCard">
      <div>
        <div class="sec6-invite-kicker">UNITY 6 URP 3D STUDIO &bull; FULL-SCREEN CHALLENGE</div>
        <h3 class="sec6-invite-question">Bạn có muốn chơi game lắp ráp Case PC 3D để nhận Voucher giảm giá không?</h3>
        <p class="sec6-invite-desc">
          Mở phòng Studio Lắp Case PC 3D toàn màn hình (mô hình <b>Blender PBR</b> &amp; vật lý <b>Unity Engine</b>): kéo thả chuẩn trình tự <b>14 linh kiện kích thước thật 1:1</b> trên bàn (tách riêng 2 thanh RAM, 3 ổ SSD NVMe/SATA, quạt hông/đáy/sau &amp; tản nước AIO) để đóng nắp kính và mở bộ 4 Gấu Chibi!
          Không bật gợi ý để bảo toàn rương <b>Jackpot 1.000.000đ</b> — bấm nút <i>Gợi ý</i> sẽ hiện vùng lắp nhưng giảm hạng giá trị Voucher!
        </p>
        <div class="sec6-invite-prizes">
          <span class="sec6-prize-chip"><b>CASE100 / FREESHIP</b> Có gợi ý</span>
          <span class="sec6-prize-chip"><b>CASE200</b> Giảm 200K</span>
          <span class="sec6-prize-chip"><b>CASE500</b> Giảm 500K</span>
          <span class="sec6-prize-chip"><b>SKY10</b> Giảm 10%</span>
          <span class="sec6-prize-chip is-jackpot"><b>CASE1TR</b> Jackpot 1TR (0 Gợi ý)</span>
        </div>
        <div class="sec6-invite-cta-row">
          <a href="./pc-case-3d-game.html" class="sec6-btn-start-unity" id="sec6StartUnityBtn">
            ${SVG_PLAY}
            <span>Bắt đầu chơi game 3D nhận Voucher</span>
            ${SITE_SVGS.arrowRight}
          </a>
          <span class="sec6-invite-meta">Chuyển sang trang Studio 3D riêng biệt &bull; Tự động lưu Voucher về Giỏ hàng</span>
        </div>
        ${savedHtml}
      </div>

      <div class="sec6-invite-preview">
        <div class="sec6-invite-preview-head">
          <span>14 LINH KIỆN BLENDER TỶ LỆ 1:1</span>
          <span>VẬT LÝ THỰC TẾ</span>
        </div>
        <div class="sec6-invite-parts-grid">
          ${SEC6_PARTS_PREVIEW.map((p) => `
            <div class="sec6-mini-part">
              <span>${p.no} // ${p.code}</span>
              <strong>${escHtml(p.name)}</strong>
            </div>`).join('')}
        </div>
        <div style="font-size:0.74rem;color:#94a3b8;line-height:1.48;">
          Cách chơi: Kéo thả từng linh kiện 3D trên thảm ESD vào khe khớp trong Case. Mặc định tắt khung gợi ý — chỉ sáng khi bạn bấm <b>Gợi ý</b> (có cảnh báo trừ bậc thưởng).
        </div>
      </div>
    </div>`;
}

window.startSec6UnityGame = () => {
  window.location.href = './pc-case-3d-game.html';
};

window.applySec6VoucherToCart = () => {
  const v = activeReward || readStoredVoucher();
  if (!v || !v.code || !window.S25) return;
  window.S25.setCartMeta({ promoCode: v.code });
  appliedNote = `Đã áp dụng mã <b>${escHtml(v.code)}</b> vào Giỏ hàng — <a href="./cart.html" style="color:#38bdf8;text-decoration:underline;">Mở Giỏ hàng kiểm tra ngay</a>.`;
  renderSec6CaseGame();
  ensureFullCatalogLoaded();
};

renderSec6CaseGame();
