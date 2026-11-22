import fs from 'fs';
import path from 'path';
import { CONFIG } from './env.mjs';
import {
  dbAll,
  dbGet,
  dbRun,
  dbTransaction,
  getActiveDbClient,
  hashPassword,
  verifyPassword,
  signSessionToken,
  verifySessionToken
} from './db.mjs';
import {
  HttpError,
  cleanStr,
  normVi,
  isValidEmail,
  isValidPhone,
  requireNonEmpty,
  requireNumber,
  requireEnum,
  formatCode,
  localIsoNow
} from './validators.mjs';

const customerAuthStore = new Map();

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  });
  res.end(body);
}

async function readJsonBody(req, maxBytes = 10 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(new HttpError(413, 'Dữ liệu gửi lên vượt quá giới hạn cho phép (10MB).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) { resolve({}); return; }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'Nội dung JSON không hợp lệ.'));
      }
    });
    req.on('error', () => reject(new HttpError(400, 'Lỗi đọc dữ liệu request.')));
  });
}

function parsePerms(raw) {
  try {
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function loadStaffUserById(userId) {
  const row = await dbGet(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role_id, u.warehouse_id,
            u.is_active, u.last_login_at, u.created_at,
            r.code AS role_code, r.name AS role_name, r.permissions_json,
            w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN warehouses w ON w.id = u.warehouse_id
     WHERE u.id = ?`,
    [userId]
  );
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role_id: row.role_id,
    role_code: row.role_code,
    role_name: row.role_name,
    permissions: parsePerms(row.permissions_json),
    warehouse_id: row.warehouse_id,
    warehouse_code: row.warehouse_code || null,
    warehouse_name: row.warehouse_name || 'Toàn hệ thống (5 kho)',
    warehouse_region: row.warehouse_region || 'Toàn Quốc',
    is_active: Number(row.is_active),
    last_login_at: row.last_login_at,
    is_staff: true
  };
}

async function loadCustomerAccountById(customerId) {
  const c = await dbGet(`SELECT * FROM customers WHERE id = ?`, [customerId]);
  if (!c) return null;
  const roleName = c.customer_type === 'VIP'
    ? 'Khách Hàng VIP'
    : c.customer_type === 'B2B'
      ? 'Khách Hàng Doanh Nghiệp (B2B)'
      : 'Khách Hàng Thành Viên';
  return {
    id: c.id,
    customer_id: c.id,
    username: c.code,
    code: c.code,
    full_name: c.name,
    email: c.email,
    phone: c.phone,
    address: c.address,
    region: c.region,
    customer_type: c.customer_type,
    credit_limit: Number(c.credit_limit || 0),
    receivable_debt: Number(c.receivable_debt || 0),
    total_spent: Number(c.total_spent || 0),
    role_id: null,
    role_code: 'CUSTOMER',
    role_name: roleName,
    permissions: [],
    warehouse_id: null,
    warehouse_name: c.region,
    is_active: Number(c.is_active),
    is_staff: false
  };
}

async function getAuthContext(req) {
  const auth = String(req.headers.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  const payload = verifySessionToken(token);
  if (!payload) return null;
  if (payload.kind === 'customer') {
    const cust = await loadCustomerAccountById(payload.sub);
    if (!cust || !cust.is_active) return null;
    return cust;
  }
  const user = await loadStaffUserById(payload.sub);
  if (!user || !user.is_active) return null;
  return user;
}

async function requireAuth(req, { staffOnly = false } = {}) {
  const ctx = await getAuthContext(req);
  if (!ctx) throw new HttpError(401, 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.');
  if (staffOnly && !ctx.is_staff) {
    throw new HttpError(403, 'Tài khoản khách hàng không có quyền truy cập hệ thống quản trị nội bộ.');
  }
  return ctx;
}

function hasAnyPermission(user, perms) {
  if (!user || !user.is_staff) return false;
  if (user.role_code === 'ADMIN' || user.permissions.includes('ALL')) return true;
  return perms.some((p) => user.permissions.includes(p));
}

function requirePermission(user, perms, label = 'chức năng này') {
  if (!hasAnyPermission(user, perms)) {
    throw new HttpError(403, `Vai trò "${user?.role_name || 'N/A'}" không có quyền thực hiện ${label}.`);
  }
}

function parseIdParam(raw, label = 'ID') {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, `${label} không hợp lệ.`);
  return id;
}

function regionToDefaultWarehouseCode(region) {
  const r = normVi(region);
  if (r.includes('nam') || r.includes('hcm') || r.includes('sai gon') || r.includes('can tho') || r.includes('binh duong') || r.includes('dong nai')) {
    return 'WH-HCM-HUB';
  }
  if (r.includes('trung') || r.includes('da nang') || r.includes('hue') || r.includes('nha trang') || r.includes('nghe an')) {
    return 'WH-DN-HUB';
  }
  return 'WH-HN-HUB';
}

function parsePeriodStart(period) {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'today') return d;
  if (period === '7days') { d.setDate(d.getDate() - 6); return d; }
  if (period === '30days') { d.setDate(d.getDate() - 29); return d; }
  if (period === 'this_month') return new Date(now.getFullYear(), now.getMonth(), 1);
  if (period === 'this_year') return new Date(now.getFullYear(), 0, 1);
  return null;
}

function parseYmdDate(raw, endOfDay = false) {
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new HttpError(400, 'Định dạng ngày không hợp lệ (đúng chuẩn YYYY-MM-DD).');
  }
  const [y, m, d] = raw.split('-').map(Number);
  const dt = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    throw new HttpError(400, `Ngày "${raw}" không tồn tại trên lịch.`);
  }
  return dt;
}

function parseDateRange(url) {
  const period = cleanStr(url.searchParams.get('period') || 'all', 30);
  const fromRaw = cleanStr(url.searchParams.get('from'), 20);
  const toRaw = cleanStr(url.searchParams.get('to'), 20);

  if (fromRaw || toRaw) {
    const startDate = parseYmdDate(fromRaw, false);
    const endDate = parseYmdDate(toRaw, true);
    if (startDate && endDate && startDate > endDate) {
      throw new HttpError(400, 'Khoảng thời gian không hợp lệ: "Từ ngày" phải nhỏ hơn hoặc bằng "Đến ngày".');
    }
    return { period: 'custom', from: fromRaw, to: toRaw, startDate, endDate };
  }

  return { period, from: '', to: '', startDate: parsePeriodStart(period), endDate: null };
}

function parseDbDate(str) {
  if (!str) return null;
  const iso = String(str).includes('T') ? String(str) : String(str).replace(' ', 'T');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isDateInRange(dateStr, range) {
  if (!range || (!range.startDate && !range.endDate)) return true;
  const d = parseDbDate(dateStr);
  if (!d) return false;
  if (range.startDate && d < range.startDate) return false;
  if (range.endDate && d > range.endDate) return false;
  return true;
}

function defaultPaymentCategory(dir) {
  switch (dir) {
    case 'RECEIPT_FROM_CUSTOMER': return 'Thu công nợ / Bán hàng';
    case 'OTHER_RECEIPT': return 'Thu nhập khác';
    case 'PAYMENT_TO_SUPPLIER': return 'Thanh toán công nợ NCC';
    case 'OPERATING_EXPENSE': return 'Chi phí vận hành';
    default: return 'Giao dịch quỹ';
  }
}

/* ============================================================================
 *  AUTH HANDLERS
 * ============================================================================ */
async function handleLogin(req, res) {
  const body = await readJsonBody(req);
  const identifier = requireNonEmpty(body.identifier ?? body.username ?? body.email, 'Tên đăng nhập / Email', 2);
  const password = requireNonEmpty(body.password, 'Mật khẩu', 4);

  const staffRow = await dbGet(
    `SELECT id, password_hash, is_active FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
    [identifier, identifier]
  );

  if (staffRow) {
    if (!Number(staffRow.is_active)) {
      throw new HttpError(403, 'Tài khoản nhân sự này đang bị khóa. Vui lòng liên hệ Quản trị hệ thống.');
    }
    if (!verifyPassword(password, staffRow.password_hash)) {
      throw new HttpError(401, 'Tên đăng nhập hoặc mật khẩu không chính xác.');
    }
    await dbRun(`UPDATE users SET last_login_at = ? WHERE id = ?`, [localIsoNow(), staffRow.id]);
    const user = await loadStaffUserById(staffRow.id);
    const token = signSessionToken({ sub: user.id, kind: 'staff', role: user.role_code });
    return sendJson(res, 200, { token, user, db_client: getActiveDbClient() });
  }

  const custRow = await dbGet(
    `SELECT * FROM customers WHERE LOWER(email) = LOWER(?) OR phone = ?`,
    [identifier, identifier.replace(/[\s.-]/g, '')]
  );

  if (custRow) {
    if (!Number(custRow.is_active)) {
      throw new HttpError(403, 'Tài khoản khách hàng đang bị tạm khóa.');
    }
    const storedHash = customerAuthStore.get(custRow.id);
    const ok = storedHash ? verifyPassword(password, storedHash) : password === '123456';
    if (!ok) {
      throw new HttpError(401, 'Email/SĐT hoặc mật khẩu không chính xác (tài khoản khách mẫu dùng mật khẩu: 123456).');
    }
    const user = await loadCustomerAccountById(custRow.id);
    const token = signSessionToken({ sub: user.id, kind: 'customer', role: 'CUSTOMER' });
    return sendJson(res, 200, { token, user, db_client: getActiveDbClient() });
  }

  throw new HttpError(401, 'Tài khoản không tồn tại trong hệ thống SKYCRUMB.');
}

async function handleRegister(req, res) {
  const body = await readJsonBody(req);
  const full_name = requireNonEmpty(body.full_name ?? body.name, 'Họ và tên', 2);
  const email = requireNonEmpty(body.email, 'Email', 5).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Định dạng Email không hợp lệ.');
  const phoneRaw = requireNonEmpty(body.phone, 'Số điện thoại', 9);
  const phone = phoneRaw.replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại phải bắt đầu bằng 0 và gồm 9–11 chữ số.');
  const password = requireNonEmpty(body.password, 'Mật khẩu', 6);
  const address = cleanStr(body.address, 300);
  const region = cleanStr(body.region || 'Miền Bắc', 50);

  const dupUser = await dbGet(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
  if (dupUser) throw new HttpError(409, 'Email này thuộc tài khoản nhân sự nội bộ, vui lòng dùng email khác.');

  const dupCust = await dbGet(`SELECT id FROM customers WHERE LOWER(email) = LOWER(?) OR phone = ?`, [email, phone]);
  if (dupCust) throw new HttpError(409, 'Email hoặc Số điện thoại này đã được đăng ký trước đó.');

  const code = formatCode('KH');
  const now = localIsoNow();
  const ins = await dbRun(
    `INSERT INTO customers (code, name, customer_type, tax_code, phone, email, address, region, credit_limit, receivable_debt, total_spent, is_active, created_at)
     VALUES (?, ?, 'RETAIL', '', ?, ?, ?, ?, 20000000, 0, 0, 1, ?)`,
    [code, full_name, phone, email, address, region, now]
  );

  customerAuthStore.set(ins.lastInsertRowid, hashPassword(password));
  const user = await loadCustomerAccountById(ins.lastInsertRowid);
  const token = signSessionToken({ sub: user.id, kind: 'customer', role: 'CUSTOMER' });
  return sendJson(res, 201, { token, user, message: 'Đăng ký tài khoản khách hàng thành công.' });
}

/* ============================================================================
 *  META
 * ============================================================================ */
async function handleMeta(req, res) {
  await requireAuth(req, { staffOnly: true });
  const [roles, warehouses, categories, suppliers, productsCountRow, customersCountRow] = await Promise.all([
    dbAll(`SELECT id, code, name, description, permissions_json FROM roles ORDER BY id ASC`),
    dbAll(`SELECT * FROM warehouses ORDER BY id ASC`),
    dbAll(`SELECT * FROM categories ORDER BY id ASC`),
    dbAll(`SELECT id, code, name, phone, email, payment_terms_days, lead_time_days, payable_debt, is_active FROM suppliers ORDER BY id ASC`),
    dbGet(`SELECT COUNT(*) AS cnt FROM products`),
    dbGet(`SELECT COUNT(*) AS cnt FROM customers`)
  ]);
  return sendJson(res, 200, {
    db_client: getActiveDbClient(),
    roles: roles.map((r) => ({ ...r, permissions: parsePerms(r.permissions_json) })),
    warehouses,
    categories,
    suppliers,
    counts: {
      products: Number(productsCountRow?.cnt || 0),
      customers: Number(customersCountRow?.cnt || 0),
      suppliers: suppliers.length,
      warehouses: warehouses.length,
      categories: categories.length
    }
  });
}

/* ============================================================================
 *  USERS CRUD
 * ============================================================================ */
async function handleGetUsers(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['USERS'], 'xem danh sách người dùng');

  const rows = await dbAll(
    `SELECT u.id, u.username, u.full_name, u.email, u.phone, u.role_id, u.warehouse_id,
            u.is_active, u.last_login_at, u.created_at,
            r.code AS role_code, r.name AS role_name,
            w.code AS warehouse_code, w.name AS warehouse_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN warehouses w ON w.id = u.warehouse_id
     ORDER BY u.id ASC`
  );

  const q = normVi(url.searchParams.get('q') || '');
  const roleId = url.searchParams.get('role_id');
  const whId = url.searchParams.get('warehouse_id');
  const active = url.searchParams.get('is_active');

  const filtered = rows.filter((u) => {
    if (roleId && String(u.role_id) !== String(roleId)) return false;
    if (whId && String(u.warehouse_id || '') !== String(whId)) return false;
    if (active !== null && active !== '' && String(u.is_active) !== String(active)) return false;
    if (q) {
      const hay = normVi(`${u.username} ${u.full_name} ${u.email} ${u.phone} ${u.role_name} ${u.warehouse_name || ''}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return sendJson(res, 200, { items: filtered, total: filtered.length });
}

async function handleCreateUser(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['USERS'], 'tạo tài khoản nhân viên');
  const body = await readJsonBody(req);

  const username = requireNonEmpty(body.username, 'Tên đăng nhập', 3).toLowerCase();
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    throw new HttpError(400, 'Tên đăng nhập chỉ gồm chữ thường, số và ký tự . _ - (3–50 ký tự).');
  }
  const password = requireNonEmpty(body.password, 'Mật khẩu', 6);
  const full_name = requireNonEmpty(body.full_name, 'Họ và tên', 2);
  const email = requireNonEmpty(body.email, 'Email', 5).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Email không hợp lệ.');
  const phone = requireNonEmpty(body.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ (bắt đầu bằng 0, 9–11 số).');
  const role_id = requireNumber(body.role_id, 'Vai trò', { min: 1, integer: true });
  const warehouse_id = body.warehouse_id ? requireNumber(body.warehouse_id, 'Kho trực thuộc', { min: 1, integer: true }) : null;
  const is_active = body.is_active === 0 || body.is_active === false || body.is_active === '0' ? 0 : 1;

  const role = await dbGet(`SELECT id FROM roles WHERE id = ?`, [role_id]);
  if (!role) throw new HttpError(400, 'Vai trò không tồn tại.');
  if (warehouse_id) {
    const wh = await dbGet(`SELECT id FROM warehouses WHERE id = ?`, [warehouse_id]);
    if (!wh) throw new HttpError(400, 'Kho trực thuộc không tồn tại.');
  }

  const ins = await dbRun(
    `INSERT INTO users (username, password_hash, full_name, email, phone, role_id, warehouse_id, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [username, hashPassword(password), full_name, email, phone, role_id, warehouse_id, is_active, localIsoNow()]
  );

  const item = await loadStaffUserById(ins.lastInsertRowid);
  return sendJson(res, 201, { item, message: 'Tạo người dùng thành công.' });
}

async function handleUpdateUser(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['USERS'], 'cập nhật người dùng');
  const id = parseIdParam(idParam, 'Mã người dùng');
  const existing = await dbGet(`SELECT * FROM users WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy người dùng.');

  const body = await readJsonBody(req);
  const full_name = requireNonEmpty(body.full_name ?? existing.full_name, 'Họ và tên', 2);
  const email = requireNonEmpty(body.email ?? existing.email, 'Email', 5).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Email không hợp lệ.');
  const phone = requireNonEmpty(body.phone ?? existing.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ.');
  const role_id = requireNumber(body.role_id ?? existing.role_id, 'Vai trò', { min: 1, integer: true });
  const warehouse_id = body.warehouse_id === '' || body.warehouse_id === null
    ? null
    : requireNumber(body.warehouse_id ?? existing.warehouse_id, 'Kho trực thuộc', { min: 1, integer: true });
  const is_active = body.is_active === undefined ? Number(existing.is_active) : (Number(body.is_active) ? 1 : 0);

  if (id === me.id && (is_active === 0 || role_id !== existing.role_id)) {
    throw new HttpError(400, 'Không thể tự khóa hoặc tự hạ quyền tài khoản Quản trị đang đăng nhập.');
  }

  let passwordHash = existing.password_hash;
  if (body.password && String(body.password).trim().length > 0) {
    const newPass = requireNonEmpty(body.password, 'Mật khẩu mới', 6);
    passwordHash = hashPassword(newPass);
  }

  await dbRun(
    `UPDATE users SET full_name = ?, email = ?, phone = ?, role_id = ?, warehouse_id = ?, is_active = ?, password_hash = ? WHERE id = ?`,
    [full_name, email, phone, role_id, warehouse_id, is_active, passwordHash, id]
  );

  const item = await loadStaffUserById(id);
  return sendJson(res, 200, { item, message: 'Cập nhật thông tin người dùng thành công.' });
}

async function handleDeleteUser(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['USERS'], 'xóa người dùng');
  const id = parseIdParam(idParam, 'Mã người dùng');
  if (id === me.id || id === 1) {
    throw new HttpError(400, 'Không thể xóa tài khoản Quản trị gốc hoặc tài khoản đang đăng nhập.');
  }
  const existing = await dbGet(`SELECT id FROM users WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy người dùng.');

  const refCount = await dbGet(
    `SELECT (SELECT COUNT(*) FROM purchase_receipts WHERE created_by = ?)
          + (SELECT COUNT(*) FROM sales_invoices WHERE created_by = ?)
          + (SELECT COUNT(*) FROM stock_transfers WHERE created_by = ?)
          + (SELECT COUNT(*) FROM inventory_ledger WHERE created_by = ?) AS cnt`,
    [id, id, id, id]
  );
  if (Number(refCount?.cnt || 0) > 0) {
    throw new HttpError(409, 'Nhân sự này đã lập chứng từ/phiếu kho. Vui lòng chuyển trạng thái Ngừng hoạt động thay vì xóa.');
  }

  await dbRun(`DELETE FROM users WHERE id = ?`, [id]);
  return sendJson(res, 200, { deleted: true, id, message: 'Đã xóa người dùng.' });
}

/* ============================================================================
 *  CATEGORIES CRUD
 * ============================================================================ */
async function handleGetCategories(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const cats = await dbAll(`SELECT * FROM categories ORDER BY id ASC`);
  const prods = await dbAll(`SELECT id, category_id FROM products`);
  const stocks = await dbAll(
    `SELECT p.category_id, COALESCE(SUM(ws.qty_on_hand), 0) AS qty
     FROM products p
     LEFT JOIN warehouse_stocks ws ON ws.product_id = p.id
     GROUP BY p.category_id`
  );
  const prodCountMap = new Map();
  prods.forEach((p) => prodCountMap.set(p.category_id, (prodCountMap.get(p.category_id) || 0) + 1));
  const stockMap = new Map(stocks.map((s) => [s.category_id, Number(s.qty || 0)]));

  const q = normVi(url.searchParams.get('q') || '');
  const group = normVi(url.searchParams.get('parent_group') || '');
  const active = url.searchParams.get('is_active');

  const items = cats.map((c) => ({
    ...c,
    product_count: prodCountMap.get(c.id) || 0,
    total_stock: stockMap.get(c.id) || 0
  })).filter((c) => {
    if (active !== null && active !== '' && String(c.is_active) !== String(active)) return false;
    if (group && !normVi(c.parent_group).includes(group)) return false;
    if (q && !normVi(`${c.code} ${c.name} ${c.parent_group} ${c.description}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleCreateCategory(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CATEGORIES'], 'thêm loại hàng');
  const body = await readJsonBody(req);

  const code = requireNonEmpty(body.code || formatCode('CAT'), 'Mã loại hàng', 2).toUpperCase();
  const name = requireNonEmpty(body.name, 'Tên loại hàng', 2);
  const parent_group = cleanStr(body.parent_group || 'Linh Kiện & Thiết Bị', 150);
  const default_warranty_months = requireNumber(body.default_warranty_months ?? 36, 'Bảo hành mặc định', { min: 0, max: 120, integer: true });
  const min_stock_default = requireNumber(body.min_stock_default ?? 5, 'Mức tồn tối thiểu ROP', { min: 0, max: 10000, integer: true });
  const description = cleanStr(body.description, 1000);
  const is_active = body.is_active === 0 || body.is_active === '0' || body.is_active === false ? 0 : 1;

  const ins = await dbRun(
    `INSERT INTO categories (code, name, parent_group, default_warranty_months, min_stock_default, description, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [code, name, parent_group, default_warranty_months, min_stock_default, description, is_active]
  );
  const item = await dbGet(`SELECT * FROM categories WHERE id = ?`, [ins.lastInsertRowid]);
  return sendJson(res, 201, { item, message: 'Đã thêm loại hàng mới.' });
}

async function handleUpdateCategory(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CATEGORIES'], 'cập nhật loại hàng');
  const id = parseIdParam(idParam, 'Mã loại hàng');
  const existing = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy loại hàng.');

  const body = await readJsonBody(req);
  const code = requireNonEmpty(body.code ?? existing.code, 'Mã loại hàng', 2).toUpperCase();
  const name = requireNonEmpty(body.name ?? existing.name, 'Tên loại hàng', 2);
  const parent_group = cleanStr(body.parent_group ?? existing.parent_group, 150);
  const default_warranty_months = requireNumber(body.default_warranty_months ?? existing.default_warranty_months, 'Bảo hành mặc định', { min: 0, max: 120, integer: true });
  const min_stock_default = requireNumber(body.min_stock_default ?? existing.min_stock_default, 'Mức tồn tối thiểu ROP', { min: 0, max: 10000, integer: true });
  const description = cleanStr(body.description ?? existing.description, 1000);
  const is_active = body.is_active === undefined ? Number(existing.is_active) : (Number(body.is_active) ? 1 : 0);

  await dbRun(
    `UPDATE categories SET code = ?, name = ?, parent_group = ?, default_warranty_months = ?, min_stock_default = ?, description = ?, is_active = ? WHERE id = ?`,
    [code, name, parent_group, default_warranty_months, min_stock_default, description, is_active, id]
  );
  const item = await dbGet(`SELECT * FROM categories WHERE id = ?`, [id]);
  return sendJson(res, 200, { item, message: 'Đã cập nhật loại hàng.' });
}

async function handleDeleteCategory(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CATEGORIES'], 'xóa loại hàng');
  const id = parseIdParam(idParam, 'Mã loại hàng');
  const existing = await dbGet(`SELECT id FROM categories WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy loại hàng.');

  const cnt = await dbGet(`SELECT COUNT(*) AS cnt FROM products WHERE category_id = ?`, [id]);
  if (Number(cnt?.cnt || 0) > 0) {
    throw new HttpError(409, `Loại hàng đang chứa ${cnt.cnt} sản phẩm. Hãy chuyển danh mục sản phẩm trước khi xóa.`);
  }
  await dbRun(`DELETE FROM categories WHERE id = ?`, [id]);
  return sendJson(res, 200, { deleted: true, id, message: 'Đã xóa loại hàng.' });
}

/* ============================================================================
 *  SUPPLIERS CRUD
 * ============================================================================ */
async function handleGetSuppliers(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const rows = await dbAll(`SELECT * FROM suppliers ORDER BY id ASC`);
  const stats = await dbAll(
    `SELECT supplier_id, COUNT(*) AS receipt_count, COALESCE(SUM(total_amount), 0) AS total_purchased
     FROM purchase_receipts GROUP BY supplier_id`
  );
  const statMap = new Map(stats.map((s) => [s.supplier_id, s]));

  const q = normVi(url.searchParams.get('q') || '');
  const hasDebt = url.searchParams.get('has_debt');
  const active = url.searchParams.get('is_active');

  const items = rows.map((s) => ({
    ...s,
    payable_debt: Number(s.payable_debt || 0),
    rating: Number(s.rating || 5),
    receipt_count: Number(statMap.get(s.id)?.receipt_count || 0),
    total_purchased: Number(statMap.get(s.id)?.total_purchased || 0)
  })).filter((s) => {
    if (active !== null && active !== '' && String(s.is_active) !== String(active)) return false;
    if (hasDebt === '1' && s.payable_debt <= 0) return false;
    if (hasDebt === '0' && s.payable_debt > 0) return false;
    if (q && !normVi(`${s.code} ${s.name} ${s.tax_code} ${s.contact_person} ${s.phone} ${s.email} ${s.address}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleCreateSupplier(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SUPPLIERS'], 'thêm nhà cung cấp');
  const body = await readJsonBody(req);

  const code = requireNonEmpty(body.code || formatCode('NCC'), 'Mã nhà cung cấp', 3).toUpperCase();
  const name = requireNonEmpty(body.name, 'Tên nhà cung cấp', 2);
  const tax_code = cleanStr(body.tax_code, 50);
  const contact_person = cleanStr(body.contact_person, 150);
  const phone = requireNonEmpty(body.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại nhà cung cấp không hợp lệ.');
  const email = requireNonEmpty(body.email, 'Email nhà cung cấp', 5).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Email nhà cung cấp không hợp lệ.');
  const address = cleanStr(body.address, 300);
  const payment_terms_days = requireNumber(body.payment_terms_days ?? 30, 'Hạn thanh toán (ngày)', { min: 0, max: 365, integer: true });
  const lead_time_days = requireNumber(body.lead_time_days ?? 3, 'Thời gian giao hàng (ngày)', { min: 1, max: 180, integer: true });
  const rating = requireNumber(body.rating ?? 5, 'Đánh giá NCC', { min: 1, max: 5 });
  const is_active = body.is_active === 0 || body.is_active === '0' || body.is_active === false ? 0 : 1;

  const ins = await dbRun(
    `INSERT INTO suppliers (code, name, tax_code, contact_person, phone, email, address, payment_terms_days, lead_time_days, rating, payable_debt, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [code, name, tax_code, contact_person, phone, email, address, payment_terms_days, lead_time_days, rating, is_active, localIsoNow()]
  );
  const item = await dbGet(`SELECT * FROM suppliers WHERE id = ?`, [ins.lastInsertRowid]);
  return sendJson(res, 201, { item, message: 'Đã thêm nhà cung cấp.' });
}

async function handleUpdateSupplier(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SUPPLIERS'], 'cập nhật nhà cung cấp');
  const id = parseIdParam(idParam, 'Mã nhà cung cấp');
  const existing = await dbGet(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy nhà cung cấp.');

  const body = await readJsonBody(req);
  const code = requireNonEmpty(body.code ?? existing.code, 'Mã nhà cung cấp', 3).toUpperCase();
  const name = requireNonEmpty(body.name ?? existing.name, 'Tên nhà cung cấp', 2);
  const tax_code = cleanStr(body.tax_code ?? existing.tax_code, 50);
  const contact_person = cleanStr(body.contact_person ?? existing.contact_person, 150);
  const phone = requireNonEmpty(body.phone ?? existing.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ.');
  const email = requireNonEmpty(body.email ?? existing.email, 'Email', 5).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, 'Email không hợp lệ.');
  const address = cleanStr(body.address ?? existing.address, 300);
  const payment_terms_days = requireNumber(body.payment_terms_days ?? existing.payment_terms_days, 'Hạn thanh toán', { min: 0, max: 365, integer: true });
  const lead_time_days = requireNumber(body.lead_time_days ?? existing.lead_time_days, 'Lead time', { min: 1, max: 180, integer: true });
  const rating = requireNumber(body.rating ?? existing.rating, 'Đánh giá', { min: 1, max: 5 });
  const is_active = body.is_active === undefined ? Number(existing.is_active) : (Number(body.is_active) ? 1 : 0);

  await dbRun(
    `UPDATE suppliers SET code=?, name=?, tax_code=?, contact_person=?, phone=?, email=?, address=?, payment_terms_days=?, lead_time_days=?, rating=?, is_active=? WHERE id=?`,
    [code, name, tax_code, contact_person, phone, email, address, payment_terms_days, lead_time_days, rating, is_active, id]
  );
  const item = await dbGet(`SELECT * FROM suppliers WHERE id = ?`, [id]);
  return sendJson(res, 200, { item, message: 'Đã cập nhật nhà cung cấp.' });
}

async function handleDeleteSupplier(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SUPPLIERS'], 'xóa nhà cung cấp');
  const id = parseIdParam(idParam, 'Mã nhà cung cấp');
  const existing = await dbGet(`SELECT id FROM suppliers WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy nhà cung cấp.');

  const cnt = await dbGet(`SELECT COUNT(*) AS cnt FROM purchase_receipts WHERE supplier_id = ?`, [id]);
  if (Number(cnt?.cnt || 0) > 0) {
    throw new HttpError(409, 'Nhà cung cấp này đã phát sinh phiếu nhập hàng. Không thể xóa, hãy chuyển Ngừng hoạt động.');
  }
  await dbRun(`DELETE FROM suppliers WHERE id = ?`, [id]);
  return sendJson(res, 200, { deleted: true, id, message: 'Đã xóa nhà cung cấp.' });
}

/* ============================================================================
 *  CUSTOMERS CRUD
 * ============================================================================ */
async function handleGetCustomers(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const rows = await dbAll(`SELECT * FROM customers ORDER BY id DESC`);
  const stats = await dbAll(
    `SELECT customer_id, COUNT(*) AS order_count FROM sales_invoices GROUP BY customer_id`
  );
  const statMap = new Map(stats.map((s) => [s.customer_id, Number(s.order_count || 0)]));

  const q = normVi(url.searchParams.get('q') || '');
  const type = url.searchParams.get('customer_type') || '';
  const region = url.searchParams.get('region') || '';
  const hasDebt = url.searchParams.get('has_debt');
  const active = url.searchParams.get('is_active');

  const items = rows.map((c) => ({
    ...c,
    credit_limit: Number(c.credit_limit || 0),
    receivable_debt: Number(c.receivable_debt || 0),
    total_spent: Number(c.total_spent || 0),
    order_count: statMap.get(c.id) || 0
  })).filter((c) => {
    if (type && c.customer_type !== type) return false;
    if (region && c.region !== region) return false;
    if (active !== null && active !== '' && String(c.is_active) !== String(active)) return false;
    if (hasDebt === '1' && c.receivable_debt <= 0) return false;
    if (hasDebt === '0' && c.receivable_debt > 0) return false;
    if (q && !normVi(`${c.code} ${c.name} ${c.phone} ${c.email} ${c.tax_code} ${c.address} ${c.region}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleCreateCustomer(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CUSTOMERS', 'SALES'], 'thêm khách hàng');
  const body = await readJsonBody(req);

  const code = requireNonEmpty(body.code || formatCode('KH'), 'Mã khách hàng', 3).toUpperCase();
  const name = requireNonEmpty(body.name, 'Tên khách hàng', 2);
  const customer_type = requireEnum(body.customer_type || 'RETAIL', ['RETAIL', 'VIP', 'B2B'], 'Phân hạng khách hàng');
  const tax_code = cleanStr(body.tax_code, 50);
  const phone = requireNonEmpty(body.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ.');
  const email = cleanStr(body.email, 150).toLowerCase();
  if (email && !isValidEmail(email)) throw new HttpError(400, 'Email khách hàng không hợp lệ.');
  const address = cleanStr(body.address, 300);
  const region = requireEnum(body.region || 'Miền Bắc', ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Toàn Quốc'], 'Khu vực');
  const credit_limit = requireNumber(body.credit_limit ?? (customer_type === 'B2B' ? 300000000 : 20000000), 'Hạn mức công nợ', { min: 0 });
  const is_active = body.is_active === 0 || body.is_active === '0' || body.is_active === false ? 0 : 1;

  const ins = await dbRun(
    `INSERT INTO customers (code, name, customer_type, tax_code, phone, email, address, region, credit_limit, receivable_debt, total_spent, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [code, name, customer_type, tax_code, phone, email, address, region, credit_limit, is_active, localIsoNow()]
  );
  const item = await dbGet(`SELECT * FROM customers WHERE id = ?`, [ins.lastInsertRowid]);
  return sendJson(res, 201, { item, message: 'Đã thêm khách hàng mới.' });
}

async function handleUpdateCustomer(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CUSTOMERS', 'SALES'], 'cập nhật khách hàng');
  const id = parseIdParam(idParam, 'Mã khách hàng');
  const existing = await dbGet(`SELECT * FROM customers WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy khách hàng.');

  const body = await readJsonBody(req);
  const code = requireNonEmpty(body.code ?? existing.code, 'Mã khách hàng', 3).toUpperCase();
  const name = requireNonEmpty(body.name ?? existing.name, 'Tên khách hàng', 2);
  const customer_type = requireEnum(body.customer_type ?? existing.customer_type, ['RETAIL', 'VIP', 'B2B'], 'Phân hạng');
  const tax_code = cleanStr(body.tax_code ?? existing.tax_code, 50);
  const phone = requireNonEmpty(body.phone ?? existing.phone, 'Số điện thoại', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại không hợp lệ.');
  const email = cleanStr(body.email ?? existing.email, 150).toLowerCase();
  if (email && !isValidEmail(email)) throw new HttpError(400, 'Email không hợp lệ.');
  const address = cleanStr(body.address ?? existing.address, 300);
  const region = requireEnum(body.region ?? existing.region, ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Toàn Quốc'], 'Khu vực');
  const credit_limit = requireNumber(body.credit_limit ?? existing.credit_limit, 'Hạn mức công nợ', { min: 0 });
  const is_active = body.is_active === undefined ? Number(existing.is_active) : (Number(body.is_active) ? 1 : 0);

  await dbRun(
    `UPDATE customers SET code=?, name=?, customer_type=?, tax_code=?, phone=?, email=?, address=?, region=?, credit_limit=?, is_active=? WHERE id=?`,
    [code, name, customer_type, tax_code, phone, email, address, region, credit_limit, is_active, id]
  );
  const item = await dbGet(`SELECT * FROM customers WHERE id = ?`, [id]);
  return sendJson(res, 200, { item, message: 'Đã cập nhật thông tin khách hàng.' });
}

async function handleDeleteCustomer(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['CUSTOMERS'], 'xóa khách hàng');
  const id = parseIdParam(idParam, 'Mã khách hàng');
  const existing = await dbGet(`SELECT id FROM customers WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy khách hàng.');

  const cnt = await dbGet(`SELECT COUNT(*) AS cnt FROM sales_invoices WHERE customer_id = ?`, [id]);
  if (Number(cnt?.cnt || 0) > 0) {
    throw new HttpError(409, 'Khách hàng đã có lịch sử hóa đơn mua hàng. Không thể xóa, hãy chuyển Ngừng hoạt động.');
  }
  await dbRun(`DELETE FROM customers WHERE id = ?`, [id]);
  return sendJson(res, 200, { deleted: true, id, message: 'Đã xóa khách hàng.' });
}

/* ============================================================================
 *  PRODUCTS CRUD & IMAGE UPLOAD
 * ============================================================================ */
async function handleGetProducts(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const [products, stocks] = await Promise.all([
    dbAll(
      `SELECT p.*, c.code AS category_code, c.name AS category_name,
              s.code AS supplier_code, s.name AS supplier_name
       FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       ORDER BY p.id DESC`
    ),
    dbAll(
      `SELECT ws.warehouse_id, ws.product_id, ws.bin_location, ws.qty_on_hand, ws.qty_reserved,
              w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region
       FROM warehouse_stocks ws
       JOIN warehouses w ON w.id = ws.warehouse_id
       ORDER BY ws.warehouse_id ASC`
    )
  ]);

  const stockByProd = new Map();
  for (const st of stocks) {
    if (!stockByProd.has(st.product_id)) stockByProd.set(st.product_id, []);
    stockByProd.get(st.product_id).push({
      warehouse_id: st.warehouse_id,
      warehouse_code: st.warehouse_code,
      warehouse_name: st.warehouse_name,
      warehouse_region: st.warehouse_region,
      bin_location: st.bin_location,
      qty_on_hand: Number(st.qty_on_hand || 0),
      qty_reserved: Number(st.qty_reserved || 0),
      qty_available: Number(st.qty_on_hand || 0) - Number(st.qty_reserved || 0)
    });
  }

  const q = normVi(url.searchParams.get('q') || '');
  const categoryId = url.searchParams.get('category_id');
  const supplierId = url.searchParams.get('supplier_id');
  const warehouseId = url.searchParams.get('warehouse_id') ? Number(url.searchParams.get('warehouse_id')) : null;
  const stockState = url.searchParams.get('stock_state') || '';
  const minPrice = url.searchParams.get('min_price') !== null && url.searchParams.get('min_price') !== '' ? Number(url.searchParams.get('min_price')) : null;
  const maxPrice = url.searchParams.get('max_price') !== null && url.searchParams.get('max_price') !== '' ? Number(url.searchParams.get('max_price')) : null;
  const active = url.searchParams.get('is_active');

  const items = products.map((p) => {
    const whList = stockByProd.get(p.id) || [];
    const total_on_hand = whList.reduce((acc, w) => acc + w.qty_on_hand, 0);
    const total_reserved = whList.reduce((acc, w) => acc + w.qty_reserved, 0);
    const total_available = total_on_hand - total_reserved;
    const whEntry = warehouseId ? whList.find((w) => w.warehouse_id === warehouseId) : null;
    const displayAvail = warehouseId ? (whEntry?.qty_available || 0) : total_available;
    return {
      ...p,
      cost_price: Number(p.cost_price || 0),
      retail_price: Number(p.retail_price || 0),
      wholesale_price: Number(p.wholesale_price || 0),
      warranty_months: Number(p.warranty_months || 0),
      min_reorder_level: Number(p.min_reorder_level || 0),
      track_serial: Number(p.track_serial || 0),
      is_active: Number(p.is_active || 0),
      total_on_hand,
      total_reserved,
      total_available,
      wh_qty_available: displayAvail,
      wh_bin_location: whEntry?.bin_location || (whList[0]?.bin_location || 'A01-R01-B01'),
      warehouse_stocks: whList
    };
  }).filter((p) => {
    if (categoryId && String(p.category_id) !== String(categoryId)) return false;
    if (supplierId && String(p.supplier_id || '') !== String(supplierId)) return false;
    if (active !== null && active !== '' && String(p.is_active) !== String(active)) return false;
    if (minPrice !== null && Number.isFinite(minPrice) && p.retail_price < minPrice) return false;
    if (maxPrice !== null && Number.isFinite(maxPrice) && p.retail_price > maxPrice) return false;
    if (stockState === 'out' && p.wh_qty_available > 0) return false;
    if (stockState === 'low' && !(p.wh_qty_available > 0 && p.wh_qty_available <= p.min_reorder_level)) return false;
    if (stockState === 'alert' && p.wh_qty_available > p.min_reorder_level) return false;
    if (stockState === 'ok' && p.wh_qty_available <= p.min_reorder_level) return false;
    if (q) {
      const hay = normVi(`${p.sku} ${p.name} ${p.category_name} ${p.sub_category} ${p.supplier_name || ''} ${p.specs_summary}`);
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleCreateProduct(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PRODUCTS'], 'thêm sản phẩm');
  const body = await readJsonBody(req);

  const sku = requireNonEmpty(body.sku || formatCode('SKU'), 'Mã SKU', 2).toUpperCase();
  const name = requireNonEmpty(body.name, 'Tên sản phẩm', 2);
  const category_id = requireNumber(body.category_id, 'Loại hàng', { min: 1, integer: true });
  const sub_category = cleanStr(body.sub_category, 150);
  const supplier_id = body.supplier_id ? requireNumber(body.supplier_id, 'Nhà cung cấp', { min: 1, integer: true }) : null;
  const unit = cleanStr(body.unit || 'Chiếc', 50);
  const cost_price = requireNumber(body.cost_price ?? 0, 'Giá vốn', { min: 0 });
  const retail_price = requireNumber(body.retail_price ?? 0, 'Giá bán lẻ', { min: 0 });
  const wholesale_price = requireNumber(body.wholesale_price ?? Math.round(retail_price * 0.91), 'Giá bán sỉ B2B', { min: 0 });
  const warranty_months = requireNumber(body.warranty_months ?? 36, 'Bảo hành (tháng)', { min: 0, max: 120, integer: true });
  const min_reorder_level = requireNumber(body.min_reorder_level ?? 5, 'Mức tồn tối thiểu ROP', { min: 0, max: 10000, integer: true });
  const track_serial = Number(body.track_serial) ? 1 : 0;
  const specs_summary = cleanStr(body.specs_summary, 2000);
  const image_url = cleanStr(body.image_url, 500);
  const is_active = body.is_active === 0 || body.is_active === '0' || body.is_active === false ? 0 : 1;
  const initial_warehouse_id = body.initial_warehouse_id ? requireNumber(body.initial_warehouse_id, 'Kho khởi tạo', { min: 1, integer: true }) : 1;
  const initial_qty = requireNumber(body.initial_qty ?? 0, 'Tồn kho ban đầu', { min: 0, max: 100000, integer: true });
  const bin_location = cleanStr(body.bin_location || 'A01-R01-B01', 50);

  const cat = await dbGet(`SELECT id FROM categories WHERE id = ?`, [category_id]);
  if (!cat) throw new HttpError(400, 'Loại hàng không tồn tại.');

  const productId = await dbTransaction(async (tx) => {
    const now = localIsoNow();
    const ins = await tx.run(
      `INSERT INTO products (sku, name, category_id, sub_category, supplier_id, unit, cost_price, retail_price, wholesale_price, warranty_months, min_reorder_level, track_serial, specs_summary, image_url, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, name, category_id, sub_category, supplier_id, unit, cost_price, retail_price, wholesale_price, warranty_months, min_reorder_level, track_serial, specs_summary, image_url, is_active, now]
    );
    const pid = ins.lastInsertRowid;
    const warehouses = await tx.all(`SELECT id FROM warehouses ORDER BY id ASC`);
    for (const w of warehouses) {
      const qty = w.id === initial_warehouse_id ? initial_qty : 0;
      await tx.run(
        `INSERT INTO warehouse_stocks (warehouse_id, product_id, bin_location, qty_on_hand, qty_reserved, updated_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [w.id, pid, bin_location, qty, now]
      );
    }
    if (initial_qty > 0) {
      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)`,
        [initial_warehouse_id, pid, `INIT-${sku}`, initial_qty, initial_qty, cost_price, 'Khởi tạo tồn kho ban đầu khi tạo sản phẩm', me.id, now]
      );
    }
    return pid;
  });

  const item = await dbGet(`SELECT * FROM products WHERE id = ?`, [productId]);
  return sendJson(res, 201, { item, message: 'Đã thêm sản phẩm mới vào danh mục 5 kho.' });
}

async function handleUpdateProduct(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PRODUCTS'], 'cập nhật sản phẩm');
  const id = parseIdParam(idParam, 'Mã sản phẩm');
  const existing = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy sản phẩm.');

  const body = await readJsonBody(req);
  const sku = requireNonEmpty(body.sku ?? existing.sku, 'Mã SKU', 2).toUpperCase();
  const name = requireNonEmpty(body.name ?? existing.name, 'Tên sản phẩm', 2);
  const category_id = requireNumber(body.category_id ?? existing.category_id, 'Loại hàng', { min: 1, integer: true });
  const sub_category = cleanStr(body.sub_category ?? existing.sub_category, 150);
  const supplier_id = body.supplier_id === '' || body.supplier_id === null
    ? null
    : requireNumber(body.supplier_id ?? existing.supplier_id, 'Nhà cung cấp', { min: 1, integer: true });
  const unit = cleanStr(body.unit ?? existing.unit, 50);
  const cost_price = requireNumber(body.cost_price ?? existing.cost_price, 'Giá vốn', { min: 0 });
  const retail_price = requireNumber(body.retail_price ?? existing.retail_price, 'Giá bán lẻ', { min: 0 });
  const wholesale_price = requireNumber(body.wholesale_price ?? existing.wholesale_price, 'Giá bán sỉ B2B', { min: 0 });
  const warranty_months = requireNumber(body.warranty_months ?? existing.warranty_months, 'Bảo hành', { min: 0, max: 120, integer: true });
  const min_reorder_level = requireNumber(body.min_reorder_level ?? existing.min_reorder_level, 'Mức ROP', { min: 0, max: 10000, integer: true });
  const track_serial = body.track_serial === undefined ? Number(existing.track_serial) : (Number(body.track_serial) ? 1 : 0);
  const specs_summary = cleanStr(body.specs_summary ?? existing.specs_summary, 2000);
  const image_url = cleanStr(body.image_url ?? existing.image_url, 500);
  const is_active = body.is_active === undefined ? Number(existing.is_active) : (Number(body.is_active) ? 1 : 0);

  await dbRun(
    `UPDATE products SET sku=?, name=?, category_id=?, sub_category=?, supplier_id=?, unit=?, cost_price=?, retail_price=?, wholesale_price=?, warranty_months=?, min_reorder_level=?, track_serial=?, specs_summary=?, image_url=?, is_active=? WHERE id=?`,
    [sku, name, category_id, sub_category, supplier_id, unit, cost_price, retail_price, wholesale_price, warranty_months, min_reorder_level, track_serial, specs_summary, image_url, is_active, id]
  );
  const item = await dbGet(`SELECT * FROM products WHERE id = ?`, [id]);
  return sendJson(res, 200, { item, message: 'Đã cập nhật sản phẩm.' });
}

async function handleDeleteProduct(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PRODUCTS'], 'xóa sản phẩm');
  const id = parseIdParam(idParam, 'Mã sản phẩm');
  const existing = await dbGet(`SELECT id FROM products WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy sản phẩm.');

  const refs = await dbGet(
    `SELECT (SELECT COUNT(*) FROM purchase_receipt_items WHERE product_id = ?)
          + (SELECT COUNT(*) FROM sales_invoice_items WHERE product_id = ?)
          + (SELECT COUNT(*) FROM stock_transfer_items WHERE product_id = ?) AS cnt`,
    [id, id, id]
  );
  if (Number(refs?.cnt || 0) > 0) {
    throw new HttpError(409, 'Sản phẩm đã phát sinh giao dịch nhập/xuất/điều chuyển. Hãy chuyển trạng thái Ngừng kinh doanh thay vì xóa.');
  }

  await dbTransaction(async (tx) => {
    await tx.run(`DELETE FROM inventory_ledger WHERE product_id = ?`, [id]);
    await tx.run(`DELETE FROM warehouse_stocks WHERE product_id = ?`, [id]);
    await tx.run(`DELETE FROM products WHERE id = ?`, [id]);
  });
  return sendJson(res, 200, { deleted: true, id, message: 'Đã xóa sản phẩm.' });
}

async function handleUploadImage(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PRODUCTS'], 'tải ảnh sản phẩm');
  const body = await readJsonBody(req, 8 * 1024 * 1024);
  const dataUrl = requireNonEmpty(body.dataUrl, 'Dữ liệu ảnh', 20);
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
  if (!match) {
    throw new HttpError(400, 'Chỉ hỗ trợ ảnh PNG, JPG, WEBP hoặc GIF dạng Base64.');
  }
  const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  const buf = Buffer.from(match[2], 'base64');
  if (buf.length > 5 * 1024 * 1024) {
    throw new HttpError(413, 'Kích thước ảnh vượt quá 5MB.');
  }
  const baseName = cleanStr(body.filename || 'product', 60)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 40) || 'product';
  const fileName = `${Date.now()}-${baseName}.${ext}`;
  fs.mkdirSync(CONFIG.UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONFIG.UPLOAD_DIR, fileName), buf);
  return sendJson(res, 201, { url: `./assets/images/uploads/${fileName}`, message: 'Tải ảnh thành công.' });
}

/* ============================================================================
 *  PURCHASING MODULE (MUA HÀNG + AUTO-ROP + MOVING AVERAGE COST)
 * ============================================================================ */
async function handleGetPurchases(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PURCHASES', 'INVENTORY'], 'xem phiếu nhập hàng');

  const rows = await dbAll(
    `SELECT pr.*, s.code AS supplier_code, s.name AS supplier_name,
            w.code AS warehouse_code, w.name AS warehouse_name,
            u.full_name AS created_by_name
     FROM purchase_receipts pr
     JOIN suppliers s ON s.id = pr.supplier_id
     JOIN warehouses w ON w.id = pr.warehouse_id
     JOIN users u ON u.id = pr.created_by
     ORDER BY pr.id DESC`
  );
  const itemCounts = await dbAll(
    `SELECT receipt_id, COUNT(*) AS line_count, COALESCE(SUM(qty), 0) AS total_qty FROM purchase_receipt_items GROUP BY receipt_id`
  );
  const countMap = new Map(itemCounts.map((r) => [r.receipt_id, r]));

  const q = normVi(url.searchParams.get('q') || '');
  const supplierId = url.searchParams.get('supplier_id');
  const warehouseId = url.searchParams.get('warehouse_id');
  const paymentStatus = url.searchParams.get('payment_status') || '';

  const items = rows.map((r) => ({
    ...r,
    subtotal: Number(r.subtotal || 0),
    discount_amount: Number(r.discount_amount || 0),
    vat_amount: Number(r.vat_amount || 0),
    total_amount: Number(r.total_amount || 0),
    paid_amount: Number(r.paid_amount || 0),
    debt_amount: Number(r.debt_amount || 0),
    line_count: Number(countMap.get(r.id)?.line_count || 0),
    total_qty: Number(countMap.get(r.id)?.total_qty || 0)
  })).filter((r) => {
    if (supplierId && String(r.supplier_id) !== String(supplierId)) return false;
    if (warehouseId && String(r.warehouse_id) !== String(warehouseId)) return false;
    if (paymentStatus && r.payment_status !== paymentStatus) return false;
    if (q && !normVi(`${r.receipt_code} ${r.supplier_invoice_no} ${r.supplier_name} ${r.warehouse_name} ${r.note}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleGetPurchaseDetail(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PURCHASES', 'INVENTORY'], 'xem chi tiết phiếu nhập');
  const id = parseIdParam(idParam, 'Mã phiếu nhập');
  const header = await dbGet(
    `SELECT pr.*, s.code AS supplier_code, s.name AS supplier_name, s.phone AS supplier_phone, s.address AS supplier_address, s.tax_code AS supplier_tax_code,
            w.code AS warehouse_code, w.name AS warehouse_name, w.address AS warehouse_address,
            u.full_name AS created_by_name
     FROM purchase_receipts pr
     JOIN suppliers s ON s.id = pr.supplier_id
     JOIN warehouses w ON w.id = pr.warehouse_id
     JOIN users u ON u.id = pr.created_by
     WHERE pr.id = ?`,
    [id]
  );
  if (!header) throw new HttpError(404, 'Không tìm thấy phiếu nhập hàng.');
  const items = await dbAll(
    `SELECT pri.*, p.sku, p.name AS product_name, p.unit
     FROM purchase_receipt_items pri
     JOIN products p ON p.id = pri.product_id
     WHERE pri.receipt_id = ?
     ORDER BY pri.id ASC`,
    [id]
  );
  const payments = await dbAll(
    `SELECT * FROM payment_transactions WHERE receipt_id = ? ORDER BY id DESC`,
    [id]
  );
  return sendJson(res, 200, { item: { ...header, items, payments } });
}

async function handleReorderSuggestions(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PURCHASES', 'INVENTORY', 'INVENTORY_VIEW'], 'xem gợi ý đặt hàng ROP');
  const whId = url.searchParams.get('warehouse_id') ? Number(url.searchParams.get('warehouse_id')) : null;

  const products = await dbAll(
    `SELECT p.id, p.sku, p.name, p.cost_price, p.min_reorder_level, p.supplier_id,
            c.name AS category_name, s.name AS supplier_name, s.lead_time_days
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     WHERE p.is_active = 1`
  );
  const stocks = whId
    ? await dbAll(`SELECT product_id, qty_on_hand, qty_reserved, bin_location FROM warehouse_stocks WHERE warehouse_id = ?`, [whId])
    : await dbAll(`SELECT product_id, SUM(qty_on_hand) AS qty_on_hand, SUM(qty_reserved) AS qty_reserved, MIN(bin_location) AS bin_location FROM warehouse_stocks GROUP BY product_id`);
  const stMap = new Map(stocks.map((s) => [s.product_id, s]));

  const suggestions = [];
  for (const p of products) {
    const st = stMap.get(p.id) || { qty_on_hand: 0, qty_reserved: 0, bin_location: 'A01-R01-B01' };
    const avail = Number(st.qty_on_hand || 0) - Number(st.qty_reserved || 0);
    const rop = Number(p.min_reorder_level || 5);
    const threshold = whId ? Math.max(2, Math.ceil(rop / 2)) : rop;
    if (avail <= threshold) {
      const suggested_qty = Math.max(threshold * 2 - avail, 5);
      suggestions.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        category_name: p.category_name,
        supplier_id: p.supplier_id,
        supplier_name: p.supplier_name || 'Chưa gắn NCC',
        lead_time_days: Number(p.lead_time_days || 3),
        cost_price: Number(p.cost_price || 0),
        qty_available: avail,
        min_reorder_level: threshold,
        suggested_qty,
        estimated_cost: suggested_qty * Number(p.cost_price || 0),
        bin_location: st.bin_location || 'A01-R01-B01',
        severity: avail === 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK'
      });
    }
  }
  suggestions.sort((a, b) => a.qty_available - b.qty_available || b.estimated_cost - a.estimated_cost);
  return sendJson(res, 200, { items: suggestions, total: suggestions.length });
}

async function handleCreatePurchase(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['PURCHASES'], 'lập phiếu nhập hàng');
  const body = await readJsonBody(req);

  const supplier_id = requireNumber(body.supplier_id, 'Nhà cung cấp', { min: 1, integer: true });
  const warehouse_id = requireNumber(body.warehouse_id, 'Kho nhận hàng', { min: 1, integer: true });
  const supplier_invoice_no = cleanStr(body.supplier_invoice_no, 100);
  const note = cleanStr(body.note, 1000);
  const vat_rate = requireNumber(body.vat_rate ?? 8, 'Thuế suất VAT (%)', { min: 0, max: 20 });
  const payment_method = cleanStr(body.payment_method || 'BANK_TRANSFER', 50);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Phiếu nhập hàng phải có ít nhất 1 dòng sản phẩm.');
  }

  const parsedLines = body.items.map((line, idx) => {
    const product_id = requireNumber(line.product_id, `Sản phẩm dòng #${idx + 1}`, { min: 1, integer: true });
    const qty = requireNumber(line.qty, `Số lượng dòng #${idx + 1}`, { min: 1, max: 100000, integer: true });
    const unit_cost = requireNumber(line.unit_cost, `Đơn giá nhập dòng #${idx + 1}`, { min: 0 });
    const discount_pct = requireNumber(line.discount_pct ?? 0, `Chiết khấu dòng #${idx + 1}`, { min: 0, max: 100 });
    const bin_location = cleanStr(line.bin_location || 'A01-R01-B01', 50);
    const gross = qty * unit_cost;
    const disc = Math.round(gross * discount_pct / 100);
    const line_total = gross - disc;
    return { product_id, qty, unit_cost, discount_pct, bin_location, gross, disc, line_total };
  });

  const subtotal = parsedLines.reduce((s, l) => s + l.gross, 0);
  const discount_amount = parsedLines.reduce((s, l) => s + l.disc, 0);
  const netBeforeVat = subtotal - discount_amount;
  const vat_amount = Math.round(netBeforeVat * vat_rate / 100);
  const total_amount = netBeforeVat + vat_amount;
  const paid_amount = body.paid_amount === undefined || body.paid_amount === ''
    ? total_amount
    : requireNumber(body.paid_amount, 'Số tiền thanh toán ngay', { min: 0, max: total_amount });
  const debt_amount = total_amount - paid_amount;
  const payment_status = debt_amount === 0 ? 'PAID' : (paid_amount > 0 ? 'PARTIAL' : 'UNPAID');

  const receiptId = await dbTransaction(async (tx) => {
    const sup = await tx.get(`SELECT id, name FROM suppliers WHERE id = ?`, [supplier_id]);
    if (!sup) throw new HttpError(400, 'Nhà cung cấp không tồn tại.');
    const wh = await tx.get(`SELECT id FROM warehouses WHERE id = ?`, [warehouse_id]);
    if (!wh) throw new HttpError(400, 'Kho nhận hàng không tồn tại.');

    const receipt_code = cleanStr(body.receipt_code, 50) || `PN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const now = localIsoNow();

    const ins = await tx.run(
      `INSERT INTO purchase_receipts (receipt_code, supplier_id, warehouse_id, created_by, supplier_invoice_no, note, subtotal, discount_amount, vat_amount, total_amount, paid_amount, debt_amount, payment_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [receipt_code, supplier_id, warehouse_id, me.id, supplier_invoice_no, note, subtotal, discount_amount, vat_amount, total_amount, paid_amount, debt_amount, payment_status, now]
    );
    const rid = ins.lastInsertRowid;

    for (const line of parsedLines) {
      const prod = await tx.get(`SELECT id, cost_price FROM products WHERE id = ?`, [line.product_id]);
      if (!prod) throw new HttpError(400, `Sản phẩm ID ${line.product_id} không tồn tại.`);

      // Moving Average Cost (MAC) recalculation before adding stock
      const totalStockRow = await tx.get(`SELECT COALESCE(SUM(qty_on_hand), 0) AS qty FROM warehouse_stocks WHERE product_id = ?`, [line.product_id]);
      const oldTotalQty = Number(totalStockRow?.qty || 0);
      const oldCost = Number(prod.cost_price || 0);
      const effUnitCost = line.qty > 0 ? Math.round(line.line_total / line.qty) : line.unit_cost;
      const newAvgCost = (oldTotalQty + line.qty) > 0
        ? Math.round(((oldTotalQty * oldCost) + (line.qty * effUnitCost)) / (oldTotalQty + line.qty))
        : effUnitCost;
      await tx.run(`UPDATE products SET cost_price = ? WHERE id = ?`, [newAvgCost, line.product_id]);

      await tx.run(
        `INSERT INTO purchase_receipt_items (receipt_id, product_id, qty, unit_cost, discount_pct, line_total, bin_location)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [rid, line.product_id, line.qty, line.unit_cost, line.discount_pct, line.line_total, line.bin_location]
      );

      const st = await tx.get(`SELECT qty_on_hand, bin_location FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [warehouse_id, line.product_id]);
      let newBalance = line.qty;
      if (st) {
        newBalance = Number(st.qty_on_hand || 0) + line.qty;
        await tx.run(
          `UPDATE warehouse_stocks SET qty_on_hand = ?, bin_location = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`,
          [newBalance, line.bin_location || st.bin_location, now, warehouse_id, line.product_id]
        );
      } else {
        await tx.run(
          `INSERT INTO warehouse_stocks (warehouse_id, product_id, bin_location, qty_on_hand, qty_reserved, updated_at)
           VALUES (?, ?, ?, ?, 0, ?)`,
          [warehouse_id, line.product_id, line.bin_location, newBalance, now]
        );
      }

      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'PURCHASE_IN', ?, ?, ?, ?, ?, ?, ?)`,
        [warehouse_id, line.product_id, receipt_code, line.qty, newBalance, effUnitCost, `Nhập mua hàng theo phiếu ${receipt_code}`, me.id, now]
      );
    }

    if (debt_amount > 0) {
      await tx.run(`UPDATE suppliers SET payable_debt = payable_debt + ? WHERE id = ?`, [debt_amount, supplier_id]);
    }
    if (paid_amount > 0) {
      await tx.run(
        `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, supplier_id, receipt_id, amount, payment_method, note, created_by, created_at)
         VALUES (?, 'PAYMENT_TO_SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [formatCode('PC'), 'Thanh toán khi nhập hàng', sup.name, supplier_id, rid, paid_amount, payment_method, `Thanh toán khi nhập phiếu ${receipt_code}`, me.id, now]
      );
    }

    return rid;
  });

  const created = await dbGet(`SELECT * FROM purchase_receipts WHERE id = ?`, [receiptId]);
  return sendJson(res, 201, { item: created, message: `Đã lập phiếu nhập ${created.receipt_code}, cộng tồn kho & cập nhật giá vốn bình quân.` });
}

/* ============================================================================
 *  SALES MODULE (BÁN HÀNG POS / B2B / WEB3D + SMART ROUTING + CHẶN XUẤT ÂM)
 * ============================================================================ */
async function handleGetSales(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES', 'INVENTORY', 'INVENTORY_VIEW'], 'xem danh sách hóa đơn bán hàng');

  const rows = await dbAll(
    `SELECT si.*, c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone, c.customer_type,
            w.code AS warehouse_code, w.name AS warehouse_name,
            u.full_name AS created_by_name
     FROM sales_invoices si
     JOIN customers c ON c.id = si.customer_id
     JOIN warehouses w ON w.id = si.warehouse_id
     JOIN users u ON u.id = si.created_by
     ORDER BY si.id DESC`
  );
  const itemStats = await dbAll(
    `SELECT invoice_id, COUNT(*) AS line_count, COALESCE(SUM(qty), 0) AS total_qty,
            COALESCE(SUM(line_total - qty * unit_cost_snapshot), 0) AS est_profit
     FROM sales_invoice_items GROUP BY invoice_id`
  );
  const statMap = new Map(itemStats.map((s) => [s.invoice_id, s]));

  const q = normVi(url.searchParams.get('q') || '');
  const customerId = url.searchParams.get('customer_id');
  const warehouseId = url.searchParams.get('warehouse_id');
  const channel = url.searchParams.get('sales_channel') || '';
  const payStatus = url.searchParams.get('payment_status') || '';
  const fulStatus = url.searchParams.get('fulfillment_status') || '';

  const items = rows.map((r) => ({
    ...r,
    subtotal: Number(r.subtotal || 0),
    discount_amount: Number(r.discount_amount || 0),
    shipping_fee: Number(r.shipping_fee || 0),
    vat_amount: Number(r.vat_amount || 0),
    total_amount: Number(r.total_amount || 0),
    paid_amount: Number(r.paid_amount || 0),
    debt_amount: Number(r.debt_amount || 0),
    line_count: Number(statMap.get(r.id)?.line_count || 0),
    total_qty: Number(statMap.get(r.id)?.total_qty || 0),
    est_profit: Number(statMap.get(r.id)?.est_profit || 0)
  })).filter((r) => {
    if (customerId && String(r.customer_id) !== String(customerId)) return false;
    if (warehouseId && String(r.warehouse_id) !== String(warehouseId)) return false;
    if (channel && r.sales_channel !== channel) return false;
    if (payStatus && r.payment_status !== payStatus) return false;
    if (fulStatus && r.fulfillment_status !== fulStatus) return false;
    if (q && !normVi(`${r.invoice_code} ${r.customer_name} ${r.customer_phone} ${r.warehouse_name} ${r.sales_channel} ${r.note}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items, total: items.length });
}

async function handleGetSaleDetail(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES', 'INVENTORY', 'INVENTORY_VIEW'], 'xem chi tiết hóa đơn');
  const id = parseIdParam(idParam, 'Mã hóa đơn');

  const header = await dbGet(
    `SELECT si.*, c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone, c.email AS customer_email, c.address AS customer_address, c.customer_type, c.tax_code AS customer_tax_code,
            w.code AS warehouse_code, w.name AS warehouse_name, w.address AS warehouse_address,
            u.full_name AS created_by_name
     FROM sales_invoices si
     JOIN customers c ON c.id = si.customer_id
     JOIN warehouses w ON w.id = si.warehouse_id
     JOIN users u ON u.id = si.created_by
     WHERE si.id = ?`,
    [id]
  );
  if (!header) throw new HttpError(404, 'Không tìm thấy hóa đơn bán hàng.');

  const items = await dbAll(
    `SELECT sii.*, p.sku, p.name AS product_name, p.unit, p.warranty_months
     FROM sales_invoice_items sii
     JOIN products p ON p.id = sii.product_id
     WHERE sii.invoice_id = ?
     ORDER BY sii.id ASC`,
    [id]
  );
  const payments = await dbAll(
    `SELECT * FROM payment_transactions WHERE invoice_id = ? ORDER BY id DESC`,
    [id]
  );
  return sendJson(res, 200, { item: { ...header, items, payments } });
}

async function suggestBestWarehouse(region, requestedItems = []) {
  const warehouses = await dbAll(`SELECT * FROM warehouses WHERE is_active = 1 ORDER BY id ASC`);
  const preferredCode = regionToDefaultWarehouseCode(region);
  const stocks = await dbAll(`SELECT warehouse_id, product_id, qty_on_hand, qty_reserved FROM warehouse_stocks`);

  const stockMap = new Map();
  for (const s of stocks) {
    stockMap.set(`${s.warehouse_id}:${s.product_id}`, Number(s.qty_on_hand || 0) - Number(s.qty_reserved || 0));
  }

  // Aggregate requested quantities per product_id so duplicate lines are checked accurately
  const aggReq = new Map();
  for (const it of requestedItems) {
    const pid = Number(it.product_id);
    const qty = Math.max(1, Number(it.qty || 1));
    if (pid > 0) aggReq.set(pid, (aggReq.get(pid) || 0) + qty);
  }

  const scored = warehouses.map((w) => {
    let canFulfillAll = true;
    let shortages = [];
    for (const [pid, need] of aggReq.entries()) {
      const avail = stockMap.get(`${w.id}:${pid}`) || 0;
      if (avail < need) {
        canFulfillAll = false;
        shortages.push({ product_id: pid, need, avail });
      }
    }
    let score = 0;
    if (canFulfillAll) score += 100;
    if (w.code === preferredCode) score += 40;
    if (w.warehouse_type === 'MEGA_HUB') score += 15;
    if (w.warehouse_type === 'REGIONAL_HUB') score += 10;
    if (w.warehouse_type === 'RMA_WARRANTY') score -= 50;
    return { warehouse: w, canFulfillAll, shortages, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return {
    recommended: scored[0]?.warehouse || warehouses[0],
    canFulfillAll: Boolean(scored[0]?.canFulfillAll),
    candidates: scored.map((s) => ({
      warehouse_id: s.warehouse.id,
      code: s.warehouse.code,
      name: s.warehouse.name,
      region: s.warehouse.region,
      can_fulfill_all: s.canFulfillAll,
      shortage_count: s.shortages.length,
      score: s.score
    }))
  };
}

async function handleSuggestWarehouse(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const region = url.searchParams.get('region') || 'Miền Bắc';
  let items = [];
  try {
    const raw = url.searchParams.get('items');
    if (raw) items = JSON.parse(raw);
  } catch { items = []; }
  const result = await suggestBestWarehouse(region, Array.isArray(items) ? items : []);
  return sendJson(res, 200, result);
}

async function handleCreateSale(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES'], 'lập hóa đơn bán hàng');
  const body = await readJsonBody(req);

  const customer_id = requireNumber(body.customer_id, 'Khách hàng', { min: 1, integer: true });
  const warehouse_id = requireNumber(body.warehouse_id, 'Kho xuất hàng', { min: 1, integer: true });
  const sales_channel = requireEnum(body.sales_channel || 'POS', ['POS', 'B2B', 'WEB3D'], 'Kênh bán hàng');
  const payment_method = cleanStr(body.payment_method || 'BANK_TRANSFER', 50);
  const fulfillment_status = requireEnum(body.fulfillment_status || (sales_channel === 'POS' ? 'COMPLETED' : 'PROCESSING'), ['COMPLETED', 'PROCESSING', 'DELIVERED'], 'Trạng thái giao vận');
  const promo_code = cleanStr(body.promo_code, 50).toUpperCase();
  const note = cleanStr(body.note, 1000);
  const shipping_fee = requireNumber(body.shipping_fee ?? 0, 'Phí vận chuyển', { min: 0 });
  const vat_rate = requireNumber(body.vat_rate ?? 0, 'Thuế suất VAT (%)', { min: 0, max: 20 });

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Hóa đơn bán hàng phải có ít nhất 1 sản phẩm.');
  }

  const parsedLines = body.items.map((line, idx) => {
    const product_id = requireNumber(line.product_id, `Sản phẩm dòng #${idx + 1}`, { min: 1, integer: true });
    const qty = requireNumber(line.qty, `Số lượng dòng #${idx + 1}`, { min: 1, max: 100000, integer: true });
    const unit_price = requireNumber(line.unit_price, `Đơn giá bán dòng #${idx + 1}`, { min: 0 });
    const discount_pct = requireNumber(line.discount_pct ?? 0, `Chiết khấu dòng #${idx + 1}`, { min: 0, max: 100 });
    const serial_numbers = cleanStr(line.serial_numbers, 500);
    const gross = qty * unit_price;
    const disc = Math.round(gross * discount_pct / 100);
    const line_total = gross - disc;
    return { product_id, qty, unit_price, discount_pct, serial_numbers, gross, disc, line_total };
  });

  const subtotal = parsedLines.reduce((s, l) => s + l.gross, 0);
  const lineDiscount = parsedLines.reduce((s, l) => s + l.disc, 0);
  const extraDiscount = requireNumber(body.extra_discount ?? 0, 'Giảm giá thêm', { min: 0 });
  const discount_amount = Math.min(subtotal, lineDiscount + extraDiscount);
  const netBeforeVat = Math.max(0, subtotal - discount_amount);
  const vat_amount = Math.round(netBeforeVat * vat_rate / 100);
  const total_amount = netBeforeVat + vat_amount + shipping_fee;
  const paid_amount = body.paid_amount === undefined || body.paid_amount === ''
    ? total_amount
    : requireNumber(body.paid_amount, 'Số tiền khách thanh toán', { min: 0, max: total_amount });
  const debt_amount = total_amount - paid_amount;
  const payment_status = debt_amount === 0 ? 'PAID' : (paid_amount > 0 ? 'PARTIAL' : 'UNPAID');

  const invoiceId = await dbTransaction(async (tx) => {
    const cust = await tx.get(`SELECT * FROM customers WHERE id = ?`, [customer_id]);
    if (!cust) throw new HttpError(400, 'Khách hàng không tồn tại.');
    const wh = await tx.get(`SELECT * FROM warehouses WHERE id = ?`, [warehouse_id]);
    if (!wh) throw new HttpError(400, 'Kho xuất hàng không tồn tại.');

    // B2B / Credit limit validation
    if (debt_amount > 0) {
      const nextDebt = Number(cust.receivable_debt || 0) + debt_amount;
      const limit = Number(cust.credit_limit || 0);
      if (nextDebt > limit) {
        throw new HttpError(400, `Vượt hạn mức công nợ cho khách "${cust.name}": nợ mới ${nextDebt.toLocaleString('vi-VN')}đ > hạn mức ${limit.toLocaleString('vi-VN')}đ.`);
      }
    }

    // Strict Over-Export Check (aggregated across duplicate product lines)
    const reqQtyByProd = new Map();
    for (const l of parsedLines) {
      reqQtyByProd.set(l.product_id, (reqQtyByProd.get(l.product_id) || 0) + l.qty);
    }

    const prodCache = new Map();
    for (const [pid, needQty] of reqQtyByProd.entries()) {
      const prod = await tx.get(`SELECT id, sku, name, cost_price FROM products WHERE id = ?`, [pid]);
      if (!prod) throw new HttpError(400, `Sản phẩm ID ${pid} không tồn tại.`);
      prodCache.set(pid, prod);

      const st = await tx.get(`SELECT qty_on_hand, qty_reserved FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [warehouse_id, pid]);
      const onHand = Number(st?.qty_on_hand || 0);
      const reserved = Number(st?.qty_reserved || 0);
      const available = onHand - reserved;

      if (needQty > available) {
        throw new HttpError(
          409,
          `Không đủ tồn kho khả dụng cho [${prod.sku}] ${prod.name} tại ${wh.name}: yêu cầu xuất ${needQty}, tồn khả dụng chỉ còn ${available} (tồn vật lý ${onHand}, giữ chỗ ${reserved}). Hệ thống chặn xuất âm kho!`
        );
      }
    }

    const prefix = sales_channel === 'B2B' ? 'HD-B2B' : sales_channel === 'WEB3D' ? 'SKY' : 'HD';
    const invoice_code = cleanStr(body.invoice_code, 50) || `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;
    const now = localIsoNow();

    const ins = await tx.run(
      `INSERT INTO sales_invoices (invoice_code, customer_id, warehouse_id, created_by, sales_channel, payment_method, promo_code, note, subtotal, discount_amount, shipping_fee, vat_amount, total_amount, paid_amount, debt_amount, payment_status, fulfillment_status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [invoice_code, customer_id, warehouse_id, me.id, sales_channel, payment_method, promo_code, note, subtotal, discount_amount, shipping_fee, vat_amount, total_amount, paid_amount, debt_amount, payment_status, fulfillment_status, now]
    );
    const iid = ins.lastInsertRowid;

    for (const line of parsedLines) {
      const prod = prodCache.get(line.product_id);
      await tx.run(
        `INSERT INTO sales_invoice_items (invoice_id, product_id, qty, unit_price, unit_cost_snapshot, discount_pct, serial_numbers, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [iid, line.product_id, line.qty, line.unit_price, Number(prod.cost_price || 0), line.discount_pct, line.serial_numbers, line.line_total]
      );
    }

    for (const [pid, needQty] of reqQtyByProd.entries()) {
      const st = await tx.get(`SELECT qty_on_hand FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [warehouse_id, pid]);
      const newBal = Number(st.qty_on_hand) - needQty;
      await tx.run(
        `UPDATE warehouse_stocks SET qty_on_hand = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`,
        [newBal, now, warehouse_id, pid]
      );
      const lineMatch = parsedLines.find((l) => l.product_id === pid);
      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'SALE_OUT', ?, ?, ?, ?, ?, ?, ?)`,
        [warehouse_id, pid, invoice_code, -needQty, newBal, lineMatch?.unit_price || 0, `Xuất bán kênh ${sales_channel} theo hóa đơn ${invoice_code}`, me.id, now]
      );
    }

    await tx.run(
      `UPDATE customers SET total_spent = total_spent + ?, receivable_debt = receivable_debt + ? WHERE id = ?`,
      [total_amount, debt_amount, customer_id]
    );

    if (paid_amount > 0) {
      await tx.run(
        `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, customer_id, invoice_id, amount, payment_method, note, created_by, created_at)
         VALUES (?, 'RECEIPT_FROM_CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [formatCode('PT'), 'Thu tiền bán hàng', cust.name, customer_id, iid, paid_amount, payment_method, `Thu tiền hóa đơn ${invoice_code}`, me.id, now]
      );
    }

    return iid;
  });

  const created = await dbGet(`SELECT * FROM sales_invoices WHERE id = ?`, [invoiceId]);
  return sendJson(res, 201, { item: created, message: `Đã xuất hóa đơn ${created.invoice_code}, trừ tồn kho và ghi sổ cái thành công.` });
}

async function handleUpdateFulfillment(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES', 'INVENTORY'], 'cập nhật trạng thái giao vận');
  const id = parseIdParam(idParam, 'Mã hóa đơn');
  const existing = await dbGet(`SELECT * FROM sales_invoices WHERE id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Không tìm thấy hóa đơn.');

  const body = await readJsonBody(req);
  const fulfillment_status = requireEnum(body.fulfillment_status, ['PROCESSING', 'DELIVERED', 'COMPLETED'], 'Trạng thái giao vận');
  const note = body.note !== undefined ? cleanStr(body.note, 1000) : existing.note;

  await dbRun(`UPDATE sales_invoices SET fulfillment_status = ?, note = ? WHERE id = ?`, [fulfillment_status, note, id]);
  const updated = await dbGet(`SELECT * FROM sales_invoices WHERE id = ?`, [id]);
  return sendJson(res, 200, { item: updated, message: `Đã chuyển trạng thái đơn ${updated.invoice_code} sang ${fulfillment_status}.` });
}

/* ============================================================================
 *  STOREFRONT PUBLIC CHECKOUT & ORDER TRACKING
 * ============================================================================ */
async function handleStorefrontCheckout(req, res) {
  const body = await readJsonBody(req);
  const custIn = body.customer || {};
  const name = requireNonEmpty(custIn.name || body.name, 'Họ tên người nhận', 2);
  const phone = requireNonEmpty(custIn.phone || body.phone, 'Số điện thoại nhận hàng', 9).replace(/[\s.-]/g, '');
  if (!isValidPhone(phone)) throw new HttpError(400, 'Số điện thoại nhận hàng không hợp lệ.');
  const email = cleanStr(custIn.email || body.email || '', 150).toLowerCase();
  const address = cleanStr(custIn.address || body.address || '', 300);
  const region = cleanStr(custIn.region || (normVi(address).includes('ho chi minh') || normVi(address).includes('hcm') || normVi(address).includes('sai gon') ? 'Miền Nam' : normVi(address).includes('da nang') ? 'Miền Trung' : 'Miền Bắc'), 50);
  const payment_method = cleanStr(body.payment_method || 'COD', 50);
  const promo_code = cleanStr(body.promo_code || '', 50).toUpperCase();
  const discount_amount = Math.max(0, Number(body.discount_amount || 0));
  const shipping_fee = Math.max(0, Number(body.shipping_fee || 0));
  const note = cleanStr(body.note || `Giao tới: ${address}`, 1000);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Giỏ hàng đang trống.');
  }

  // Match storefront items against DB products by SKU (or fallback to highest-stock catalog item for uncatalogued storefront SKUs)
  const allProducts = await dbAll(`SELECT * FROM products WHERE is_active = 1`);
  const allStocks = await dbAll(`SELECT product_id, SUM(qty_on_hand - qty_reserved) AS avail FROM warehouse_stocks GROUP BY product_id`);
  const availByPid = new Map(allStocks.map((s) => [Number(s.product_id), Number(s.avail || 0)]));
  const fallbackProd = [...allProducts].sort((a, b) => (availByPid.get(b.id) || 0) - (availByPid.get(a.id) || 0))[0] || allProducts[0];

  const resolvedLines = [];
  for (const it of body.items) {
    const qty = Math.max(1, Math.floor(Number(it.qty || 1)));
    const skuKey = cleanStr(it.sku || it.id || '', 100);
    let prod = skuKey ? allProducts.find((p) => String(p.sku).toLowerCase() === skuKey.toLowerCase()) : null;
    if (!prod && it.name) {
      const target = normVi(it.name);
      prod = allProducts.find((p) => normVi(p.name) === target || normVi(p.name).includes(target.slice(0, 24)));
    }
    if (!prod) {
      prod = fallbackProd;
    }
    const unit_price = Number(it.price || prod.retail_price || 0);
    resolvedLines.push({
      product_id: prod.id,
      sku: prod.sku,
      name: it.name || prod.name,
      qty,
      unit_price,
      cost_price: Number(prod.cost_price || 0),
      line_total: qty * unit_price
    });
  }

  // Smart Warehouse Routing for storefront order
  const routing = await suggestBestWarehouse(region, resolvedLines.map((l) => ({ product_id: l.product_id, qty: l.qty })));
  const chosenWh = routing.recommended;

  const subtotal = resolvedLines.reduce((s, l) => s + l.line_total, 0);
  const clampedDisc = Math.min(subtotal, discount_amount);
  const total_amount = Math.max(0, subtotal - clampedDisc + shipping_fee);
  const isPrepaid = payment_method !== 'COD';
  const paid_amount = isPrepaid ? total_amount : 0;
  const debt_amount = total_amount - paid_amount;
  const payment_status = debt_amount === 0 ? 'PAID' : 'UNPAID';

  const created = await dbTransaction(async (tx) => {
    const now = localIsoNow();
    let cust = await tx.get(`SELECT * FROM customers WHERE phone = ?`, [phone]);
    if (!cust && email) {
      cust = await tx.get(`SELECT * FROM customers WHERE LOWER(email) = LOWER(?)`, [email]);
    }
    let customerId;
    if (cust) {
      customerId = cust.id;
      await tx.run(
        `UPDATE customers SET name = ?, address = COALESCE(NULLIF(?, ''), address), region = ? WHERE id = ?`,
        [name, address, region, customerId]
      );
    } else {
      const insCust = await tx.run(
        `INSERT INTO customers (code, name, customer_type, tax_code, phone, email, address, region, credit_limit, receivable_debt, total_spent, is_active, created_at)
         VALUES (?, ?, 'RETAIL', '', ?, ?, ?, ?, 50000000, 0, 0, 1, ?)`,
        [formatCode('KH'), name, phone, email, address, region, now]
      );
      customerId = insCust.lastInsertRowid;
    }

    // Aggregate & check stock in chosen warehouse
    const reqQty = new Map();
    for (const l of resolvedLines) reqQty.set(l.product_id, (reqQty.get(l.product_id) || 0) + l.qty);
    for (const [pid, need] of reqQty.entries()) {
      const st = await tx.get(`SELECT qty_on_hand, qty_reserved FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [chosenWh.id, pid]);
      const avail = Number(st?.qty_on_hand || 0) - Number(st?.qty_reserved || 0);
      if (need > avail) {
        const p = await tx.get(`SELECT name FROM products WHERE id = ?`, [pid]);
        throw new HttpError(409, `Sản phẩm "${p?.name || pid}" hiện chỉ còn ${avail} sản phẩm khả dụng tại ${chosenWh.name}. Vui lòng giảm số lượng.`);
      }
    }

    const invoice_code = cleanStr(body.invoice_code, 50) || formatCode('SKY');
    const insInv = await tx.run(
      `INSERT INTO sales_invoices (invoice_code, customer_id, warehouse_id, created_by, sales_channel, payment_method, promo_code, note, subtotal, discount_amount, shipping_fee, vat_amount, total_amount, paid_amount, debt_amount, payment_status, fulfillment_status, created_at)
       VALUES (?, ?, ?, 1, 'WEB3D', ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, 'PROCESSING', ?)`,
      [invoice_code, customerId, chosenWh.id, payment_method, promo_code, note, subtotal, clampedDisc, shipping_fee, total_amount, paid_amount, debt_amount, payment_status, now]
    );
    const iid = insInv.lastInsertRowid;

    for (const l of resolvedLines) {
      await tx.run(
        `INSERT INTO sales_invoice_items (invoice_id, product_id, qty, unit_price, unit_cost_snapshot, discount_pct, serial_numbers, line_total)
         VALUES (?, ?, ?, ?, ?, 0, '', ?)`,
        [iid, l.product_id, l.qty, l.unit_price, l.cost_price, l.line_total]
      );
    }

    for (const [pid, need] of reqQty.entries()) {
      const st = await tx.get(`SELECT qty_on_hand FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [chosenWh.id, pid]);
      const newBal = Number(st.qty_on_hand) - need;
      await tx.run(
        `UPDATE warehouse_stocks SET qty_on_hand = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`,
        [newBal, now, chosenWh.id, pid]
      );
      const l = resolvedLines.find((x) => x.product_id === pid);
      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'SALE_OUT', ?, ?, ?, ?, ?, 1, ?)`,
        [chosenWh.id, pid, invoice_code, -need, newBal, l?.unit_price || 0, `Đơn hàng Storefront WEB3D ${invoice_code}`, now]
      );
    }

    await tx.run(
      `UPDATE customers SET total_spent = total_spent + ?, receivable_debt = receivable_debt + ? WHERE id = ?`,
      [total_amount, debt_amount, customerId]
    );
    if (paid_amount > 0) {
      await tx.run(
        `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, customer_id, invoice_id, amount, payment_method, note, created_by, created_at)
         VALUES (?, 'RECEIPT_FROM_CUSTOMER', ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [formatCode('PT'), 'Thanh toán đơn hàng Online', name, customerId, iid, paid_amount, payment_method, `Thanh toán đơn WEB3D ${invoice_code}`, now]
      );
    }

    return { id: iid, invoice_code, total_amount, warehouse_name: chosenWh.name, warehouse_code: chosenWh.code, fulfillment_status: 'PROCESSING', payment_status, created_at: now };
  });

  return sendJson(res, 201, {
    invoice_code: created.invoice_code,
    order: created,
    message: `Đặt hàng thành công! Mã đơn ${created.invoice_code} đã điều phối về ${created.warehouse_name}.`
  });
}

async function handleTrackStorefrontOrder(req, res, url) {
  const code = cleanStr(url.searchParams.get('code') || '', 60);
  const phone = cleanStr(url.searchParams.get('phone') || '', 30).replace(/[\s.-]/g, '');
  if (!code && !phone) throw new HttpError(400, 'Vui lòng nhập Mã đơn hàng hoặc Số điện thoại để tra cứu.');

  let rows;
  if (code) {
    rows = await dbAll(
      `SELECT si.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              w.code AS warehouse_code, w.name AS warehouse_name
       FROM sales_invoices si
       JOIN customers c ON c.id = si.customer_id
       JOIN warehouses w ON w.id = si.warehouse_id
       WHERE LOWER(si.invoice_code) = LOWER(?)
       ORDER BY si.id DESC`,
      [code]
    );
  } else {
    rows = await dbAll(
      `SELECT si.*, c.name AS customer_name, c.phone AS customer_phone, c.address AS customer_address,
              w.code AS warehouse_code, w.name AS warehouse_name
       FROM sales_invoices si
       JOIN customers c ON c.id = si.customer_id
       JOIN warehouses w ON w.id = si.warehouse_id
       WHERE c.phone = ?
       ORDER BY si.id DESC`,
      [phone]
    );
  }

  if (!rows.length) {
    throw new HttpError(404, 'Không tìm thấy đơn hàng khớp với thông tin đã nhập.');
  }

  const enriched = [];
  for (const r of rows.slice(0, 10)) {
    const items = await dbAll(
      `SELECT sii.qty, sii.unit_price, sii.line_total, p.sku, p.name AS product_name, p.image_url
       FROM sales_invoice_items sii
       JOIN products p ON p.id = sii.product_id
       WHERE sii.invoice_id = ?`,
      [r.id]
    );
    enriched.push({
      id: r.id,
      invoice_code: r.invoice_code,
      sales_channel: r.sales_channel,
      customer_name: r.customer_name,
      customer_phone: r.customer_phone,
      customer_address: r.customer_address,
      warehouse_name: r.warehouse_name,
      payment_method: r.payment_method,
      payment_status: r.payment_status,
      fulfillment_status: r.fulfillment_status,
      subtotal: Number(r.subtotal || 0),
      discount_amount: Number(r.discount_amount || 0),
      shipping_fee: Number(r.shipping_fee || 0),
      total_amount: Number(r.total_amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      debt_amount: Number(r.debt_amount || 0),
      created_at: r.created_at,
      items
    });
  }

  return sendJson(res, 200, { order: enriched[0], items: enriched });
}

async function handleMyStorefrontOrders(req, res) {
  const me = await requireAuth(req, { staffOnly: false });
  let rows = [];
  if (!me.is_staff) {
    rows = await dbAll(
      `SELECT si.*, w.code AS warehouse_code, w.name AS warehouse_name, c.name AS customer_name, c.phone AS customer_phone
       FROM sales_invoices si
       JOIN customers c ON c.id = si.customer_id
       JOIN warehouses w ON w.id = si.warehouse_id
       WHERE si.customer_id = ?
       ORDER BY si.id DESC`,
      [me.customer_id]
    );
  } else {
    rows = await dbAll(
      `SELECT si.*, w.code AS warehouse_code, w.name AS warehouse_name, c.name AS customer_name, c.phone AS customer_phone
       FROM sales_invoices si
       JOIN customers c ON c.id = si.customer_id
       JOIN warehouses w ON w.id = si.warehouse_id
       WHERE LOWER(c.email) = LOWER(?) OR c.phone = ? OR si.created_by = ?
       ORDER BY si.id DESC`,
      [me.email || '', me.phone || '', me.id]
    );
  }

  const enriched = [];
  for (const r of rows.slice(0, 30)) {
    const items = await dbAll(
      `SELECT sii.qty, sii.unit_price, sii.line_total, p.sku, p.name AS product_name, p.image_url
       FROM sales_invoice_items sii
       JOIN products p ON p.id = sii.product_id
       WHERE sii.invoice_id = ?`,
      [r.id]
    );
    enriched.push({
      ...r,
      total_amount: Number(r.total_amount || 0),
      paid_amount: Number(r.paid_amount || 0),
      debt_amount: Number(r.debt_amount || 0),
      items
    });
  }
  return sendJson(res, 200, { items: enriched, total: enriched.length });
}

/* ============================================================================
 *  INVENTORY, LEDGER, ADJUSTMENTS & INTER-WAREHOUSE TRANSFERS
 * ============================================================================ */
async function handleGetInventory(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY', 'INVENTORY_VIEW', 'PURCHASES', 'SALES'], 'xem tồn kho');

  const [warehouses, stocks] = await Promise.all([
    dbAll(`SELECT * FROM warehouses ORDER BY id ASC`),
    dbAll(
      `SELECT ws.warehouse_id, ws.product_id, ws.bin_location, ws.qty_on_hand, ws.qty_reserved, ws.updated_at,
              w.code AS warehouse_code, w.name AS warehouse_name, w.region AS warehouse_region,
              p.sku, p.name AS product_name, p.unit, p.cost_price, p.retail_price, p.min_reorder_level, p.category_id,
              c.name AS category_name
       FROM warehouse_stocks ws
       JOIN warehouses w ON w.id = ws.warehouse_id
       JOIN products p ON p.id = ws.product_id
       JOIN categories c ON c.id = p.category_id
       ORDER BY ws.warehouse_id ASC, p.id ASC`
    )
  ]);

  const whId = url.searchParams.get('warehouse_id');
  const catId = url.searchParams.get('category_id');
  const q = normVi(url.searchParams.get('q') || '');
  const alertOnly = url.searchParams.get('alert_only') === '1';

  // Per-warehouse utilization summary (across full dataset)
  const whSummaryMap = new Map(warehouses.map((w) => [w.id, {
    ...w,
    capacity_units: Number(w.capacity_units || 5000),
    total_on_hand: 0,
    total_reserved: 0,
    total_available: 0,
    valuation: 0,
    low_stock_count: 0,
    sku_in_stock: 0
  }]));

  for (const s of stocks) {
    const onHand = Number(s.qty_on_hand || 0);
    const reserved = Number(s.qty_reserved || 0);
    const avail = onHand - reserved;
    const sum = whSummaryMap.get(s.warehouse_id);
    if (sum) {
      sum.total_on_hand += onHand;
      sum.total_reserved += reserved;
      sum.total_available += avail;
      sum.valuation += onHand * Number(s.cost_price || 0);
      if (onHand > 0) sum.sku_in_stock += 1;
      if (avail <= Math.max(2, Math.ceil(Number(s.min_reorder_level || 5) / 2))) sum.low_stock_count += 1;
    }
  }

  const warehouse_summary = Array.from(whSummaryMap.values()).map((w) => ({
    ...w,
    utilization_pct: w.capacity_units > 0 ? Math.min(100, Math.round((w.total_on_hand / w.capacity_units) * 1000) / 10) : 0
  }));

  const items = stocks.map((s) => {
    const qty_on_hand = Number(s.qty_on_hand || 0);
    const qty_reserved = Number(s.qty_reserved || 0);
    const qty_available = qty_on_hand - qty_reserved;
    const cost_price = Number(s.cost_price || 0);
    const rop = Math.max(2, Math.ceil(Number(s.min_reorder_level || 5) / 2));
    return {
      ...s,
      qty_on_hand,
      qty_reserved,
      qty_available,
      cost_price,
      retail_price: Number(s.retail_price || 0),
      min_reorder_level: Number(s.min_reorder_level || 5),
      wh_rop_threshold: rop,
      stock_value: qty_on_hand * cost_price,
      stock_status: qty_available === 0 ? 'OUT' : qty_available <= rop ? 'LOW' : 'OK'
    };
  }).filter((s) => {
    if (whId && String(s.warehouse_id) !== String(whId)) return false;
    if (catId && String(s.category_id) !== String(catId)) return false;
    if (alertOnly && s.stock_status === 'OK') return false;
    if (q && !normVi(`${s.sku} ${s.product_name} ${s.warehouse_name} ${s.bin_location} ${s.category_name}`).includes(q)) return false;
    return true;
  });

  const kpi = {
    total_units: items.reduce((a, b) => a + b.qty_on_hand, 0),
    total_available: items.reduce((a, b) => a + b.qty_available, 0),
    total_valuation: items.reduce((a, b) => a + b.stock_value, 0),
    low_stock_rows: items.filter((i) => i.stock_status === 'LOW').length,
    out_of_stock_rows: items.filter((i) => i.stock_status === 'OUT').length
  };

  return sendJson(res, 200, { items, total: items.length, warehouse_summary, kpi });
}

async function handleGetLedger(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY', 'INVENTORY_VIEW', 'PURCHASES', 'SALES'], 'xem sổ cái thẻ kho');

  const rows = await dbAll(
    `SELECT l.*, w.code AS warehouse_code, w.name AS warehouse_name,
            p.sku, p.name AS product_name, u.full_name AS created_by_name
     FROM inventory_ledger l
     JOIN warehouses w ON w.id = l.warehouse_id
     JOIN products p ON p.id = l.product_id
     LEFT JOIN users u ON u.id = l.created_by
     ORDER BY l.id DESC`
  );

  const whId = url.searchParams.get('warehouse_id');
  const prodId = url.searchParams.get('product_id');
  const txType = url.searchParams.get('tx_type') || '';
  const q = normVi(url.searchParams.get('q') || '');

  const filtered = rows.filter((r) => {
    if (whId && String(r.warehouse_id) !== String(whId)) return false;
    if (prodId && String(r.product_id) !== String(prodId)) return false;
    if (txType && r.tx_type !== txType) return false;
    if (q && !normVi(`${r.ref_code} ${r.sku} ${r.product_name} ${r.warehouse_name} ${r.note}`).includes(q)) return false;
    return true;
  });

  return sendJson(res, 200, { items: filtered.slice(0, 250), total: filtered.length });
}

async function handleAdjustInventory(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY'], 'kiểm kê & điều chỉnh tồn kho');
  const body = await readJsonBody(req);

  const warehouse_id = requireNumber(body.warehouse_id, 'Kho kiểm kê', { min: 1, integer: true });
  const product_id = requireNumber(body.product_id, 'Sản phẩm', { min: 1, integer: true });
  const new_qty = requireNumber(body.new_qty_on_hand, 'Số lượng thực tế kiểm kê', { min: 0, max: 500000, integer: true });
  const bin_location = cleanStr(body.bin_location || '', 50);
  const reason = requireNonEmpty(body.reason, 'Lý do điều chỉnh kiểm kê', 3);

  const result = await dbTransaction(async (tx) => {
    const wh = await tx.get(`SELECT id, name FROM warehouses WHERE id = ?`, [warehouse_id]);
    if (!wh) throw new HttpError(400, 'Kho không tồn tại.');
    const prod = await tx.get(`SELECT id, sku, name, cost_price FROM products WHERE id = ?`, [product_id]);
    if (!prod) throw new HttpError(400, 'Sản phẩm không tồn tại.');

    const st = await tx.get(`SELECT * FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [warehouse_id, product_id]);
    const oldQty = Number(st?.qty_on_hand || 0);
    const reserved = Number(st?.qty_reserved || 0);
    if (new_qty < reserved) {
      throw new HttpError(409, `Không thể điều chỉnh tồn xuống ${new_qty} vì đang có ${reserved} sản phẩm được giữ chỗ (reserved).`);
    }

    const delta = new_qty - oldQty;
    const now = localIsoNow();
    const ref_code = formatCode('KK');

    if (st) {
      await tx.run(
        `UPDATE warehouse_stocks SET qty_on_hand = ?, bin_location = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`,
        [new_qty, bin_location || st.bin_location, now, warehouse_id, product_id]
      );
    } else {
      await tx.run(
        `INSERT INTO warehouse_stocks (warehouse_id, product_id, bin_location, qty_on_hand, qty_reserved, updated_at)
         VALUES (?, ?, ?, ?, 0, ?)`,
        [warehouse_id, product_id, bin_location || 'A01-R01-B01', new_qty, now]
      );
    }

    await tx.run(
      `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
       VALUES (?, ?, 'ADJUSTMENT', ?, ?, ?, ?, ?, ?, ?)`,
      [warehouse_id, product_id, ref_code, delta, new_qty, Number(prod.cost_price || 0), `Kiểm kê kho: ${reason}`, me.id, now]
    );

    return { ref_code, warehouse_id, product_id, old_qty: oldQty, new_qty, delta };
  });

  return sendJson(res, 200, { item: result, message: `Đã cập nhật tồn kho kiểm kê (${result.ref_code}): ${result.old_qty} → ${result.new_qty}.` });
}

async function handleGetTransfers(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY', 'INVENTORY_VIEW'], 'xem phiếu điều chuyển liên kho');

  const rows = await dbAll(
    `SELECT st.*, wf.code AS from_warehouse_code, wf.name AS from_warehouse_name,
            wt.code AS to_warehouse_code, wt.name AS to_warehouse_name,
            u.full_name AS created_by_name
     FROM stock_transfers st
     JOIN warehouses wf ON wf.id = st.from_warehouse_id
     JOIN warehouses wt ON wt.id = st.to_warehouse_id
     JOIN users u ON u.id = st.created_by
     ORDER BY st.id DESC`
  );
  const itemsAll = await dbAll(
    `SELECT sti.*, p.sku, p.name AS product_name
     FROM stock_transfer_items sti
     JOIN products p ON p.id = sti.product_id
     ORDER BY sti.id ASC`
  );
  const byTransfer = new Map();
  for (const it of itemsAll) {
    if (!byTransfer.has(it.transfer_id)) byTransfer.set(it.transfer_id, []);
    byTransfer.get(it.transfer_id).push(it);
  }
  const items = rows.map((r) => ({
    ...r,
    items: byTransfer.get(r.id) || [],
    total_qty: (byTransfer.get(r.id) || []).reduce((s, x) => s + Number(x.qty || 0), 0)
  }));
  return sendJson(res, 200, { items, total: items.length });
}

async function handleCreateTransfer(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY'], 'tạo phiếu điều chuyển liên kho');
  const body = await readJsonBody(req);

  const from_warehouse_id = requireNumber(body.from_warehouse_id, 'Kho xuất', { min: 1, integer: true });
  const to_warehouse_id = requireNumber(body.to_warehouse_id, 'Kho nhận', { min: 1, integer: true });
  if (from_warehouse_id === to_warehouse_id) {
    throw new HttpError(400, 'Kho xuất và Kho nhận phải khác nhau.');
  }
  const status = requireEnum(body.status || 'IN_TRANSIT', ['IN_TRANSIT', 'COMPLETED'], 'Trạng thái điều chuyển');
  const reason = requireNonEmpty(body.reason || 'Điều chuyển cân bằng tồn kho liên vùng', 'Lý do điều chuyển', 3);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw new HttpError(400, 'Phiếu điều chuyển cần ít nhất 1 sản phẩm.');
  }

  const aggMap = new Map();
  for (let i = 0; i < body.items.length; i++) {
    const pid = requireNumber(body.items[i].product_id, `Sản phẩm dòng #${i + 1}`, { min: 1, integer: true });
    const qty = requireNumber(body.items[i].qty, `Số lượng dòng #${i + 1}`, { min: 1, max: 50000, integer: true });
    aggMap.set(pid, (aggMap.get(pid) || 0) + qty);
  }

  const transferId = await dbTransaction(async (tx) => {
    const wf = await tx.get(`SELECT * FROM warehouses WHERE id = ?`, [from_warehouse_id]);
    const wt = await tx.get(`SELECT * FROM warehouses WHERE id = ?`, [to_warehouse_id]);
    if (!wf || !wt) throw new HttpError(400, 'Kho xuất hoặc kho nhận không tồn tại.');

    const now = localIsoNow();
    const transfer_code = `DCK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`;

    // Strict stock availability check at source warehouse
    for (const [pid, qty] of aggMap.entries()) {
      const prod = await tx.get(`SELECT id, sku, name, cost_price FROM products WHERE id = ?`, [pid]);
      if (!prod) throw new HttpError(400, `Sản phẩm ID ${pid} không tồn tại.`);
      const st = await tx.get(`SELECT qty_on_hand, qty_reserved FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [from_warehouse_id, pid]);
      const avail = Number(st?.qty_on_hand || 0) - Number(st?.qty_reserved || 0);
      if (qty > avail) {
        throw new HttpError(409, `Không đủ tồn kho điều chuyển cho [${prod.sku}] ${prod.name} tại ${wf.name}: cần chuyển ${qty}, khả dụng chỉ còn ${avail}.`);
      }
    }

    const ins = await tx.run(
      `INSERT INTO stock_transfers (transfer_code, from_warehouse_id, to_warehouse_id, created_by, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [transfer_code, from_warehouse_id, to_warehouse_id, me.id, reason, status, now]
    );
    const tid = ins.lastInsertRowid;

    for (const [pid, qty] of aggMap.entries()) {
      const prod = await tx.get(`SELECT cost_price FROM products WHERE id = ?`, [pid]);
      await tx.run(`INSERT INTO stock_transfer_items (transfer_id, product_id, qty) VALUES (?, ?, ?)`, [tid, pid, qty]);

      // Deduct source warehouse
      const stFrom = await tx.get(`SELECT qty_on_hand FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [from_warehouse_id, pid]);
      const balFrom = Number(stFrom.qty_on_hand) - qty;
      await tx.run(`UPDATE warehouse_stocks SET qty_on_hand = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`, [balFrom, now, from_warehouse_id, pid]);
      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'TRANSFER_OUT', ?, ?, ?, ?, ?, ?, ?)`,
        [from_warehouse_id, pid, transfer_code, -qty, balFrom, Number(prod.cost_price || 0), `Xuất điều chuyển sang ${wt.name}`, me.id, now]
      );

      // If COMPLETED immediately, credit destination warehouse now
      if (status === 'COMPLETED') {
        const stTo = await tx.get(`SELECT qty_on_hand FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [to_warehouse_id, pid]);
        let balTo = qty;
        if (stTo) {
          balTo = Number(stTo.qty_on_hand) + qty;
          await tx.run(`UPDATE warehouse_stocks SET qty_on_hand = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`, [balTo, now, to_warehouse_id, pid]);
        } else {
          await tx.run(`INSERT INTO warehouse_stocks (warehouse_id, product_id, bin_location, qty_on_hand, qty_reserved, updated_at) VALUES (?, ?, 'A01-R01-B01', ?, 0, ?)`, [to_warehouse_id, pid, balTo, now]);
        }
        await tx.run(
          `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
           VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?)`,
          [to_warehouse_id, pid, transfer_code, qty, balTo, Number(prod.cost_price || 0), `Nhận điều chuyển từ ${wf.name}`, me.id, now]
        );
      }
    }
    return tid;
  });

  const created = await dbGet(`SELECT * FROM stock_transfers WHERE id = ?`, [transferId]);
  return sendJson(res, 201, {
    item: created,
    message: created.status === 'IN_TRANSIT'
      ? `Đã xuất kho đi đường phiếu ${created.transfer_code} (IN_TRANSIT). Kho đích cần xác nhận nhận hàng để cộng tồn.`
      : `Đã hoàn tất điều chuyển liên kho ${created.transfer_code}.`
  });
}

async function handleCompleteTransfer(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['INVENTORY'], 'xác nhận nhận hàng điều chuyển');
  const id = parseIdParam(idParam, 'Mã phiếu điều chuyển');

  const updated = await dbTransaction(async (tx) => {
    const tr = await tx.get(`SELECT * FROM stock_transfers WHERE id = ?`, [id]);
    if (!tr) throw new HttpError(404, 'Không tìm thấy phiếu điều chuyển.');
    if (tr.status === 'COMPLETED') {
      throw new HttpError(409, 'Phiếu điều chuyển này đã được xác nhận hoàn tất trước đó.');
    }
    const wf = await tx.get(`SELECT name FROM warehouses WHERE id = ?`, [tr.from_warehouse_id]);
    const items = await tx.all(`SELECT * FROM stock_transfer_items WHERE transfer_id = ?`, [id]);
    const now = localIsoNow();

    for (const it of items) {
      const prod = await tx.get(`SELECT cost_price FROM products WHERE id = ?`, [it.product_id]);
      const stTo = await tx.get(`SELECT qty_on_hand FROM warehouse_stocks WHERE warehouse_id = ? AND product_id = ?`, [tr.to_warehouse_id, it.product_id]);
      let balTo = Number(it.qty);
      if (stTo) {
        balTo = Number(stTo.qty_on_hand) + Number(it.qty);
        await tx.run(`UPDATE warehouse_stocks SET qty_on_hand = ?, updated_at = ? WHERE warehouse_id = ? AND product_id = ?`, [balTo, now, tr.to_warehouse_id, it.product_id]);
      } else {
        await tx.run(`INSERT INTO warehouse_stocks (warehouse_id, product_id, bin_location, qty_on_hand, qty_reserved, updated_at) VALUES (?, ?, 'A01-R01-B01', ?, 0, ?)`, [tr.to_warehouse_id, it.product_id, balTo, now]);
      }
      await tx.run(
        `INSERT INTO inventory_ledger (warehouse_id, product_id, tx_type, ref_code, qty_change, balance_after, unit_price, note, created_by, created_at)
         VALUES (?, ?, 'TRANSFER_IN', ?, ?, ?, ?, ?, ?, ?)`,
        [tr.to_warehouse_id, it.product_id, tr.transfer_code, Number(it.qty), balTo, Number(prod?.cost_price || 0), `Xác nhận nhận hàng điều chuyển từ ${wf?.name || 'kho nguồn'}`, me.id, now]
      );
    }

    await tx.run(`UPDATE stock_transfers SET status = 'COMPLETED' WHERE id = ?`, [id]);
    return tx.get(`SELECT * FROM stock_transfers WHERE id = ?`, [id]);
  });

  return sendJson(res, 200, { item: updated, message: `Kho đích đã xác nhận nhận đủ hàng cho phiếu ${updated.transfer_code}.` });
}

/* ============================================================================
 *  PAYMENTS, CASHBOOK & AR / AP DEBT SETTLEMENT
 * ============================================================================ */
function formatPaymentRow(r) {
  const dir = r.tx_direction;
  const isIncome = dir === 'RECEIPT_FROM_CUSTOMER' || dir === 'OTHER_RECEIPT';
  return {
    ...r,
    amount: Number(r.amount || 0),
    flow_type: isIncome ? 'IN' : 'OUT',
    display_category: r.category || defaultPaymentCategory(dir),
    display_counterparty: r.counterparty_name || r.customer_name || r.supplier_name || '---',
    display_ref: r.invoice_code || r.receipt_code || 'Phiếu độc lập'
  };
}

async function handleGetPayments(req, res, url) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES', 'PURCHASES', 'CUSTOMERS', 'SUPPLIERS'], 'xem sổ quỹ thu chi');

  const range = parseDateRange(url);
  const dir = cleanStr(url.searchParams.get('tx_direction') || '', 40);
  const methodFilter = cleanStr(url.searchParams.get('payment_method') || '', 40);
  const q = normVi(cleanStr(url.searchParams.get('q') || '', 120));

  const rows = await dbAll(
    `SELECT pt.*, c.name AS customer_name, c.code AS customer_code,
            s.name AS supplier_name, s.code AS supplier_code,
            si.invoice_code, pr.receipt_code, u.full_name AS created_by_name
     FROM payment_transactions pt
     LEFT JOIN customers c ON c.id = pt.customer_id
     LEFT JOIN suppliers s ON s.id = pt.supplier_id
     LEFT JOIN sales_invoices si ON si.id = pt.invoice_id
     LEFT JOIN purchase_receipts pr ON pr.id = pt.receipt_id
     LEFT JOIN users u ON u.id = pt.created_by
     ORDER BY pt.id DESC`
  );

  const normalized = rows.map(formatPaymentRow);

  // Filter by date range, payment method, and keyword first to build accurate cashbook summary
  const periodMatched = normalized.filter((r) => {
    if (!isDateInRange(r.created_at, range)) return false;
    if (methodFilter && r.payment_method !== methodFilter) return false;
    if (q) {
      const hay = normVi(
        `${r.payment_code} ${r.display_counterparty} ${r.display_category} ${r.invoice_code || ''} ${r.receipt_code || ''} ${r.note || ''}`
      );
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const by_method = {
    CASH: { in: 0, out: 0 },
    BANK_TRANSFER: { in: 0, out: 0 },
    CARD: { in: 0, out: 0 }
  };
  let total_in = 0;
  let total_out = 0;
  let receipt_count = 0;
  let expense_count = 0;

  for (const r of periodMatched) {
    const mKey = by_method[r.payment_method] ? r.payment_method : 'BANK_TRANSFER';
    if (r.flow_type === 'IN') {
      total_in += r.amount;
      receipt_count += 1;
      by_method[mKey].in += r.amount;
    } else {
      total_out += r.amount;
      expense_count += 1;
      by_method[mKey].out += r.amount;
    }
  }

  const items = periodMatched.filter((r) => {
    if (!dir) return true;
    if (dir === 'IN') return r.flow_type === 'IN';
    if (dir === 'OUT') return r.flow_type === 'OUT';
    return r.tx_direction === dir;
  });

  return sendJson(res, 200, {
    items,
    total: items.length,
    period: range.period,
    from: range.from,
    to: range.to,
    summary: {
      total_in,
      total_out,
      net_cashflow: total_in - total_out,
      receipt_count,
      expense_count,
      by_method
    }
  });
}

async function handleGetPaymentDetail(req, res, idParam) {
  const me = await requireAuth(req, { staffOnly: true });
  requirePermission(me, ['SALES', 'PURCHASES', 'CUSTOMERS', 'SUPPLIERS'], 'xem chi tiết phiếu thu chi');
  const id = parseIdParam(idParam, 'Mã chứng từ thu chi');

  const row = await dbGet(
    `SELECT pt.*,
            c.code AS customer_code, c.name AS customer_name, c.phone AS customer_phone,
            c.address AS customer_address, c.tax_code AS customer_tax_code,
            s.code AS supplier_code, s.name AS supplier_name, s.phone AS supplier_phone,
            s.address AS supplier_address, s.tax_code AS supplier_tax_code,
            si.invoice_code, si.total_amount AS invoice_total, si.debt_amount AS invoice_debt,
            pr.receipt_code, pr.total_amount AS receipt_total, pr.debt_amount AS receipt_debt,
            u.full_name AS created_by_name
     FROM payment_transactions pt
     LEFT JOIN customers c ON c.id = pt.customer_id
     LEFT JOIN suppliers s ON s.id = pt.supplier_id
     LEFT JOIN sales_invoices si ON si.id = pt.invoice_id
     LEFT JOIN purchase_receipts pr ON pr.id = pt.receipt_id
     LEFT JOIN users u ON u.id = pt.created_by
     WHERE pt.id = ?`,
    [id]
  );
  if (!row) throw new HttpError(404, 'Không tìm thấy phiếu thu / phiếu chi.');
  return sendJson(res, 200, { item: formatPaymentRow(row) });
}

async function handleCreatePayment(req, res) {
  const me = await requireAuth(req, { staffOnly: true });
  const body = await readJsonBody(req);

  const tx_direction = requireEnum(
    body.tx_direction,
    ['RECEIPT_FROM_CUSTOMER', 'OTHER_RECEIPT', 'PAYMENT_TO_SUPPLIER', 'OPERATING_EXPENSE'],
    'Loại giao dịch'
  );
  const amount = requireNumber(body.amount, 'Số tiền thanh toán', { min: 1 });
  const payment_method = requireEnum(body.payment_method || 'BANK_TRANSFER', ['BANK_TRANSFER', 'CASH', 'CARD'], 'Phương thức thanh toán');
  const rawCategory = cleanStr(body.category, 100);
  const rawCounterparty = cleanStr(body.counterparty_name, 250);
  const rawNote = cleanStr(body.note, 500);

  if (tx_direction === 'RECEIPT_FROM_CUSTOMER') {
    requirePermission(me, ['SALES', 'CUSTOMERS'], 'thu hồi công nợ khách hàng');
  } else if (tx_direction === 'PAYMENT_TO_SUPPLIER') {
    requirePermission(me, ['PURCHASES', 'SUPPLIERS'], 'thanh toán công nợ nhà cung cấp');
  } else if (tx_direction === 'OTHER_RECEIPT') {
    requirePermission(me, ['SALES', 'PURCHASES', 'CUSTOMERS'], 'lập phiếu thu khác');
  } else {
    requirePermission(me, ['PURCHASES', 'SALES'], 'lập phiếu chi vận hành');
  }

  const created = await dbTransaction(async (tx) => {
    const now = localIsoNow();
    if (tx_direction === 'RECEIPT_FROM_CUSTOMER') {
      const customer_id = requireNumber(body.customer_id, 'Khách hàng', { min: 1, integer: true });
      const invoice_id = body.invoice_id ? requireNumber(body.invoice_id, 'Hóa đơn', { min: 1, integer: true }) : null;
      const cust = await tx.get(`SELECT * FROM customers WHERE id = ?`, [customer_id]);
      if (!cust) throw new HttpError(404, 'Không tìm thấy khách hàng.');
      if (amount > Number(cust.receivable_debt || 0)) {
        throw new HttpError(400, `Số tiền thu (${amount.toLocaleString('vi-VN')}đ) vượt công nợ phải thu hiện tại (${Number(cust.receivable_debt).toLocaleString('vi-VN')}đ).`);
      }

      if (invoice_id) {
        const inv = await tx.get(`SELECT * FROM sales_invoices WHERE id = ? AND customer_id = ?`, [invoice_id, customer_id]);
        if (!inv) throw new HttpError(404, 'Không tìm thấy hóa đơn của khách hàng này.');
        if (amount > Number(inv.debt_amount || 0)) {
          throw new HttpError(400, `Số tiền thu vượt số dư nợ còn lại của hóa đơn ${inv.invoice_code}.`);
        }
        const newPaid = Number(inv.paid_amount) + amount;
        const newDebt = Number(inv.debt_amount) - amount;
        const newStatus = newDebt <= 0 ? 'PAID' : 'PARTIAL';
        await tx.run(`UPDATE sales_invoices SET paid_amount = ?, debt_amount = ?, payment_status = ? WHERE id = ?`, [newPaid, Math.max(0, newDebt), newStatus, invoice_id]);
      } else {
        // FIFO settlement across unpaid invoices
        let rem = amount;
        const unpaid = await tx.all(`SELECT id, paid_amount, debt_amount FROM sales_invoices WHERE customer_id = ? AND debt_amount > 0 ORDER BY id ASC`, [customer_id]);
        for (const inv of unpaid) {
          if (rem <= 0) break;
          const payHere = Math.min(rem, Number(inv.debt_amount));
          const newDebt = Number(inv.debt_amount) - payHere;
          await tx.run(`UPDATE sales_invoices SET paid_amount = ?, debt_amount = ?, payment_status = ? WHERE id = ?`, [Number(inv.paid_amount) + payHere, newDebt, newDebt <= 0 ? 'PAID' : 'PARTIAL', inv.id]);
          rem -= payHere;
        }
      }

      await tx.run(`UPDATE customers SET receivable_debt = receivable_debt - ? WHERE id = ?`, [amount, customer_id]);
      const pcode = formatCode('PT');
      const category = rawCategory || 'Thu công nợ / Bán hàng';
      const counterparty = rawCounterparty || cust.name;
      const ins = await tx.run(
        `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, customer_id, invoice_id, amount, payment_method, note, created_by, created_at)
         VALUES (?, 'RECEIPT_FROM_CUSTOMER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pcode, category, counterparty, customer_id, invoice_id, amount, payment_method, rawNote || `Thu hồi công nợ khách hàng ${cust.name}`, me.id, now]
      );
      return tx.get(`SELECT * FROM payment_transactions WHERE id = ?`, [ins.lastInsertRowid]);
    }

    if (tx_direction === 'PAYMENT_TO_SUPPLIER') {
      const supplier_id = requireNumber(body.supplier_id, 'Nhà cung cấp', { min: 1, integer: true });
      const receipt_id = body.receipt_id ? requireNumber(body.receipt_id, 'Phiếu nhập', { min: 1, integer: true }) : null;
      const sup = await tx.get(`SELECT * FROM suppliers WHERE id = ?`, [supplier_id]);
      if (!sup) throw new HttpError(404, 'Không tìm thấy nhà cung cấp.');
      if (amount > Number(sup.payable_debt || 0)) {
        throw new HttpError(400, `Số tiền chi (${amount.toLocaleString('vi-VN')}đ) vượt công nợ phải trả hiện tại (${Number(sup.payable_debt).toLocaleString('vi-VN')}đ).`);
      }

      if (receipt_id) {
        const pr = await tx.get(`SELECT * FROM purchase_receipts WHERE id = ? AND supplier_id = ?`, [receipt_id, supplier_id]);
        if (!pr) throw new HttpError(404, 'Không tìm thấy phiếu nhập của nhà cung cấp này.');
        if (amount > Number(pr.debt_amount || 0)) {
          throw new HttpError(400, `Số tiền chi vượt công nợ còn lại của phiếu nhập ${pr.receipt_code}.`);
        }
        const newPaid = Number(pr.paid_amount) + amount;
        const newDebt = Number(pr.debt_amount) - amount;
        await tx.run(`UPDATE purchase_receipts SET paid_amount = ?, debt_amount = ?, payment_status = ? WHERE id = ?`, [newPaid, Math.max(0, newDebt), newDebt <= 0 ? 'PAID' : 'PARTIAL', receipt_id]);
      } else {
        let rem = amount;
        const unpaid = await tx.all(`SELECT id, paid_amount, debt_amount FROM purchase_receipts WHERE supplier_id = ? AND debt_amount > 0 ORDER BY id ASC`, [supplier_id]);
        for (const pr of unpaid) {
          if (rem <= 0) break;
          const payHere = Math.min(rem, Number(pr.debt_amount));
          const newDebt = Number(pr.debt_amount) - payHere;
          await tx.run(`UPDATE purchase_receipts SET paid_amount = ?, debt_amount = ?, payment_status = ? WHERE id = ?`, [Number(pr.paid_amount) + payHere, newDebt, newDebt <= 0 ? 'PAID' : 'PARTIAL', pr.id]);
          rem -= payHere;
        }
      }

      await tx.run(`UPDATE suppliers SET payable_debt = payable_debt - ? WHERE id = ?`, [amount, supplier_id]);
      const pcode = formatCode('PC');
      const category = rawCategory || 'Thanh toán công nợ NCC';
      const counterparty = rawCounterparty || sup.name;
      const ins = await tx.run(
        `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, supplier_id, receipt_id, amount, payment_method, note, created_by, created_at)
         VALUES (?, 'PAYMENT_TO_SUPPLIER', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [pcode, category, counterparty, supplier_id, receipt_id, amount, payment_method, rawNote || `Thanh toán công nợ NCC ${sup.name}`, me.id, now]
      );
      return tx.get(`SELECT * FROM payment_transactions WHERE id = ?`, [ins.lastInsertRowid]);
    }

    // Standalone cashbook voucher (OTHER_RECEIPT / OPERATING_EXPENSE)
    const isOtherReceipt = tx_direction === 'OTHER_RECEIPT';
    const counterparty = requireNonEmpty(
      rawCounterparty,
      isOtherReceipt ? 'Người nộp tiền / Đơn vị nộp' : 'Người nhận tiền / Đơn vị nhận',
      2
    );
    const category = requireNonEmpty(
      rawCategory,
      isOtherReceipt ? 'Hạng mục thu' : 'Hạng mục chi',
      2
    );
    const note = requireNonEmpty(
      rawNote,
      isOtherReceipt ? 'Nội dung / Lý do thu' : 'Nội dung / Lý do chi',
      3
    );
    const pcode = formatCode(isOtherReceipt ? 'PT' : 'PC');
    const ins = await tx.run(
      `INSERT INTO payment_transactions (payment_code, tx_direction, category, counterparty_name, amount, payment_method, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [pcode, tx_direction, category, counterparty, amount, payment_method, note, me.id, now]
    );
    return tx.get(`SELECT * FROM payment_transactions WHERE id = ?`, [ins.lastInsertRowid]);
  });

  const normalized = formatPaymentRow(created);
  return sendJson(res, 201, { item: normalized, message: `Đã ghi nhận chứng từ ${normalized.payment_code} (${normalized.amount.toLocaleString('vi-VN')}đ) vào Sổ quỹ.` });
}

/* ============================================================================
 *  ANALYTICS OVERVIEW & COMPREHENSIVE REPORTS
 * ============================================================================ */
async function handleAnalyticsOverview(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const range = parseDateRange(url);
  const whId = url.searchParams.get('warehouse_id') ? Number(url.searchParams.get('warehouse_id')) : null;

  const [sales, saleItems, purchases, payments, customers, suppliers, warehouses, stocks, products] = await Promise.all([
    dbAll(`SELECT * FROM sales_invoices ORDER BY created_at ASC`),
    dbAll(
      `SELECT sii.*, p.sku, p.name AS product_name, si.warehouse_id, si.created_at
       FROM sales_invoice_items sii
       JOIN sales_invoices si ON si.id = sii.invoice_id
       JOIN products p ON p.id = sii.product_id`
    ),
    dbAll(`SELECT * FROM purchase_receipts ORDER BY created_at ASC`),
    dbAll(`SELECT id, tx_direction, amount, created_at FROM payment_transactions`),
    dbAll(`SELECT id, receivable_debt, total_spent, customer_type FROM customers`),
    dbAll(`SELECT id, payable_debt FROM suppliers`),
    dbAll(`SELECT * FROM warehouses ORDER BY id ASC`),
    dbAll(
      `SELECT ws.*, p.cost_price, p.min_reorder_level, p.sku, p.name AS product_name
       FROM warehouse_stocks ws
       JOIN products p ON p.id = ws.product_id`
    ),
    dbAll(`SELECT id, sku, name, min_reorder_level, cost_price FROM products WHERE is_active = 1`)
  ]);

  const inFilter = (row) => {
    if (whId && Number(row.warehouse_id) !== whId) return false;
    return isDateInRange(row.created_at, range);
  };

  const fSales = sales.filter(inFilter);
  const fSaleItems = saleItems.filter(inFilter);
  const fPurchases = purchases.filter(inFilter);
  const fPayments = payments.filter((p) => isDateInRange(p.created_at, range));
  const fStocks = whId ? stocks.filter((s) => Number(s.warehouse_id) === whId) : stocks;

  const total_revenue = fSales.reduce((s, x) => s + Number(x.total_amount || 0), 0);
  const total_cogs = fSaleItems.reduce((s, x) => s + Number(x.qty || 0) * Number(x.unit_cost_snapshot || 0), 0);
  const gross_profit = Math.max(0, total_revenue - total_cogs);
  const gross_margin_pct = total_revenue > 0 ? Math.round((gross_profit / total_revenue) * 1000) / 10 : 0;
  const total_orders = fSales.length;
  const avg_order_value = total_orders > 0 ? Math.round(total_revenue / total_orders) : 0;
  const total_purchases = fPurchases.reduce((s, x) => s + Number(x.total_amount || 0), 0);
  const total_receivable_debt = customers.reduce((s, c) => s + Number(c.receivable_debt || 0), 0);
  const total_payable_debt = suppliers.reduce((s, c) => s + Number(c.payable_debt || 0), 0);

  let cash_in_period = 0;
  let cash_out_period = 0;
  let operating_expense_period = 0;
  for (const pt of fPayments) {
    const amt = Number(pt.amount || 0);
    if (pt.tx_direction === 'RECEIPT_FROM_CUSTOMER' || pt.tx_direction === 'OTHER_RECEIPT') {
      cash_in_period += amt;
    } else {
      cash_out_period += amt;
      if (pt.tx_direction === 'OPERATING_EXPENSE') operating_expense_period += amt;
    }
  }
  const net_cashflow_period = cash_in_period - cash_out_period;

  const inventory_valuation = fStocks.reduce((s, x) => s + Number(x.qty_on_hand || 0) * Number(x.cost_price || 0), 0);
  const total_units_in_stock = fStocks.reduce((s, x) => s + Number(x.qty_on_hand || 0), 0);

  // Status breakdowns
  const fulfillment_breakdown = { COMPLETED: 0, DELIVERED: 0, PROCESSING: 0 };
  const payment_breakdown = { PAID: 0, PARTIAL: 0, UNPAID: 0 };
  const channel_breakdown = {
    POS: { count: 0, revenue: 0 },
    B2B: { count: 0, revenue: 0 },
    WEB3D: { count: 0, revenue: 0 }
  };
  for (const s of fSales) {
    fulfillment_breakdown[s.fulfillment_status] = (fulfillment_breakdown[s.fulfillment_status] || 0) + 1;
    payment_breakdown[s.payment_status] = (payment_breakdown[s.payment_status] || 0) + 1;
    if (channel_breakdown[s.sales_channel]) {
      channel_breakdown[s.sales_channel].count += 1;
      channel_breakdown[s.sales_channel].revenue += Number(s.total_amount || 0);
    }
  }

  // Top 6 products
  const prodSalesMap = new Map();
  for (const it of fSaleItems) {
    const cur = prodSalesMap.get(it.product_id) || { product_id: it.product_id, sku: it.sku, name: it.product_name, qty: 0, revenue: 0 };
    cur.qty += Number(it.qty || 0);
    cur.revenue += Number(it.line_total || 0);
    prodSalesMap.set(it.product_id, cur);
  }
  const top_products = Array.from(prodSalesMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  // Per-warehouse comparison
  const whPerf = warehouses.map((w) => {
    const whSales = fSales.filter((s) => Number(s.warehouse_id) === w.id);
    const whSt = stocks.filter((s) => Number(s.warehouse_id) === w.id);
    const units = whSt.reduce((a, b) => a + Number(b.qty_on_hand || 0), 0);
    const val = whSt.reduce((a, b) => a + Number(b.qty_on_hand || 0) * Number(b.cost_price || 0), 0);
    return {
      warehouse_id: w.id,
      code: w.code,
      name: w.name,
      region: w.region,
      orders: whSales.length,
      revenue: whSales.reduce((a, b) => a + Number(b.total_amount || 0), 0),
      units,
      capacity: Number(w.capacity_units || 5000),
      utilization_pct: w.capacity_units > 0 ? Math.round((units / Number(w.capacity_units)) * 1000) / 10 : 0,
      valuation: val
    };
  });

  // Revenue trend by date
  const dayMap = new Map();
  for (const s of fSales) {
    const day = String(s.created_at || '').slice(0, 10) || 'N/A';
    const cur = dayMap.get(day) || { date: day, revenue: 0, orders: 0 };
    cur.revenue += Number(s.total_amount || 0);
    cur.orders += 1;
    dayMap.set(day, cur);
  }
  const revenue_trend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-12);

  // Low stock alerts across system
  const availByProd = new Map();
  for (const st of fStocks) {
    const av = Number(st.qty_on_hand || 0) - Number(st.qty_reserved || 0);
    availByProd.set(st.product_id, (availByProd.get(st.product_id) || 0) + av);
  }
  const low_stock_alerts = [];
  for (const p of products) {
    const avail = availByProd.get(p.id) || 0;
    const threshold = whId ? Math.max(2, Math.ceil(Number(p.min_reorder_level || 5) / 2)) : Number(p.min_reorder_level || 5);
    if (avail <= threshold) {
      low_stock_alerts.push({ product_id: p.id, sku: p.sku, name: p.name, qty_available: avail, min_reorder_level: threshold });
    }
  }
  low_stock_alerts.sort((a, b) => a.qty_available - b.qty_available);

  return sendJson(res, 200, {
    db_client: getActiveDbClient(),
    period: range.period,
    from: range.from,
    to: range.to,
    warehouse_id: whId,
    kpi: {
      total_revenue,
      total_cogs,
      gross_profit,
      gross_margin_pct,
      total_orders,
      avg_order_value,
      total_purchases,
      total_receivable_debt,
      total_payable_debt,
      cash_in_period,
      cash_out_period,
      net_cashflow_period,
      operating_expense_period,
      inventory_valuation,
      total_units_in_stock,
      low_stock_sku_count: low_stock_alerts.length,
      total_products: products.length,
      total_customers: customers.length,
      total_suppliers: suppliers.length
    },
    fulfillment_breakdown,
    payment_breakdown,
    channel_breakdown,
    top_products,
    warehouse_performance: whPerf,
    revenue_trend,
    low_stock_alerts: low_stock_alerts.slice(0, 10)
  });
}

async function handleReportsSummary(req, res, url) {
  await requireAuth(req, { staffOnly: true });
  const type = requireEnum(url.searchParams.get('type') || 'revenue', ['revenue', 'inventory', 'debt_cashflow'], 'Loại báo cáo');
  const range = parseDateRange(url);
  const whId = url.searchParams.get('warehouse_id') ? Number(url.searchParams.get('warehouse_id')) : null;
  const qRaw = cleanStr(url.searchParams.get('q') || '', 120);
  const q = normVi(qRaw);

  if (type === 'revenue') {
    const [sales, items, warehouses] = await Promise.all([
      dbAll(
        `SELECT si.*, c.name AS customer_name, c.code AS customer_code,
                w.code AS warehouse_code, w.name AS warehouse_name,
                u.full_name AS created_by_name
         FROM sales_invoices si
         JOIN customers c ON c.id = si.customer_id
         JOIN warehouses w ON w.id = si.warehouse_id
         JOIN users u ON u.id = si.created_by
         ORDER BY si.created_at DESC, si.id DESC`
      ),
      dbAll(
        `SELECT sii.invoice_id, sii.qty, sii.unit_cost_snapshot
         FROM sales_invoice_items sii`
      ),
      dbAll(`SELECT id, code, name FROM warehouses ORDER BY id ASC`)
    ]);

    const costByInvoice = new Map();
    for (const it of items) {
      const cur = costByInvoice.get(it.invoice_id) || { cogs: 0, total_qty: 0, line_count: 0 };
      cur.cogs += Number(it.qty || 0) * Number(it.unit_cost_snapshot || 0);
      cur.total_qty += Number(it.qty || 0);
      cur.line_count += 1;
      costByInvoice.set(it.invoice_id, cur);
    }

    const filteredInvoices = [];
    for (const s of sales) {
      if (whId && Number(s.warehouse_id) !== whId) continue;
      if (!isDateInRange(s.created_at, range)) continue;
      const cInfo = costByInvoice.get(s.id) || { cogs: 0, total_qty: 0, line_count: 0 };
      const total_amount = Number(s.total_amount || 0);
      const gross_profit = total_amount - cInfo.cogs;
      const margin_pct = total_amount > 0 ? Math.round((gross_profit / total_amount) * 1000) / 10 : 0;
      const row = {
        ...s,
        subtotal: Number(s.subtotal || 0),
        discount_amount: Number(s.discount_amount || 0),
        shipping_fee: Number(s.shipping_fee || 0),
        vat_amount: Number(s.vat_amount || 0),
        total_amount,
        paid_amount: Number(s.paid_amount || 0),
        debt_amount: Number(s.debt_amount || 0),
        cogs: cInfo.cogs,
        gross_profit,
        margin_pct,
        total_qty: cInfo.total_qty,
        line_count: cInfo.line_count
      };
      if (q) {
        const hay = normVi(`${row.invoice_code} ${row.customer_name} ${row.customer_code} ${row.warehouse_name} ${row.warehouse_code} ${row.sales_channel}`);
        if (!hay.includes(q)) continue;
      }
      filteredInvoices.push(row);
    }

    const chMap = new Map([
      ['POS', { channel: 'POS', label: 'Showroom / Quầy (POS)', orders: 0, qty: 0, revenue: 0, cogs: 0, gross_profit: 0, paid_amount: 0, debt_amount: 0 }],
      ['B2B', { channel: 'B2B', label: 'Doanh nghiệp / Dự án (B2B)', orders: 0, qty: 0, revenue: 0, cogs: 0, gross_profit: 0, paid_amount: 0, debt_amount: 0 }],
      ['WEB3D', { channel: 'WEB3D', label: 'Storefront Online (WEB3D)', orders: 0, qty: 0, revenue: 0, cogs: 0, gross_profit: 0, paid_amount: 0, debt_amount: 0 }]
    ]);
    const whMap = new Map();
    for (const w of warehouses) {
      whMap.set(w.id, { warehouse_id: w.id, code: w.code, name: w.name, orders: 0, qty: 0, revenue: 0, cogs: 0, gross_profit: 0 });
    }
    const dayMap = new Map();

    let total_revenue = 0;
    let total_cogs = 0;
    let total_paid = 0;
    let total_debt = 0;
    let total_qty = 0;

    for (const inv of filteredInvoices) {
      total_revenue += inv.total_amount;
      total_cogs += inv.cogs;
      total_paid += inv.paid_amount;
      total_debt += inv.debt_amount;
      total_qty += inv.total_qty;

      const ch = chMap.get(inv.sales_channel);
      if (ch) {
        ch.orders += 1;
        ch.qty += inv.total_qty;
        ch.revenue += inv.total_amount;
        ch.cogs += inv.cogs;
        ch.gross_profit += inv.gross_profit;
        ch.paid_amount += inv.paid_amount;
        ch.debt_amount += inv.debt_amount;
      }

      const wh = whMap.get(Number(inv.warehouse_id));
      if (wh) {
        wh.orders += 1;
        wh.qty += inv.total_qty;
        wh.revenue += inv.total_amount;
        wh.cogs += inv.cogs;
        wh.gross_profit += inv.gross_profit;
      }

      const day = String(inv.created_at || '').slice(0, 10) || 'N/A';
      const dRec = dayMap.get(day) || { date: day, orders: 0, qty: 0, revenue: 0, cogs: 0, gross_profit: 0 };
      dRec.orders += 1;
      dRec.qty += inv.total_qty;
      dRec.revenue += inv.total_amount;
      dRec.cogs += inv.cogs;
      dRec.gross_profit += inv.gross_profit;
      dayMap.set(day, dRec);
    }

    const gross_profit = total_revenue - total_cogs;
    const gross_margin_pct = total_revenue > 0 ? Math.round((gross_profit / total_revenue) * 1000) / 10 : 0;

    return sendJson(res, 200, {
      type,
      period: range.period,
      from: range.from,
      to: range.to,
      warehouse_id: whId,
      summary: {
        total_orders: filteredInvoices.length,
        total_qty,
        total_revenue,
        total_cogs,
        gross_profit,
        gross_margin_pct,
        total_paid,
        total_debt
      },
      by_channel: Array.from(chMap.values()),
      by_warehouse: Array.from(whMap.values()),
      by_day: Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
      invoices: filteredInvoices
    });
  }

  if (type === 'inventory') {
    const [products, stocks, ledger] = await Promise.all([
      dbAll(
        `SELECT p.id, p.sku, p.name, p.unit, p.cost_price, p.retail_price, p.min_reorder_level,
                c.name AS category_name
         FROM products p
         JOIN categories c ON c.id = p.category_id
         WHERE p.is_active = 1
         ORDER BY p.id ASC`
      ),
      dbAll(`SELECT warehouse_id, product_id, qty_on_hand, qty_reserved FROM warehouse_stocks`),
      dbAll(`SELECT warehouse_id, product_id, tx_type, ref_code, qty_change, unit_price, created_at FROM inventory_ledger ORDER BY id ASC`)
    ]);

    const stockByProd = new Map();
    for (const s of stocks) {
      if (whId && Number(s.warehouse_id) !== whId) continue;
      const cur = stockByProd.get(s.product_id) || { on_hand: 0, reserved: 0 };
      cur.on_hand += Number(s.qty_on_hand || 0);
      cur.reserved += Number(s.qty_reserved || 0);
      stockByProd.set(s.product_id, cur);
    }

    const afterEndNet = new Map();
    const inPeriodMov = new Map();

    for (const l of ledger) {
      if (whId && Number(l.warehouse_id) !== whId) continue;
      const pid = l.product_id;
      const d = parseDbDate(l.created_at);
      const qtyChange = Number(l.qty_change || 0);

      if (range.endDate && d && d > range.endDate) {
        afterEndNet.set(pid, (afterEndNet.get(pid) || 0) + qtyChange);
        continue;
      }

      if (isDateInRange(l.created_at, range)) {
        // When viewing full history ("all"), keep historical opening audit seed in opening_qty
        if (!range.startDate && l.ref_code === 'INIT-OPENING-2026') {
          continue;
        }
        const cur = inPeriodMov.get(pid) || { in_qty: 0, out_qty: 0, adj_qty: 0, in_val: 0, out_val: 0 };
        const unitP = Number(l.unit_price || 0);
        if (l.tx_type === 'PURCHASE_IN' || l.tx_type === 'TRANSFER_IN') {
          cur.in_qty += Math.abs(qtyChange);
          cur.in_val += Math.abs(qtyChange) * unitP;
        } else if (l.tx_type === 'SALE_OUT' || l.tx_type === 'TRANSFER_OUT') {
          cur.out_qty += Math.abs(qtyChange);
          cur.out_val += Math.abs(qtyChange) * unitP;
        } else {
          cur.adj_qty += qtyChange;
        }
        inPeriodMov.set(pid, cur);
      }
    }

    const rows = [];
    for (const p of products) {
      if (q) {
        const hay = normVi(`${p.sku} ${p.name} ${p.category_name}`);
        if (!hay.includes(q)) continue;
      }
      const st = stockByProd.get(p.id) || { on_hand: 0, reserved: 0 };
      const netAfter = afterEndNet.get(p.id) || 0;
      const closing_qty = Math.max(0, st.on_hand - netAfter);
      const mov = inPeriodMov.get(p.id) || { in_qty: 0, out_qty: 0, adj_qty: 0, in_val: 0, out_val: 0 };
      const opening_qty = closing_qty - (mov.in_qty - mov.out_qty + mov.adj_qty);
      const unit_cost = Number(p.cost_price || 0);
      const closing_value = closing_qty * unit_cost;
      const qty_reserved = whId ? st.reserved : st.reserved;
      const qty_available = Math.max(0, closing_qty - qty_reserved);
      const threshold = whId ? Math.max(2, Math.ceil(Number(p.min_reorder_level || 5) / 2)) : Number(p.min_reorder_level || 5);
      const is_low_stock = qty_available <= threshold;

      rows.push({
        product_id: p.id,
        sku: p.sku,
        name: p.name,
        category_name: p.category_name,
        unit: p.unit,
        opening_qty,
        in_qty: mov.in_qty,
        out_qty: mov.out_qty,
        adj_qty: mov.adj_qty,
        closing_qty,
        qty_reserved,
        qty_available,
        min_reorder_level: threshold,
        unit_cost,
        closing_value,
        in_value: mov.in_val,
        out_value: mov.out_val,
        is_low_stock
      });
    }

    rows.sort((a, b) => b.closing_value - a.closing_value);

    const summary = rows.reduce((acc, r) => {
      acc.sku_count += 1;
      acc.total_opening_qty += r.opening_qty;
      acc.total_in_qty += r.in_qty;
      acc.total_out_qty += r.out_qty;
      acc.total_adj_qty += r.adj_qty;
      acc.total_closing_qty += r.closing_qty;
      acc.total_closing_value += r.closing_value;
      if (r.is_low_stock) acc.low_stock_count += 1;
      return acc;
    }, {
      sku_count: 0,
      total_opening_qty: 0,
      total_in_qty: 0,
      total_out_qty: 0,
      total_adj_qty: 0,
      total_closing_qty: 0,
      total_closing_value: 0,
      low_stock_count: 0
    });

    return sendJson(res, 200, {
      type,
      period: range.period,
      from: range.from,
      to: range.to,
      warehouse_id: whId,
      summary,
      rows
    });
  }

  // type === 'debt_cashflow'
  const [customers, suppliers, payments] = await Promise.all([
    dbAll(`SELECT id, code, name, customer_type, phone, credit_limit, receivable_debt, total_spent FROM customers ORDER BY receivable_debt DESC, id ASC`),
    dbAll(`SELECT id, code, name, contact_person, phone, payment_terms_days, payable_debt FROM suppliers ORDER BY payable_debt DESC, id ASC`),
    dbAll(
      `SELECT pt.*, c.name AS customer_name, s.name AS supplier_name,
              si.invoice_code, pr.receipt_code, u.full_name AS created_by_name
       FROM payment_transactions pt
       LEFT JOIN customers c ON c.id = pt.customer_id
       LEFT JOIN suppliers s ON s.id = pt.supplier_id
       LEFT JOIN sales_invoices si ON si.id = pt.invoice_id
       LEFT JOIN purchase_receipts pr ON pr.id = pt.receipt_id
       LEFT JOIN users u ON u.id = pt.created_by
       ORDER BY pt.id DESC`
    )
  ]);

  const receivables = customers
    .map((c) => ({ ...c, credit_limit: Number(c.credit_limit || 0), receivable_debt: Number(c.receivable_debt || 0), total_spent: Number(c.total_spent || 0) }))
    .filter((c) => c.receivable_debt > 0 && (!q || normVi(`${c.code} ${c.name} ${c.phone}`).includes(q)));

  const payables = suppliers
    .map((s) => ({ ...s, payable_debt: Number(s.payable_debt || 0) }))
    .filter((s) => s.payable_debt > 0 && (!q || normVi(`${s.code} ${s.name} ${s.phone}`).includes(q)));

  const transactions = payments
    .map(formatPaymentRow)
    .filter((r) => isDateInRange(r.created_at, range) && (!q || normVi(`${r.payment_code} ${r.display_counterparty} ${r.display_category} ${r.note || ''}`).includes(q)));

  let total_in = 0;
  let total_out = 0;
  const catMap = new Map();
  for (const r of transactions) {
    if (r.flow_type === 'IN') total_in += r.amount;
    else total_out += r.amount;
    const key = `${r.tx_direction}::${r.display_category}`;
    const cur = catMap.get(key) || {
      tx_direction: r.tx_direction,
      flow_type: r.flow_type,
      category: r.display_category,
      count: 0,
      amount: 0
    };
    cur.count += 1;
    cur.amount += r.amount;
    catMap.set(key, cur);
  }

  return sendJson(res, 200, {
    type,
    period: range.period,
    from: range.from,
    to: range.to,
    summary: {
      total_receivable_debt: customers.reduce((a, c) => a + Number(c.receivable_debt || 0), 0),
      receivable_count: receivables.length,
      total_payable_debt: suppliers.reduce((a, s) => a + Number(s.payable_debt || 0), 0),
      payable_count: payables.length,
      total_in,
      total_out,
      net_cashflow: total_in - total_out,
      tx_count: transactions.length
    },
    receivables,
    payables,
    cashflow_by_category: Array.from(catMap.values()).sort((a, b) => b.amount - a.amount),
    transactions
  });
}

/* ============================================================================
 *  MAIN DISPATCHER
 * ============================================================================ */
export async function handleApiRequest(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method.toUpperCase();

  try {
    // Health
    if (pathname === '/api/health' && method === 'GET') {
      return sendJson(res, 200, { ok: true, db_client: getActiveDbClient(), time: localIsoNow() });
    }

    // Auth
    if (pathname === '/api/auth/login' && method === 'POST') return await handleLogin(req, res);
    if (pathname === '/api/auth/register' && method === 'POST') return await handleRegister(req, res);
    if (pathname === '/api/auth/me' && method === 'GET') {
      const user = await requireAuth(req, { staffOnly: false });
      return sendJson(res, 200, { user, db_client: getActiveDbClient() });
    }

    // Meta
    if (pathname === '/api/meta' && method === 'GET') return await handleMeta(req, res);

    // Users
    if (pathname === '/api/users' && method === 'GET') return await handleGetUsers(req, res, url);
    if (pathname === '/api/users' && method === 'POST') return await handleCreateUser(req, res);
    let m = pathname.match(/^\/api\/users\/(\d+)$/);
    if (m && method === 'PUT') return await handleUpdateUser(req, res, m[1]);
    if (m && method === 'DELETE') return await handleDeleteUser(req, res, m[1]);

    // Categories
    if (pathname === '/api/categories' && method === 'GET') return await handleGetCategories(req, res, url);
    if (pathname === '/api/categories' && method === 'POST') return await handleCreateCategory(req, res);
    m = pathname.match(/^\/api\/categories\/(\d+)$/);
    if (m && method === 'PUT') return await handleUpdateCategory(req, res, m[1]);
    if (m && method === 'DELETE') return await handleDeleteCategory(req, res, m[1]);

    // Suppliers
    if (pathname === '/api/suppliers' && method === 'GET') return await handleGetSuppliers(req, res, url);
    if (pathname === '/api/suppliers' && method === 'POST') return await handleCreateSupplier(req, res);
    m = pathname.match(/^\/api\/suppliers\/(\d+)$/);
    if (m && method === 'PUT') return await handleUpdateSupplier(req, res, m[1]);
    if (m && method === 'DELETE') return await handleDeleteSupplier(req, res, m[1]);

    // Customers
    if (pathname === '/api/customers' && method === 'GET') return await handleGetCustomers(req, res, url);
    if (pathname === '/api/customers' && method === 'POST') return await handleCreateCustomer(req, res);
    m = pathname.match(/^\/api\/customers\/(\d+)$/);
    if (m && method === 'PUT') return await handleUpdateCustomer(req, res, m[1]);
    if (m && method === 'DELETE') return await handleDeleteCustomer(req, res, m[1]);

    // Products & Upload
    if (pathname === '/api/products' && method === 'GET') return await handleGetProducts(req, res, url);
    if (pathname === '/api/products' && method === 'POST') return await handleCreateProduct(req, res);
    if (pathname === '/api/upload-image' && method === 'POST') return await handleUploadImage(req, res);
    m = pathname.match(/^\/api\/products\/(\d+)$/);
    if (m && method === 'PUT') return await handleUpdateProduct(req, res, m[1]);
    if (m && method === 'DELETE') return await handleDeleteProduct(req, res, m[1]);

    // Purchases
    if (pathname === '/api/purchases/reorder-suggestions' && method === 'GET') return await handleReorderSuggestions(req, res, url);
    if (pathname === '/api/purchases' && method === 'GET') return await handleGetPurchases(req, res, url);
    if (pathname === '/api/purchases' && method === 'POST') return await handleCreatePurchase(req, res);
    m = pathname.match(/^\/api\/purchases\/(\d+)$/);
    if (m && method === 'GET') return await handleGetPurchaseDetail(req, res, m[1]);

    // Sales
    if (pathname === '/api/sales/suggest-warehouse' && method === 'GET') return await handleSuggestWarehouse(req, res, url);
    if (pathname === '/api/sales' && method === 'GET') return await handleGetSales(req, res, url);
    if (pathname === '/api/sales' && method === 'POST') return await handleCreateSale(req, res);
    m = pathname.match(/^\/api\/sales\/(\d+)\/fulfillment$/);
    if (m && method === 'PATCH') return await handleUpdateFulfillment(req, res, m[1]);
    m = pathname.match(/^\/api\/sales\/(\d+)$/);
    if (m && method === 'GET') return await handleGetSaleDetail(req, res, m[1]);

    // Storefront Public & Customer Orders
    if (pathname === '/api/storefront/orders' && method === 'POST') return await handleStorefrontCheckout(req, res);
    if (pathname === '/api/storefront/orders/track' && method === 'GET') return await handleTrackStorefrontOrder(req, res, url);
    if (pathname === '/api/storefront/orders/my' && method === 'GET') return await handleMyStorefrontOrders(req, res);

    // Inventory & Transfers
    if (pathname === '/api/inventory' && method === 'GET') return await handleGetInventory(req, res, url);
    if (pathname === '/api/inventory/ledger' && method === 'GET') return await handleGetLedger(req, res, url);
    if (pathname === '/api/inventory/adjust' && method === 'POST') return await handleAdjustInventory(req, res);
    if (pathname === '/api/transfers' && method === 'GET') return await handleGetTransfers(req, res);
    if (pathname === '/api/transfers' && method === 'POST') return await handleCreateTransfer(req, res);
    m = pathname.match(/^\/api\/transfers\/(\d+)\/complete$/);
    if (m && method === 'PATCH') return await handleCompleteTransfer(req, res, m[1]);

    // Payments & Cashbook
    if (pathname === '/api/payments' && method === 'GET') return await handleGetPayments(req, res, url);
    if (pathname === '/api/payments' && method === 'POST') return await handleCreatePayment(req, res);
    m = pathname.match(/^\/api\/payments\/(\d+)$/);
    if (m && method === 'GET') return await handleGetPaymentDetail(req, res, m[1]);

    // Analytics & Comprehensive Reports
    if (pathname === '/api/analytics/overview' && method === 'GET') return await handleAnalyticsOverview(req, res, url);
    if (pathname === '/api/reports/summary' && method === 'GET') return await handleReportsSummary(req, res, url);

    return sendJson(res, 404, { error: `Không tìm thấy API endpoint: ${method} ${pathname}` });
  } catch (err) {
    if (err instanceof HttpError) {
      return sendJson(res, err.status, { error: err.message, details: err.details || undefined });
    }
    console.error('[API ERROR]', method, pathname, err);
    return sendJson(res, 500, { error: 'Lỗi hệ thống máy chủ nội bộ. Vui lòng thử lại sau.' });
  }
}
