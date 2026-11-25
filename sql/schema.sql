-- 电商经营分析数据仓库（星型模型）
-- 事实表: fact_sales  维度表: dim_customer / dim_product / dim_date
--
-- 说明：建库、切库由 etl/build_dw.py 负责（库名取自 .env 的 DATABASE_URL），
-- 本文件只保留纯 DDL —— 避免库名在 .env / .py / .sql 三处各硬编码一份。

-- ---------- 维度：日期 ----------
CREATE TABLE IF NOT EXISTS dim_date (
    date_key   INT PRIMARY KEY,          -- YYYYMMDD
    full_date  DATE NOT NULL,
    year       SMALLINT NOT NULL,
    quarter    TINYINT NOT NULL,
    month      TINYINT NOT NULL,
    month_name VARCHAR(10),
    day_of_month TINYINT,
    weekday    TINYINT,                  -- 1=周一 … 7=周日
    is_weekend TINYINT(1)
) ENGINE=InnoDB;

-- ---------- 维度：客户 ----------
CREATE TABLE IF NOT EXISTS dim_customer (
    customer_id   BIGINT PRIMARY KEY,
    country       VARCHAR(64),
    first_order_date DATE,
    last_order_date  DATE,
    total_orders  INT DEFAULT 0,          -- 去重订单数（只算正向销售，口径同 RFM 的 F）
    total_amount  DECIMAL(14,2) DEFAULT 0 -- 正向销售金额（只算 is_return=0，口径同 RFM 的 M）
) ENGINE=InnoDB;

-- ---------- 维度：商品 ----------
CREATE TABLE IF NOT EXISTS dim_product (
    stock_code  VARCHAR(32) PRIMARY KEY,
    description VARCHAR(255),
    avg_price   DECIMAL(10,2)
) ENGINE=InnoDB;

-- ---------- 事实：销售明细 ----------
CREATE TABLE IF NOT EXISTS fact_sales (
    sales_id    BIGINT AUTO_INCREMENT PRIMARY KEY,
    invoice_no  VARCHAR(20) NOT NULL,
    line_no     SMALLINT,
    stock_code  VARCHAR(32),
    customer_id BIGINT,
    date_key    INT NOT NULL,
    quantity    INT NOT NULL,
    price       DECIMAL(10,2) NOT NULL,
    amount      DECIMAL(14,2) NOT NULL,   -- quantity * price
    is_return   TINYINT(1) DEFAULT 0,     -- 退货/取消单标记
    is_product  TINYINT(1) DEFAULT 1,     -- 0=非商品项（邮费/手工调整/礼品券等）
    is_guest    TINYINT(1) DEFAULT 0,     -- 1=无客户 ID 的游客订单
    country     VARCHAR(64),
    source_sheet VARCHAR(64),             -- 数据血缘：来自 Excel 哪一个 sheet
    source_row  INT,                      -- 数据血缘：在源 sheet 中的行号（表头占第 1 行）
    KEY idx_fact_date (date_key),
    KEY idx_fact_customer (customer_id),
    KEY idx_fact_stock (stock_code),
    KEY idx_fact_invoice (invoice_no),
    -- 组合索引：几乎所有分析查询都同时带 is_return=0（+ is_product=1），再按日期过滤。
    -- 单列索引在这种场景下只能用到一半，组合索引可以把两个过滤条件一起走完。
    KEY idx_fact_scope (is_return, is_product, date_key)
) ENGINE=InnoDB;

-- ---------- 视图：统一的"有效销售"口径 ----------

CREATE OR REPLACE VIEW v_sales AS
    SELECT * FROM fact_sales WHERE is_return = 0;

CREATE OR REPLACE VIEW v_product_sales AS
    SELECT * FROM fact_sales WHERE is_return = 0 AND is_product = 1;
