import crypto from 'crypto';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import { CONFIG } from './env.mjs';
import { HttpError } from './validators.mjs';

let sqliteDb = null;
let mssqlPool = null;
let activeClient = 'sqlite';

/**
 * Dual-DB SQL Adapter supporting Microsoft SQL Server (`mssql`) and SQLite (`node:sqlite`).
 * Positional `?` placeholders are mapped cleanly to `@p0, @p1...` for T-SQL.
 */
function convertPlaceholdersToMssql(sql, params) {
  let idx = 0;
  const mappedSql = sql.replace(/\?/g, () => `@p${idx++}`);
  return { mappedSql, count: idx, params };
}

function formatDateValue(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizeMssqlRow(row) {
  if (!row || typeof row !== 'object') return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      out[k] = formatDateValue(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function normalizeSqliteError(err) {
  if (err instanceof HttpError) return err;
  const msg = String(err?.message || err || '');
  if (/UNIQUE constraint failed/i.test(msg)) {
    const col = msg.split(':').pop()?.trim() || 'dữ liệu';
    return new HttpError(409, `Dữ liệu bị trùng lặp (${col}). Vui lòng kiểm tra lại mã, email hoặc số điện thoại.`);
  }
  if (/FOREIGN KEY constraint failed/i.test(msg)) {
    return new HttpError(409, 'Không thể thực hiện vì bản ghi đang được liên kết dữ liệu (ràng buộc khóa ngoại).');
  }
  if (/CHECK constraint failed/i.test(msg)) {
    return new HttpError(400, `Dữ liệu vi phạm ràng buộc kiểm tra của CSDL (${msg}).`);
  }
  return new HttpError(500, `Lỗi CSDL SQLite: ${msg}`);
}

function normalizeMssqlError(err) {
  if (err instanceof HttpError) return err;
  const code = Number(err?.number || err?.originalError?.info?.number || 0);
  const msg = String(err?.message || err || '');
  if (code === 2627 || code === 2601 || /Violation of UNIQUE KEY|duplicate key/i.test(msg)) {
    return new HttpError(409, 'Dữ liệu bị trùng lặp (mã, username, email hoặc số điện thoại đã tồn tại trong SQL Server).');
  }
  if (code === 547) {
    if (/REFERENCE constraint|FOREIGN KEY/i.test(msg)) {
      return new HttpError(409, 'Không thể thực hiện vì bản ghi đang được liên kết dữ liệu (ràng buộc khóa ngoại SQL Server).');
    }
    return new HttpError(400, `Dữ liệu vi phạm ràng buộc kiểm tra CHECK trong SQL Server (${msg}).`);
  }
  return new HttpError(500, `Lỗi SQL Server: ${msg}`);
}

function createSqliteTxHandle(db) {
  return {
    client: 'sqlite',
    async all(sql, params = []) {
      try { return db.prepare(sql).all(...params); } catch (e) { throw normalizeSqliteError(e); }
    },
    async get(sql, params = []) {
      try { return db.prepare(sql).get(...params) || null; } catch (e) { throw normalizeSqliteError(e); }
    },
    async run(sql, params = []) {
      try {
        const res = db.prepare(sql).run(...params);
        return { changes: Number(res.changes || 0), lastInsertRowid: Number(res.lastInsertRowid || 0) };
      } catch (e) {
        throw normalizeSqliteError(e);
      }
    }
  };
}

function createMssqlTxHandle(reqFactory) {
  return {
    client: 'mssql',
    async all(sql, params = []) {
      try {
        const { mappedSql } = convertPlaceholdersToMssql(sql, params);
        const req = reqFactory();
        params.forEach((v, i) => req.input(`p${i}`, v === undefined ? null : v));
        const res = await req.query(mappedSql);
        return (res.recordset || []).map(normalizeMssqlRow);
      } catch (e) {
        throw normalizeMssqlError(e);
      }
    },
    async get(sql, params = []) {
      const rows = await this.all(sql, params);
      return rows[0] || null;
    },
    async run(sql, params = []) {
      try {
        const isInsert = /^\s*INSERT\s+INTO\s+/i.test(sql);
        const execSql = isInsert ? `${sql}; SELECT SCOPE_IDENTITY() AS id;` : sql;
        const { mappedSql } = convertPlaceholdersToMssql(execSql, params);
        const req = reqFactory();
        params.forEach((v, i) => req.input(`p${i}`, v === undefined ? null : v));
        const res = await req.query(mappedSql);
        const rawId = isInsert ? res.recordset?.[0]?.id : 0;
        const lastId = rawId !== null && rawId !== undefined ? Number(rawId) : 0;
        const changes = Array.isArray(res.rowsAffected) ? Number(res.rowsAffected[0] || 0) : 0;
        return { changes, lastInsertRowid: lastId };
      } catch (e) {
        throw normalizeMssqlError(e);
      }
    }
  };
}

export function buildMssqlConfig(databaseOverride = null) {
  const cfg = {
    server: CONFIG.MSSQL.server,
    user: CONFIG.MSSQL.user,
    password: CONFIG.MSSQL.password,
    database: databaseOverride || CONFIG.MSSQL.database,
    connectionTimeout: 15000,
    requestTimeout: 30000,
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    options: {
      encrypt: CONFIG.MSSQL.encrypt,
      trustServerCertificate: CONFIG.MSSQL.trustServerCertificate
    }
  };
  if (CONFIG.MSSQL.instanceName) {
    cfg.options.instanceName = CONFIG.MSSQL.instanceName;
  } else {
    cfg.port = CONFIG.MSSQL.port;
  }
  return cfg;
}

export async function ensureSqlServerSchema(pool) {
  if (!fs.existsSync(CONFIG.SQLSERVER_SCHEMA_PATH)) return;
  const ddl = fs.readFileSync(CONFIG.SQLSERVER_SCHEMA_PATH, 'utf8');
  // Split table DDL and index DDL into separate batches so T-SQL compiles CREATE INDEX after tables exist
  const marker = '-- CHỈ MỤC TỐI ƯU TRUY VẤN';
  const idx = ddl.indexOf(marker);
  if (idx > 0) {
    const tablesBatch = ddl.slice(0, idx).trim();
    const indexesBatch = ddl.slice(idx).trim();
    if (tablesBatch) await pool.request().batch(tablesBatch);
    if (indexesBatch) await pool.request().batch(indexesBatch);
  } else {
    await pool.request().batch(ddl);
  }

  // Batch 1: Add cashbook columns & expand tx_direction CHECK constraint on existing DBs
  await pool.request().batch(`
    IF COL_LENGTH(N'dbo.payment_transactions', N'category') IS NULL
      ALTER TABLE dbo.payment_transactions ADD category NVARCHAR(100) NOT NULL CONSTRAINT DF_pt_category DEFAULT N'';
    IF COL_LENGTH(N'dbo.payment_transactions', N'counterparty_name') IS NULL
      ALTER TABLE dbo.payment_transactions ADD counterparty_name NVARCHAR(250) NOT NULL CONSTRAINT DF_pt_counterparty DEFAULT N'';

    DECLARE @oldChk NVARCHAR(256);
    SELECT TOP 1 @oldChk = cc.name
    FROM sys.check_constraints cc
    WHERE cc.parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
      AND cc.definition LIKE N'%tx_direction%'
      AND cc.definition NOT LIKE N'%OPERATING_EXPENSE%';
    IF @oldChk IS NOT NULL
    BEGIN
      EXEC(N'ALTER TABLE dbo.payment_transactions DROP CONSTRAINT [' + @oldChk + N']');
    END;

    IF NOT EXISTS (
      SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id = OBJECT_ID(N'dbo.payment_transactions')
        AND name = N'CK_pt_tx_direction'
    )
    BEGIN
      ALTER TABLE dbo.payment_transactions
      ADD CONSTRAINT CK_pt_tx_direction
      CHECK (tx_direction IN ('RECEIPT_FROM_CUSTOMER', 'OTHER_RECEIPT', 'PAYMENT_TO_SUPPLIER', 'OPERATING_EXPENSE'));
    END;
  `);

  // Batch 2 (separate compile scope after ALTER ADD): Backfill historical payment_transactions rows
  await pool.request().batch(`
    UPDATE pt
    SET
      category = CASE
        WHEN pt.category = N'' AND pt.tx_direction = 'RECEIPT_FROM_CUSTOMER' THEN N'Thu công nợ / Bán hàng'
        WHEN pt.category = N'' AND pt.tx_direction = 'PAYMENT_TO_SUPPLIER' THEN N'Thanh toán công nợ NCC'
        WHEN pt.category = N'' AND pt.tx_direction = 'OTHER_RECEIPT' THEN N'Thu nhập khác'
        WHEN pt.category = N'' AND pt.tx_direction = 'OPERATING_EXPENSE' THEN N'Chi phí vận hành'
        ELSE pt.category
      END,
      counterparty_name = CASE
        WHEN pt.counterparty_name = N'' AND c.name IS NOT NULL THEN c.name
        WHEN pt.counterparty_name = N'' AND s.name IS NOT NULL THEN s.name
        ELSE pt.counterparty_name
      END
    FROM dbo.payment_transactions pt
    LEFT JOIN dbo.customers c ON c.id = pt.customer_id
    LEFT JOIN dbo.suppliers s ON s.id = pt.supplier_id
    WHERE pt.category = N'' OR pt.counterparty_name = N'';
  `);
}

export async function initDatabase() {
  if (CONFIG.DB_CLIENT === 'mssql') {
    const mssqlMod = await import('mssql');
    const sql = mssqlMod.default || mssqlMod;

    try {
      if (CONFIG.MSSQL.autoCreateDb) {
        const masterPool = await new sql.ConnectionPool(buildMssqlConfig('master')).connect();
        try {
          const safeDbName = CONFIG.MSSQL.database.replace(/[\]']/g, '');
          await masterPool.request().query(
            `IF DB_ID(N'${safeDbName}') IS NULL CREATE DATABASE [${safeDbName}];`
          );
        } finally {
          await masterPool.close();
        }
      }

      mssqlPool = await new sql.ConnectionPool(buildMssqlConfig(CONFIG.MSSQL.database)).connect();
      await ensureSqlServerSchema(mssqlPool);
      activeClient = 'mssql';
      const target = CONFIG.MSSQL.instanceName
        ? `${CONFIG.MSSQL.server}\\${CONFIG.MSSQL.instanceName}`
        : `${CONFIG.MSSQL.server}:${CONFIG.MSSQL.port}`;
      console.log(`[DB] Connected to Microsoft SQL Server (${target} / ${CONFIG.MSSQL.database})`);
      return activeClient;
    } catch (err) {
      if (process.env.MSSQL_ALLOW_SQLITE_FALLBACK === '1') {
        console.warn(`[DB] SQL Server unavailable (${err.message}). Falling back to SQLite (${CONFIG.SQLITE_PATH}).`);
      } else {
        throw new Error(`[DB] Cannot connect to Microsoft SQL Server (${err.message}). Check SQL Server service and .env settings.`);
      }
    }
  }

  sqliteDb = new DatabaseSync(CONFIG.SQLITE_PATH);
  sqliteDb.exec('PRAGMA foreign_keys = ON;');
  sqliteDb.exec('PRAGMA journal_mode = WAL;');
  sqliteDb.exec('PRAGMA busy_timeout = 5000;');
  const ptCols = sqliteDb.prepare(`PRAGMA table_info(payment_transactions)`).all().map((c) => c.name);
  if (ptCols.length) {
    if (!ptCols.includes('category')) sqliteDb.exec(`ALTER TABLE payment_transactions ADD COLUMN category TEXT NOT NULL DEFAULT ''`);
    if (!ptCols.includes('counterparty_name')) sqliteDb.exec(`ALTER TABLE payment_transactions ADD COLUMN counterparty_name TEXT NOT NULL DEFAULT ''`);
  }
  activeClient = 'sqlite';
  console.log(`[DB] Connected to SQLite ERP database (${CONFIG.SQLITE_PATH})`);
  return activeClient;
}

export function getActiveDbClient() {
  return activeClient;
}

export function getMssqlPool() {
  return mssqlPool;
}

export async function closeDatabase() {
  if (mssqlPool) {
    try { await mssqlPool.close(); } catch {}
    mssqlPool = null;
  }
  if (sqliteDb) {
    try { sqliteDb.close(); } catch {}
    sqliteDb = null;
  }
}

export async function dbAll(sql, params = []) {
  if (activeClient === 'mssql' && mssqlPool) {
    return createMssqlTxHandle(() => mssqlPool.request()).all(sql, params);
  }
  return createSqliteTxHandle(sqliteDb).all(sql, params);
}

export async function dbGet(sql, params = []) {
  if (activeClient === 'mssql' && mssqlPool) {
    return createMssqlTxHandle(() => mssqlPool.request()).get(sql, params);
  }
  return createSqliteTxHandle(sqliteDb).get(sql, params);
}

export async function dbRun(sql, params = []) {
  if (activeClient === 'mssql' && mssqlPool) {
    return createMssqlTxHandle(() => mssqlPool.request()).run(sql, params);
  }
  return createSqliteTxHandle(sqliteDb).run(sql, params);
}

export async function dbTransaction(fn) {
  if (activeClient === 'mssql' && mssqlPool) {
    const mssqlMod = await import('mssql');
    const sql = mssqlMod.default || mssqlMod;
    const tx = new sql.Transaction(mssqlPool);
    await tx.begin();
    try {
      const handle = createMssqlTxHandle(() => new sql.Request(tx));
      const result = await fn(handle);
      await tx.commit();
      return result;
    } catch (err) {
      try { await tx.rollback(); } catch {}
      throw normalizeMssqlError(err);
    }
  }

  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const handle = createSqliteTxHandle(sqliteDb);
    const result = await fn(handle);
    sqliteDb.exec('COMMIT');
    return result;
  } catch (err) {
    try { sqliteDb.exec('ROLLBACK'); } catch {}
    throw normalizeSqliteError(err);
  }
}

/* ===== PASSWORD HASHING & STATELESS HMAC AUTH TOKENS ===== */
export function hashPassword(plain) {
  const salt = crypto.randomBytes(12).toString('hex');
  const hash = crypto.scryptSync(String(plain), salt, 32).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(plain, stored) {
  const raw = String(stored || '');
  if (raw.startsWith('scrypt:')) {
    const parts = raw.split(':');
    if (parts.length !== 3) return false;
    const derived = crypto.scryptSync(String(plain), parts[1], 32).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(parts[2], 'hex'));
  }
  return String(plain) === raw;
}

export function signSessionToken(payload) {
  const data = { ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(data)).toString('base64url');
  const sig = crypto.createHmac('sha256', CONFIG.AUTH_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', CONFIG.AUTH_SECRET).update(body).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}
