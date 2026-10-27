# SQL 闯关：从零到能讲 RFM（配 DataGrip 练习）

> 说明：题目全部基于你项目里的 `biz_analytics` 库（真实 106 万行数据）。
> 每题都给了**参考答案 + 实际运行结果**，做完自己核对。答案在最后，别先看。
> 建议节奏：L1 半小时，L2 一小时，L3 一小时，L4 两小时，L5 一小时。分两次做完。

---

## 开始之前：DataGrip 连上数据库（5 分钟）

1. 打开 DataGrip → 左上 `+` → `数据源` → `MySQL`
2. 填：
   - 主机 `localhost`，端口 `3306`
   - 用户 `root`，密码（你自己那个）
   - 数据库 `biz_analytics`
3. 提示缺驱动 → 点 `下载` → `测试连接` → 成功后 `确定`
4. 左侧会出现 `biz_analytics` → 展开 `public` 能看到 4 张表

**小技巧**：
- 打开一个 SQL 编辑器：右键数据库 → `新建` → `查询控制台`（`Ctrl+Shift+Q` 也行）
- 执行语句：光标放在那条语句上，按 `Ctrl+Enter`（只执行当前语句，不用全选）
- 自动补全表名/字段名：输入 `fact_` 会弹出 `fact_sales`，按 Tab 补全
- `Ctrl+B` 跳到表定义，能看到字段类型和索引

**先认识这 4 张表**（这个必须背下来，后面全靠它）：

| 表 | 类型 | 主键 | 关键字段 |
|---|---|---|---|
| `fact_sales` | 事实表，106 万行 | `sales_id` | invoice_no（订单号）、stock_code（商品）、customer_id（客户）、date_key（日期）、quantity、price、amount（金额）、**is_return**（1=退货）、**is_product**（1=真实商品）、country |
| `dim_customer` | 维度，5,939 行 | `customer_id` | country、first_order_date、last_order_date、total_orders、total_amount |
| `dim_product` | 维度，4,741 行 | `stock_code` | description（商品名）、avg_price |
| `dim_date` | 维度，739 行 | `date_key` | full_date、year、month、month_name（如 2009-12）、weekday（1=周一…7=周日）、is_weekend |

⚠️ **两个必须记住的过滤条件**（忘了就全错）：
- 算销售额 → 一定加 `WHERE is_return = 0`（排除退货单）
- 算商品分析 → 一定加 `AND is_product = 1`（排除邮费/手工调整）

---

# L1 热身：认识数据

### L1-1 数一数每张表有多少行

要求：一个查询同时输出 4 张表的行数（提示：`UNION ALL`）。

### L1-2 看看事实表长什么样

要求：查 `fact_sales` 前 5 行，所有字段都看。

**看完回答**：`amount` 和 `quantity * price` 是什么关系？`is_return` 和 `is_product` 分别是什么值？

### L1-3 找出所有"非商品项"

要求：从 `fact_sales` 里查出所有 `is_product = 0` 的记录，**去重**列出它们的 `stock_code`（提示：`DISTINCT`）。

**看完回答**：这些编码分别代表什么？（答：M=手工调整、DOT/POST=邮费、BANK CHARGES=银行手续费、GIFT_0001=礼品券）

---

# L2 基础聚合：这四句话必须会写

### L2-1 全期总 GMV（排除退货）

提示：`SUM(amount)` + `WHERE is_return = 0`

### L2-2 一共有多少笔订单

提示：一个订单有多行商品，所以要 `COUNT(DISTINCT invoice_no)`

### L2-3 客单价 AOV（平均每单金额）

提示：总 GMV ÷ 订单数。注意分母要用 `NULLIF(x, 0)` 防止除零。

### L2-4 退货金额占比（%）

提示：退货金额是负数，前面加负号变正。用 `SUM(CASE WHEN ... THEN ... END)` 分别算退货额和正销售额。

### L2-5 哪个国家卖得最好？Top 5

提示：`GROUP BY country ORDER BY SUM(amount) DESC LIMIT 5`

### L2-6 按月看 GMV 趋势（前 5 个月）

提示：要 `JOIN dim_date` 拿 `month_name`。注意排序别用 `month_name`（字符串排序会错），用 `MIN(date_key)`。

---

# L3 分组进阶：`GROUP BY` + `HAVING` + `JOIN`

