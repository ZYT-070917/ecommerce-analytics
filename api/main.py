#电商经营分析 API —— FastAPI + MySQL 数据仓库。

#启动:uvicorn api.main:app --reload --port 8000
#文档:http://127.0.0.1:8000/docs

import logging
import os
import time
import traceback
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
engine = create_engine(os.getenv("DATABASE_URL"), pool_pre_ping=True)

app = FastAPI(title="电商经营分析平台", version="1.1.2")
app.mount("/static", StaticFiles(directory=ROOT / "web"), name="static")

# 前端如果从别的端口/域名访问（例如把 web/ 单独部署），没有 CORS 会被浏览器直接拦掉。
# 本地开发全放开；真要公网部署时应把 allow_origins 收紧成具体域名。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

logger = logging.getLogger("api")


@app.exception_handler(Exception)
async def unhandled_error(request: Request, exc: Exception):
    """兜底：数据库连不上时，别让前端只看到一坨 500 堆栈。"""
    logger.error("请求失败 %s: %s\n%s", request.url.path, exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"status": "error", "path": request.url.path, "detail": str(exc)},
    )


# ---------- 结果缓存 ----------
# 看板一次加载会并发打 8 个接口，每个接口都要扫上百万行聚合。
# 同样的 SQL 在 TTL 内直接复用上次结果，第二次刷新从「秒级」降到「毫秒级」。
# ETL 是手动触发的全量重建，所以 5 分钟的陈旧窗口可以接受；
# 改数据后想立刻看到，重启服务或等 5 分钟即可。
CACHE_TTL = 300
_cache: dict[str, tuple[float, list[dict]]] = {}


def q(sql: str, **params) -> list[dict]:
    key = sql + repr(sorted(params.items()))
    hit = _cache.get(key)
    if hit is not None and time.time() - hit[0] < CACHE_TTL:
        return [dict(r) for r in hit[1]]   # 返回副本，防止调用方原地改到缓存
    with engine.connect() as conn:
        df = pd.read_sql(text(sql), conn, params=params or None)
    rows = df.to_dict("records")
    _cache[key] = (time.time(), rows)
    return [dict(r) for r in rows]


@app.get("/")
def index():
    return FileResponse(ROOT / "web" / "index.html")


@app.get("/api/kpi")
def kpi():
    """核心经营指标（GMV 不含退货；退货率单独从退货行统计）"""
    sql = """
        SELECT
            ROUND(SUM(f.amount), 2)                              AS gmv,
            COUNT(DISTINCT f.invoice_no)                         AS orders,
            -- 客户数仍按全表算（含 61 个"只有退货单"的客户），保持与原口径一致；
            -- 若改成从 v_sales 取会变成 5,878，那属于指标口径变更，不在重构范围内。
            (SELECT COUNT(DISTINCT customer_id) FROM fact_sales) AS customers,
            ROUND(SUM(f.amount)
                  / NULLIF(COUNT(DISTINCT f.invoice_no), 0), 2)  AS aov,
            -- 退货金额取绝对值：不假设退货行的 quantity 一定是负数，
            -- 否则数据里一旦出现正数量的退货单，退货率会算成负数。
            ROUND((SELECT ABS(SUM(amount)) FROM fact_sales WHERE is_return = 1)
                  / NULLIF(SUM(f.amount), 0) * 100, 2)           AS return_rate,
            (SELECT COUNT(*) FROM fact_sales)                    AS line_count,
            -- 数据周期交给后端算，前端不再写死
            (SELECT MIN(full_date) FROM dim_date)                AS date_from,
            (SELECT MAX(full_date) FROM dim_date)                AS date_to
        FROM v_sales f
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
        FROM v_sales f
        JOIN dim_date d ON d.date_key = f.date_key
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
        FROM v_product_sales f
        LEFT JOIN dim_product p ON p.stock_code = f.stock_code
        GROUP BY f.stock_code
        ORDER BY gmv DESC
        LIMIT :limit
    """
    return q(sql, limit=limit)


@app.get("/api/country")
def country(limit: int = 10):
    """国家/地区 GMV 分布"""
    sql = """
        SELECT f.country,
               ROUND(SUM(f.amount), 2) AS gmv,
               COUNT(DISTINCT f.customer_id) AS customers
        FROM v_sales f
        GROUP BY f.country
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
        FROM v_sales f
        JOIN dim_date d ON d.date_key = f.date_key
        GROUP BY d.weekday
        ORDER BY d.weekday
    """
    names = {1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日"}
    # 返回新对象而不是原地改：q() 的结果可能来自缓存，原地改会把缓存污染掉
    return [{**r, "weekday": names.get(r["weekday"], str(r["weekday"]))} for r in q(sql)]


@app.get("/api/rfm")
def rfm():
    """RFM 客户分层：最近购买 R、购买频次 F、消费金额 M，各按五分位打分"""
    sql = """
        WITH base AS (
            SELECT f.customer_id,
                   DATEDIFF((SELECT MAX(full_date) FROM dim_date), MAX(d.full_date)) AS recency,
                   COUNT(DISTINCT f.invoice_no) AS frequency,
                   SUM(f.amount)                AS monetary
            FROM v_sales f
            JOIN dim_date d ON d.date_key = f.date_key
            WHERE f.customer_id IS NOT NULL
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


# ABC 与 Pareto 用的是同一份中间结果：「按 SKU 汇总 GMV，再按金额降序累计」。
# 之前两个接口各写了一遍（连 CTE 名字都一样），口径改动要改两处 —— 抽成常量共用。
STOCK_GMV_CTE = """
        WITH ranked AS (
            SELECT stock_code,
                   SUM(amount)                                       AS gmv,
                   SUM(SUM(amount)) OVER (ORDER BY SUM(amount) DESC)  AS cum_gmv,
                   SUM(SUM(amount)) OVER ()                           AS total_gmv,
                   ROW_NUMBER() OVER (ORDER BY SUM(amount) DESC)      AS rn
            FROM v_product_sales
            GROUP BY stock_code
        )
"""


@app.get("/api/abc")
def abc():
    """ABC 商品分析 + 帕累托：按累计 GMV 贡献把商品分为 A(80%)/B(95%)/C"""
    sql = STOCK_GMV_CTE + """
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
    sql = STOCK_GMV_CTE + """
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



