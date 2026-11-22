/* ============================================================================
   S25 // SKYCRUMB — HOMEPAGE CONFIGURATION & COMPONENT CATALOG METADATA
   ============================================================================ */

import {
  PLACEHOLDER_IMAGES,
  SITE_SVGS,
  MAIN_CATEGORIES,
  GROUP3D_TO_SUBCAT,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSubcatLabel,
  formatSpecText,
  normalizeVi,
  resolveCatalogImgUrl,
  getProductImages
} from '../shared/catalog-helpers.js';

export {
  PLACEHOLDER_IMAGES,
  SITE_SVGS,
  MAIN_CATEGORIES,
  GROUP3D_TO_SUBCAT,
  CATEGORY_LABEL_MAP,
  escHtml,
  formatSubcatLabel,
  formatSpecText,
  normalizeVi,
  resolveCatalogImgUrl,
  getProductImages
};

export const SHARED_IMG_HARDWARE = PLACEHOLDER_IMAGES.hardwareSquare;
export const SHARED_IMG_DECOR = PLACEHOLDER_IMAGES.decorSquare;

export const TTG_SVGS = {
  location: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480.21-480Q510-480 531-501.21t21-51Q552-582 530.79-603t-51-21Q450-624 429-602.79t-21 51Q408-522 429.21-501t51 21ZM480-96Q323.03-227.11 245.51-339.55 168-452 168-549q0-134 89-224.5T479.5-864q133.5 0 223 90.5T792-549q0 97-77 209T480-96Z"/></svg>`,
  map: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="m600-144-240-72-153 51q-23 8-43-6t-20-40v-498q0-16 9.5-28.5T177-755l183-61 240 72 153-51q23-9 43 5.5t20 40.5v498q0 16-9 28.5T783-205l-183 61Zm-36-86v-450l-168-50v450l168 50Z"/></svg>`,
  phone: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M744-481q0-109-77.5-186.5T480-745v-72q70 0 131 26.5t106.5 72Q763-673 789.5-612T816-481h-72Zm-144 0q0-50-35-85t-85-35v-72q80 0 136 56t56 136h-72Zm163 336q-121-9-229.5-59.5T339-341q-86-86-136-194.5T144-765q-2-21 12.5-36.5T192-817h136q17 0 29.5 10.5T374-780l24 107q2 13-1.5 25T385-628l-97 98q20 38 46 73t58 66q30 30 64 55.5t72 45.5l99-96q8-8 20-11.5t25-1.5l107 23q17 5 27 17.5t10 29.5v136q0 21-16 35.5T763-145Z"/></svg>`,
  history: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M480-144q-140 0-238-98t-98-238h72q0 109 77.5 186.5T480-216q109 0 186.5-77.5T744-480q0-109-77.5-186.5T480-744q-62 0-114.55 25.6Q312.91-692.8 277-648h107v72H144v-240h72v130q46-60 114.5-95T480-816q70 0 131.13 26.6 61.14 26.6 106.4 71.87 45.27 45.26 71.87 106.4Q816-550 816-480t-26.6 131.13q-26.6 61.14-71.87 106.4-45.26 45.27-106.4 71.87Q550-144 480-144Zm100-200L444-480v-192h72v162l115 115-51 51Z"/></svg>`,
  cart: `<svg class="tb-svg-stroke nzxt-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1,3 5,3 7.5,16 19,16 23,7 10,7"/><circle cx="9" cy="20" r="1"/><circle cx="17" cy="20" r="1"/></svg>`,
  chevrons: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M381-480 192-669l51-51 240 240-240 240-51-51 189-189Zm285 0L477-669l51-51 240 240-240 240-51-51 189-189Z"/></svg>`
};

