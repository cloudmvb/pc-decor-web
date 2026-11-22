import { DatabaseSync } from 'node:sqlite';
import mssql from 'mssql';
import { CONFIG } from './env.mjs';
import { buildMssqlConfig, ensureSqlServerSchema } from './db.mjs';

const TABLES_IN_ORDER = [
  { name: 'roles', identity: true, cols: ['id', 'code', 'name', 'description', 'permissions_json'] },
  { name: 'warehouses', identity: true, cols: ['id', 'code', 'name', 'region', 'warehouse_type', 'address', 'manager_name', 'phone', 'capacity_units', 'is_active'] },
  { name: 'users', identity: true, cols: ['id', 'username', 'password_hash', 'full_name', 'email', 'phone', 'role_id', 'warehouse_id', 'is_active', 'last_login_at', 'created_at'], dateCols: ['last_login_at', 'created_at'] },
  { name: 'categories', identity: true, cols: ['id', 'code', 'name', 'parent_group', 'default_warranty_months', 'min_stock_default', 'description', 'is_active'] },
  { name: 'suppliers', identity: true, cols: ['id', 'code', 'name', 'tax_code', 'contact_person', 'phone', 'email', 'address', 'payment_terms_days', 'lead_time_days', 'rating', 'payable_debt', 'is_active', 'created_at'], dateCols: ['created_at'] },
  { name: 'customers', identity: true, cols: ['id', 'code', 'name', 'customer_type', 'tax_code', 'phone', 'email', 'address', 'region', 'credit_limit', 'receivable_debt', 'total_spent', 'is_active', 'created_at'], dateCols: ['created_at'] },
  { name: 'products', identity: true, cols: ['id', 'sku', 'name', 'category_id', 'sub_category', 'supplier_id', 'unit', 'cost_price', 'retail_price', 'wholesale_price', 'warranty_months', 'min_reorder_level', 'track_serial', 'specs_summary', 'image_url', 'is_active', 'created_at'], dateCols: ['created_at'] },
  { name: 'warehouse_stocks', identity: false, cols: ['warehouse_id', 'product_id', 'bin_location', 'qty_on_hand', 'qty_reserved', 'updated_at'], dateCols: ['updated_at'] },
  { name: 'purchase_receipts', identity: true, cols: ['id', 'receipt_code', 'supplier_id', 'warehouse_id', 'created_by', 'supplier_invoice_no', 'note', 'subtotal', 'discount_amount', 'vat_amount', 'total_amount', 'paid_amount', 'debt_amount', 'payment_status', 'created_at'], dateCols: ['created_at'] },
  { name: 'purchase_receipt_items', identity: true, cols: ['id', 'receipt_id', 'product_id', 'qty', 'unit_cost', 'discount_pct', 'line_total', 'bin_location'] },
  { name: 'sales_invoices', identity: true, cols: ['id', 'invoice_code', 'customer_id', 'warehouse_id', 'created_by', 'sales_channel', 'payment_method', 'promo_code', 'note', 'subtotal', 'discount_amount', 'shipping_fee', 'vat_amount', 'total_amount', 'paid_amount', 'debt_amount', 'payment_status', 'fulfillment_status', 'created_at'], dateCols: ['created_at'] },
  { name: 'sales_invoice_items', identity: true, cols: ['id', 'invoice_id', 'product_id', 'qty', 'unit_price', 'unit_cost_snapshot', 'discount_pct', 'serial_numbers', 'line_total'] },
  { name: 'stock_transfers', identity: true, cols: ['id', 'transfer_code', 'from_warehouse_id', 'to_warehouse_id', 'created_by', 'reason', 'status', 'created_at'], dateCols: ['created_at'] },
  { name: 'stock_transfer_items', identity: true, cols: ['id', 'transfer_id', 'product_id', 'qty'] },
  { name: 'inventory_ledger', identity: true, cols: ['id', 'warehouse_id', 'product_id', 'tx_type', 'ref_code', 'qty_change', 'balance_after', 'unit_price', 'note', 'created_by', 'created_at'], dateCols: ['created_at'] },
  { name: 'payment_transactions', identity: true, cols: ['id', 'payment_code', 'tx_direction', 'customer_id', 'supplier_id', 'invoice_id', 'receipt_id', 'amount', 'payment_method', 'note', 'created_by', 'created_at'], dateCols: ['created_at'] }
];

