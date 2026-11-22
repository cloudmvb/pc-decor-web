-- ============================================================================
-- SKYCRUMB STUDIO — ENTERPRISE MULTI-WAREHOUSE ERP & WMS DATABASE SCHEMA (T-SQL)
-- Microsoft SQL Server (Chuẩn hóa 3NF • PK, FK, UNIQUE, CHECK Constraints)
-- ============================================================================

-- 1. BẢNG VAI TRÒ & PHÂN QUYỀN (ROLES)
IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(code))) >= 2),
    name NVARCHAR(150) NOT NULL,
    description NVARCHAR(MAX) NOT NULL DEFAULT N'',
    permissions_json NVARCHAR(MAX) NOT NULL DEFAULT N'[]'
  );
END;

-- 2. BẢNG KHO BÃI ĐA ĐIỂM (WAREHOUSES)
IF OBJECT_ID(N'dbo.warehouses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.warehouses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(code))) >= 3),
    name NVARCHAR(200) NOT NULL,
    region NVARCHAR(50) NOT NULL CHECK (region IN (N'Miền Bắc', N'Miền Trung', N'Miền Nam', N'Toàn Quốc')),
    warehouse_type NVARCHAR(50) NOT NULL CHECK (warehouse_type IN ('MEGA_HUB', 'REGIONAL_HUB', 'LAB_ASSEMBLY', 'RMA_WARRANTY')),
    address NVARCHAR(300) NOT NULL,
    manager_name NVARCHAR(150) NOT NULL DEFAULT N'',
    phone NVARCHAR(30) NOT NULL DEFAULT N'',
    capacity_units INT NOT NULL DEFAULT 5000 CHECK (capacity_units > 0),
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
  );
END;

-- 3. BẢNG NGƯỜI DÙNG / NHÂN VIÊN (USERS)
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(100) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(username))) >= 3),
    password_hash NVARCHAR(255) NOT NULL CHECK (LEN(password_hash) >= 4),
    full_name NVARCHAR(150) NOT NULL CHECK (LEN(LTRIM(RTRIM(full_name))) >= 2),
    email NVARCHAR(150) NOT NULL UNIQUE CHECK (email LIKE '%_@_%._%'),
    phone NVARCHAR(30) NOT NULL CHECK (LEN(LTRIM(RTRIM(phone))) >= 9),
    role_id INT NOT NULL,
    warehouse_id INT NULL,
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    last_login_at DATETIME2 NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_users_role FOREIGN KEY (role_id) REFERENCES dbo.roles(id) ON DELETE NO ACTION,
    CONSTRAINT FK_users_warehouse FOREIGN KEY (warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE SET NULL
  );
END;

-- 4. BẢNG LOẠI HÀNG / DANH MỤC SẢN PHẨM (CATEGORIES)
IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.categories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(code))) >= 2),
    name NVARCHAR(150) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(name))) >= 2),
    parent_group NVARCHAR(150) NOT NULL DEFAULT N'Linh Kiện & Thiết Bị',
    default_warranty_months INT NOT NULL DEFAULT 36 CHECK (default_warranty_months >= 0),
    min_stock_default INT NOT NULL DEFAULT 5 CHECK (min_stock_default >= 0),
    description NVARCHAR(MAX) NOT NULL DEFAULT N'',
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
  );
END;

-- 5. BẢNG NHÀ CUNG CẤP (SUPPLIERS)
IF OBJECT_ID(N'dbo.suppliers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.suppliers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(code))) >= 3),
    name NVARCHAR(250) NOT NULL CHECK (LEN(LTRIM(RTRIM(name))) >= 2),
    tax_code NVARCHAR(50) NOT NULL DEFAULT N'',
    contact_person NVARCHAR(150) NOT NULL DEFAULT N'',
    phone NVARCHAR(30) NOT NULL CHECK (LEN(LTRIM(RTRIM(phone))) >= 9),
    email NVARCHAR(150) NOT NULL CHECK (email LIKE '%_@_%._%'),
    address NVARCHAR(300) NOT NULL DEFAULT N'',
    payment_terms_days INT NOT NULL DEFAULT 30 CHECK (payment_terms_days >= 0),
    lead_time_days INT NOT NULL DEFAULT 3 CHECK (lead_time_days >= 1),
    rating FLOAT NOT NULL DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 5.0),
    payable_debt DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (payable_debt >= 0),
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;

