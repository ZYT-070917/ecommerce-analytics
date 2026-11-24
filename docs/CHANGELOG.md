# 更新日志

本项目所有变更记录在此文件。

格式参考 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **关于版本号**：本项目为个人作品集项目，尚未正式发版。
> `1.0.0` 指"功能完整、可端到端运行"的第一个可用版本；此后按下方规则递增
> （`1.0.x` 为缺陷修复，`1.x.0` 为新增分析模型/接口）。

---

## [Unreleased]

### 计划中

- **同期群分析（Cohort）**：按客户首购月份分组，追踪各队列的留存率与复购曲线
- **同比 / 环比归因拆解**：GMV 变化拆解为"客户数 × 客单价"或"流量 × 转化 × 客单"的贡献度
- **购物篮关联分析**：`Apriori` / 支持度-置信度，找常一起购买的商品组合用于搭配推荐
- **增量 ETL 调度**：用 `APScheduler` 每日增量更新，配合 `ON DUPLICATE KEY UPDATE` 做幂等 upsert
- **销售预测**：基于月度序列做简单时序预测（移动平均 / 指数平滑）
- **部署上线**：容器化并部署到 Render / Railway，提供公网可访问链接

### 待补充

- 业务分析报告的独立文档，把核心结论扩展成完整分析报告
- 自动化测试，当前没有测试用例，数据校验依靠人工核对

---

## [1.0.1] — 2026-11-24

> **修订版本（Z +1）**：仅修复缺陷与展示错误，**无新增接口、无表结构变更**。
> 前端与 API 调用方式完全不变，升级只需重跑一次 ETL。

### 修复 Fixed

#### 1. 两个 sheet 日期重叠导致重复计数（数据准确性）

- **现象**：月度趋势里 2010-12 出现反常尖峰 —— GMV £1,262,598 但只有 1,559 个订单，
  客单价 £810，而邻月为 £535。
- **根因**：Online Retail II 第一个 sheet 覆盖到 2010-12-09，第二个从 2010-12-01 开始，
  两段有 **9 天重叠**。`extract()` 直接 `pd.concat(sheets.values())`，这 9 天被读两遍。
- **证据**：22,345 行重复明细，归为 22,025 组，两次出现的 `sales_id` 间隔全部落在 20,000 至 25,000
  之间，即第一个 sheet 尾部与第二个 sheet 头部，且重复行全部集中在 2010-12-01 至 09。
- **修复**：改动位置为 `etl/build_dw.py` 中的 `extract()`，第二个及以后的 sheet 只保留
  第一个 sheet 最后一天之后的行。没有使用整体 `drop_duplicates`，
  因为同一订单里同商品买两次属于合法业务数据，这类合法重复仍有 11,806 行，必须保留。
- **结果**：行数由 1,061,164 降为 1,038,819；GMV 由 £20,972,595 降为 £20,533,742，降幅 2.09%；
  2010-12 回落到 £823,746，客单价 £528，与邻月一致。

#### 2. 金额币种纠正，由 ¥ 改为 £

- 数据源是英国在线零售商，`Price` 单位为**英镑**。此前看板 `money()` 与 README
  统一按 `¥` 渲染，属于单位错配。
- **修复**：`web/index.html` 的 `money()` 改为 `£`，README 中 25 处金额同步更新。

#### 3. 退货率不再假设退货数量为负

- **根因**：`/api/kpi` 用 `-SUM(退货金额) / SUM(正向金额)`，隐含假设退货行 `quantity` 均为负数。
  一旦数据里出现正数量的退货单，退货率会被算成负值。
- **修复**：改为 `ABS(SUM(退货金额)) / SUM(正向金额)`，对符号不敏感。
- **结果**：退货率由 7.28% 降为 7.14%。

### 变更 Changed

- **README 全部指标重算**：核心结论一节的 GMV、AOV、RFM、ABC、周内分布、国家分布，
  以及 Top 商品示例、`/api/kpi` 示例响应，全部按去重后的数据更新。
- **README 数据清洗规则**新增一行，说明如何裁掉两个 sheet 的 9 天重叠。
- **已知问题**：游客订单统计更新为 229,328 行 / 3,499 单 / £310.2 万 / 占总 GMV 15.1%。

### 升级步骤 Upgrade

```bash
python etl/build_dw.py                          # 重跑 ETL，约 4~5 分钟
uvicorn api.main:app --reload --port 8000       # 重启服务
```

### 影响面 Impact