function normalizeValue(val, isDateCol) {
  if (val === undefined || val === null) return null;
  if (isDateCol && typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    return trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
  }
  return val;
}

const resetFlag = process.argv.includes('--reset');
const sqlite = new DatabaseSync(CONFIG.SQLITE_PATH);

console.log(`[MIGRATE] Connecting to SQL Server (${CONFIG.MSSQL.server}:${CONFIG.MSSQL.port} / ${CONFIG.MSSQL.database})...`);

if (CONFIG.MSSQL.autoCreateDb) {
  const masterPool = await new mssql.ConnectionPool(buildMssqlConfig('master')).connect();
  try {
    const safeDb = CONFIG.MSSQL.database.replace(/[\]']/g, '');
    await masterPool.request().query(`IF DB_ID(N'${safeDb}') IS NULL CREATE DATABASE [${safeDb}];`);
    console.log(`[MIGRATE] Database [${safeDb}] ready.`);
  } finally {
    await masterPool.close();
  }
}

const pool = await new mssql.ConnectionPool(buildMssqlConfig(CONFIG.MSSQL.database)).connect();
try {
  await ensureSqlServerSchema(pool);
  console.log('[MIGRATE] 16 tables + indexes verified via database/schema.sqlserver.sql.');

  if (resetFlag) {
    console.log('[MIGRATE] --reset flag active: clearing SQL Server tables in reverse FK order...');
    for (const t of [...TABLES_IN_ORDER].reverse()) {
      await pool.request().query(`DELETE FROM dbo.[${t.name}];`);
    }
  }

  const summary = [];
  for (const t of TABLES_IN_ORDER) {
    const srcRows = sqlite.prepare(`SELECT ${t.cols.join(', ')} FROM ${t.name}`).all();
    const existingRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.[${t.name}]`);
    const existingCnt = Number(existingRes.recordset?.[0]?.cnt || 0);

    if (existingCnt > 0 && !resetFlag) {
      summary.push({ table: t.name, sqlite: srcRows.length, mssql: existingCnt, action: 'SKIPPED (already populated)' });
      continue;
    }

    const tx = new mssql.Transaction(pool);
    await tx.begin();
    try {
      const colList = t.cols.map((c) => `[${c}]`).join(', ');
      const placeholders = t.cols.map((_, i) => `@p${i}`).join(', ');
      const insertSql = t.identity
        ? `SET IDENTITY_INSERT dbo.[${t.name}] ON; INSERT INTO dbo.[${t.name}] (${colList}) VALUES (${placeholders}); SET IDENTITY_INSERT dbo.[${t.name}] OFF;`
        : `INSERT INTO dbo.[${t.name}] (${colList}) VALUES (${placeholders});`;
      const dateSet = new Set(t.dateCols || []);

      for (const row of srcRows) {
        const req = new mssql.Request(tx);
        t.cols.forEach((col, i) => {
          req.input(`p${i}`, normalizeValue(row[col], dateSet.has(col)));
        });
        await req.query(insertSql);
      }

      if (t.identity && srcRows.length > 0) {
        const maxId = srcRows.reduce((m, r) => Math.max(m, Number(r.id || 0)), 0);
        await new mssql.Request(tx).query(`DBCC CHECKIDENT ('dbo.${t.name}', RESEED, ${maxId});`);
      }

      await tx.commit();
    } catch (err) {
      try { await tx.rollback(); } catch {}
      throw new Error(`Migration failed on table dbo.${t.name}: ${err.message}`);
    }

    const verifyRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM dbo.[${t.name}]`);
    const mssqlCnt = Number(verifyRes.recordset?.[0]?.cnt || 0);
    summary.push({ table: t.name, sqlite: srcRows.length, mssql: mssqlCnt, action: 'MIGRATED' });
  }

  console.table(summary);
  const mismatch = summary.filter((s) => s.sqlite !== s.mssql);
  if (mismatch.length) {
    console.error('[MIGRATE] Row count mismatch:', mismatch);
    process.exit(1);
  }
  console.log('[MIGRATE] ALL 16 TABLES MIGRATED & VERIFIED 100% ON MICROSOFT SQL SERVER!');
} finally {
  await pool.close();
  sqlite.close();
}
