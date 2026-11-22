import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export function loadEnvFile() {
  const envPath = path.join(PROJECT_ROOT, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFile();

export const CONFIG = {
  PORT: Number(process.env.PORT || 8080),
  DB_CLIENT: String(process.env.DB_CLIENT || 'mssql').trim().toLowerCase(),
  SQLITE_PATH: path.join(PROJECT_ROOT, 'database', 'skycrumb_erp.db'),
  SQLSERVER_SCHEMA_PATH: path.join(PROJECT_ROOT, 'database', 'schema.sqlserver.sql'),
  UPLOAD_DIR: path.join(PROJECT_ROOT, 'assets', 'images', 'uploads'),
  AUTH_SECRET: process.env.AUTH_SECRET || 'skycrumb-enterprise-erp-hmac-secret-2026',
  MSSQL: {
    server: process.env.MSSQL_SERVER || 'localhost',
    port: Number(process.env.MSSQL_PORT || 1433),
    instanceName: process.env.MSSQL_INSTANCE || '',
    database: process.env.MSSQL_DATABASE || 'SkyCrumbERP',
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASSWORD || '',
    encrypt: String(process.env.MSSQL_ENCRYPT || 'false') === 'true',
    trustServerCertificate: String(process.env.MSSQL_TRUST_SERVER_CERTIFICATE || 'true') === 'true',
    autoCreateDb: String(process.env.MSSQL_AUTO_CREATE_DB || '1') === '1'
  }
};
