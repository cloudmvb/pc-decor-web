export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function cleanStr(val, maxLen = 500) {
  return String(val ?? '').trim().slice(0, maxLen);
}

export function normVi(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email || '').trim());
}

export function isValidPhone(phone) {
  const digits = String(phone || '').replace(/[\s.-]/g, '');
  return /^0\d{8,10}$/.test(digits) || /^\+84\d{8,10}$/.test(digits);
}

export function requireNonEmpty(val, fieldLabel, minLen = 1) {
  const s = cleanStr(val);
  if (s.length < minLen) {
    throw new HttpError(400, `${fieldLabel} không được để trống (tối thiểu ${minLen} ký tự).`);
  }
  return s;
}

export function requireNumber(val, fieldLabel, { min = -Infinity, max = Infinity, integer = false } = {}) {
  const n = Number(val);
  if (!Number.isFinite(n)) throw new HttpError(400, `${fieldLabel} phải là số hợp lệ.`);
  if (integer && !Number.isInteger(n)) throw new HttpError(400, `${fieldLabel} phải là số nguyên.`);
  if (n < min) throw new HttpError(400, `${fieldLabel} phải lớn hơn hoặc bằng ${min}.`);
  if (n > max) throw new HttpError(400, `${fieldLabel} phải nhỏ hơn hoặc bằng ${max}.`);
  return n;
}

export function requireEnum(val, allowed, fieldLabel) {
  const s = cleanStr(val);
  if (!allowed.includes(s)) {
    throw new HttpError(400, `${fieldLabel} không hợp lệ (cho phép: ${allowed.join(', ')}).`);
  }
  return s;
}

export function formatCode(prefix) {
  const rnd = Math.floor(10000 + Math.random() * 89999);
  return `${prefix}-${rnd}`;
}

export function localIsoNow() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