-- 6. BẢNG KHÁCH HÀNG (CUSTOMERS)
IF OBJECT_ID(N'dbo.customers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.customers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(code))) >= 3),
    name NVARCHAR(250) NOT NULL CHECK (LEN(LTRIM(RTRIM(name))) >= 2),
    customer_type NVARCHAR(20) NOT NULL DEFAULT N'RETAIL' CHECK (customer_type IN ('RETAIL', 'VIP', 'B2B')),
    tax_code NVARCHAR(50) NOT NULL DEFAULT N'',
    phone NVARCHAR(30) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(phone))) >= 9),
    email NVARCHAR(150) NOT NULL DEFAULT N'',
    address NVARCHAR(300) NOT NULL DEFAULT N'',
    region NVARCHAR(50) NOT NULL DEFAULT N'Miền Bắc',
    credit_limit DECIMAL(18,2) NOT NULL DEFAULT 20000000 CHECK (credit_limit >= 0),
    receivable_debt DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (receivable_debt >= 0),
    total_spent DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END;

-- 7. BẢNG SẢN PHẨM (PRODUCTS)
IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.products (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sku NVARCHAR(100) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(sku))) >= 2),
    name NVARCHAR(300) NOT NULL CHECK (LEN(LTRIM(RTRIM(name))) >= 2),
    category_id INT NOT NULL,
    sub_category NVARCHAR(150) NOT NULL DEFAULT N'',
    supplier_id INT NULL,
    unit NVARCHAR(50) NOT NULL DEFAULT N'Chiếc',
    cost_price DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
    retail_price DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (retail_price >= 0),
    wholesale_price DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (wholesale_price >= 0),
    warranty_months INT NOT NULL DEFAULT 36 CHECK (warranty_months >= 0),
    min_reorder_level INT NOT NULL DEFAULT 5 CHECK (min_reorder_level >= 0),
    track_serial TINYINT NOT NULL DEFAULT 0 CHECK (track_serial IN (0, 1)),
    specs_summary NVARCHAR(MAX) NOT NULL DEFAULT N'',
    image_url NVARCHAR(500) NOT NULL DEFAULT N'',
    is_active TINYINT NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories(id) ON DELETE NO ACTION,
    CONSTRAINT FK_products_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id) ON DELETE SET NULL
  );
END;

