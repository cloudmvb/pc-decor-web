/* ============================================================================
   S25 // SKYCRUMB — SHARED CATALOG HELPERS & CONSTANTS
   Single source of truth for placeholder paths, category metadata,
   Vietnamese text search normalization, and local catalog image resolution.
   ============================================================================ */

export const PLACEHOLDER_IMAGES = {
  hardwareWide: './assets/images/placeholders/hardware-wide.png',
  hardwareSquare: './assets/images/placeholders/hardware-square.png',
  decorWide: './assets/images/placeholders/decor-wide.png',
  decorSquare: './assets/images/placeholders/decor-square.png'
};

export const SITE_SVGS = {
  expand: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 3H6C4.34 3 3 4.34 3 6V17C3 18.31 3.83 19.42 5 19.83V22.92C2.16 22.44 0 19.97 0 17V6C0 2.69 2.69 0 6 0H17C19.98 0 22.44 2.16 22.92 5H19.83C19.42 3.83 18.31 3 17 3Z" fill="currentColor"></path><path fill-rule="evenodd" clip-rule="evenodd" d="M13.9998 7.99982H33.9998C37.3098 7.99982 39.9998 10.6898 39.9998 13.9998V33.9998C39.9998 37.3098 37.3098 39.9998 33.9998 39.9998H13.9998C10.6898 39.9998 7.99982 37.3098 7.99982 33.9998V13.9998C7.99982 10.6898 10.6898 7.99982 13.9998 7.99982ZM33.9998 36.9998C35.6598 36.9998 36.9998 35.6598 36.9998 33.9998V13.9898C36.9998 12.3298 35.6598 10.9898 33.9998 10.9898H13.9998C12.3398 10.9898 10.9998 12.3298 10.9998 13.9898V33.9998C10.9998 35.6598 12.3398 36.9998 13.9998 36.9998H33.9998Z" fill="currentColor"></path></svg>`,
  collapse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6l6 6"></path></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M5 12h14M13 18l6-6M13 6l6 6"></path></svg>`,
  orbit: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M40 20C40 31.05 31.05 40 20 40C8.95 40 0 31.05 0 20C0 8.95 8.95 0 20 0C22.63 0 25.14 0.51 27.44 1.43C26.54 2.06 25.77 2.87 25.19 3.81C23.55 3.29 21.81 3 20 3C10.61 3 3 10.61 3 20C3 29.39 10.61 37 20 37C29.39 37 37 29.39 37 20C37 18.19 36.72 16.45 36.19 14.81C37.13 14.23 37.94 13.46 38.57 12.56C39.49 14.86 40 17.37 40 20ZM27 20C27 23.87 23.87 27 20 27C16.13 27 13 23.87 13 20C13 16.13 16.13 13 20 13C23.87 13 27 16.13 27 20Z" fill="currentColor"></path></svg>`,
  decorLamp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 18v-5"/><path d="M6.5 13h11l-2.2-8H8.7L6.5 13z"/></svg>`,
  decorBox: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="22" width="52" height="12" rx="3"/><path d="M10 34v22a3 3 0 0 0 3 3h38a3 3 0 0 0 3-3V34"/><path d="M32 22v37"/><path d="M32 22c-3-8-14-12-14-5 0 4 8 5 14 5zM32 22c3-8 14-12 14-5 0 4-8 5-14 5z"/></svg>`,
  gpu: `<svg viewBox="0 0 640 640" fill="currentColor"><path d="M192 176C112.5 176 48 240.5 48 320C48 399.5 112.5 464 192 464L448 464C527.5 464 592 399.5 592 320C592 240.5 527.5 176 448 176L192 176zM0 320C0 214 86 128 192 128L448 128C554 128 640 214 640 320C640 426 554 512 448 512L192 512C86 512 0 426 0 320zM232 264L232 296L264 296C277.3 296 288 306.7 288 320C288 333.3 277.3 344 264 344L232 344L232 376C232 389.3 221.3 400 208 400C194.7 400 184 389.3 184 376L184 344L152 344C138.7 344 128 333.3 128 320C128 306.7 138.7 296 152 296L184 296L184 264C184 250.7 194.7 240 208 240C221.3 240 232 250.7 232 264zM400 336C417.7 336 432 350.3 432 368C432 385.7 417.7 400 400 400C382.3 400 368 385.7 368 368C368 350.3 382.3 336 400 336zM432 272C432 254.3 446.3 240 464 240C481.7 240 496 254.3 496 272C496 289.7 481.7 304 464 304C446.3 304 432 289.7 432 272z"/></svg>`,
  bars: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M18.5 8C18.5 7.17157 17.8284 6.5 17 6.5C16.1716 6.5 15.5 7.17157 15.5 8L15.5 29C15.5 29.8284 16.1716 30.5 17 30.5C17.8284 30.5 18.5 29.8284 18.5 29L18.5 8Z" fill="currentColor"></path><path d="M12.5 14C12.5 13.1716 11.8284 12.5 11 12.5C10.1716 12.5 9.5 13.1716 9.5 14L9.5 26C9.5 26.8284 10.1716 27.5 11 27.5C11.8284 27.5 12.5 26.8284 12.5 26L12.5 14Z" fill="currentColor"></path><path d="M23 14.5C23.8284 14.5 24.5 15.1716 24.5 16V24C24.5 24.8284 23.8284 25.5 23 25.5C22.1716 25.5 21.5 24.8284 21.5 24V16C21.5 15.1716 22.1716 14.5 23 14.5Z" fill="currentColor"></path><path d="M30.5 12C30.5 11.1716 29.8284 10.5 29 10.5C28.1716 10.5 27.5 11.1716 27.5 12V26C27.5 26.8284 28.1716 27.5 29 27.5C29.8284 27.5 30.5 26.8284 30.5 26V12Z" fill="currentColor"></path></svg>`,
  chamber: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M22.4127 4.95374C22.4127 4.06501 23.1333 3.34454 24.022 3.34454L32.0679 3.34456C32.9568 3.34457 33.6772 4.06503 33.6772 4.95376C33.6772 5.8425 32.9568 6.56296 32.0679 6.56296L29.6541 6.56294V9.78133H31.0035C34.4554 9.78133 37.7002 12.4172 37.7002 16.4779V22.3952C37.7002 26.4557 34.4554 29.0917 31.0035 29.0917H29.6541V32.3101H32.0679C32.9568 32.3101 33.6772 33.0306 33.6772 33.9193C33.6772 34.808 32.9568 35.5284 32.0679 35.5284H24.022C23.1333 35.5284 22.4127 34.808 22.4127 33.9193C22.4127 33.0305 23.1333 32.3101 24.022 32.3101H26.4358V6.56294H24.022C23.1333 6.56294 22.4127 5.84247 22.4127 4.95374ZM8.99446 9.78133H21.6082V12.9997H9.05649C6.5 12.9997 5.51625 14.2 5.51625 16.54V22.3331C5.51625 24.6 6.5 25.8732 9.05649 25.8732H21.6082V29.0917H8.99449C4.5 29.0917 2.29785 26.4 2.29785 22.395V16.4779C2.29785 12.4 4.5 9.78133 8.99446 9.78133Z" fill="currentColor"></path></svg>`,
  cpu: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M14.5666 31.5585C14.323 32.3503 14.7674 33.1897 15.5592 33.4333C16.351 33.6769 17.1903 33.2326 17.434 32.4408L25.434 6.44076C25.6776 5.64897 25.2332 4.8096 24.4414 4.56597C23.6496 4.32234 22.8102 4.76671 22.5666 5.55851L14.5666 31.5585Z" fill="currentColor"></path><path d="M10.7117 4.67957C11.4411 5.07233 11.714 5.98202 11.3212 6.71143L4.70414 19.0003L11.3212 31.2891C11.714 32.0185 11.4411 32.9282 10.7117 33.321C9.98225 33.7137 9.07256 33.4408 8.6798 32.7114L1.29688 19.0003L8.6798 5.28913C9.07256 4.55972 9.98225 4.28682 10.7117 4.67957Z" fill="currentColor"></path><path d="M29.2893 4.67957C28.5599 5.07233 28.287 5.98202 28.6798 6.71143L35.2968 19.0003L28.6798 31.2891C28.287 32.0185 28.5599 32.9282 29.2893 33.321C30.0187 33.7137 30.9284 33.4408 31.3212 32.7114L38.7041 19.0003L31.3212 5.28913C30.9284 4.55972 30.0187 4.28682 29.2893 4.67957Z" fill="currentColor"></path></svg>`,
  mainboard: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.5389 13.247L10.786 20.1273C8.60516 24.1256 11.499 29.0004 16.0534 29.0004H23.7937C28.4169 29.0004 31.3031 23.9919 28.9849 19.9919L24.9975 13.1116C22.6512 9.06306 16.7796 9.13909 14.5389 13.247ZM17.1726 14.6836L13.4197 21.5639C12.3293 23.563 13.7762 26.0004 16.0534 26.0004H23.7937C26.1053 26.0004 27.5484 23.4962 26.3893 21.4962L22.4019 14.6159C21.2287 12.5916 18.2929 12.6296 17.1726 14.6836Z" fill="currentColor"></path><rect x="2" y="2" width="36" height="36" rx="9" stroke="currentColor" stroke-width="3"/></svg>`,
  ssd: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M3.53727 9.70222C0.167266 11.5722 0.167266 16.4322 3.53727 18.3022L17.5873 26.1022C19.0773 26.9322 20.8773 26.9322 22.3673 26.1022L36.4173 18.3022C39.7873 16.4322 39.7873 11.5722 36.4173 9.70222L22.3673 1.90222C20.8773 1.07222 19.0773 1.07222 17.5873 1.90222L3.53727 9.70222Z" fill="currentColor"></path><path d="M36.0475 21.5024L36.4075 21.7024C39.7775 23.5724 39.7775 28.4324 36.4075 30.3024L22.3575 38.1024C20.8675 38.9324 19.0675 38.9324 17.5775 38.1024L3.5275 30.3024C0.1575 28.4324 0.1575 23.5724 3.5275 21.7024L6.9775 23.2224L19.0375 35.4924L34.9475 27.6924L36.0475 21.5024Z" fill="currentColor"></path></svg>`,
  cables: `<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M6 20C6 24.4183 9.58172 28 14 28C18.4183 28 22 24.4183 22 20C22 15.5817 18.4183 12 14 12C9.58172 12 6 15.5817 6 20ZM26 6H14C6.26801 6 0 12.268 0 20C0 27.732 6.26801 34 14 34H26C33.732 34 40 27.732 40 20C40 12.268 33.732 6 26 6ZM3 20C3 13.9249 7.92487 9 14 9H26C32.0751 9 37 13.9249 37 20C37 26.0751 32.0751 31 26 31H14C7.92487 31 3 26.0751 3 20Z" fill="currentColor"></path></svg>`,
  plus: `<svg viewBox="0 -960 960 960" fill="currentColor"><path d="M444-444H240v-72h204v-204h72v204h204v72H516v204h-72v-204Z"/></svg>`
};