| 项目 | 影响 |
|---|---|
| 数据库表结构 | 无变化 |
| API 接口签名 | 无变化 |
| 前端 | 仅货币符号由 `¥` 改为 `£` |
| 数据 | 事实表 −22,345 行（重叠重复），GMV −2.09% |

---

## [1.0.0] — 2026-10-27

首个功能完整版本，ETL、数据仓库、API、可视化看板全链路跑通。

### 新增 Added

#### 数据仓库（`sql/schema.sql`）

- 星型模型四表结构：`fact_sales`（事实）+ `dim_customer` / `dim_product` / `dim_date`（维度）
- 事实表在 `date_key` / `customer_id` / `stock_code` / `invoice_no` 上建立 4 个索引
- 统一字符集 `utf8mb4` + 排序规则 `utf8mb4_unicode_ci`
- 事实表新增两个分析标记位：
  - `is_return`：区分退货/取消单（`Invoice` 以 `C` 开头）
  - `is_product`：区分真实商品与邮费/手续费/礼品券等虚拟编码

#### ETL 流程（`etl/build_dw.py`，208 行，1.0.1 修复后为 217 行）

- `extract()`：一次性读取 Excel 全部 sheet 并合并（`sheet_name=None`）
- `clean()`：11 条清洗规则，详见 README 的数据清洗规则一节，含派生字段
  `amount` / `date_key` / `line_no` / `is_return` / `is_product` / `is_guest`
- `build_dims()`：构建三个维度表，日期维度覆盖完整时间轴（739 天，无空洞）
- `load()`：全量重建策略 —— 先 `DROP` 再按 DDL 重建，最后批量装载
- 装载性能优化：`method="multi"` + `chunksize=10000`，比逐行插入快 5~10 倍
- 装载结果：事实表 **1,061,164** 行，全流程约 5 分钟

#### 分析 API（`api/main.py`，232 行）

- FastAPI 应用，挂载静态目录，自动生成 Swagger 文档（`/docs`）
- 10 个接口：
  `GET /`、`/api/kpi`、`/api/trend`、`/api/rfm`、`/api/abc`、`/api/pareto`、
  `/api/top-products`、`/api/country`、`/api/weekday`、`/api/health`
- 统一查询助手 `q()`：SQLAlchemy 连接 + `pandas.read_sql` + 转 `list[dict]`
- 连接池启用 `pool_pre_ping`，避免长连接失效

#### 可视化看板（`web/index.html`，287 行）

- 单文件零构建（HTML + CSS + JS + CDN 引入 ECharts）
- 6 个 KPI 卡片：GMV / 订单数 / 活跃客户 / 客单价 / 退货率 / 明细行数
- 7 张图表：月度趋势（双 Y 轴）、RFM 分层、ABC 结构、国家 Top10、周内日均、商品 Top10、帕累托曲线
- 2 张明细表：RFM 分层明细、ABC 分类明细
- 先请求 KPI 接口，再用 `Promise.all` 并发请求其余 7 个接口，全页共涉及 8 个接口
- 响应式网格布局（`.g-2` / `.g-3` / `.g-11`）

#### 分析模型

- **RFM 客户分层**：`NTILE(5)` 五分位打分，划分为 6 类客户，分别为重要价值、重要保持、重要挽留、新客户、流失、一般
- **ABC 商品分类**：累计 GMV 贡献 80% / 95% 为界，划分 A / B / C 三类
- **帕累托分析**：头部商品累计贡献曲线

### 修复 Fixed

按发生顺序记录，均已在当前代码中修正：

1. **`nan can not be used with MySQL`**（装载中断）
   - 根因：pymysql 无法序列化 pandas 的 `float('nan')`
   - 修复：新增 `to_nullable_int()` 工具函数，`astype(object).where(notna(), None)` 把 NaN 转成真正的 `NULL`

2. **`Duplicate entry '15056bl' for key 'dim_product.PRIMARY'`**（装载中断）
   - 根因：同一 SKU 存在 `15056BL` / `15056bl` 两种写法；MySQL `utf8mb4_unicode_ci` 不区分大小写，
     两个变体被当作同一个主键，引发冲突
   - 修复：`clean()` 中对 `stock_code` 做 `.str.strip().str.upper()` 统一

3. **帕累托图与商品榜被邮费污染**
   - 现象：`POST`（邮费）、`M`（手工调整）、`GIFT_0001_xx`（礼品券）排进商品 Top 榜
   - 根因：这些虚拟编码金额不小，但混入商品维度分析会让 ABC 分类和帕累托曲线失真
   - 修复：新增 `is_product` 标记（12 个固定编码 + `GIFT_0001` 前缀），
     所有商品维度查询加 `AND f.is_product = 1`；维度表 `dim_product` 只收真实商品