-- 8. BẢNG TỒN KHO CHI TIẾT THEO TỪNG KHO & VỊ TRÍ KỆ BIN (WAREHOUSE_STOCKS)
IF OBJECT_ID(N'dbo.warehouse_stocks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.warehouse_stocks (
    warehouse_id INT NOT NULL,
    product_id INT NOT NULL,
    bin_location NVARCHAR(50) NOT NULL DEFAULT N'A01-R01-B01',
    qty_on_hand INT NOT NULL DEFAULT 0 CHECK (qty_on_hand >= 0),
    qty_reserved INT NOT NULL DEFAULT 0 CHECK (qty_reserved >= 0),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT PK_warehouse_stocks PRIMARY KEY (warehouse_id, product_id),
    CONSTRAINT CHK_warehouse_stocks_avail CHECK (qty_on_hand >= qty_reserved),
    CONSTRAINT FK_stocks_warehouse FOREIGN KEY (warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE CASCADE,
    CONSTRAINT FK_stocks_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE CASCADE
  );
END;

-- 9. BẢNG PHIẾU NHẬP HÀNG — MODULE MUA HÀNG (PURCHASE_RECEIPTS)
IF OBJECT_ID(N'dbo.purchase_receipts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_receipts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    receipt_code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(receipt_code))) >= 4),
    supplier_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    created_by INT NOT NULL,
    supplier_invoice_no NVARCHAR(100) NOT NULL DEFAULT N'',
    note NVARCHAR(MAX) NOT NULL DEFAULT N'',
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    debt_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (debt_amount >= 0),
    payment_status NVARCHAR(20) NOT NULL DEFAULT N'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID')),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_pr_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pr_warehouse FOREIGN KEY (warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pr_user FOREIGN KEY (created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END;

-- 10. BẢNG CHI TIẾT PHIẾU NHẬP (PURCHASE_RECEIPT_ITEMS)
IF OBJECT_ID(N'dbo.purchase_receipt_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.purchase_receipt_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    receipt_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL CHECK (qty > 0),
    unit_cost DECIMAL(18,2) NOT NULL CHECK (unit_cost >= 0),
    discount_pct FLOAT NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    line_total DECIMAL(18,2) NOT NULL CHECK (line_total >= 0),
    bin_location NVARCHAR(50) NOT NULL DEFAULT N'A01-R01-B01',
    CONSTRAINT FK_pri_receipt FOREIGN KEY (receipt_id) REFERENCES dbo.purchase_receipts(id) ON DELETE CASCADE,
    CONSTRAINT FK_pri_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE NO ACTION
  );
END;

-- 11. BẢNG HÓA ĐƠN BÁN HÀNG — MODULE BÁN HÀNG (SALES_INVOICES)
IF OBJECT_ID(N'dbo.sales_invoices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sales_invoices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    invoice_code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(invoice_code))) >= 4),
    customer_id INT NOT NULL,
    warehouse_id INT NOT NULL,
    created_by INT NOT NULL,
    sales_channel NVARCHAR(20) NOT NULL DEFAULT N'POS' CHECK (sales_channel IN ('POS', 'B2B', 'WEB3D')),
    payment_method NVARCHAR(50) NOT NULL DEFAULT N'BANK_TRANSFER',
    promo_code NVARCHAR(50) NOT NULL DEFAULT N'',
    note NVARCHAR(MAX) NOT NULL DEFAULT N'',
    subtotal DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
    discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
    shipping_fee DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
    vat_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (vat_amount >= 0),
    total_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (paid_amount >= 0),
    debt_amount DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (debt_amount >= 0),
    payment_status NVARCHAR(20) NOT NULL DEFAULT N'PAID' CHECK (payment_status IN ('PAID', 'PARTIAL', 'UNPAID')),
    fulfillment_status NVARCHAR(20) NOT NULL DEFAULT N'COMPLETED' CHECK (fulfillment_status IN ('COMPLETED', 'PROCESSING', 'DELIVERED')),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_si_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id) ON DELETE NO ACTION,
    CONSTRAINT FK_si_warehouse FOREIGN KEY (warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE NO ACTION,
    CONSTRAINT FK_si_user FOREIGN KEY (created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END;

-- 12. BẢNG CHI TIẾT HÓA ĐƠN BÁN (SALES_INVOICE_ITEMS)
IF OBJECT_ID(N'dbo.sales_invoice_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sales_invoice_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    invoice_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL CHECK (qty > 0),
    unit_price DECIMAL(18,2) NOT NULL CHECK (unit_price >= 0),
    unit_cost_snapshot DECIMAL(18,2) NOT NULL DEFAULT 0 CHECK (unit_cost_snapshot >= 0),
    discount_pct FLOAT NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
    serial_numbers NVARCHAR(MAX) NOT NULL DEFAULT N'',
    line_total DECIMAL(18,2) NOT NULL CHECK (line_total >= 0),
    CONSTRAINT FK_sii_invoice FOREIGN KEY (invoice_id) REFERENCES dbo.sales_invoices(id) ON DELETE CASCADE,
    CONSTRAINT FK_sii_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE NO ACTION
  );
END;

-- 13. BẢNG PHIẾU ĐIỀU CHUYỂN LIÊN KHO (STOCK_TRANSFERS)
IF OBJECT_ID(N'dbo.stock_transfers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transfers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transfer_code NVARCHAR(50) NOT NULL UNIQUE CHECK (LEN(LTRIM(RTRIM(transfer_code))) >= 4),
    from_warehouse_id INT NOT NULL,
    to_warehouse_id INT NOT NULL,
    created_by INT NOT NULL,
    reason NVARCHAR(MAX) NOT NULL DEFAULT N'',
    status NVARCHAR(20) NOT NULL DEFAULT N'COMPLETED' CHECK (status IN ('COMPLETED', 'IN_TRANSIT')),
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CHK_st_diff_wh CHECK (from_warehouse_id <> to_warehouse_id),
    CONSTRAINT FK_st_from_wh FOREIGN KEY (from_warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE NO ACTION,
    CONSTRAINT FK_st_to_wh FOREIGN KEY (to_warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE NO ACTION,
    CONSTRAINT FK_st_user FOREIGN KEY (created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END;

-- 14. BẢNG CHI TIẾT ĐIỀU CHUYỂN LIÊN KHO (STOCK_TRANSFER_ITEMS)
IF OBJECT_ID(N'dbo.stock_transfer_items', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.stock_transfer_items (
    id INT IDENTITY(1,1) PRIMARY KEY,
    transfer_id INT NOT NULL,
    product_id INT NOT NULL,
    qty INT NOT NULL CHECK (qty > 0),
    CONSTRAINT FK_sti_transfer FOREIGN KEY (transfer_id) REFERENCES dbo.stock_transfers(id) ON DELETE CASCADE,
    CONSTRAINT FK_sti_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE NO ACTION
  );
END;

-- 15. BẢNG SỔ CÁI THẺ KHO (INVENTORY_LEDGER)
IF OBJECT_ID(N'dbo.inventory_ledger', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.inventory_ledger (
    id INT IDENTITY(1,1) PRIMARY KEY,
    warehouse_id INT NOT NULL,
    product_id INT NOT NULL,
    tx_type NVARCHAR(30) NOT NULL CHECK (tx_type IN ('PURCHASE_IN', 'SALE_OUT', 'TRANSFER_OUT', 'TRANSFER_IN', 'ADJUSTMENT')),
    ref_code NVARCHAR(50) NOT NULL,
    qty_change INT NOT NULL,
    balance_after INT NOT NULL CHECK (balance_after >= 0),
    unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
    note NVARCHAR(MAX) NOT NULL DEFAULT N'',
    created_by INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT FK_ledger_warehouse FOREIGN KEY (warehouse_id) REFERENCES dbo.warehouses(id) ON DELETE NO ACTION,
    CONSTRAINT FK_ledger_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE NO ACTION,
    CONSTRAINT FK_ledger_user FOREIGN KEY (created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END;

-- 16. BẢNG GIAO DỊCH THU CHI & CÔNG NỢ (PAYMENT_TRANSACTIONS)
IF OBJECT_ID(N'dbo.payment_transactions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.payment_transactions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    payment_code NVARCHAR(50) NOT NULL UNIQUE,
    tx_direction NVARCHAR(30) NOT NULL,
    category NVARCHAR(100) NOT NULL DEFAULT N'',
    counterparty_name NVARCHAR(250) NOT NULL DEFAULT N'',
    customer_id INT NULL,
    supplier_id INT NULL,
    invoice_id INT NULL,
    receipt_id INT NULL,
    amount DECIMAL(18,2) NOT NULL CHECK (amount > 0),
    payment_method NVARCHAR(50) NOT NULL DEFAULT N'BANK_TRANSFER',
    note NVARCHAR(MAX) NOT NULL DEFAULT N'',
    created_by INT NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT CK_pt_tx_direction CHECK (tx_direction IN ('RECEIPT_FROM_CUSTOMER', 'OTHER_RECEIPT', 'PAYMENT_TO_SUPPLIER', 'OPERATING_EXPENSE')),
    CONSTRAINT FK_pt_customer FOREIGN KEY (customer_id) REFERENCES dbo.customers(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pt_supplier FOREIGN KEY (supplier_id) REFERENCES dbo.suppliers(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pt_invoice FOREIGN KEY (invoice_id) REFERENCES dbo.sales_invoices(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pt_receipt FOREIGN KEY (receipt_id) REFERENCES dbo.purchase_receipts(id) ON DELETE NO ACTION,
    CONSTRAINT FK_pt_user FOREIGN KEY (created_by) REFERENCES dbo.users(id) ON DELETE NO ACTION
  );
END;

-- CHỈ MỤC TỐI ƯU TRUY VẤN
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_products_category' AND object_id = OBJECT_ID(N'dbo.products'))
  CREATE INDEX idx_products_category ON dbo.products(category_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_products_supplier' AND object_id = OBJECT_ID(N'dbo.products'))
  CREATE INDEX idx_products_supplier ON dbo.products(supplier_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_stocks_product' AND object_id = OBJECT_ID(N'dbo.warehouse_stocks'))
  CREATE INDEX idx_stocks_product ON dbo.warehouse_stocks(product_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_purchases_supplier' AND object_id = OBJECT_ID(N'dbo.purchase_receipts'))
  CREATE INDEX idx_purchases_supplier ON dbo.purchase_receipts(supplier_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_sales_customer' AND object_id = OBJECT_ID(N'dbo.sales_invoices'))
  CREATE INDEX idx_sales_customer ON dbo.sales_invoices(customer_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_ledger_wh_prod' AND object_id = OBJECT_ID(N'dbo.inventory_ledger'))
  CREATE INDEX idx_ledger_wh_prod ON dbo.inventory_ledger(warehouse_id, product_id);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'idx_payments_created_at' AND object_id = OBJECT_ID(N'dbo.payment_transactions'))
  CREATE INDEX idx_payments_created_at ON dbo.payment_transactions(created_at);

