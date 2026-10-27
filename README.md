# 电商经营分析平台

基于英国在线零售商真实交易数据（UCI Online Retail II）构建的**数据仓库 + 分析模型 + 可视化看板**，
回答经营者最关心的三个问题：**生意好不好、客户值不值钱、商品该不该留**。

![看板截图](docs/images/dashboard-top.png)

<p>
<img alt="Python" src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white">
<img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white">
<img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white">
<img alt="ECharts" src="https://img.shields.io/badge/ECharts-5-AA344D">
<img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

<details>
<summary><b>完整看板截图（点击展开）</b></summary>

![完整看板](docs/images/dashboard-full.png)

</details>

---

## 目录

- [项目概览](#项目概览)
- [核心结论](#核心结论)
- [技术架构](#技术架构)
- [数据模型](#数据模型)
- [分析模型](#分析模型)
- [数据清洗规则](#数据清洗规则)
- [快速开始](#快速开始)
- [API 一览](#api-一览)
- [工程实现要点](#工程实现要点)
- [踩过的坑](#踩过的坑)
- [目录结构](#目录结构)
- [学习笔记](#学习笔记)
- [数据来源与许可](#数据来源与许可)

---

## 项目概览

| 项目 | 说明 |
|---|---|
| 数据规模 | **1,061,164** 行交易明细 / 48,369 个订单 / 5,939 个客户 / 4,741 个 SKU |
| 时间跨度 | 2009-12-01 ~ 2011-12-09（739 天，25 个月） |
| 数据来源 | UCI Machine Learning Repository — Online Retail II |
| 技术栈 | Python 3 · pandas · MySQL 8.0 · SQLAlchemy · FastAPI · ECharts |
| 产出形态 | 本地可运行的数据仓库 + REST API + 单页可视化看板 |
| 代码规模 | **786 行**（ETL 208 行 / API 232 行 / 看板 287 行 / DDL 59 行） |

---

## 核心结论

以下是本平台在真实数据上跑出来的结果，也是这个项目最有价值的部分。

### 1. 整体经营

| 指标 | 数值 |
|---|---|
| GMV（不含退货） | **¥20,972,594.55** |
| 订单数 | 40,077 |
| 活跃客户数 | 5,939 |
| 客单价 AOV | **¥523.31** |
| 退货金额占比 | 7.28% |
| 销售明细行 | 1,041,670 |

> 客单价 523 元明显高于普通零售电商（通常 50~200 元），说明客户结构以**批发/批量采购**为主，而非个人消费。

### 2. 客户价值极不均衡（RFM）

| 客户分层 | 人数 | 占比 | 人均 GMV | GMV 贡献 |
|---|---|---|---|---|
| 重要价值客户 | 1,345 | 22.6% | ¥9,081 | **¥12,214,163（58.2%）** |
| 一般客户 | 2,004 | 33.7% | ¥1,039 | ¥2,082,961 |
| 重要保持客户 | 395 | 6.6% | ¥4,108 | ¥1,622,485 |
| 重要挽留客户 | 203 | 3.4% | ¥4,779 | ¥970,135 |
| 流失客户 | 1,644 | 27.7% | ¥450 | ¥739,637 |
| 新客户 | 287 | 4.8% | ¥397 | ¥114,049 |

**运营含义**：
- **1,345 个"重要价值客户"贡献近 6 成营收**，是要重点保护的核心资产
- **"重要挽留客户"只有 203 人，但人均历史消费 ¥4,779** —— 人少、值钱、还在流失窗口内，**召回 ROI 最高**，一个客服一周就能全部触达
- **"流失客户"1,644 人但人均仅 ¥450** —— 人多不值钱，用自动化邮件群发即可，别投入人力

### 3. 商品长尾严重（ABC / 帕累托）

| 分类 | SKU 数 | 占比 | GMV | GMV 占比 |
|---|---|---|---|---|
| A 类（累计贡献 80%） | 1,025 | 21.7% | ¥16,093,195 | **79.99%** |
| B 类（80~95%） | 1,261 | 26.7% | ¥3,020,260 | 15.01% |
| C 类（尾部） | 2,441 | **51.6%** | ¥1,006,567 | **5.00%** |

**运营含义**：
- **C 类 2,441 个 SKU 占用了一半的商品数和大量库存/采购精力，却只贡献 5% 的营收** → 应清仓、不再补货，把资源压到 A 类
- Top 10 商品仅贡献 **8.04%** GMV，Top 30 仅 **14.51%** —— 这不是"爆款驱动"结构，而是典型的批发性长尾，**真正的帕累托临界线在 1,000 名以后**

### 4. 周内规律明显（运营排期）

| 星期 | 日均 GMV |
|---|---|
| 周一 | ¥38,774 |
| 周二 | ¥40,249 |
| 周三 | ¥34,633 |
| **周四** | **¥41,810（最高）** |
| 周五 | ¥34,111 |
| 周六 | **¥9,803（最低，仅为周四的 1/4）** |
| 周日 | ¥18,657 |

**运营含义**：客户以英国本土 B2B 批发商为主，周末不营业。**营销邮件周四发送、周末不投广告预算**。

### 5. 市场高度集中于本土

| 国家 | GMV | 客户数 |
|---|---|---|
| United Kingdom | ¥17,870,978（**85.2%**） | 5,350 |
| EIRE（爱尔兰） | ¥664,432 | **5** |
| Netherlands | ¥554,232 | **22** |
| Germany | ¥431,262 | 107 |
| France | ¥356,945 | 95 |

**运营含义**：爱尔兰仅 5 个客户就做了 66 万，荷兰 22 个客户做了 55 万 —— **典型的少数大客户批发市场**。
这类客户需要按"大客户"单独维护（专属对接人、账期、返点），不能用零售思路做。

---

## 技术架构

```
┌─────────────────────────────────────────────────────────────┐
│  UCI Online Retail II（Excel，约 108 万行原始明细）           │
└────────────────────────┬────────────────────────────────────┘
                         │
                  ① 抽取 extract()
                  ② 清洗 clean()
                  ③ 建模 build_dims()
                  ④ 装载 load()
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  MySQL 8.0 · biz_analytics      （星型模型数据仓库）          │
│                                                              │
│   fact_sales     1,061,164 行   ← 事实表（销售明细）          │
│   dim_customer       5,939 行   ← 客户维度                    │
│   dim_product        4,741 行   ← 商品维度                    │
│   dim_date             739 行   ← 日期维度                    │
└────────────────────────┬────────────────────────────────────┘
                         │  SQLAlchemy + pandas.read_sql
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  FastAPI · api/main.py     （10 个分析接口 + Swagger 文档）   │
└────────────────────────┬────────────────────────────────────┘
                         │  HTTP / JSON
                         ▼
┌─────────────────────────────────────────────────────────────┐
│  web/index.html            （ECharts 单页看板，零构建依赖）    │
│  6 个 KPI 卡片 · 7 张图表 · 2 张明细表                        │
└─────────────────────────────────────────────────────────────┘
```

**为什么这么分层**：ETL 只做"把数据变干净、变规整"，API 只做"把 SQL 结果转成 JSON"，前端只做"把 JSON 画成图"。
三层互不依赖，任何一层都能单独替换（比如把 ECharts 换成 Vue，或把 MySQL 换成 PostgreSQL，另两层不用动）。

---

## 数据模型

采用**星型模型（Star Schema）**：一张事实表 + 三张维度表。

```
                    ┌──────────────┐
                    │  dim_date    │
                    │  date_key PK │
                    └──────┬───────┘
                           │
┌──────────────┐    ┌──────▼──────────┐    ┌──────────────┐
│ dim_customer │    │   fact_sales    │    │ dim_product  │
│ customer_id  ├───►│  sales_id    PK │◄───┤  stock_code  │
│      PK      │    │  customer_id FK │    │      PK      │
└──────────────┘    │  stock_code  FK │    └──────────────┘
                    │  date_key    FK │
                    └─────────────────┘
```

### fact_sales（事实表，1,061,164 行）

| 字段 | 类型 | 说明 |
|---|---|---|
| `sales_id` | BIGINT AUTO_INCREMENT | 主键 |
| `invoice_no` | VARCHAR(20) | 订单号 |
| `line_no` | SMALLINT | 订单内行号 |
| `stock_code` | VARCHAR(32) | 商品编码（关联 dim_product） |
| `customer_id` | BIGINT, NULL | 客户编号（NULL = 游客订单） |
| `date_key` | INT | 日期键 YYYYMMDD（关联 dim_date） |
| `quantity` | INT | 数量（退货为负） |
| `price` | DECIMAL(10,2) | 单价 |
| `amount` | DECIMAL(14,2) | 金额 = quantity × price |
| `is_return` | TINYINT(1) | 1 = 退货/取消单 |
| `is_product` | TINYINT(1) | 0 = 非商品项（邮费/手续费/礼品券等） |
| `country` | VARCHAR(64) | 国家 |

**索引**：`date_key` / `customer_id` / `stock_code` / `invoice_no` 各建索引，覆盖全部高频查询条件。

### dim_date（739 行）

`date_key`(PK) · `full_date` · `year` · `quarter` · `month` · `month_name`(如 `2009-12`) · `day_of_month` · `weekday`(1=周一…7=周日) · `is_weekend`

**为什么单独建日期维度**：把日期属性（年/季/月/星期/是否周末）预计算好，
分析时不用每次写 `EXTRACT`，也保证趋势图时间轴连续（无订单的日子也有行）。

### dim_customer（5,939 行）

`customer_id`(PK) · `country` · `first_order_date` · `last_order_date` · `total_orders` · `total_amount` · `is_guest`

### dim_product（4,741 行）

`stock_code`(PK) · `description`(VARCHAR(255)) · `avg_price`

> **注意**：`dim_product` 只包含**真实商品**（`is_product=1`），邮费/手续费等虚拟编码不进维度表。
> 这就是 `fact_sales` 做 INNER JOIN 时会少 5,793 行的原因（详见[踩过的坑](#踩过的坑)）。

---

## 分析模型

| 模块 | 业务问题 | 实现方法 | 对应接口 |
|---|---|---|---|
| 核心 KPI | 整体经营健康度 | 条件聚合 `SUM(CASE WHEN ...)` 一次算出 GMV / 订单 / 客户 / AOV / 退货率 | `/api/kpi` |
| 月度趋势 | 在增长还是衰退 | 事实表 JOIN 日期维度，按 `year, month` 分组 | `/api/trend` |
| **RFM 客户分层** | 哪些客户值得投入 | `NTILE(5)` 五分位打分 + `CASE WHEN` 组合成 6 类 | `/api/rfm` |
| **ABC 商品分析** | 哪些商品撑起营收 | 累计求和 `SUM() OVER (ORDER BY ...)` 划分 80% / 95% 临界 | `/api/abc` |
| 帕累托曲线 | 头部集中度 | 同上的累计占比取前 N 名 | `/api/pareto?top=30` |
| 商品 Top N | 卖得最好的是什么 | JOIN 商品维度取名称，按 GMV 排序 | `/api/top-products?limit=10` |
| 区域分布 | 市场结构 | 按国家分组聚合 | `/api/country?limit=10` |
| 周内分布 | 营销/排期参考 | 按 `weekday` 分组，算**日均**（非总额，因各星期天数不同） | `/api/weekday` |
| 健康检查 | 服务与数据库连通性 | 直接 count 事实表 | `/api/health` |

### RFM 打分逻辑（关键细节）

```sql
ntile(5) over (order by recency desc)  as r_score   -- 注意是 desc
ntile(5) over (order by frequency)     as f_score
ntile(5) over (order by monetary)      as m_score
```

**为什么 R 用 `DESC`**：`recency` 是"距最后一次购买的天数"，**数字越小越好**（是反向指标）。
`NTILE` 的规则是"排在最后的拿 5 分"，所以要让**天数小的人排在后面**，就必须倒序排。
这样三个指标方向统一为"分数高 = 状态好"，业务解释才通顺。

**为什么 R 用 `MAX(full_date) FROM dim_date` 而不是 `NOW()`**：这是历史数据，最后一天是 2011-12-09。
用 `NOW()` 会让所有客户都变成"5000 多天没买"，分层完全失效。

### ABC 分类逻辑

```sql
sum(gmv) over (order by gmv desc)  -- 累计（滚雪球）
sum(gmv) over ()                   -- 全局总额（每行同一个数）
cum_gmv / total_gmv                -- 累计占比
```

累计 ≤ 80% → A 类；80~95% → B 类；其余 → C 类。

---

## 数据清洗规则

原始数据有 108 万行，清洗后保留 **1,061,164** 行。每一步处理都有明确业务理由：

| 原始问题 | 处理方式 | 为什么这么做 |
|---|---|---|
| 取消/退货单（`Invoice` 以 `C` 开头） | 标记 `is_return=1`，**保留不删** | 仍要能分析退款率，删了就永远算不出退货率 |
| `Price <= 0` | 剔除 | 赠品/手工调价，会让客单价失真 |
| `Quantity = 0` | 剔除 | 无业务意义 |
| `Quantity < 0` 但非 C 单 | **保留**（归为退货） | 少量调整单，与退货同性质 |
| 缺失 `Customer ID` | 保留事实行，标 `is_guest=1` | **要算进 GMV**（钱是真收了），但不参与 RFM（无法追踪个人行为） |
| 缺失 `StockCode` | 剔除 | 没有商品编码无法做任何商品维度分析 |
| 缺失 `Description` | 填 `(无描述)` | 不能丢行，仅为显示占位 |
| 商品编码大小写混用（`15056BL` / `15056bl`） | `.str.upper().str.strip()` 统一 | MySQL 排序规则不区分大小写，不统一会**撞主键** |
| 邮费/手续费/礼品券（`POST`/`M`/`BANK CHARGES`/`GIFT_0001_*` 等） | 标 `is_product=0` | 计入营收，但**必须排除在商品分析外**，否则污染 ABC 和帕累托 |
| `InvoiceDate` 带时分秒 | 派生 `date_key` = YYYYMMDD | 整数比 DATETIME 索引更快，且无时分秒干扰分组 |
| 原始无金额列 | `amount = quantity × price` | 自己算，保留 2 位小数 |

**非商品项完整清单**（`NON_PRODUCT` 集合，共 12 个 + 8 个礼品券变体）：
`M`（手工调整）、`DOT` / `POST`（邮费）、`BANK CHARGES`（银行手续费）、`AMAZONFEE`、`CRUK`、
`PADS`、`B`、`C2`、`D`、`S`、`SP1002`，以及所有以 `GIFT_0001` 开头的礼品券编码。

---

## 快速开始

### 环境要求

- Python 3.9+
- MySQL 8.0+（本地或远程均可）

### 步骤

```bash
# 1) 克隆仓库
git clone https://github.com/GH_USER/ecommerce-analytics.git
cd ecommerce-analytics

# 2) 安装依赖
pip install -r requirements.txt

# 3) 配置连接串（复制模板后改成自己的密码）
cp .env.example .env
```

`.env` 内容格式：

```ini
DATABASE_URL=mysql+pymysql://root:你的密码@localhost:3306/biz_analytics
```

> **注意**：库 `biz_analytics` **不需要提前手动创建**。ETL 会自动建库（含字符集设置）。

```bash
# 4) 下载数据集到 raw/（约 45 MB）
mkdir -p raw
curl -L -o raw/online_retail_ii.zip "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
unzip -o raw/online_retail_ii.zip -d raw/
# 得到 raw/online_retail_II.xlsx（脚本读这个名字，注意大小写）

# 5) 构建数据仓库（首次约 5~10 分钟，主要耗时在装载 106 万行）
python etl/build_dw.py

# 6) 启动服务
uvicorn api.main:app --port 8000
```

浏览器打开 **http://127.0.0.1:8000** 查看看板，
**http://127.0.0.1:8000/docs** 查看可交互的 API 文档。

### 验证是否成功

```bash
curl http://127.0.0.1:8000/api/health
# 期望：{"status":"ok","fact_rows":1061164}
```

### 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `Unknown database 'biz_analytics'` | 用的是旧版脚本 | 新版 `load()` 已自动建库；确认 `etl/build_dw.py` 里有 `CREATE DATABASE IF NOT EXISTS` |
| `No module named uvicorn` | 依赖没装全 | `pip install -r requirements.txt` |
| 页面空白、KPI 全是 `—` | API 没启动或端口不对 | 确认 `uvicorn` 在跑；`index.html` 里的 `API` 常量与端口一致 |
| `BadZipFile: File is not a zip file` | `raw/` 里是软链接而非真实文件 | 必须用真实文件，不能建符号链接 |
| 装载中途 `nan can not be used with MySQL` | NaN 无法转 NULL（旧版问题） | 新版已用 `to_nullable_int()` 处理 |
| 装载报 `Duplicate entry ... for key 'dim_product.PRIMARY'` | 商品编码大小写未统一（旧版问题） | 新版已在 `clean()` 里 `.str.upper()` |

---

## API 一览

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/` | — | 返回看板页面 |
| GET | `/api/kpi` | — | 核心指标：gmv / orders / customers / aov / return_rate / line_count |
| GET | `/api/trend` | — | 月度趋势（25 条）：month / gmv / orders / customers |
| GET | `/api/rfm` | — | RFM 六分层：segment / customers / avg_recency_days / avg_frequency / avg_monetary / total_gmv |
| GET | `/api/abc` | — | ABC 三类：abc_class / sku_count / gmv / gmv_share_pct |
| GET | `/api/pareto` | `top`（默认 30） | 头部商品累计占比：rn / stock_code / gmv / cum_pct |
| GET | `/api/top-products` | `limit`（默认 10） | GMV Top 商品：stock_code / description / gmv / qty / orders |
| GET | `/api/country` | `limit`（默认 10） | 国家分布：country / gmv / customers |
| GET | `/api/weekday` | — | 周内日均：weekday（中文）/ avg_gmv |
| GET | `/api/health` | — | `{"status":"ok","fact_rows":1061164}` |

**示例**：

```bash
$ curl -s http://127.0.0.1:8000/api/kpi
{"gmv":20972594.55,"orders":40077,"customers":5939,"aov":523.31,"return_rate":7.28,"line_count":1061164}

$ curl -s "http://127.0.0.1:8000/api/top-products?limit=3"
[{"stock_code":"22423","description":"REGENCY CAKESTAND 3 TIER","gmv":344563.25,"qty":27577,"orders":3918},
 {"stock_code":"85123A","description":"CREAM HANGING HEART T-LIGHT HOLDER","gmv":267102.06,"qty":96744,"orders":5464},
 {"stock_code":"85099B","description":"JUMBO BAG RED RETROSPOT","gmv":185566.47,"qty":98768,"orders":4013}]
```

---

## 工程实现要点

这个项目避开了一些"教程代码"常见的偷懒做法，下面几处是实际踩坑后改出来的。

### 1. 全量重建 vs 增量更新

`load()` 采用**先 DROP 再按 DDL 重建**的策略：

```python
conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
for t in ("fact_sales", "dim_date", "dim_product", "dim_customer"):
    conn.execute(text(f"DROP TABLE IF EXISTS {t}"))
conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
```

**为什么**：表结构会随需求演进（比如后来加了 `is_product` 字段）。全量重建保证
"表结构永远等于 `schema.sql` 里的定义"，不会出现"代码改了字段但库里还是旧结构"这种幽灵问题。
代价是每次都要重跑（约 5 分钟），对 100 万行量级完全可接受。

**如果数据涨到千万级**，应改为增量：用 `ON DUPLICATE KEY UPDATE` 按 `invoice_no + line_no` 做幂等 upsert。

### 2. 批量插入提速

```python
fact.to_sql("fact_sales", engine, if_exists="append", index=False,
            chunksize=10000, method="multi")
```

`method="multi"` 把多行拼成一条 `INSERT INTO ... VALUES (...), (...), (...)`，
比 pandas 默认的逐行插入**快 5~10 倍**。这是 106 万行能在几分钟内装完的关键。

### 3. 自动建库，避免"鸡生蛋"死锁

```python
SERVER_URL = DB_URL.rsplit("/", 1)[0] + "/"   # 不带库名
server_engine = create_engine(SERVER_URL)
with server_engine.begin() as conn:
    conn.execute(text("CREATE DATABASE IF NOT EXISTS biz_analytics "
                      "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
```

**问题**：`schema.sql` 里有 `CREATE DATABASE`，但**要执行它必须先连上库**，而库还不存在 → 死锁。
**解法**：用不带库名的连接串先建库，再切到带库名的连接串建表。

### 4. NaN → NULL 的类型陷阱

```python
def to_nullable_int(series):
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.astype(object).where(numeric.notna(), None)
```

pandas 用 `NaN`（float）表示缺失，MySQL 只认 `NULL`。但**数值类型的列不允许存 `None`**
（会被强制转回 `NaN`），必须先用 `astype(object)` 承接。

同类问题：`df["country"].astype(str)` 会把缺失值变成字符串 `"nan"`（而不是 NULL），
所以要用 `astype(object).where(notna(), None)`。

### 5. `only_full_group_by` 下的安全写法

MySQL 8 默认开启 `ONLY_FULL_GROUP_BY`：`SELECT` 里的非聚合列必须出现在 `GROUP BY` 里。
所以按月分组时写的是：

```sql
group by d.year, d.month, d.month_name
```

而不是只写 `month_name`。同理，在 `GROUP BY segment` 后要用全局总额，得写成 `MAX(total_gmv)`。

### 6. 排序不能用文本月份

`month_name` 是 `'2009-12'`、`'2010-03'` 这样的字符串，直接 `ORDER BY month_name` 会排成
字典序 —— **`2010-10` 会跑到 `2010-02` 前面**。
正确做法：`ORDER BY MIN(date_key)`（用数字日期键排序）。

### 7. 前端零构建

`web/index.html` 单文件包含 HTML / CSS / JS，ECharts 走 CDN，**不需要 npm/webpack/vite**。
对"个人项目快速看到效果 + 方便部署"来说是最优解。
数据获取用 `Promise.all` 并发发起 9 个请求，避免瀑布式等待。

---

## 踩过的坑

真实发生过、且已修复的问题。这部分最能说明"代码是怎么长成现在这样的"。

| # | 报错 / 现象 | 根因 | 修复 |
|---|---|---|---|
| 1 | `nan can not be used with MySQL` | pymysql 无法序列化 `float('nan')` | `to_nullable_int()` + `astype(object)` |
| 2 | `Duplicate entry '15056bl' for key 'dim_product.PRIMARY'` | 同一 SKU 有 `15056BL`/`15056bl` 两种写法；MySQL `utf8mb4_unicode_ci` 不区分大小写 → 撞主键 | `clean()` 里 `.str.upper().str.strip()` |
| 3 | 帕累托图第一名是 `POST`（邮费） | 虚拟编码混进商品分析 | 新增 `is_product` 标记，所有商品查询加 `AND is_product = 1` |
| 4 | `(1064, ... near 'lines')` | `lines` 是 MySQL 8 保留字 | 别名改为 `line_count`（API + 前端同步改） |
| 5 | `(1049, "Unknown database 'biz_analytics'")` | 手删过库；`load()` 用带库名的连接串连库 → 连不上就无法 CREATE DATABASE | 改用 `SERVER_URL` 先建库（见[工程实现要点 3](#3-自动建库避免鸡生蛋死锁)） |
| 6 | `BadZipFile: File is not a zip file` | `raw/` 里 xlsx 是软链接 | 必须用真实文件，重新复制 |
| 7 | 月度趋势图月份顺序乱 | `ORDER BY month_name` 走了字典序 | 改为 `ORDER BY MIN(date_key)` |
| 8 | 运行 `api/main.py` 后"什么都没发生" | 文件只注册路由，没有 `uvicorn.run()` 入口 | 用 `uvicorn api.main:app --port 8000` 启动 |

---

## 目录结构

```
ecommerce-analytics/
├── .env.example            # 连接串模板（复制为 .env 使用）
├── .gitignore
├── LICENSE                 # MIT
├── README.md
├── requirements.txt
├── sql/
│   └── schema.sql          # 星型模型 DDL（4 表 + 4 索引）
├── etl/
│   └── build_dw.py         # ETL 全流程：extract → clean → build_dims → load
├── api/
│   └── main.py             # FastAPI：10 个接口
├── web/
│   └── index.html          # ECharts 看板（单文件，零构建）
└── docs/
    ├── CHANGELOG.md        # 版本记录
    ├── SQL_零基础教程.md    # 学习笔记：SQL（60 条语句真库验证）
    ├── SQL_PRACTICE.md     # 学习笔记：SQL 练习题库
    ├── PANDAS_零基础教程.md # 学习笔记：pandas 数据清洗
    └── images/             # README 配图
```

---

## 学习笔记

这个项目配套的两份零基础教程，记录了从 0 到 1 的完整学习路径，
全部在真实数据（同一份 106 万行交易数据）上逐条验证：

- [SQL 零基础教程](docs/SQL_零基础教程.md) — 从 select 到窗口函数，60 条语句全部在项目数据库上验证
- [pandas 零基础教程](docs/PANDAS_零基础教程.md) — 从 read_excel 到完整数据清洗，清洗结果与数据库 8 项指标交叉验证
- [SQL 练习题库](docs/SQL_PRACTICE.md) — L1~L5 分级练习，附业务解读与面试追问
- [CHANGELOG](docs/CHANGELOG.md) — 开发时间线与问题修复记录

---

## 数据来源与许可

数据集来自 [UCI Machine Learning Repository — Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii)，
由英国在线零售商（主营礼品/家居小商品）在 2009-12-01 至 2011-12-09 期间的真实交易记录构成。

原始数据已脱敏，**不含客户姓名、地址、联系方式等个人信息**，仅保留匿名 `Customer ID`。
仅用于学习与研究目的。

本项目代码以 **MIT License** 发布。
