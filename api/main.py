"""电商经营分析 API —— FastAPI + MySQL 数据仓库。

启动:
    uvicorn api.main:app --reload --port 8000
文档:
    http://127.0.0.1:8000/docs
"""
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
engine = create_engine(os.getenv("DATABASE_URL"), pool_pre_ping=True)

app = FastAPI(title="电商经营分析平台", version="1.0")
app.mount("/static", StaticFiles(directory=ROOT / "web"), name="static")


def q(sql: str, **params) -> list[dict]:
    with engine.connect() as conn:
        df = pd.read_sql(text(sql), conn, params=params or None)
    return df.to_dict("records")


@app.get("/")
def index():
    return FileResponse(ROOT / "web" / "index.html")


@app.get("/api/kpi")
def kpi():
    """核心经营指标（GMV 排除退货单）"""
    sql = """
        SELECT
            ROUND(SUM(CASE WHEN is_return = 0 THEN amount END), 2)      AS gmv,
            COUNT(DISTINCT CASE WHEN is_return = 0 THEN invoice_no END) AS orders,
            COUNT(DISTINCT customer_id)                                AS customers,
            ROUND(SUM(CASE WHEN is_return = 0 THEN amount END)
                  / NULLIF(COUNT(DISTINCT CASE WHEN is_return = 0 THEN invoice_no END), 0), 2) AS aov,
            ROUND(-SUM(CASE WHEN is_return = 1 THEN amount END)
                  / NULLIF(SUM(CASE WHEN is_return = 0 THEN amount END), 0) * 100, 2) AS return_rate,
            COUNT(*) AS line_count
        FROM fact_sales
    """
    return q(sql)[0]


@app.get("/api/trend")
def trend():
    """月度 GMV / 订单数 / 客户数 趋势"""
    sql = """
        SELECT d.month_name AS month,
               ROUND(SUM(f.amount), 2)          AS gmv,
               COUNT(DISTINCT f.invoice_no)     AS orders,
               COUNT(DISTINCT f.customer_id)    AS customers
        FROM fact_sales f
        JOIN dim_date d ON d.date_key = f.date_key
        WHERE f.is_return = 0
        GROUP BY d.year, d.month, d.month_name
        ORDER BY MIN(d.date_key)
    """
    return q(sql)


@app.get("/api/top-products")
def top_products(limit: int = 10):
    """GMV 贡献 Top 商品"""
    sql = """
        SELECT f.stock_code,
               MAX(p.description)              AS description,
               ROUND(SUM(f.amount), 2)         AS gmv,
               SUM(f.quantity)                 AS qty,
               COUNT(DISTINCT f.invoice_no)    AS orders
        FROM fact_sales f
        LEFT JOIN dim_product p ON p.stock_code = f.stock_code
        WHERE f.is_return = 0 AND f.is_product = 1
        GROUP BY f.stock_code
        ORDER BY gmv DESC
        LIMIT :limit
    """
    return q(sql, limit=limit)


@app.get("/api/country")
def country(limit: int = 10):
    """国家/地区 GMV 分布"""
    sql = """
        SELECT country,
               ROUND(SUM(amount), 2) AS gmv,
               COUNT(DISTINCT customer_id) AS customers
        FROM fact_sales
        WHERE is_return = 0
        GROUP BY country
        ORDER BY gmv DESC
        LIMIT :limit
    """
    return q(sql, limit=limit)


@app.get("/api/weekday")
def weekday():
    """一周内各天销售分布（运营排期用）"""
    sql = """
        SELECT d.weekday,
               ROUND(SUM(f.amount) / COUNT(DISTINCT d.full_date), 2) AS avg_gmv
        FROM fact_sales f
        JOIN dim_date d ON d.date_key = f.date_key
        WHERE f.is_return = 0
        GROUP BY d.weekday
        ORDER BY d.weekday
    """
    names = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}
    rows = q(sql)
    for r in rows:
        r["weekday"] = names.get(r["weekday"], str(r["weekday"]))
    return rows