4. **`(1064, ... You have an error ... near 'lines')`**
   - 根因：`lines` 是 MySQL 8 保留字，作为列别名触发语法错误
   - 修复：别名改为 `line_count`，API 返回字段与前端 `k-lines` 读取逻辑同步修改

5. **`(1049, "Unknown database 'biz_analytics'")`**（首次运行/删库后必现）
   - 根因：`load()` 用带库名的 `DB_URL` 建立连接，但库不存在时连接直接失败；
     而 `CREATE DATABASE` 写在 `schema.sql` 里，需要先连上库才能执行，形成死循环
   - 修复：`load()` 开头新增三步，先用不带库名的 `SERVER_URL` 连到服务器，执行
     `CREATE DATABASE IF NOT EXISTS`，再 dispose 该连接，之后切换到 `DB_URL` 建表装载
   - 效果：用户手删数据库后仍可一键重跑，无需手动建库

6. **月度趋势月份排序错乱**
   - 现象：`2010-10` 排在 `2010-02` 前面
   - 根因：`month_name` 是 `'2009-12'` 形式的字符串，`ORDER BY` 走字典序
   - 修复：改为 `ORDER BY MIN(date_key)`，用数字日期键排序

7. **`BadZipFile: File is not a zip file`**（Windows 环境）
   - 根因：`raw/online_retail_II.xlsx` 是软链接而非真实文件，`openpyxl` 读取失败
   - 修复：改用真实文件复制，不使用符号链接
   - 说明：此项为环境问题，非代码缺陷，但已记录进 README 常见问题一节

### 优化 Changed

- `country` 字段缺失值处理：从 `astype(str)`（会把缺失变成字符串 `"nan"`）改为
  `astype(object).where(notna(), None)`，正确写入 `NULL`
- `quantity` / `price` / `amount` 列在装载前统一 `round(2)` 并按目标字段类型对齐
  （`stock_code` 截断为 VARCHAR(32)，`invoice_no` 截断为 VARCHAR(20)）
- 维度表装载 `chunksize` 设为 5000，事实表 10000
- 日期维度用 `pd.date_range` 生成连续日期序列，保证无订单日也有行（趋势图不断点）
- 客户维度 `total_orders` 使用 `nunique` 而非 `count`，避免"订单内多行"被重复计数

### 已知问题 Known Issues

> 以下为**当前版本（1.0.1）**仍存在的问题，随修复逐条移出。

- **全量重建耗时长**：每次运行都要重装 104 万行（约 5 分钟），数据量再涨需要改增量方案
- **无鉴权**：API 无任何认证，仅适合本地运行，不能直接公网暴露
- **无分页**：`/api/top-products`、`/api/country` 用 `LIMIT` 参数控制，但没有分页游标
- **RFM 季节性偏差**：`recency` 以数据最后一天（2011-12-09）为基准，
  若数据窗口末端有淡季，会系统性地让更多客户被判为"流失"
- **游客订单未纳入客户分析**：**229,328 行**（3,499 个订单，GMV 约 **£310.2 万**，占总 GMV 的 15.1%）
  无 `customer_id`，计入 GMV 但不参与 RFM，
  因此"客户数 × 客单价"与总 GMV 不构成严格的等式关系
- **仅支持全量刷新**：无增量/调度机制，需手动重跑 ETL

---

## 版本说明

| 版本 | 日期 | 状态 | 说明 |
|---|---|---|---|
| 1.0.1 | 2026-11-24 | 可用 | 修复重复计数 / 币种 / 退货率，指标全部重算 |
| 1.0.0 | 2026-10-27 | 可用 | 全链路跑通，覆盖 8 个业务问题 |

### 版本号规则

- **主版本号（X）**：数据结构不兼容变更（如事实表主键调整、表结构大改）
- **次版本号（Y）**：新增分析模型或新接口（向后兼容）
- **修订号（Z）**：Bug 修复、代码优化、文案调整（不影响接口）

---

## 附：变更类型说明

| 类型 | 含义 |
|---|---|
| **新增 Added** | 新功能、新文件、新接口 |
| **修改 Changed** | 已有功能的调整（行为变化） |
| **弃用 Deprecated** | 即将移除的功能 |
| **移除 Removed** | 已删除的功能 |
| **修复 Fixed** | Bug 修复 |
| **安全 Security** | 安全相关修复 |