### L3-1 一周里哪天生意最好？

要求：按 `weekday`（1-7）分组，算**日均 GMV**（不是总 GMV，因为各星期天数不一样）。
提示：日均 = `SUM(amount) / COUNT(DISTINCT full_date)`

**别忘了把 1-7 翻译成"周一"到"周日"**（提示：`CASE WHEN` 或 `ELT`）。

### L3-2 哪个国家的客单价最高？（只看订单数 ≥ 100 的国家）

提示：`HAVING COUNT(DISTINCT invoice_no) >= 100`

### L3-3 卖得最好的 10 个商品（要显示商品名）

提示：`JOIN dim_product` 拿 `description`。注意过滤 `is_product = 1`。

### L3-4 每月有多少活跃客户？（前 5 个月）

提示：`COUNT(DISTINCT customer_id)`，并且 `customer_id IS NOT NULL`（游客不算）。

---

# L4 窗口函数：面试必考区

> 窗口函数的核心：**在保留每一行的同时，额外算出一个跨行的值**。
> `GROUP BY` 会把多行压成一行，窗口函数不会。

### L4-1 消费最高的 5 个客户，并给出名次

提示：`RANK() OVER (ORDER BY SUM(amount) DESC)`
注意：`GROUP BY` 之后才能用 `RANK()`，它的 `ORDER BY` 里可以写聚合函数。

### L4-2 帕累托：Top 10 商品各占多少累计百分比

要求输出：`rn`（排名）、`stock_code`、`gmv`、`累计占比%`
提示：
```sql
sum(gmv) over (order by gmv desc)  -- 累计求和（第1行=第1名，第2行=前2名之和…）
sum(gmv) over ()                    -- 全局总和（每行都是同一个总数）
cum / total * 100                   -- 累计占比
```

**关键理解**：带 `ORDER BY` 的 `SUM` 是**累计**，不带的是**全局**。这是窗口函数最容易考的点。

### L4-3 把客户按消费额分三档

要求：≥1 万 = 高价值，1 千~1 万 = 中价值，<1 千 = 低价值。统计每档人数和总 GMV。
提示：用 `WITH` 先算出每个客户的总消费，再 `CASE WHEN` 分档，最后 `GROUP BY 档位`。

---

# L5 综合应用：把这个项目最值钱的两个模型自己写出来

### L5-1 RFM 客户分层（完整实现）

这是项目里 `/api/rfm` 接口的 SQL，你自己写一遍。

**三步**：
1. `WITH base AS (...)`：算每个客户的 R（距最后一天多少天）、F（买了几次）、M（花了多少钱）
2. `WITH scored AS (...)`：用 `NTILE(5)` 把三项各分成 5 档打分（1-5）
3. 主查询：用 `CASE WHEN` 按分数组合分成 6 类

提示：
```sql
datediff((select max(full_date) from dim_date), max(d.full_date))  -- Recency
ntile(5) over (order by recency desc)   -- R 分数：注意是 desc（越近分越高）
ntile(5) over (order by frequency)      -- F 分数
ntile(5) over (order by monetary)       -- M 分数
```

**写完必答**：为什么 R 用 `DESC`，F 和 M 不用？（答：recency 是"多少天没买"，天数**越小**越好，所以要倒序排让天数小的排后面拿高分）

### L5-2 ABC 商品分类

要求：按 GMV 降序累计，累计到 80% 的是 A 类，80-95% 是 B 类，其余 C 类。统计每类的 SKU 数、GMV、GMV 占比。

提示：和 L4-2 同一个套路，只是最后用 `CASE WHEN` 分类再 `GROUP BY`。

**写完必答**：A 类商品只占全部商品的百分之多少？说明什么业务结论？

---

# 参考答案（做完再看）

> 以下所有结果都是我在这份真实数据上跑出来的，你的结果应该完全一致。

### L1-1
```sql
select 'fact_sales' as 表名, count(*) as 行数 from fact_sales
union all select 'dim_customer', count(*) from dim_customer
union all select 'dim_product', count(*) from dim_product
union all select 'dim_date', count(*) from dim_date;
```
| 表名 | 行数 |
|---|---|
| fact_sales | 1,061,164 |
| dim_customer | 5,939 |
| dim_product | 4,741 |
| dim_date | 739 |