// =========================================================================
// 2. CATALOG DATA FOR ALL 10 COMPONENT GROUPS (ZERO EMOJIS)
// =========================================================================
export const GROUPS_CONFIG = {
  Group_Accessories: {
    id: 'Group_Accessories',
    svgKey: 'decorBox',
    sharedImg: SHARED_IMG_DECOR,
    unlockAt: 0.15,
    explodeOffset: [0.0, 0.42, 0.0],
    explodeRot: [0.05, 0.0, 0.0],
    focus: { distance: 1.25, camDir: [0.05, 0.25, 0.98], offsetTargetY: 0.05 },
    title: 'Phụ Kiện & Mô Hình Decor',
    sub: '342 sản phẩm Decor & Mô Hình',
    zoomScale: 1.75,
    desc: 'Bộ sưu tập đèn bàn, đồng hồ setup, dây LED RGB và mô hình One Piece / Dragon Ball / Naruto / Marvel tuyển chọn.',
    products: []
  },
  Group_Cooling: {
    id: 'Group_Cooling',
    svgKey: 'orbit',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.65,
    explodeOffset: [1.42, -0.06, 0.18],
    explodeRot: [0.0, -0.20, 0.0],
    focus: { distance: 1.80, camDir: [0.25, 0.18, 1.05], offsetTargetY: -0.02 },
    title: 'Hệ Thống Tản Nhiệt (AIO + Fan)',
    sub: 'Tản nước 360mm LCD • Fan Vô Cực ARGB',
    zoomScale: 1.65,
    desc: 'Tản nhiệt nước AIO 360mm màn hình IPS LCD tròn hiển thị thông số nhiệt độ kết hợp cụm quạt ARGB ghép nối nam châm.',
    products: [
      { badge: 'Màn LCD IPS', name: 'Tản Nhiệt Nước AIO SkyFlow 360 White LCD', specs: 'Màn IPS 2.1" hiển thị GIF/Nhiệt độ • Ống bọc dù trắng', price: '4.290.000đ' },
      { badge: 'Pack 3 Fan', name: 'Bộ 3 Quạt Vô Cực UniFan White ARGB 120mm', specs: 'Ghép nối nam châm không dây • Đồng bộ ánh sáng ARGB', price: '1.850.000đ' },
      { badge: 'Reverse Blade', name: 'Quạt Hút Gió Ngược Reverse-Blade White 120mm', specs: 'Giấu khung xương quạt khi lắp trong Case kính bể cá', price: '650.000đ' }
    ]
  },
  Group_GPU: {
    id: 'Group_GPU',
    svgKey: 'gpu',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.48,
    explodeOffset: [-1.45, -1.05, 0.35],
    explodeRot: [0.06, 0.30, 0.0],
    focus: { distance: 1.40, camDir: [-0.15, 0.22, 1.05], offsetTargetY: 0.0 },
    title: 'Card Đồ Họa (VGA / GPU)',
    sub: 'RTX 4080 Super • RTX 5080 Pure White',
    zoomScale: 1.75,
    desc: 'Card đồ họa hiệu năng cao tông trắng tinh khiết với 3 quạt tản nhiệt và mặt lưng backplate kim loại phẳng tối ưu để đặt mô hình.',
    products: [
      { badge: 'Flagship White', name: 'ROG Strix / Aero RTX 4080 Super 16GB White', specs: '3 Fan 11 cánh trắng • Backplate nhôm nguyên khối • LED ARGB', price: '29.990.000đ' },
      { badge: 'Next-Gen', name: 'GeForce RTX 5070 Ti 16GB Snow Edition', specs: 'Kiến trúc Blackwell • Tối ưu 2K/4K Max Settings & AI Local', price: '25.990.000đ' },
      { badge: 'Tầm Trung', name: 'RTX 4070 Ti Super Snow White 16GB', specs: 'Thiết kế chuẩn Minimalist White • Tối ưu cho vỏ Case kính trắng', price: '22.490.000đ' }
    ]
  },
  Group_SSD: {
    id: 'Group_SSD',
    svgKey: 'ssd',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.65,
    explodeOffset: [-2.55, 0.22, 0.30],
    explodeRot: [0.08, 0.28, 0.0],
    focus: { distance: 1.05, camDir: [-0.15, 0.12, 1.00], offsetTargetY: 0.0 },
    title: 'Ổ Cứng SSD (NVMe + SATA)',
    sub: '2TB PCIe 5.0 M.2 Heatsink • SSD 2.5" White',
    zoomScale: 1.85,
    desc: 'Bộ đôi ổ cứng SSD M.2 NVMe Gen5 có giáp tản nhiệt nhôm trắng kèm LED và ổ SSD 2.5" SATA vỏ nhôm phay.',
    products: [
      { badge: 'Gen5 14.500MB/s', name: 'SSD M.2 NVMe Crucial T705 / 990 Pro 2TB White Heatsink', specs: 'Tốc độ đọc 14.500MB/s • Tản nhiệt nhôm trắng nguyên khối', price: '5.490.000đ' },
      { badge: 'Gen4 7.400MB/s', name: 'SSD Kingston KC3000 / SN850X 1TB + Giáp Trắng', specs: 'Kèm giáp tản nhiệt M.2 ARGB màu trắng bạc', price: '2.590.000đ' },
      { badge: '2.5" SATA White', name: 'SSD 2.5" SATA 2TB Snow Metal Edition', specs: 'Vỏ nhôm phay trắng gắn lộ thiên trên vách Case trang trí', price: '2.890.000đ' }
    ]
  },
  Group_Cables: {
    id: 'Group_Cables',
    svgKey: 'cables',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.31,
    explodeOffset: [1.10, -0.82, 0.28],
    explodeRot: [0.05, -0.20, 0.0],
    focus: { distance: 1.25, camDir: [0.20, 0.22, 0.98], offsetTargetY: 0.0 },
    title: 'Dây Cáp Bọc Dù & LED Strimer',
    sub: '24-Pin Main • 16-Pin GPU • 8-Pin CPU',
    zoomScale: 1.80,
    desc: 'Trọn bộ 4 cụm dây nối mặt trước (24-Pin Strimer, 12VHPWR GPU, 8-Pin CPU EPS & Cáp Riser PCIe 5.0) xếp thẳng hàng kèm lược nhôm.',
    products: [
      { badge: 'ARGB Strimer', name: 'Dây Nối Nguồn Lian Li Strimer Plus V2 24-Pin + 16-Pin GPU', specs: 'Dải LED quang học mịn • Đồng bộ hiệu ứng ánh sáng', price: '2.850.000đ' },
      { badge: 'Full Kit Bọc Dù', name: 'Bộ Dây Nối Dài Bọc Dù Trắng Kèm Lược Nhôm (24P + 8P + 16P)', specs: 'Lõi đồng 16AWG chịu tải cao • Kèm sẵn 12 lược cài dây', price: '690.000đ' },
      { badge: 'Cáp Riser Gen5', name: 'Cáp Riser PCIe 5.0 x16 Dựng Dọc VGA Shielded White', specs: 'Băng thông 128GB/s không suy hao FPS • Chống nhiễu EMI', price: '1.650.000đ' }
    ]
  },
  Group_RAM: {
    id: 'Group_RAM',
    svgKey: 'bars',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.48,
    explodeOffset: [0.98, 0.86, 0.22],
    explodeRot: [0.0, 0.0, 0.0],
    focus: { distance: 0.90, camDir: [0.12, 0.15, 0.98], offsetTargetY: 0.0 },
    title: 'Bộ Nhớ RAM DDR5',
    sub: '32GB / 64GB Trident Z5 RGB White',
    zoomScale: 1.90,
    desc: 'Cặp thanh RAM DDR5 Trident Z5 RGB phô diễn dải đèn diffuser ARGB chuyển sắc mượt và mặt giáp nhôm phay CNC.',
    products: [
      { badge: 'DDR5 6400', name: 'RAM G.Skill Trident Z5 RGB White 32GB (2x16GB)', specs: '2x16GB DDR5 6400MT/s CL32 • Heatsink nhôm trắng-bạc', price: '3.890.000đ' },
      { badge: 'DDR5 7200', name: 'RAM Trident Z5 Royal / Snow White 64GB (2x32GB)', specs: '2x32GB DDR5 7200MT/s • Dải LED toàn dải mịn không lộ bóng', price: '6.490.000đ' }
    ]
  },
  Group_CPU: {
    id: 'Group_CPU',
    svgKey: 'cpu',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.82,
    explodeOffset: [-1.40, 0.85, 0.15],
    explodeRot: [0.18, 0.28, 0.0],
    focus: { distance: 0.75, camDir: [-0.10, 0.18, 0.98], offsetTargetY: 0.0 },
    title: 'Vi Xử Lý (CPU)',
    sub: 'Core i9 / Core Ultra • Ryzen 7 9800X3D',
    zoomScale: 1.95,
    desc: 'Bộ vi xử lý đa nhân xung nhịp cao chuyên trị Gaming 4K, AI Local và đồ họa 3D nặng.',
    products: [
      { badge: '24 Nhân 6.0GHz', name: 'Intel Core i9-14900K / Core Ultra 7 265KF', specs: 'Xung nhịp tối đa 6.0GHz • 36MB Smart Cache', price: '14.590.000đ' },
      { badge: 'Vua Gaming 3D', name: 'AMD Ryzen 7 9800X3D / 7800X3D 8 Nhân 16 Luồng', specs: 'Công nghệ 3D V-Cache thế hệ mới • Tối ưu FPS đỉnh cao', price: '12.990.000đ' }
    ]
  },
  Group_Mainboard: {
    id: 'Group_Mainboard',
    svgKey: 'mainboard',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.82,
    explodeOffset: [-1.38, -0.35, 0.25],
    explodeRot: [0.02, 0.42, 0.0],
    focus: { distance: 1.45, camDir: [-0.20, 0.18, 1.05], offsetTargetY: 0.0 },
    title: 'Bo Mạch Chủ (Mainboard)',
    sub: 'Z790 / X870 White PCB & CNC VRM Armor',
    zoomScale: 1.80,
    desc: 'Bo mạch chủ ATX PCB trắng nguyên bản với giáp tản nhiệt VRM nhôm phay CNC, khe PCIe 5.0 bọc thép và Wi-Fi 7.',
    products: [
      { badge: 'Full White PCB', name: 'Mainboard Gigabyte Z790 Aorus Pro Ice / X870 Ice', specs: 'PCB trắng • Giáp tản nhiệt M.2 tháo lắp nhanh • Wi-Fi 7', price: '8.990.000đ' },
      { badge: 'ROG Strix White', name: 'ASUS ROG Strix Z790-A Gaming WiFi II White', specs: 'Tản VRM nhôm phay bạc-trắng • 4 khe M.2 PCIe 4.0', price: '9.490.000đ' }
    ]
  },
  Group_Case: {
    id: 'Group_Case',
    svgKey: 'chamber',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.15,
    explodeOffset: [0.0, 0.0, 0.0],
    explodeRot: [0.0, 0.10, 0.0],
    focus: { distance: 2.10, camDir: [0.70, 0.45, 1.35], offsetTargetY: 0.35 },
    title: 'Vỏ Case Kính Bể Cá 3 Mặt',
    sub: 'Panoramic 45° Snow White Dual-Chamber',
    zoomScale: 1.60,
    desc: 'Vỏ Case 2 buồng kính cường lực 3 mặt vát góc 45° không trụ cản tầm nhìn, tối ưu luồng gió đáy và không gian trưng bày mô hình.',
    products: [
      { badge: 'Góc Vát 3 Mặt', name: 'Case Hyte Y60 / Y70 Snow White Panoramic', specs: 'Thiết kế 3 mặt kính vát góc 45° • Kèm cáp Riser dựng dọc VGA', price: '5.290.000đ' },
      { badge: 'Không Trụ Góc', name: 'Case Lian Li O11 Vision / NZXT H9 Flow White', specs: 'Kính cường lực siêu trong • Nóc phẳng rộng rãi để bày Figure', price: '4.190.000đ' }
    ]
  },
  Group_PSU: {
    id: 'Group_PSU',
    svgKey: 'chamber',
    sharedImg: SHARED_IMG_HARDWARE,
    unlockAt: 0.82,
    explodeOffset: [0.0, -1.30, 0.35],
    explodeRot: [0.0, 0.20, 0.0],
    focus: { distance: 1.15, camDir: [0.20, 0.22, 0.98], offsetTargetY: 0.0 },
    title: 'Nguồn Máy Tính (PSU)',
    sub: '1000W 80 Plus Gold ATX 3.1 Full Modular',
    zoomScale: 1.80,
    desc: 'Bộ nguồn Full Modular 1000W chuẩn ATX 3.1 / PCIe 5.1 màu trắng trang bị cổng 12VHPWR 600W nguyên bản.',
    products: [
      { badge: 'ATX 3.1 White', name: 'Corsair RM1000x Shift / White 1000W 80 Plus Gold', specs: 'Cáp Modular trắng toàn tập • Quạt Zero-RPM siêu êm', price: '4.890.000đ' },
      { badge: 'Dual-Chamber', name: 'Nguồn Lian Li Edge / ASUS ROG Loki 850W White', specs: 'Thiết kế chữ L tối ưu đi dây cho Case kính 2 buồng', price: '3.950.000đ' }
    ]
  }
};