@app.get("/api/rfm")
def rfm():
    """RFM 客户分层：最近购买 R、购买频次 F、消费金额 M，各按五分位打分"""
    sql = """
        WITH base AS (
            SELECT f.customer_id,
                   DATEDIFF((SELECT MAX(full_date) FROM dim_date), MAX(d.full_date)) AS recency,
                   COUNT(DISTINCT f.invoice_no) AS frequency,
                   SUM(f.amount)                AS monetary
            FROM fact_sales f
            JOIN dim_date d ON d.date_key = f.date_key
            WHERE f.is_return = 0 AND f.customer_id IS NOT NULL
            GROUP BY f.customer_id
        ), scored AS (
            SELECT *,
                   NTILE(5) OVER (ORDER BY recency DESC)  AS r_score,  -- 越近分越高
                   NTILE(5) OVER (ORDER BY frequency)     AS f_score,
                   NTILE(5) OVER (ORDER BY monetary)      AS m_score
            FROM base
        )
        SELECT CASE
                 WHEN r_score >= 4 AND f_score >= 4 AND m_score >= 4 THEN '重要价值客户'
                 WHEN r_score >= 4 AND f_score <= 2                 THEN '新客户'
                 WHEN r_score <= 2 AND f_score >= 4 AND m_score >= 4 THEN '重要挽留客户'
                 WHEN r_score <= 2 AND f_score <= 2                 THEN '流失客户'
                 WHEN f_score >= 4 AND m_score >= 4                 THEN '重要保持客户'
                 ELSE '一般客户'
               END AS segment,
               COUNT(*)                          AS customers,
               ROUND(AVG(recency), 0)            AS avg_recency_days,
               ROUND(AVG(frequency), 1)          AS avg_frequency,
               ROUND(AVG(monetary), 2)           AS avg_monetary,
               ROUND(SUM(monetary), 2)           AS total_gmv
        FROM scored
        GROUP BY segment
        ORDER BY total_gmv DESC
    """
    return q(sql)


@app.get("/api/abc")
def abc():
    """ABC 商品分析 + 帕累托：按累计 GMV 贡献把商品分为 A(80%)/B(95%)/C"""
    sql = """
        WITH prod AS (
            SELECT stock_code, SUM(amount) AS gmv
            FROM fact_sales
            WHERE is_return = 0 AND is_product = 1
            GROUP BY stock_code
        ), ranked AS (
            SELECT stock_code, gmv,
                   SUM(gmv) OVER (ORDER BY gmv DESC) AS cum_gmv,
                   SUM(gmv) OVER ()                  AS total_gmv,
                   ROW_NUMBER() OVER (ORDER BY gmv DESC) AS rn
            FROM prod
        )
        SELECT CASE
                 WHEN cum_gmv / total_gmv <= 0.80 THEN 'A 类(贡献80%GMV)'
                 WHEN cum_gmv / total_gmv <= 0.95 THEN 'B 类(80-95%)'
                 ELSE 'C 类(尾部)'
               END AS abc_class,
               COUNT(*)                          AS sku_count,
               ROUND(SUM(gmv), 2)                AS gmv,
               ROUND(SUM(gmv) / MAX(total_gmv) * 100, 2) AS gmv_share_pct
        FROM ranked
        GROUP BY abc_class
        ORDER BY gmv DESC
    """
    return q(sql)


@app.get("/api/pareto")
def pareto(top: int = 30):
    """头部商品累计贡献曲线（帕累托图数据）"""
    sql = """
        WITH prod AS (
            SELECT stock_code, SUM(amount) AS gmv
            FROM fact_sales WHERE is_return = 0 AND is_product = 1
            GROUP BY stock_code
        ), ranked AS (
            SELECT stock_code, gmv,
                   ROW_NUMBER() OVER (ORDER BY gmv DESC) AS rn,
                   SUM(gmv) OVER (ORDER BY gmv DESC) AS cum_gmv,
                   SUM(gmv) OVER () AS total_gmv
            FROM prod
        )
        SELECT rn, stock_code,
               ROUND(gmv, 2) AS gmv,
               ROUND(cum_gmv / total_gmv * 100, 2) AS cum_pct
        FROM ranked
        WHERE rn <= :top
        ORDER BY rn
    """
    return q(sql, top=top)


@app.get("/api/health")
def health():
    try:
        with engine.connect() as conn:
            n = conn.execute(text("SELECT COUNT(*) FROM fact_sales")).scalar()
        return {"status": "ok", "fact_rows": n}
    except Exception as e:  # noqa: BLE001
        return {"status": "error", "detail": str(e)}