### L1-2
```sql
select * from fact_sales order by sales_id limit 5;
```
看到 `amount = quantity * price`（如 12 × 6.95 = 83.4），`is_return` 和 `is_product` 都是 0/1 标记。

### L1-3
```sql
select distinct stock_code from fact_sales where is_product = 0;
```
结果包含 `M`、`DOT`、`POST`、`BANK CHARGES`、`AMAZONFEE`、`CRUK`、`PADS`、`GIFT_0001_xx` 等。

### L2-1
```sql
select round(sum(amount), 2) as gmv from fact_sales where is_return = 0;
```
**20,972,594.55**

### L2-2
```sql
select count(distinct invoice_no) as 订单数 from fact_sales where is_return = 0;
```
**40,077**

### L2-3
```sql
select round(sum(amount) / nullif(count(distinct invoice_no), 0), 2) as aov
from fact_sales where is_return = 0;
```
**523.31**

### L2-4
```sql
select round(-sum(case when is_return = 1 then amount end)
             / sum(case when is_return = 0 then amount end) * 100, 2) as 退货率
from fact_sales;
```
**7.28** (%)
（`SUM(CASE WHEN...)` 里不满足条件的行返回 NULL，SUM 会自动忽略——这是条件聚合的关键）

### L2-5
```sql
select country, round(sum(amount), 2) as gmv
from fact_sales where is_return = 0
group by country order by gmv desc limit 5;
```
| country | gmv |
|---|---|
| United Kingdom | 17,870,977.76 |
| EIRE | 664,431.78 |
| Netherlands | 554,232.34 |
| Germany | 431,262.46 |
| France | 356,944.60 |

**业务解读**：英国本土占 85%，是典型的"本地生意 + 少量出口"结构。

### L2-6
```sql
select d.month_name as 月份, round(sum(f.amount), 2) as gmv
from fact_sales f join dim_date d on d.date_key = f.date_key
where f.is_return = 0
group by d.year, d.month, d.month_name
order by min(d.date_key) limit 5;
```
| 月份 | gmv |
|---|---|
| 2009-12 | 825,685.76 |
| 2010-01 | 652,708.50 |
| 2010-02 | 553,339.73 |
| 2010-03 | 833,570.13 |
| 2010-04 | 681,528.99 |

**注意**：这里 `GROUP BY` 里同时写了 `year` 和 `month`，因为只有 `month_name` 的话，"2010-03" 和 "2011-03" 会被合并——这是 `GROUP BY` 最常见的坑。

### L3-1
```sql
select d.weekday as 星期几,
       round(sum(f.amount) / count(distinct d.full_date), 2) as 日均
from fact_sales f join dim_date d on d.date_key = f.date_key
where f.is_return = 0
group by d.weekday order by d.weekday;
```
| 星期 | 日均 |
|---|---|
| 1 周一 | 38,774.01 |
| 2 周二 | 40,248.68 |
| 3 周三 | 34,632.60 |
| 4 周四 | 41,809.63 |
| 5 周五 | 34,110.90 |
| 6 周六 | **9,803.05** |
| 7 周日 | 18,656.67 |

**业务解读**：周六日均只有周四的 1/4。因为客户主要是英国批发商（B2B），周末不上班。→ 结论：营销邮件要周四发，周末不用投预算。

### L3-2
```sql
select country, count(distinct invoice_no) as 订单数,
       round(sum(amount) / count(distinct invoice_no), 2) as aov
from fact_sales where is_return = 0
group by country having count(distinct invoice_no) >= 100
order by aov desc limit 5;
```
| country | 订单数 | aov |
|---|---|---|
| Netherlands | 228 | 2,430.84 |
| EIRE | 626 | 1,061.39 |
| Sweden | 105 | 875.27 |
| Spain | 154 | 708.95 |
| France | 622 | 573.87 |

**业务解读**：荷兰只有 228 单，但客单价是英国的 4 倍多——少数大客户做批发。这类客户最值得单独维护。

