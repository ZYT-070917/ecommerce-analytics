"""ETL：UCI Online Retail II -> MySQL 星型模型数据仓库。

步骤：读取 Excel 两个 sheet -> 清洗 -> 构建 4 张表（dim_date/dim_customer/dim_product/fact_sales）

用法：
    python etl/build_dw.py
"""
import os
import time
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------- 路径配置 ----------
ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
DB_URL = os.getenv("DATABASE_URL")
SERVER_URL = DB_URL.rsplit("/", 1)[0] + "/"   # 不指定库名，用于首次建库
RAW = ROOT / "raw" / "online_retail_II.xlsx"

# 非商品项编码：邮费、手工调整、手续费、礼品券等
# 计入营收（GMV），但必须排除在商品维度分析之外，否则污染 ABC / 帕累托
NON_PRODUCT = {"M", "DOT", "POST", "BANK CHARGES", "AMAZONFEE",
               "CRUK", "PADS", "B", "C2", "D", "S", "SP1002"}


def log(msg: str) -> None:
    print(f"[{time.strftime('%H:%M:%S')}] {msg}", flush=True)


def to_nullable_int(series: pd.Series) -> pd.Series:
    """数值列 -> 可存 None 的 object 列。

    背景：pandas 用 NaN 表示缺失，MySQL 只认 NULL。
    数值类型的列不允许存 None（会被强制转回 NaN），必须先用 object 承接。
    """
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.astype(object).where(numeric.notna(), None)


def split_sql(ddl: str) -> list[str]:
    """把 .sql 文件切成单条语句（去掉注释行，按分号切）。"""
    lines = [l for l in ddl.splitlines() if not l.strip().startswith("--")]
    return [s.strip() for s in "\n".join(lines).split(";") if s.strip()]


# ---------- 1. 抽取 ----------
def extract() -> pd.DataFrame:
    log("读取 Excel...")
    # sheet_name=None 一次读完全部 sheet，返回 {sheet名: DataFrame}
    sheets = pd.read_excel(RAW, sheet_name=None, engine="openpyxl",
                           dtype={"Invoice": str, "StockCode": str})
    df = pd.concat(sheets.values(), ignore_index=True)  # ignore_index 重新编号
    log(f"原始行数: {len(df):,}")
    return df


# ---------- 2. 清洗 ----------
def clean(df: pd.DataFrame) -> pd.DataFrame:
    before = len(df)
    df = df.rename(columns={
        "Invoice": "invoice_no", "StockCode": "stock_code", "Description": "description",
        "Quantity": "quantity", "InvoiceDate": "invoice_date", "Price": "price",
        "Customer ID": "customer_id", "Country": "country",
    })  # 统一成数据库习惯的 snake_case

    # 退货 / 取消单：订单号以 C 开头，标记而非删除（保留退款分析能力）
    df["is_return"] = df["invoice_no"].astype(str).str.startswith("C").astype("int8")

    # 价格 <= 0 视为脏数据（赠品 / 手工调整），剔除
    df = df[df["price"] > 0]
    # 数量为 0 无业务意义，剔除；负数量属于退货，保留
    df = df[df["quantity"] != 0]
    # 无商品编码的记录无法做商品分析，剔除
    df = df[df["stock_code"].notna()]

    # 商品描述缺失用占位符；去前后空格
    df["description"] = df["description"].fillna("(无描述)").astype(str).str.strip()

    # 商品编码统一大写 + 去空格：原始数据有 15056BL / 15056bl 混用，
    # MySQL 默认排序规则不区分大小写，不统一会撞主键
    df["stock_code"] = df["stock_code"].astype(str).str.strip().str.upper()

    # 没有客户 ID 的订单 = 游客：保留事实行（要算进 GMV），但不参与 RFM
    df["is_guest"] = df["customer_id"].isna().astype("int8")

    # 非商品项识别（邮费 / 手工调整 / 礼品券等虚拟编码）
    is_voucher = df["stock_code"].str.startswith("GIFT_0001")
    df["is_product"] = (~df["stock_code"].isin(NON_PRODUCT) & ~is_voucher).astype("int8")
    log(f"非商品项记录: {(df['is_product'] == 0).sum():,} 行（邮费/调整/礼品券等）")

    # ---------- 派生字段 ----------
    df["invoice_date"] = pd.to_datetime(df["invoice_date"])
    # 原始数据没有金额列，数量 × 单价自己算，保留两位小数
    df["amount"] = (df["quantity"] * df["price"]).round(2)
    # 日期变整数 YYYYMMDD，作为日期维度主键（比 DATETIME 快、无时分秒干扰）
    df["date_key"] = df["invoice_date"].dt.strftime("%Y%m%d").astype(int)
    # 同一订单内的明细行号
    df["line_no"] = df.groupby("invoice_no").cumcount() + 1

    log(f"清洗后行数: {len(df):,}（剔除 {before - len(df):,} 行脏数据）")
    return df