export const MAIN_CATEGORIES = [
  { key: 'ALL', label: 'Tất cả sản phẩm', short: 'Tất cả', svgKey: 'expand' },
  { key: 'pc', label: 'PC Gaming & Đồ Họa', short: 'PC Gaming', svgKey: 'chamber' },
  { key: 'pc-van-phong', label: 'PC Văn Phòng', short: 'PC Văn Phòng', svgKey: 'mainboard' },
  { key: 'linh-kien-may-tinh', label: 'Linh Kiện Máy Tính', short: 'Linh Kiện PC', svgKey: 'cpu' },
  { key: 'man-hinh-may-tinh', label: 'Màn Hình Máy Tính', short: 'Màn Hình', svgKey: 'gpu' },
  { key: 'gaming-gear', label: 'Gaming Gear & Ghế', short: 'Gaming Gear', svgKey: 'cables' },
  { key: 'decor', label: 'Mô Hình & Decor Setup', short: 'Mô Hình & Decor', svgKey: 'decorBox' }
];

export const CATEGORY_LABEL_MAP = Object.fromEntries(MAIN_CATEGORIES.map((m) => [m.key, m.label]));

export const GROUP3D_LABELS = {
  Group_GPU: 'Card Màn Hình (VGA)',
  Group_CPU: 'Vi Xử Lý (CPU)',
  Group_Mainboard: 'Bo Mạch Chủ (Mainboard)',
  Group_Cooling: 'Tản Nhiệt & Fan',
  Group_RAM: 'Bộ Nhớ RAM',
  Group_SSD: 'Ổ Cứng SSD / HDD',
  Group_PSU: 'Nguồn Máy Tính (PSU)',
  Group_Case: 'Vỏ Case Máy Tính',
  Group_Cables: 'Cáp & Giá đỡ',
  Group_Accessories: 'Mô Hình & Decor Setup'
};

