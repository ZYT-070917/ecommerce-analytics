-- 电商经营分析数据仓库（星型模型）
-- 事实表: fact_sales  维度表: dim_customer / dim_product / dim_date

CREATE DATABASE IF NOT EXISTS biz_analytics
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE biz_analytics;

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
    total_orders  INT DEFAULT 0,          -- 去重订单数
    total_amount  DECIMAL(14,2) DEFAULT 0,
    is_guest      TINYINT(1) DEFAULT 0
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
    country     VARCHAR(64),
    KEY idx_fact_date (date_key),
    KEY idx_fact_customer (customer_id),
    KEY idx_fact_stock (stock_code),
    KEY idx_fact_invoice (invoice_no)
) ENGINE=InnoDB;