# ---------- 3. 构建维度 ----------
def build_dims(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    # 日期维度：覆盖数据首日到末日，保证趋势图时间轴连续
    dates = pd.date_range(df["invoice_date"].min().normalize(),
                          df["invoice_date"].max().normalize(), freq="D")
    dim_date = pd.DataFrame({
        "date_key": dates.strftime("%Y%m%d").astype(int),
        "full_date": dates.date,
        "year": dates.year,
        "quarter": dates.quarter,
        "month": dates.month,
        "month_name": dates.strftime("%Y-%m"),
        "day_of_month": dates.day,
        "weekday": dates.day_of_week + 1,          # 1=周一 … 7=周日
        "is_weekend": (dates.day_of_week >= 5).astype("int8"),
    })

    # 商品维度：只收真实商品
    products = df[df["is_product"] == 1]
    dim_product = (products.groupby("stock_code")
                   .agg(description=("description", "last"),
                        avg_price=("price", "mean"))
                   .reset_index())
    dim_product["avg_price"] = dim_product["avg_price"].round(2)
    dim_product["description"] = dim_product["description"].str.slice(0, 255)  # 对应 VARCHAR(255)

    # 客户维度（游客不计入）
    valid = df[df["is_guest"] == 0]
    dim_customer = (valid.groupby("customer_id")
                    .agg(country=("country", "last"),
                         first_order_date=("invoice_date", lambda s: s.min().date()),
                         last_order_date=("invoice_date", lambda s: s.max().date()),
                         total_orders=("invoice_no", "nunique"),   # 去重订单数，不是行数
                         total_amount=("amount", "sum"))
                    .reset_index())
    dim_customer["total_amount"] = dim_customer["total_amount"].round(2)
    dim_customer["is_guest"] = 0

    log(f"维度构建完成: 日期 {len(dim_date)} / 商品 {len(dim_product):,} / 客户 {len(dim_customer):,}")
    return dim_date, dim_product, dim_customer


# ---------- 4. 装载 ----------
def load(dims, fact: pd.DataFrame) -> None:
    stmts = split_sql((ROOT / "sql" / "schema.sql").read_text(encoding="utf-8"))

    # 库可能还不存在（首次运行 / 手动删过库），先用不带库名的连接串建库
    server_engine = create_engine(SERVER_URL, pool_pre_ping=True)
    with server_engine.begin() as conn:
        conn.execute(text("CREATE DATABASE IF NOT EXISTS biz_analytics "
                          "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
    server_engine.dispose()

    engine = create_engine(DB_URL, pool_pre_ping=True)
    dim_date, dim_product, dim_customer = dims

    # 全量重建：先删表再按最新 DDL 建表，避免表结构演进后字段不匹配
    with engine.begin() as conn:
        conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for t in ("fact_sales", "dim_date", "dim_product", "dim_customer"):
            conn.execute(text(f"DROP TABLE IF EXISTS {t}"))
        conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
    with engine.begin() as conn:
        for s in stmts:
            conn.execute(text(s))
    log("表结构重建完成")

    for name, d in [("dim_date", dim_date), ("dim_product", dim_product),
                    ("dim_customer", dim_customer)]:
        d.to_sql(name, engine, if_exists="append", index=False, chunksize=5000)
        log(f"已装载 {name}: {len(d):,} 行")

    fact_cols = ["invoice_no", "line_no", "stock_code", "customer_id", "date_key",
                 "quantity", "price", "amount", "is_return", "is_product", "country"]
    fact = fact[fact_cols].copy()

    # 类型对齐数据库字段
    fact["customer_id"] = to_nullable_int(fact["customer_id"])   # 缺失 -> NULL
    fact["stock_code"] = fact["stock_code"].astype(str).str.slice(0, 32)
    fact["invoice_no"] = fact["invoice_no"].astype(str).str.slice(0, 20)

    fact["country"] = fact["country"].astype(object).where(fact["country"].notna(), None)
    fact["price"] = fact["price"].astype(float).round(2)
    fact["amount"] = fact["amount"].astype(float).round(2)

    log("装载事实表(约 100 万行，需数分钟)...")

    fact.to_sql("fact_sales", engine, if_exists="append", index=False,
                chunksize=10000, method="multi")
    log("装载完成")


def main() -> None:
    df = extract()          #读 Excel
    df = clean(df)          #清洗
    dims = build_dims(df)   #造三个维度表
    load(dims, df)          #写入 MySQL
    log("ETL 全部完成")


if __name__ == "__main__":
    main()