export const GROUP3D_TO_SUBCAT = {
  Group_GPU: { c: 'linh-kien-may-tinh', sc: 'Card Màn Hình (VGA)' },
  Group_CPU: { c: 'linh-kien-may-tinh', sc: 'Vi Xử Lý (CPU)' },
  Group_Mainboard: { c: 'linh-kien-may-tinh', sc: 'Bo Mạch Chủ (Mainboard)' },
  Group_Cooling: { c: 'linh-kien-may-tinh', sc: 'Tản Nhiệt & Fan' },
  Group_RAM: { c: 'linh-kien-may-tinh', sc: 'Bộ Nhớ RAM' },
  Group_SSD: { c: 'linh-kien-may-tinh', sc: 'Ổ Cứng SSD / HDD' },
  Group_PSU: { c: 'linh-kien-may-tinh', sc: 'Nguồn Máy Tính (PSU)' },
  Group_Case: { c: 'linh-kien-may-tinh', sc: 'Vỏ Case Máy Tính' },
  Group_Cables: { c: 'linh-kien-may-tinh', sc: 'Giá đỡ & Arm' },
  Group_Accessories: { c: 'decor', sc: 'ALL' }
};

export const escHtml = (s) => String(s || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/** Normalizes subcategory display label so partner store names stay out of UI badges/tabs. */
export const formatSubcatLabel = (sc) => {
  const s = String(sc || '');
  return s === 'Mô Hình Lắc Đầu 12cm' ? 'Mô Hình Lò Xo 12cm' : s;
};

/** Strips external partner tags from product spec lines while leaving item titles untouched. */
export const formatSpecText = (spec) => String(spec || '')
  .replace(/Mã\s*SP\s*Lắc\s*Đầu\s*:/gi, 'Mã sản phẩm:')
  .replace(/\s*\(nguồn\s+(?:lacdau\.com|ttgshop\.vn)\)/gi, '')
  .replace(/\s*&\s*Setup\s*Lắc\s*Đầu/gi, ' & Setup')
  .replace(/Mô\s*hình\s*lò\s*xo\s*Lắc\s*Đầu/gi, 'Mô hình lò xo nhún')
  .trim();

export const normalizeVi = (str) => String(str || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[đĐ]/g, 'd')
  .toLowerCase();

export function resolveCatalogImgUrl(dir, file, fallback = PLACEHOLDER_IMAGES.hardwareWide) {
  if (!file) return fallback;
  if (file.startsWith('./') || file.startsWith('http')) return file;
  if (file.startsWith('images/')) return `./data/catalog/${file}`;
  return dir ? `./data/catalog/${dir}/${file}` : `./data/catalog/${file}`;
}

export function getProductImages(item, {
  hardwareFallback = PLACEHOLDER_IMAGES.hardwareWide,
  decorFallback = PLACEHOLDER_IMAGES.decorWide
} = {}) {
  if (!item) return [hardwareFallback];
  if (item._imgs) return item._imgs;
  const list = [];
  const seen = new Set();
  for (const f of (item.g || [])) {
    const u = resolveCatalogImgUrl(item.dir, f, hardwareFallback);
    if (!seen.has(u)) { seen.add(u); list.push(u); }
  }
  for (const f of (item.di || [])) {
    const u = resolveCatalogImgUrl(item.dir, f, hardwareFallback);
    if (!seen.has(u)) { seen.add(u); list.push(u); }
  }
  if (!list.length) list.push(item.c === 'decor' ? decorFallback : hardwareFallback);
  item._imgs = list;
  return list;
}