### L3-3
```sql
select f.stock_code, max(p.description) as 商品名,
       round(sum(f.amount), 2) as gmv, sum(f.quantity) as 销量
from fact_sales f left join dim_product p on p.stock_code = f.stock_code
where f.is_return = 0 and f.is_product = 1
group by f.stock_code order by gmv desc limit 10;
```
| 商品编码 | 商品名 | GMV | 销量 |
|---|---|---|---|
| 22423 | REGENCY CAKESTAND 3 TIER | 344,563.25 | 27,577 |
| 85123A | CREAM HANGING HEART T-LIGHT HOLDER | 267,102.06 | 96,744 |
| 85099B | JUMBO BAG RED RETROSPOT | 185,566.47 | 98,768 |
| 23843 | PAPER CRAFT , LITTLE BIRDIE | 168,469.60 | 80,995 |
| 47566 | PARTY BUNTING | 149,187.05 | 28,378 |

**注意 `MAX(p.description)`**：因为 `GROUP BY` 只按 stock_code 分组，`description` 不在分组字段里，标准 SQL 要求对它用聚合函数。`MAX` 在这里只是"任取一个"，因为一个编码只有一个名字。

### L3-4
```sql
select d.month_name as 月份, count(distinct f.customer_id) as 客户数
from fact_sales f join dim_date d on d.date_key = f.date_key
where f.is_return = 0 and f.customer_id is not null
group by d.year, d.month, d.month_name
order by min(d.date_key) limit 5;
```
| 月份 | 客户数 |
|---|---|
| 2009-12 | 955 |
| 2010-01 | 720 |
| 2010-02 | 772 |
| 2010-03 | 1,057 |
| 2010-04 | 942 |

### L4-1
```sql
select customer_id, round(sum(amount), 2) as gmv,
       rank() over (order by sum(amount) desc) as 名次
from fact_sales where is_return = 0 and customer_id is not null
group by customer_id limit 5;
```
| customer_id | gmv | 名次 |
|---|---|---|
| 18102 | 608,821.65 | 1 |
| 14646 | 528,602.52 | 2 |
| 14156 | 313,946.37 | 3 |
| 14911 | 295,972.63 | 4 |
| 17450 | 246,973.09 | 5 |

**注意执行顺序**：`FROM → WHERE → GROUP BY → 窗口函数 → ORDER BY → LIMIT`。窗口函数在 `GROUP BY` 之后执行，所以 `ORDER BY SUM(amount)` 是合法的。

### L4-2
```sql
with prod as (
    select stock_code, sum(amount) as gmv from fact_sales
    where is_return = 0 and is_product = 1 group by stock_code
), ranked as (
    select stock_code, gmv,
           row_number() over (order by gmv desc) as rn,
           sum(gmv) over (order by gmv desc) as cum,
           sum(gmv) over () as total
    from prod
)
select rn, stock_code, round(gmv, 2) as gmv,
       round(cum / total * 100, 2) as 累计占比
from ranked where rn <= 10 order by rn;
```
| rn | stock_code | gmv | 累计占比% |
|---|---|---|---|
| 1 | 22423 | 344,563.25 | 1.71 |
| 2 | 85123A | 267,102.06 | 3.04 |
| 3 | 85099B | 185,566.47 | 3.96 |
| ... | | | |
| 10 | 22197 | 80,920.64 | **8.04** |

**关键结论**：Top 10 商品只贡献 8.04% 的 GMV。说明这份数据**不是**"少数商品撑起全部"的结构——真正的帕累托在更长的尾部（后面 L5-2 会看到要 1,000+ 个商品才到 80%）。

### L4-3
```sql
with c as (
    select customer_id, sum(amount) as gmv from fact_sales
    where is_return = 0 and customer_id is not null group by customer_id
)
select case when gmv >= 10000 then '高价值(≥1万)'
            when gmv >= 1000  then '中价值(1千-1万)'
            else '低价值(<1千)' end as 档位,
       count(*) as 人数, round(sum(gmv), 2) as 合计GMV
from c group by 档位 order by 合计GMV desc;
```
| 档位 | 人数 | 合计GMV |
|---|---|---|
| 高价值(≥1万) | 267 | 8,958,557.75 |
| 中价值(1千-1万) | 2,480 | 7,463,526.40 |
| 低价值(<1千) | 3,131 | 1,321,345.01 |

**业务解读**：267 个客户（占 4.5%）贡献 43% 的 GMV。这是最需要维护的一批人。

