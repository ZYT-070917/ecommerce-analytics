# 电商经营分析平台

基于英国在线零售商真实交易数据（UCI Online Retail II）构建的数据仓库、分析接口与可视化看板，
覆盖经营概况、客户分层、商品结构三个方向。

![看板截图](docs/images/dashboard-top.png)

<p>
<img alt="Python" src="https://img.shields.io/badge/Python-3.x-3776AB?logo=python&logoColor=white">
<img alt="MySQL" src="https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white">
<img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white">
<img alt="ECharts" src="https://img.shields.io/badge/ECharts-5-AA344D">
<img alt="License" src="https://img.shields.io/badge/license-MIT-green">
</p>

<details>
<summary>完整看板截图</summary>

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
- [数据来源与许可](#数据来源与许可)

---

## 项目概览

| 项目 | 说明 |
|---|---|
| 数据规模 | 1,038,819 行交易明细，40,077 个成交订单，5,939 个客户，4,741 个 SKU |
| 时间跨度 | 2009-12-01 至 2011-12-09，共 739 天、25 个月 |
| 数据来源 | UCI Machine Learning Repository — Online Retail II |
| 技术栈 | Python 3、pandas、MySQL 8.0、SQLAlchemy、FastAPI、ECharts |
| 产出形态 | 本地可运行的数据仓库、REST API、单页可视化看板 |
| 代码规模 | 795 行（ETL 217 行，API 232 行，看板 287 行，DDL 59 行） |

---

## 核心结论

以下指标均由本项目在真实数据上计算得出。

### 经营概况

| 指标 | 数值 |
|---|---|
| GMV（不含退货） | £20,533,741.90 |
| 订单数 | 40,077 |
| 活跃客户数 | 5,939 |
| 客单价 AOV | £512.36 |
| 退货金额占比 | 7.14% |
| 销售明细行 | 1,038,819 |

客单价 512 英镑，明显高于普通零售电商常见的 50 至 200 英镑区间，
说明客户结构以批发和批量采购为主，而非个人消费。

### 客户价值分布（RFM）

| 客户分层 | 人数 | 占比 | 人均 GMV | GMV 贡献 |
|---|---|---|---|---|
| 重要价值客户 | 1,346 | 22.9% | £8,902 | £11,982,700（58.4%） |
| 一般客户 | 2,011 | 34.2% | £1,030 | £2,071,201 |
| 重要保持客户 | 393 | 6.7% | £4,072 | £1,600,171 |
| 重要挽留客户 | 197 | 3.4% | £4,745 | £934,806 |
| 流失客户 | 1,644 | 28.0% | £443 | £728,760 |
| 新客户 | 287 | 4.9% | £397 | £113,913 |

运营层面的解读：

- 1,346 个重要价值客户贡献了近六成营收，是应优先维护的核心客户群。
- 重要挽留客户只有 197 人，人均历史消费 4,745 英镑，人数少但价值高，且仍处在流失窗口内，
  召回投入产出比最高，一个客服一周内可以全部触达。
- 流失客户 1,644 人，人均仅 443 英镑，适合用自动化邮件群发做低成本唤醒，不必投入人力。

### 商品结构（ABC 与帕累托）

| 分类 | SKU 数 | 占比 | GMV | GMV 占比 |
|---|---|---|---|---|
| A 类（累计贡献 80%） | 1,031 | 21.8% | £15,767,353 | 79.99% |
| B 类（80% 至 95%） | 1,263 | 26.7% | £2,957,258 | 15.00% |
| C 类（尾部） | 2,433 | 51.5% | £986,184 | 5.00% |

运营层面的解读：

- C 类 2,433 个 SKU 占了一半的商品数，只贡献 5% 营收，却持续占用库存和采购精力，
  适合逐步清仓、停止补货，把资源集中到 A 类。
- Top 10 商品只贡献 8.03% 的 GMV，Top 30 也只有 14.45%。这说明营收并非由少数爆款驱动，
  而是典型的长尾批发结构，帕累托临界线实际落在 1,000 名之后。

### 周内规律

| 星期 | 日均 GMV |
|---|---|
| 周一 | £38,191 |
| 周二 | £39,291 |
| 周三 | £33,629 |
| 周四 | £40,826（最高） |
| 周五 | £33,637 |
| 周六 | £9,803（最低，约为周四的四分之一） |
| 周日 | £18,336 |

客户以英国本土 B2B 批发商为主，周末基本不营业。营销邮件适合安排在周四，
周末可以收缩广告投放。

### 市场分布

| 国家 | GMV | 客户数 |
|---|---|---|
| United Kingdom | £17,465,896（85.1%） | 5,350 |
| EIRE（爱尔兰） | £659,149 | 5 |
| Netherlands | £554,040 | 22 |
| Germany | £425,578 | 107 |
| France | £350,654 | 95 |

爱尔兰 5 个客户贡献 66 万英镑，荷兰 22 个客户贡献 55 万英镑，
属于典型的少数大客户市场。这类客户需要单独的维护方式，例如专属对接人、账期和返点，
不适用零售运营思路。

---

## 技术架构

数据流向分为四层，每层职责单一。

1. 数据源：UCI Online Retail II 的 Excel 文件，约 107 万行原始明细。
2. ETL（`etl/build_dw.py`）：`extract()` 读取、`clean()` 清洗、`build_dims()` 构建维度、`load()` 建表装载。
3. 数据仓库（MySQL 8.0，库名 `biz_analytics`）：星型模型，一张事实表加三张维度表。
4. 服务与展示：FastAPI 提供接口，`web/index.html` 用 ECharts 渲染看板。

仓库各表的数据量：

| 表 | 行数 | 说明 |
|---|---|---|
| `fact_sales` | 1,038,819 | 销售明细事实表 |
| `dim_customer` | 5,939 | 客户维度 |
| `dim_product` | 4,741 | 商品维度 |
| `dim_date` | 739 | 日期维度 |

分层的目的在于解耦：ETL 只负责把原始数据整理干净，API 只负责把查询结果转成 JSON，
前端只负责把 JSON 画成图。任何一层都可以单独替换，例如把 ECharts 换成别的图表库，
或者把 MySQL 换成 PostgreSQL，另外两层不需要改动。

---

## 数据模型

采用星型模型，一张事实表加三张维度表，通过代理键关联。

| 关联 | 连接字段 | 说明 |
|---|---|---|
| `fact_sales` 与 `dim_customer` | `customer_id` | 游客订单该字段为空，不参与关联 |
| `fact_sales` 与 `dim_product` | `stock_code` | 仅真实商品进维度表 |
| `fact_sales` 与 `dim_date` | `date_key` | 整数日期键，格式 YYYYMMDD |

### fact_sales（1,038,819 行）

| 字段 | 类型 | 说明 |
|---|---|---|
| `sales_id` | BIGINT AUTO_INCREMENT | 主键 |
| `invoice_no` | VARCHAR(20) | 订单号 |
| `line_no` | SMALLINT | 订单内行号 |
| `stock_code` | VARCHAR(32) | 商品编码，关联 dim_product |
| `customer_id` | BIGINT, NULL | 客户编号，空值表示游客订单 |
| `date_key` | INT | 日期键 YYYYMMDD，关联 dim_date |
| `quantity` | INT | 数量，退货为负 |
| `price` | DECIMAL(10,2) | 单价 |
| `amount` | DECIMAL(14,2) | 金额，等于数量乘单价 |
| `is_return` | TINYINT(1) | 1 表示退货或取消单 |
| `is_product` | TINYINT(1) | 0 表示非商品项，如邮费、手续费、礼品券 |
| `country` | VARCHAR(64) | 国家 |

索引建在 `date_key`、`customer_id`、`stock_code`、`invoice_no` 四个字段上，
覆盖看板涉及的查询条件。

### dim_date（739 行）

字段包括 `date_key`（主键）、`full_date`、`year`、`quarter`、`month`、
`month_name`（形如 `2009-12`）、`day_of_month`、`weekday`（1 为周一，7 为周日）、`is_weekend`。

单独建日期表的作用是把日期属性预先算好，分析时不必每次写 `EXTRACT`，
同时用连续日期序列保证趋势图的时间轴不断点，没有订单的日子也有对应行。

### dim_customer（5,939 行）

字段包括 `customer_id`（主键）、`country`、`first_order_date`、`last_order_date`、
`total_orders`、`total_amount`、`is_guest`。

### dim_product（4,741 行）

字段包括 `stock_code`（主键）、`description`（VARCHAR(255)）、`avg_price`。

该表只收录真实商品，邮费和手续费等虚拟编码不进维度表。
因此 `fact_sales` 与它做内连接时会丢掉这部分非商品行，这是预期行为。

---

## 分析模型

| 模块 | 分析目标 | 实现方法 | 对应接口 |
|---|---|---|---|
| 核心 KPI | 整体经营健康度 | 条件聚合 `SUM(CASE WHEN ...)` 一次算出 GMV、订单数、客户数、AOV、退货率 | `/api/kpi` |
| 月度趋势 | 增长与衰退走势 | 事实表关联日期维度，按 `year`、`month` 分组 | `/api/trend` |
| RFM 客户分层 | 客户价值分级 | `NTILE(5)` 五分位打分，再用 `CASE WHEN` 组合成 6 类 | `/api/rfm` |
| ABC 商品分析 | 商品营收贡献结构 | 累计求和 `SUM() OVER (ORDER BY ...)` 划分 80% 与 95% 临界 | `/api/abc` |
| 帕累托曲线 | 头部集中度 | 累计占比取前 N 名 | `/api/pareto?top=30` |
| 商品 Top N | 畅销商品排名 | 关联商品维度取名称，按 GMV 排序 | `/api/top-products?limit=10` |
| 区域分布 | 市场结构 | 按国家分组聚合 | `/api/country?limit=10` |
| 周内分布 | 营销与排期参考 | 按 `weekday` 分组，计算日均值而非总额，因为各星期天数不同 | `/api/weekday` |
| 健康检查 | 服务与数据库连通性 | 统计事实表行数 | `/api/health` |

### RFM 打分

```sql
ntile(5) over (order by recency desc)  as r_score
ntile(5) over (order by frequency)     as f_score
ntile(5) over (order by monetary)      as m_score
```

R 使用倒序排序，因为 `recency` 表示距最后一次购买的天数，数值越小状态越好，
属于反向指标。`NTILE` 会把排在最后的记录打 5 分，所以要让天数小的客户排在末尾，
就必须按天数降序排列。这样三个指标方向统一为分数越高状态越好，业务解释才通顺。

R 的基准日期取 `MAX(full_date) FROM dim_date`，而不是 `NOW()`。
这是历史数据，最后一天是 2011-12-09，用当前时间会让所有客户都算出数千天未购买，
分层结果完全失效。

### ABC 分类

```sql
sum(gmv) over (order by gmv desc)  -- 按 GMV 从高到低累计
sum(gmv) over ()                   -- 全局总额，每行相同
cum_gmv / total_gmv                -- 累计占比
```

累计占比不超过 80% 归为 A 类，80% 至 95% 归为 B 类，其余归为 C 类。

---

## 数据清洗规则

原始 Excel 约 107 万行，两个 sheet 的日期区间重叠 9 天（2010-12-01 至 12-09），
裁掉重叠部分后为 1,044,848 行，清洗后保留 1,038,819 行。每条规则都对应一个具体的数据问题。

| 原始问题 | 处理方式 | 处理理由 |
|---|---|---|
| 两个 sheet 日期重叠 9 天 | 第二个 sheet 只保留第一个 sheet 最后一天之后的行 | 直接 `concat` 会让这 9 天读两遍，实测产生 22,345 行重复（22,025 组），GMV 虚高约 44 万、占比 2.1%，并在 2010-12 造成假尖峰。这里不能对整个表做 `drop_duplicates`，因为同一订单里同商品买两次属于合法数据 |
| 取消或退货单，`Invoice` 以 C 开头 | 标记 `is_return=1`，保留不删 | 退款率本身是需要分析的指标，删掉就永远算不出来 |
| `Price` 小于等于 0 | 剔除 | 属于赠品或手工调价，会让客单价失真 |
| `Quantity` 等于 0 | 剔除 | 无业务意义 |
| `Quantity` 小于 0 但不是 C 单 | 保留，归入退货 | 属于少量调整单，与退货性质相同 |
| 缺失 `Customer ID` | 保留事实行，标记 `is_guest=1` | 这部分金额真实发生，需要计入 GMV；但无法追踪个人行为，不参与 RFM |
| 缺失 `StockCode` | 剔除 | 没有商品编码，无法做任何商品维度分析 |
| 缺失 `Description` | 填 `(无描述)` | 仅为显示占位，不能因此丢掉整行 |
| 商品编码大小写混用，如 `15056BL` 与 `15056bl` | 统一转为大写并去除首尾空格 | MySQL 排序规则不区分大小写，不统一会导致主键冲突 |
| 邮费、手续费、礼品券等，如 `POST`、`M`、`BANK CHARGES`、`GIFT_0001_*` | 标记 `is_product=0` | 金额计入营收，但必须排除在商品分析之外，否则会污染 ABC 分类和帕累托曲线 |
| `InvoiceDate` 带时分秒 | 派生 `date_key`，格式 YYYYMMDD | 整数索引比 DATETIME 更快，也避免时分秒干扰分组 |
| 原始数据没有金额列 | 计算 `amount = quantity * price`，保留两位小数 | 自行派生 |

非商品编码共 12 个，另有以 `GIFT_0001` 开头的礼品券变体：

`M`（手工调整）、`DOT` 与 `POST`（邮费）、`BANK CHARGES`（银行手续费）、
`AMAZONFEE`、`CRUK`、`PADS`、`B`、`C2`、`D`、`S`、`SP1002`。

---

## 快速开始

### 环境要求

- Python 3.9 及以上
- MySQL 8.0 及以上，本地或远程均可

### 步骤

```bash
# 1) 克隆仓库
git clone https://github.com/ZYT-070917/ecommerce-analytics.git
cd ecommerce-analytics

# 2) 安装依赖
pip install -r requirements.txt

# 3) 配置连接串
cp .env.example .env
```

`.env` 的格式：

```ini
DATABASE_URL=mysql+pymysql://root:你的密码@localhost:3306/biz_analytics
```

数据库 `biz_analytics` 不需要提前创建，ETL 会自动建库并设置字符集。

```bash
# 4) 下载数据集到 raw/，约 45 MB
mkdir -p raw
curl -L -o raw/online_retail_ii.zip "https://archive.ics.uci.edu/static/public/502/online+retail+ii.zip"
unzip -o raw/online_retail_ii.zip -d raw/
# 得到 raw/online_retail_II.xlsx，脚本按这个名字读取，注意大小写

# 5) 构建数据仓库，首次约 5 到 10 分钟，主要耗时在装载 104 万行
python etl/build_dw.py

# 6) 启动服务
uvicorn api.main:app --port 8000
```

浏览器打开 `http://127.0.0.1:8000` 查看看板，
打开 `http://127.0.0.1:8000/docs` 查看可交互的接口文档。

### 验证

```bash
curl http://127.0.0.1:8000/api/health
# 期望返回 {"status":"ok","fact_rows":1038819}
```

### 常见问题

| 现象 | 原因 | 解决 |
|---|---|---|
| `Unknown database 'biz_analytics'` | 使用的是旧版脚本 | 新版 `load()` 会自动建库，确认 `etl/build_dw.py` 中有 `CREATE DATABASE IF NOT EXISTS` |
| `No module named uvicorn` | 依赖未装全 | 执行 `pip install -r requirements.txt` |
| 页面空白，KPI 全部显示为横线 | API 未启动或端口不一致 | 确认 uvicorn 正在运行，并检查 `index.html` 中的 `API` 常量与端口 |
| `BadZipFile: File is not a zip file` | `raw/` 中的 xlsx 是软链接而非真实文件 | 使用真实文件复制，不要创建符号链接 |
| 装载中断，报 `nan can not be used with MySQL` | NaN 无法直接写入 MySQL | 新版已用 `to_nullable_int()` 处理 |
| 装载报 `Duplicate entry ... for key 'dim_product.PRIMARY'` | 商品编码大小写未统一 | 新版已在 `clean()` 中统一转为大写 |

---

## API 一览

| 方法 | 路径 | 参数 | 说明 |
|---|---|---|---|
| GET | `/` | 无 | 返回看板页面 |
| GET | `/api/kpi` | 无 | 核心指标：gmv、orders、customers、aov、return_rate、line_count |
| GET | `/api/trend` | 无 | 月度趋势，25 条，含 month、gmv、orders、customers |
| GET | `/api/rfm` | 无 | RFM 六分层，含 segment、customers、avg_recency_days、avg_frequency、avg_monetary、total_gmv |
| GET | `/api/abc` | 无 | ABC 三类，含 abc_class、sku_count、gmv、gmv_share_pct |
| GET | `/api/pareto` | `top`，默认 30 | 头部商品累计占比，含 rn、stock_code、gmv、cum_pct |
| GET | `/api/top-products` | `limit`，默认 10 | GMV 排名靠前的商品，含 stock_code、description、gmv、qty、orders |
| GET | `/api/country` | `limit`，默认 10 | 国家分布，含 country、gmv、customers |
| GET | `/api/weekday` | 无 | 周内日均 GMV |
| GET | `/api/health` | 无 | 返回状态和事实表行数 |

示例：

```bash
$ curl -s http://127.0.0.1:8000/api/kpi
{"gmv":20533741.9,"orders":40077,"customers":5939,"aov":512.36,"return_rate":7.14,"line_count":1038819}

$ curl -s "http://127.0.0.1:8000/api/top-products?limit=3"
[{"stock_code":"22423","description":"REGENCY CAKESTAND 3 TIER","gmv":331084.27,"qty":26519,"orders":3918},
 {"stock_code":"85123A","description":"CREAM HANGING HEART T-LIGHT HOLDER","gmv":261509.93,"qty":94839,"orders":5464},
 {"stock_code":"85099B","description":"JUMBO BAG RED RETROSPOT","gmv":185566.47,"qty":98768,"orders":4013}]
```

---

## 工程实现要点

以下七处是实际遇到问题之后调整过的实现，与常见教程写法有所不同。

### 1. 全量重建而非增量更新

`load()` 会先删除再按 DDL 重建：

```python
conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
for t in ("fact_sales", "dim_date", "dim_product", "dim_customer"):
    conn.execute(text(f"DROP TABLE IF EXISTS {t}"))
conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
```

这样做的原因是表结构会随需求变化，例如后来新增了 `is_product` 字段。
全量重建可以保证库里的结构始终与 `schema.sql` 一致，
不会出现代码改了字段、库里还是旧结构的情况。代价是每次都要重跑，
在 100 万行量级下约 5 分钟，可以接受。

如果数据增长到千万级，应改为增量方式，
用 `ON DUPLICATE KEY UPDATE` 按 `invoice_no` 与 `line_no` 做幂等写入。

### 2. 批量插入提速

```python
fact.to_sql("fact_sales", engine, if_exists="append", index=False,
            chunksize=10000, method="multi")
```

`method="multi"` 会把多行拼成一条 `INSERT INTO ... VALUES (...), (...)` 语句，
比 pandas 默认的逐行插入快 5 到 10 倍，这是 104 万行能在几分钟内装完的主要原因。

### 3. 先建库再连库

```python
SERVER_URL = DB_URL.rsplit("/", 1)[0] + "/"   # 不带库名
server_engine = create_engine(SERVER_URL)
with server_engine.begin() as conn:
    conn.execute(text("CREATE DATABASE IF NOT EXISTS biz_analytics "
                      "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"))
```

`schema.sql` 中包含 `CREATE DATABASE`，但执行它必须先连上数据库，而库此时还不存在，
直接用带库名的连接串会连接失败。因此先用不带库名的连接串连到服务器建库，
再切换到带库名的连接串建表和装载。

### 4. NaN 转 NULL 的类型处理

```python
def to_nullable_int(series):
    numeric = pd.to_numeric(series, errors="coerce")
    return numeric.astype(object).where(numeric.notna(), None)
```

pandas 用 NaN 表示缺失，MySQL 只认 NULL。数值类型的列不能直接存 `None`，
会被强制转回 NaN，需要先用 `astype(object)` 承接。

同类问题还有 `df["country"].astype(str)`，它会把缺失值变成字符串 `"nan"` 而不是 NULL，
因此要改用 `astype(object).where(notna(), None)`。

### 5. ONLY_FULL_GROUP_BY 下的分组写法

MySQL 8 默认开启 `ONLY_FULL_GROUP_BY`，`SELECT` 中的非聚合列必须出现在 `GROUP BY` 里。
所以按月分组时写成：

```sql
group by d.year, d.month, d.month_name
```

不能只写 `month_name`。同理，在 `GROUP BY segment` 之后需要使用全局总额时，
要写成 `MAX(total_gmv)`。

### 6. 月份排序使用数字日期键

`month_name` 是 `2009-12`、`2010-03` 这类字符串，直接 `ORDER BY month_name` 会按字典序排列，
导致 `2010-10` 排在 `2010-02` 前面。正确做法是 `ORDER BY MIN(date_key)`，
用数字日期键排序。

### 7. 前端不引入构建工具

`web/index.html` 单文件包含 HTML、CSS 和 JavaScript，ECharts 通过 CDN 引入，
不需要 npm、webpack 或 vite。对于个人项目快速看到效果和方便部署来说，这种方案足够。
数据获取时先单独请求 KPI 接口，其余 7 个接口用 `Promise.all` 并发发出，
避免逐个串行等待，全页共涉及 8 个接口。

---

## 踩过的坑

以下问题都在开发过程中真实出现过，并已在当前代码中修复。

| 序号 | 现象 | 原因 | 处理 |
|---|---|---|---|
| 1 | `nan can not be used with MySQL` | pymysql 无法序列化 `float('nan')` | 增加 `to_nullable_int()`，配合 `astype(object)` 转换 |
| 2 | `Duplicate entry '15056bl' for key 'dim_product.PRIMARY'` | 同一 SKU 存在大小写两种写法，而 MySQL 排序规则不区分大小写，导致主键冲突 | 在 `clean()` 中统一转为大写并去除首尾空格 |
| 3 | 帕累托图第一名是 `POST`（邮费） | 虚拟编码混入了商品分析 | 新增 `is_product` 标记，商品类查询统一加上该条件 |
| 4 | 报错提示 `near 'lines'` 语法错误 | `lines` 是 MySQL 8 保留字 | 列别名改为 `line_count`，API 与前端同步修改 |
| 5 | `Unknown database 'biz_analytics'` | 手工删库后，`load()` 用带库名的连接串连库，连不上就无法建库 | 改用 `SERVER_URL` 先建库，见工程实现要点第 3 条 |
| 6 | `BadZipFile: File is not a zip file` | `raw/` 中的 xlsx 是软链接 | 改为使用真实文件 |
| 7 | 月度趋势图月份顺序错乱 | `ORDER BY month_name` 按字典序排列 | 改为 `ORDER BY MIN(date_key)` |
| 8 | 运行 `api/main.py` 后没有反应 | 文件只注册路由，没有 `uvicorn.run()` 入口 | 改用 `uvicorn api.main:app --port 8000` 启动 |

---

## 目录结构

```
ecommerce-analytics/
├── .env.example            # 连接串模板，复制为 .env 使用
├── .gitattributes          # 统一换行符，避免 Windows 提交时污染
├── .gitignore
├── LICENSE                 # MIT
├── README.md
├── requirements.txt
├── sql/
│   └── schema.sql          # 星型模型 DDL，4 张表加 4 个索引
├── etl/
│   └── build_dw.py         # ETL 全流程，extract、clean、build_dims、load
├── api/
│   └── main.py             # FastAPI，10 个接口
├── web/
│   └── index.html          # ECharts 看板，单文件零构建
└── docs/
    ├── CHANGELOG.md        # 版本记录
    └── images/             # README 配图
```

原始数据文件 `raw/online_retail_II.xlsx` 不纳入版本控制，需按快速开始一节自行下载。

---

## 数据来源与许可

数据集来自 [UCI Machine Learning Repository — Online Retail II](https://archive.ics.uci.edu/dataset/502/online+retail+ii)，
由一家英国在线零售商在 2009-12-01 至 2011-12-09 期间的真实交易记录构成，
主营礼品和家居小商品。

原始数据已脱敏，不包含客户姓名、地址、联系方式等个人信息，仅保留匿名的 `Customer ID`，
用于学习与研究。