### L5-1
```sql
with base as (
    select f.customer_id,
           datediff((select max(full_date) from dim_date), max(d.full_date)) as recency,
           count(distinct f.invoice_no) as frequency,
           sum(f.amount) as monetary
    from fact_sales f join dim_date d on d.date_key = f.date_key
    where f.is_return = 0 and f.customer_id is not null
    group by f.customer_id
), scored as (
    select *,
           ntile(5) over (order by recency desc) as r,
           ntile(5) over (order by frequency)    as f,
           ntile(5) over (order by monetary)     as m
    from base
)
select case when r >= 4 and f >= 4 and m >= 4 then '重要价值客户'
            when r >= 4 and f <= 2 then '新客户'
            when r <= 2 and f >= 4 and m >= 4 then '重要挽留客户'
            when r <= 2 and f <= 2 then '流失客户'
            when f >= 4 and m >= 4 then '重要保持客户'
            else '一般客户' end as 分层,
       count(*) as 人数, round(avg(monetary), 2) as 人均GMV
from scored group by 分层 order by 人数 desc;
```
| 分层 | 人数 | 人均GMV |
|---|---|---|
| 一般客户 | 2,004 | 1,039.40 |
| 流失客户 | 1,644 | 449.90 |
| 重要价值客户 | 1,345 | 9,081.16 |
| 重要保持客户 | 395 | 4,107.56 |
| 新客户 | 287 | 397.38 |
| 重要挽留客户 | 203 | 4,778.99 |

**为什么 R 用 DESC**：`NTILE(5) OVER (ORDER BY recency DESC)` 是"按 recency 从大到小排，前 1/5 给 1 分，最后 1/5 给 5 分"。recency 大 = 很久没买，所以给低分；recency 小 = 最近买过，排最后拿 5 分。**分数高 = 状态好**，这样三个指标方向一致，业务解释才通顺。

**业务解读**：重要挽留客户只有 203 人，但人均历史消费 4,779 元——曾经的大客户现在不来了，召回 ROI 最高。

### L5-2
```sql
with prod as (
    select stock_code, sum(amount) as gmv from fact_sales
    where is_return = 0 and is_product = 1 group by stock_code
), r as (
    select stock_code, gmv, sum(gmv) over (order by gmv desc) as cum,
           sum(gmv) over () as total from prod
)
select case when cum/total <= 0.8 then 'A类' when cum/total <= 0.95 then 'B类'
            else 'C类' end as 类别,
       count(*) as sku数, round(sum(gmv), 2) as gmv,
       round(sum(gmv)/max(total)*100, 2) as 占比
from r group by 类别 order by gmv desc;
```
| 类别 | SKU数 | GMV | 占比% |
|---|---|---|---|
| A类 | 1,025 | 16,093,195.17 | 79.99 |
| B类 | 1,261 | 3,020,259.53 | 15.01 |
| C类 | 2,441 | 1,006,566.53 | 5.00 |

**业务结论**：A 类 1,025 个 SKU 占全部商品（4,727 个）的 **21.7%**，贡献 80% GMV；C 类 2,441 个（51.6%）只贡献 5%。→ C 类商品占用一半的采购和库存精力，几乎不赚钱，应该考虑清仓或不再补货。

---

# 每条 SQL 都要能回答的 5 个问题（面试常追问）

学完 L5 后，随便挑一条你写过的 SQL，自问：

1. **为什么加 `WHERE is_return = 0`** —— 不加会把退货的负数金额算进去，GMV 偏低
2. **`COUNT(*)` 和 `COUNT(DISTINCT invoice_no)` 差在哪** —— 前者数行数（一单多行），后者数订单数
3. **`WHERE` 和 `HAVING` 的区别** —— `WHERE` 过滤原始行（分组前），`HAVING` 过滤分组结果（分组后）
4. **`SUM(...) OVER (ORDER BY ...)` 和 `SUM(...) OVER ()` 的区别** —— 累计 vs 全局
5. **`NTILE(5)` 是怎么分的** —— 按排序位置平均分 5 组，每组约 20% 的行

---

# 通关标志

- [ ] L1~L3 全部自己写出来，不看答案
- [ ] 能用一句话说清 `GROUP BY` 和窗口函数的区别
- [ ] L4-2 能解释"为什么 Top10 只占 8%"
- [ ] L5-1 能解释"为什么 R 用 DESC"
- [ ] L5-2 能给出 C 类商品的业务建议
- [ ] 能答出上面那 5 个追问

全部打勾，这个项目的数据库部分你就真的掌握了，面试问 SQL 也不虚。
