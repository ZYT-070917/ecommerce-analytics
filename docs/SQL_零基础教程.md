# SQL 零基础实操课

> 配套项目：`business-analytics`（电商经营分析平台）
>
> 数据库：`biz_analytics`，MySQL 8.0，真实数据 1,061,164 行

---

## 先读这一页：怎么用这份教材

**这份文档的写法**：你不需要"理解"，你只需要**照着敲、看结果、再回头理解**。

SQL 就是这样学的——先让屏幕上出现数据，再问"为什么"。

**每一章的结构**：

1. 【概念】用大白话讲这一章要学什么
2. 【照着敲】完整 SQL，你复制粘贴到 DataGrip 里执行
3. 【你应该看到】真实结果表格（我在这份数据上跑出来的）
4. 【解释】逐字解释这句 SQL 每个部分是什么意思
5. 【自己练】去掉答案，你独立写一遍

**重要提醒**：本教材所有结果都是真实跑出来的。

你得到的数字和我不一样，不用慌——先看最后那一章"常见错误对照表"。

**节奏建议**：第 1~~4 章是一天，第 5~~6 章是第二天。不要一口气看完，看不完的。

---

## 关于大小写（先看这段，能省掉很多困惑）

**SQL 关键字不区分大小写。** 下面三句完全等价，执行结果一模一样：

```sql
select * from fact_sales limit 5;
SELECT * FROM fact_sales LIMIT 5;
Select * From fact_sales Limit 5;
```

**本教材统一用小写**（`select` / `from` / `where`），因为读起来更松弛，也更接近现在的行业习惯。

**但有三件事要分清：**

| 对象                                | 是否区分大小写        | 你机器上的实际情况                                                        |
| --------------------------------- | -------------- | ---------------------------------------------------------------- |
| SQL 关键字（`select`/`from`/`where`…） | ❌ **永远不区分**    | 随便写                                                              |
| 表名、字段名                            | ⚠️ **取决于配置**   | 你的 MySQL `lower_case_table_names = 1` → **不区分**，`FACT_SALES` 也能跑 |
| 字符串里的值（`'United Kingdom'`）        | ⚠️ **取决于排序规则** | 你的库是 `utf8mb4_unicode_ci` → **不区分**，`'united kingdom'` 也能查出来     |

**所以你本地怎么大小写都能跑。但别依赖这个：**

生产服务器（尤其 Linux）上 `lower_case_table_names` 常常是 `0`，表名就会区分大小写——

你本地写 `Fact_Sales` 能跑，上线就报 `Table doesn't exist`。**习惯上永远按建表时的原样写。**

字符串值同理，虽然 `ci`（case insensitive）排序规则能模糊匹配，但按真实值写才是对的。

**你会在别处看到全大写的 SQL**（网上教程、公司老代码、很多教材）。那不是另一种语言，只是风格。

**看到大写不要慌，它就是同一句话。**

**面试如果被问"SQL 大小写敏感吗"**：

> "关键字不敏感。表名和字段名看 MySQL 的 `lower_case_table_names` 参数，Windows 默认 1 不敏感，Linux 默认 0 敏感。
>
> 字符串比较看排序规则，`_ci` 结尾的不区分大小写，`_bin` 或 `_cs` 的区分。"

这个回答能显示你真的用过。

---

# 第 0 章 数据库是什么（10 分钟）

## 0.1 一句话

**数据库 = 一堆 Excel 表格 + 一个特别快的查找引擎。**

你现在要操作的就是 4 张表。它们的名字叫：

```
fact_sales      106 万行   每一行 = 一笔交易明细（一个订单里的一种商品）
dim_customer     5,939 行  每一行 = 一个客户
dim_product      4,741 行  每一行 = 一种商品
dim_date           739 行  每一行 = 一天
```

> **为什么叫 fact 和 dim？**
>
> `fact` = 事实，记录"发生了什么"（谁、何时、买了什么、多少钱），行数最多。
>
> `dim` = dimension 维度，记录"这东西是什么"（客户的属性、商品的名字），行数少。
>
> 这种设计叫**星型模型**，面试常问。你可以先记住：**fact 存交易，dim 存属性**。

## 0.2 表长什么样

`fact_sales` 的 12 个字段（这叫"列"，column）：

| 字段名           | 中文意思          | 例子             | 类型  |
| ------------- | ------------- | -------------- | --- |
| `sales_id`    | 行号（自动编号）      | 1              | 数字  |
| `invoice_no`  | 订单号           | 489434         | 文本  |
| `line_no`     | 订单里第几行        | 1              | 数字  |
| `stock_code`  | 商品编码          | 85048          | 文本  |
| `customer_id` | 客户编号          | 13085          | 数字  |
| `date_key`    | 日期（数字格式）      | 20091201       | 数字  |
| `quantity`    | 数量            | 12             | 数字  |
| `price`       | 单价            | 6.95           | 小数  |
| `amount`      | 金额            | 83.40          | 小数  |
| `is_return`   | 是否退货：1=是，0=否  | 0              | 0/1 |
| `is_product`  | 是否真商品：1=是，0=否 | 1              | 0/1 |
| `country`     | 国家            | United Kingdom | 文本  |

**最需要记住的 3 件事**：

1. **一行不是一单，是一行商品。** 订单 489434 有 5 种商品 → 在表里是 5 行。所以"有多少订单"要专门去重（第 4 章讲）。
2. **退货的 `amount` 是负数。** 所以直接 `SUM(amount)` 会算错，必须过滤。
3. **`is_product = 0` 的是非商品。** 比如 `POST` 是邮费、`M` 是手工调整、`BANK CHARGES` 是银行手续费。算商品分析时必须排掉。

## 0.3 你现在就敲一句

在 DataGrip 里（连接方法见 1.1），敲这句，然后按 `Ctrl+Enter`（Mac 是 `Cmd+Enter`）：

```sql
select * from fact_sales limit 5;
```

**你会看到**：

| sales_id | invoice_no | line_no | stock_code | customer_id | date_key | quantity | price | amount | is_return | is_product | country        |
| -------- | ---------- | ------- | ---------- | ----------- | -------- | -------- | ----- | ------ | --------- | ---------- | -------------- |
| 1        | 489434     | 1       | 85048      | 13085       | 20091201 | 12       | 6.95  | 83.40  | 0         | 1          | United Kingdom |
| 2        | 489434     | 2       | 79323P     | 13085       | 20091201 | 12       | 6.75  | 81.00  | 0         | 1          | United Kingdom |
| 3        | 489434     | 3       | 79323W     | 13085       | 20091201 | 12       | 6.75  | 81.00  | 0         | 1          | United Kingdom |
| 4        | 489434     | 4       | 22041      | 13085       | 20091201 | 48       | 2.10  | 100.80 | 0         | 1          | United Kingdom |
| 5        | 489434     | 5       | 21232      | 13085       | 20091201 | 24       | 1.25  | 30.00  | 0         | 1          | United Kingdom |

**你看，你已经跑出第一句 SQL 了。**

---

# 第 1 章 DataGrip 全部操作（配图说明用文字代替）

你说你会连接数据库，那 1.1 快速过一眼就行，重点是 1.2 之后——**这些是新手真正卡住的地方**。

## 1.1 连接（你会的话跳过）

1. 左上角 `+` → `数据源` → `MySQL`
2. 主机 `localhost`，端口 `3306`，用户 `root`，密码（你自己设的）
3. 数据库填 `biz_analytics`
4. 提示缺驱动 → 点蓝色的 `下载`（Download）→ 等进度条走完
5. 点 `测试连接`（Test Connection）→ 出现绿色勾 → `确定`

左侧栏会多出一个叫 `biz_analytics` 的东西，点小三角展开，能看到 4 张表。

## 1.2 打开一个"写 SQL 的地方"

**关键概念**：DataGrip 里写 SQL 不是在某个固定窗口，你要**先开一个"控制台"**。

两种开法，任选：

- **方法 A**：右键左侧那个 `biz_analytics` 数据库 → `新建`（New）→ `查询控制台`（Query Console）
- **方法 B**：直接按快捷键 `Ctrl+Shift+Q`

打开后右边会出现一个空白的白色编辑区，顶部有一行字写着 `biz_analytics`——

**这一行很重要，它告诉 DataGrip "我在这个库里干活"**。如果它显示的是别的库名，说明你开错了，重新开。

## 1.3 执行 SQL：三种方式，别搞混

| 操作           | 快捷键                | 效果           | 什么时候用                  |
| ------------ | ------------------ | ------------ | ---------------------- |
| 执行**当前一条**语句 | `Ctrl+Enter`       | 只跑光标所在的那一句   | **最常用**，一个文件里写了很多句就用这个 |
| 执行**全部**语句   | `Ctrl+Shift+Enter` | 从头跑到尾，结果一条条出 | 少用，容易把练习全跑一遍           |
| 执行**选中的**部分  | 选中 + `Ctrl+Enter`  | 只跑高亮的那段      | 想测半句的时候                |

**新手最容易犯的错**：写了一句 SQL，鼠标点了一下别的地方，光标跑到空行了，然后按 `Ctrl+Enter` —— 什么都没发生。

**解决**：按之前先看一眼光标是不是停在那句 SQL 里面。

## 1.4 结果在哪里看

执行后，**下方**会出现一个叫 `服务输出` / `Result` 的表格区域（DataGrip 中文版通常叫"结果"）。

如果下方没出现，看屏幕右侧边缘有没有一个竖着的标签，或者按 `Alt+F12`（打开/关闭底部面板）。

结果表格的几个操作：

- **表格太宽看不到后面的列** → 底部有横向滚动条；或者右键表头 → `自适应列宽`（Auto-fit rows / columns）
- **想复制结果** → 点结果表格左上角那个小方块（全选）→ `Ctrl+C` → 粘到 Excel 里
- **结果行数** → 表格上方会显示 `1 行`、`100 行` 这样的字样

## 1.5 报错长什么样（先学会看报错）

如果你敲了一个错的 SQL，下方结果区会变红，出现类似：

```
[42000][1064] You have an error in your SQL syntax;
check the manual ... near 'FORM fact_sales' at line 1
```

**怎么看这个报错**：

| 部分                       | 意思                      |
| ------------------------ | ----------------------- |
| `[42000][1064]`          | 错误码，可以拿去搜索              |
| `near 'FORM fact_sales'` | **最有用**：它告诉你出错位置附近是这段文字 |
| `at line 1`              | 第 1 行出错                 |

上面这个例子：`FORM` 拼错了，应该是 `FROM`。**报错说 near 某个词，八成就是那个词写错了。**

## 1.6 三个救命功能

1. **自动补全**：输入 `fact_` 会弹出 `fact_sales`，按 `Tab` 或 `Enter` 补全。

   输入 `SEL` 会弹出 `SELECT`，按 `Tab`。

   **不要手打表名和字段名**，一律用补全，能省掉 90% 的拼写错误。
2. **`Ctrl+B`**：把光标放在表名上按，会跳到表的定义（能看到所有字段）。再按一次回来。

   **忘了字段叫什么就用这个。**
3. **格式化**：`Ctrl+Alt+L`。把乱七八糟的一行 SQL 排成漂亮的缩进格式。

   写完一定要按一下，让代码可读，也顺便检查有没有明显问题。

## 1.7 一个练习文件怎么建

**建议**：新建一个文件叫 `练习.sql`，先把这 6 章的练习都在这里写一遍，写错就改，写好就留着。

以后面试前回来跑一遍，就是复习。

DataGrip 里：右键项目树 → `新建` → `文件` → 输入 `练习.sql`。

---

# 第 2 章 第一条 SELECT：把数据"取出来"

## 2.1 概念

SQL 分成两大类，**你必须分清**：

| 类别     | 干什么     | 关键词                               | 危险程度    |
| ------ | ------- | --------------------------------- | ------- |
| **查询** | 把数据读出来看 | `SELECT`                          | 安全，随便跑  |
| **修改** | 改数据/改结构 | `INSERT` `UPDATE` `DELETE` `DROP` | 危险，能毁数据 |

**本教材 100% 只讲 `SELECT`。** 你练习时也只用 `SELECT`，永远不会弄坏东西。

`SELECT` 的固定句式（背下来）：

```text
select 要哪些列        ← 必填
from   从哪张表        ← 必填
where  满足什么条件    ← 可选（不写就取全部行）
order by 按什么排      ← 可选
limit  最多给我几行    ← 可选（但建议都加上，防卡死）
```

**子句顺序绝对不能变**。这是 SQL 最重要的规则之一。

写错顺序会直接报语法错误，比如把 `LIMIT` 写在 `WHERE` 前面就不行。

## 2.2 照着敲

### 练习 2-1 取全部列

```sql
select * from fact_sales limit 5;
```

`*` = 所有列。`LIMIT 5` = 只要 5 行。

**你应该看到**：第 0 章 0.3 那张表（5 行 12 列）。

**为什么要 `LIMIT`**：`fact_sales` 有 106 万行，不加 `LIMIT` 直接 `SELECT *`，

DataGrip 会尝试取全部 —— 卡死、内存爆、甚至把软件搞崩。**养成习惯：先 LIMIT，看清楚再说。**

### 练习 2-2 只要某几列

```sql
select invoice_no, stock_code, amount from fact_sales limit 5;
```

**你应该看到**：

| invoice_no | stock_code | amount |
| ---------- | ---------- | ------ |
| 489434     | 85048      | 83.40  |
| 489434     | 79323P     | 81.00  |
| 489434     | 79323W     | 81.00  |
| 489434     | 22041      | 100.80 |
| 489434     | 21232      | 30.00  |

**解释**：列名之间用**逗号**隔开。最后那个列名后面**不能有逗号**（这是新手 No.1 语法错误）。

错误示范：

```sql
select invoice_no, stock_code, amount, from fact_sales limit 5;
--                                        ↑ 这个逗号是多余
-- 报错：near 'FROM fact_sales' —— 又是"near 某词"，你就能立刻发现是 from 前面出问题了
```

### 练习 2-3 给列改名（AS）

```sql
select invoice_no as 订单号, amount as 金额 from fact_sales limit 3;
```

**你应该看到**：

| 订单号    | 金额    |
| ------ | ----- |
| 489434 | 83.40 |
| 489434 | 81.00 |
| 489434 | 81.00 |

**解释**：`AS` 后面是**别名**，只影响显示，不改数据库里的真名字。

列名可以是中文，不用加引号（加了也行）。

**这个特别有用**：后面算出来的列（比如 `SUM(amount)`）名字会很难看，用 `AS` 改个人话名字，结果表就好读了。

### 练习 2-4 跳过前几行（OFFSET）

```sql
select invoice_no, amount from fact_sales limit 5 offset 5;
```

**你应该看到**：

| invoice_no | amount      |
| ---------- | ----------- |
| 489434     | 39.60       |
| 489434     | 30.00<br /> |
| 489434     | 59.50       |
| 489435     | 30.60       |
| 489435     | 45.00       |

**解释**：`OFFSET 5` = 跳过前 5 行，从第 6 行开始取 `LIMIT 5` 行。

`LIMIT 5 OFFSET 5` 读法："要 5 行，从第 6 行开始"。

**注意一个坑**：`LIMIT` 不加 `ORDER BY` 时，返回的行顺序是**不确定的**（数据库爱怎么给怎么给）。

你要"前 5 名"这种有意义的顺序，必须写 `ORDER BY`——第 4 章讲。

## 2.3 自己练（不看上面，独立敲）

1. 从 `dim_customer` 取前 3 行所有列
2. 从 `fact_sales` 只取 `customer_id` 和 `country` 两列，只要前 10 行
3. 从 `dim_product` 取 `stock_code`（改名成 `编码`）和 `description`（改名成 `商品名`），前 5 行

<details>

<summary>点开看答案</summary>

```sql
-- 1
select * from dim_customer limit 3;

-- 2
select customer_id, country from fact_sales limit 10;

-- 3
select stock_code as 编码, description as 商品名 from dim_product limit 5;
```

</details>

---

# 第 3 章 WHERE：只要我想要的行

## 3.1 概念

`WHERE` 是**筛选**。你给一个条件，数据库只把**条件为真**的行给你。

打个比方：`SELECT * FROM fact_sales` 是"把 106 万行全搬出来"，

`WHERE country = 'United Kingdom'` 是"只要英国的"。

## 3.2 六个比较符号

| 符号          | 意思   | 例子                            |
| ----------- | ---- | ----------------------------- |
| `=`         | 等于   | `country = 'Germany'`         |
| `>`         | 大于   | `amount > 1000`               |
| `<`         | 小于   | `quantity < 10`               |
| `>=`        | 大于等于 | `amount >= 100`               |
| `<=`        | 小于等于 | `amount <= 50`                |
| `!=` 或 `<>` | 不等于  | `country != 'United Kingdom'` |


⚠️ **`=` 是一个等号，不是两个！** Python 里写 `==`，SQL 里写 `=`。

⚠️ **文本要加单引号**。`country = United Kingdom` ❌ → `country = 'United Kingdom'` ✅

数字不用加引号：`amount > 1000` ✅

⚠️ **大小写敏感问题**：这份数据里国家名是 `United Kingdom`（首字母大写），

你写 `'united kingdom'` 也能匹配上——因为 MySQL 默认排序规则不区分大小写。

**但不要依赖这个**，习惯上按数据库里的原样写（用 1.6 的补全功能就能看到真实值）。

## 3.3 练习：单个条件

### 练习 3-1

```sql
select country, amount from fact_sales where country = 'United Kingdom' limit 5;
```

**你应该看到**：5 行，`country` 全是 `United Kingdom`，`amount` 分别是 83.40 / 81.00 / 81.00 / 100.80 / 30.00。

### 练习 3-2

```sql
select invoice_no, amount from fact_sales where amount > 1000 limit 5;
```

**你应该看到**：

| invoice_no | amount  |
| ---------- | ------- |
| 489523     | 1160.00 |
| 489675     | 1104.00 |
| 489831     | 1008.00 |
| 489889     | 1224.00 |
| 490010     | 1008.00 |

**注意**：`amount > 1000` 没加引号（因为是数字）。加了引号 `'1000'` MySQL 也能跑，会偷偷转类型，但别这么写。

## 3.4 多个条件：AND / OR / NOT

| 关键词   | 意思     | 例子               |
| ----- | ------ | ---------------- |
| `AND` | 两个都要满足 | 英国 **且** 金额>1000 |
| `OR`  | 满足一个就行 | 德国 **或** 法国      |
| `NOT` | 取反     | **不是**英国的        |

### 练习 3-3 AND

```sql
select invoice_no, country, amount from fact_sales
where country = 'United Kingdom' and amount > 1000
limit 5;
```

**你应该看到**：

| invoice_no | country        | amount  |
| ---------- | -------------- | ------- |
| 489523     | United Kingdom | 1160.00 |
| 489675     | United Kingdom | 1104.00 |
| 490010     | United Kingdom | 1008.00 |
| 490018     | United Kingdom | 1080.00 |
| 490018     | United Kingdom | 1296.00 |

### 练习 3-4 OR

```sql
select invoice_no, country, amount from fact_sales
where country = 'Germany' or country = 'France'
limit 5;
```

**你应该看到**：前 5 行的 country 全是 `France`（因为数据是按订单顺序排的，法国订单排在德国前面）。

### 练习 3-5 IN：OR 的简写

上面那个 OR 写起来很啰嗦。三个国家就要写三个 OR。用 `IN` 就干净了：

```sql
select invoice_no, country from fact_sales
where country in ('Germany', 'France', 'Spain')
limit 5;
```

**你应该看到**：同样是前 5 行 France。

**记法**：`IN ('A','B','C')` 相当于 `= 'A' OR = 'B' OR = 'C'`，但短得多。

### ⚠️ AND 和 OR 混用的大坑

```sql
-- 你想要：英国 或 法国，且金额大于 1000
select * from fact_sales
where country = 'United Kingdom' or country = 'France' and amount > 1000
limit 10;
```

**这句是错的！** 因为 `AND` 的优先级比 `OR` 高，数据库会理解成：

```
country = 'United Kingdom'   OR   (country = 'France' AND amount > 1000)
```

结果：**所有英国的行都会被返回**，哪怕金额只有 1 块钱。

**正确写法：加括号**

```sql
select * from fact_sales
where (country = 'United Kingdom' or country = 'France') and amount > 1000
limit 10;
```

**规则：只要 WHERE 里同时有 AND 和 OR，就加括号。** 加了不会错，不加可能错。

### 练习 3-6 BETWEEN：区间

```sql
select invoice_no, quantity, amount from fact_sales
where amount BETWEEN 100 and 200
limit 5;
```

**你应该看到**：

| invoice_no | quantity | amount |
| ---------- | -------- | ------ |
| 489434     | 48       | 100.80 |
| 489436     | 24       | 102.00 |
| 489438     | 56       | 168.00 |
| 489438     | 56       | 168.00 |
| 489438     | 60       | 114.00 |

**解释**：`BETWEEN 100 AND 200` = `amount >= 100 AND amount <= 200`，**包含两端**。

### 练习 3-7 LIKE：模糊匹配

想找"名字里带 BAG 的商品"，不能用 `=`（因为名字很长）。用 `LIKE`：

```sql
select distinct f.stock_code, p.description
from fact_sales f
join dim_product p on f.stock_code = p.stock_code
where p.description LIKE '%BAG%'
limit 8;
```

**你应该看到**：

| stock_code | description                     |
| ---------- | ------------------------------- |
| 16151A     | FLOWERS HANDBAG blue and orange |
| 16162L     | THE KING GIFT BAG               |
| 16162M     | THE KING GIFT BAG 25x24x12cm    |
| 16168M     | FUNKY MONKEY GIFT BAG MEDIUM    |
| 16168S     | FUNKY MONKEY GIFT BAG SMALL     |
| 16207A     | PINK STRAWBERRY HANDBAG         |
| 16207B     | PINK HEART RED HANDBAG          |
| 16258A     | SWIRLY CIRCULAR RUBBERS IN BAG  |

**`LIKE` 的通配符**：

| 写法        | 意思           | 例子                       |
| --------- | ------------ | ------------------------ |
| `'%BAG%'` | 中间包含 BAG     | `HANDBAG`、`GIFT BAG` 都匹配 |
| `'BAG%'`  | **以** BAG 开头 | 只匹配 `BAG xxx`            |
| `'%BAG'`  | **以** BAG 结尾 | 只匹配 `xxx BAG`            |
| `'_AG'`   | `_` = 任意一个字符 | 匹配 `BAG`、`TAG`           |

**这句 SQL 有点超纲**（用了 `JOIN` 和 `DISTINCT`），第 4 章会讲。现在你只要知道 `LIKE` 怎么用就行。

先直接跑，看到效果最重要。

### 练习 3-8 IS NULL：判断空值

有些订单没有客户号（游客下单，`customer_id` 是空的）。

```sql
select count(*) as 有客户号的
from fact_sales where customer_id is not null;
```

**你应该看到**：`824293`

```sql
select count(*) as 没客户号的
from fact_sales where customer_id is null;
```

**你应该看到**：`236871`

⚠️ **千万不能写 `= NULL`**：

```sql
select count(*) from fact_sales where customer_id = null;  -- 结果是 0，永远为 0
```

**原因**：`NULL` 的意思是"不知道"。问"不知道等于不知道吗"——数据库不回答是，也不回答否，答案是"未知"，所以一行都不匹配。

**判断空值只能用 `IS NULL` / `IS NOT NULL`。** 这是面试常考的点。

## 3.5 一个巧妙的等号：把条件写成数字

```sql
select count(*) as 英国行数 from fact_sales where country = 'United Kingdom';
```

**你应该看到**：`975151`

**理解一下**：106 万行里有 97.5 万行是英国，占 92%。为什么这么高？

因为这份数据是一家**英国本土电商**（玩具/礼品批发），英国订单当然占绝大多数。

后面所有分析你都会看到这个"英国一家独大"的结构。

## 3.6 自己练

1. 找出所有 `quantity > 100` 的行，只要 `invoice_no`、`quantity`、`amount`，前 5 行
2. 找出 `country` 是 `Netherlands` 且 `amount > 500` 的行，前 5 行
3. 找出所有 `stock_code` 以 `84` 开头的商品（用 `LIKE`），只要 `stock_code`，**去重**，前 10 行

   （提示：`SELECT DISTINCT`）
4. 数一数有多少行的 `is_return = 1`（提示：`COUNT(*)` + `WHERE`）

<details>

<summary>点开看答案</summary>

```sql
-- 1
select invoice_no, quantity, amount from fact_sales
where quantity > 100 limit 5;

-- 2
select invoice_no, country, amount from fact_sales
where country = 'Netherlands' and amount > 500 limit 5;

-- 3
select distinct stock_code from fact_sales
where stock_code LIKE '84%' limit 10;

-- 4
select count(*) as 退货行数 from fact_sales where is_return = 1;
-- 结果：19494
```

</details>

---

# 第 4 章 聚合：把 106 万行变成 1 个数字

**这是整个 SQL 的分水岭。** 前面第 2、3 章都是"一行一行看"，这一章开始"一堆行合成一个结果"。

## 4.1 五个聚合函数

| 函数            | 意思         | 例子                                | 结果（这份数据）    |
| ------------- | ---------- | --------------------------------- | ----------- |
| `COUNT(*)`    | 数有多少行      | `SELECT COUNT(*) FROM fact_sales` | 1061164     |
| `COUNT(列名)`   | 数这一列有几个非空值 | `COUNT(customer_id)`              | 824293      |
| `SUM(列名)`     | 求和         | `SUM(amount)`                     | 19445926.69 |
| `AVG(列名)`     | 平均         | `AVG(amount)`                     | 20.13       |
| `MAX` / `MIN` | 最大 / 最小    | `MAX(amount)`                     | 168469.60   |

### 练习 4-1 ~ 4-4

```sql
-- 4-1 数行数
select count(*) as 总行数 from fact_sales;
```

**看到**：`1061164`

```sql
-- 4-2 求和
select sum(amount) as 总金额 from fact_sales;
```

**看到**：`19445926.69`

```sql
-- 4-3 一行里放多个聚合
select count(*) as 行数, sum(amount) as 合计,
       min(amount) as 最小, max(amount) as 最大
from fact_sales where is_return = 0;
```

**看到**：

| 行数      | 合计          | 最小   | 最大        |
| ------- | ----------- | ---- | --------- |
| 1041670 | 20972594.55 | 0.00 | 168469.60 |

```sql
-- 4-4 平均
select round(avg(amount), 2) as 平均每行金额
from fact_sales where is_return = 0;
```

**看到**：`20.13`

**`ROUND(数字, 2)`** = 保留 2 位小数。不加的话你会看到 `20.134342254782...` 这种一长串。

## 4.2 立刻发现一个坑：为什么总和变了？

对比一下 4-2 和 4-3：

- `SELECT SUM(amount) FROM fact_sales` → **19,445,926.69**
- `SELECT SUM(amount) FROM fact_sales WHERE is_return = 0` → **20,972,594.55**

**加了过滤反而更大了？** 因为退货金额是**负数**，把它算进来会**扣减**总额。

正确算法是：**真实销售额 = 只算 `is_return = 0` 的行**（20,972,594.55，这就是你项目首页那个 GMV）。

**所以规则一：算销售额，永远加 `WHERE is_return = 0`。**

## 4.3 GROUP BY：分组

`SUM(amount)` 给你一个总数。但你想知道"每个国家各卖了多少"怎么办？

**`GROUP BY country`** = 按国家分组，每组算一个 `SUM`。

### 练习 4-5

```sql
select country, round(sum(amount), 2) as gmv
from fact_sales
where is_return = 0
group by country
order by gmv desc
limit 5;
```

**你应该看到**：

| country        | gmv           |
| -------------- | ------------- |
| United Kingdom | 17,870,977.76 |
| EIRE           | 664,431.78    |
| Netherlands    | 554,232.34    |
| Germany        | 431,262.46    |
| France         | 356,944.60    |

**逐字解释**：

- `SELECT country, SUM(amount)` —— 我要国家，和每个国家的金额合计
- `FROM fact_sales` —— 从事实表
- `WHERE is_return = 0` —— 先排掉退货（**WHERE 在 GROUP BY 之前执行**）
- `GROUP BY country` —— 把剩下 104 万行按 `country` 分成若干堆，每堆算一次 `SUM`
- `ORDER BY gmv DESC` —— 按合计金额**从大到小**排（`DESC` = descending 降序；`ASC` = 升序，默认值）
- `LIMIT 5` —— 只要前 5 名

**这条 SQL 是后面所有分析的骨架。** 你现在写的所有"排行榜"，都是这个结构。

### 练习 4-6 升序

```sql
select country, round(sum(amount), 2) as gmv
from fact_sales where is_return = 0
group by country order by gmv asc limit 3;
```

**看到**：

| country      | gmv    |
| ------------ | ------ |
| Nigeria      | 140.39 |
| Saudi Arabia | 145.92 |
| West Indies  | 536.41 |

**业务解读**：尼日利亚全期只卖了 140 块。要么是刚开发的客户试单，要么是数据里的异常。这种"极小额国家"通常在分析时会被过滤掉。

### ⚠️ GROUP BY 的铁律

**`SELECT` 里的每一列，要么在 `GROUP BY` 里，要么被聚合函数包着。**

正确：

```sql
select country, sum(amount) from fact_sales group by country;   -- ✅
```

错误：

```sql
select country, sum(amount) from fact_sales;   -- ❌ 没有 group by
```

**报错原文**（我把这句真的跑了一次）：

```
(1140, "In aggregated query without GROUP BY, expression #1 of SELECT list
contains nonaggregated column 'biz_analytics.fact_sales.country';
this is incompatible with sql_mode=only_full_group_by")
```

翻译成人话：**"你说要 `country`，又说要 `SUM`，但没告诉我按什么分组，我不知道该给你哪个国家的名字。"**

记住这个报错，太常见了。看到 `only_full_group_by` 就知道：**忘写 `GROUP BY` 了**。

## 4.4 HAVING：对分组结果再筛

`WHERE` 是筛**行**（分组前）。如果想筛**分组**（比如"只要订单数超过 100 的国家"），就得用 `HAVING`。

### 练习 4-7

```sql
select country, count(*) as 行数
from fact_sales
group by country
having count(*) >= 50000
order by 行数 desc;
```

**你应该看到**：只有一行

| country        | 行数     |
| -------------- | ------ |
| United Kingdom | 975151 |

**为什么只有一行**：因为只有英国的行数超过 5 万，其他国家最多几万。

### WHERE vs HAVING 对照（面试必问）

|          | `WHERE`           | `HAVING`          |
| -------- | ----------------- | ----------------- |
| 作用对象     | 原始的每一行            | 分组后的每一组           |
| 执行时机     | `GROUP BY` **之前** | `GROUP BY` **之后** |
| 能不能用聚合函数 | ❌ 不能              | ✅ 可以              |
| 写法位置     | `FROM` 之后         | `GROUP BY` 之后     |

**一句话记法**：`WHERE` 管**行**，`HAVING` 管**组**；`HAVING` 里能写 `SUM`/`COUNT`，`WHERE` 里不能。

**性能提示**：能用 `WHERE` 就别用 `HAVING`。因为 `WHERE` 先执行，能早点把数据砍小，后面算得更快。

## 4.5 条件聚合：一招练成"多面手"

这是本教材**最实用的技巧**，学会它，很多复杂需求一句就能搞定。

### 练习 4-8

```sql
select round(sum(case when is_return = 0 then amount end), 2) as 销售额,
       round(-sum(case when is_return = 1 then amount end), 2) as 退货额,
       sum(case when is_return = 1 then 1 else 0 end) as 退货行数,
       sum(case when is_return = 0 then 1 else 0 end) as 销售行数
from fact_sales;
```


**你应该看到**：

| 销售额         | 退货额        | 退货行数  | 销售行数    |
| ----------- | ---------- | ----- | ------- |
| 20972594.55 | 1526667.86 | 19494 | 1041670 |

**这句在干什么**：

`CASE WHEN 条件 THEN 值 END` = 一个"如果……那么……"的表达式，它可以写在 `SUM` 里面：

```text
sum(case when is_return = 0 then amount end)
```

读法："对每一行，如果它是销售单，就把它的 amount 拿出来；如果是退货单，就什么都不拿（返回 NULL）。然后把这些拿出来的值加起来。"

**关键机制**：`CASE WHEN` 不满足条件时返回 `NULL`，而 `SUM` 会**自动跳过 NULL**。

所以这就等于"只对满足条件的行求和"，但**不用写 WHERE**。

**为什么要用这招**：因为用 `WHERE` 你只能算一个数（要么算销售额，要么算退货额），

用条件聚合，**一次查询就能同时算出两个数**。

**这就是"退货率"的计算原理**：分子是退货额，分母是销售额，必须一次拿到两个数才能相除。

### 用条件聚合算退货率

```sql
select round(-sum(case when is_return = 1 then amount end)
             / sum(case when is_return = 0 then amount end) * 100, 2) as 退货率百分数
from fact_sales;
```

**你应该看到**：`7.28`

**业务解读**：7.28% 的退货率。英国零售行业平均退货率在 5%~10%，这个水平属于正常。

如果超过 15% 就要查原因了（尺码不对？物流破损？描述不符？）。

## 4.6 DISTINCT：去重

一份订单有多个商品 → 表里多行。你想数"一共有多少订单"，直接 `COUNT(*)` 会数成行数。

**`COUNT(DISTINCT invoice_no)`** = "去重后数有几个不同的订单号"。

### 练习 4-9

```sql
select count(*) as 总行数,
       count(distinct invoice_no) as 订单数,
       count(distinct customer_id) as 客户数,
       count(distinct stock_code) as 商品数
from fact_sales
where is_return = 0;
```

**你应该看到**：

| 总行数     | 订单数   | 客户数  | 商品数  |
| ------- | ----- | ---- | ---- |
| 1041670 | 40077 | 5878 | 4745 |

**读懂这张表**：104 万行商品明细 → 只有 4 万个订单 → 平均每单 26 行商品。

5,878 个客户，平均每人下了 6.8 单。

**`DISTINCT` 也可以单独用**：

```sql
select distinct country from fact_sales order by country limit 10;
```

**看到**：Australia / Austria / Bahrain / Belgium / Bermuda / Brazil / Canada / Channel Islands / Cyprus / Czech Republic

## 4.7 客单价 AOV：两个聚合相除

```sql
select round(sum(amount) / nullif(count(distinct invoice_no), 0), 2) as aov
from fact_sales
where is_return = 0;
```

**你应该看到**：`523.31`

**业务解读**：平均每单 523 元。这是个批发商客户为主的数据，所以客单价高（普通零售电商可能只有 50~200 元）。

**`NULLIF(x, 0)` 是干什么的**：

如果 `COUNT(DISTINCT invoice_no)` 算出来是 0（比如某天完全没有订单），那么 `x / 0` 在 MySQL 里会返回 `NULL`，

但在某些数据库里会直接**报错**。`NULLIF(x, 0)` 的意思是"如果 x 等于 0，就把它变成 NULL"，

这样除法结果就是 NULL 而不会报错。

**什么时候需要**：当你做"按天算客单价"这种分组查询时，某一天可能真的 0 订单（比如圣诞节），

不写 `NULLIF` 就会在某一天突然报错，很难查。**养成习惯，除法分母都套 `NULLIF`。**

## 4.8 JOIN：把两张表连起来

`fact_sales` 里只有商品**编码** `85048`，没有商品**名字**。名字在 `dim_product` 里。

想看"卖得最好的商品叫什么"，就得把两张表**连起来**。

### 练习 4-11

```sql
select f.invoice_no, f.stock_code, p.description, f.amount
from fact_sales f
join dim_product p on f.stock_code = p.stock_code
where f.is_return = 0
limit 5;
```

**你应该看到**：

| invoice_no | stock_code | description                         | amount |
| ---------- | ---------- | ----------------------------------- | ------ |
| 489434     | 85048      | 15CM CHRISTMAS GLASS BALL 20 LIGHTS | 83.40  |
| 489434     | 79323P     | PINK CHERRY LIGHTS                  | 81.00  |
| 489434     | 79323W     | WHITE CHERRY LIGHTS                 | 81.00  |
| 489434     | 22041      | RECORD FRAME 7" SINGLE SIZE         | 100.80 |
| 489434     | 21232      | STRAWBERRY CERAMIC TRINKET POT      | 30.00  |

### 逐字拆解（这是本教材最需要看仔细的一段）

```text
from fact_sales f                             ← ① 主表，起个别名 f
join dim_product p                            ← ② 要连的表，别名 p
     on f.stock_code = p.stock_code           ← ③ 连接条件：两边的商品编码相等
```

**① 别名（`f` 和 `p`）**

写完表名后面加个空格加个字母，就是给表起小名。之后 `f.amount` 就是"fact_sales 的 amount"，

`p.description` 就是"dim_product 的 description"。

**为什么要别名**：两张表都有 `stock_code` 这一列。你写 `stock_code` 数据库不知道你说的是哪张表的。

写 `f.stock_code` 就清楚了。**表名一多，别名是必须的。**

**② `JOIN` 的思维模型**

想象两张表面对面摆在桌上：

```
fact_sales                         dim_product
stock_code | amount                stock_code | description
-----------+--------                -----------+------------------
85048      | 83.40                  85048      | 15CM CHRISTMAS...
79323P     | 81.00                  79323P     | PINK CHERRY LIGHTS
99999X     | 12.00                  22041      | RECORD FRAME...
```

`ON f.stock_code = p.stock_code` 就是："对左边每一行，去右边找编码相同的行，找到就拼在一起。"

结果：

```
stock_code | amount | description
-----------+--------+------------------
85048      | 83.40  | 15CM CHRISTMAS...
79323P     | 81.00  | PINK CHERRY LIGHTS
```

`99999X` 在右边**找不到**，所以它**消失了**。

**这就是 INNER JOIN 的本质：只保留两边都能对上的行。**

### 练习 4-12 JOIN 会丢行（很重要）

```sql
select (select count(*) from fact_sales f join dim_product p on f.stock_code = p.stock_code) as inner_join行数,
       (select count(*) from fact_sales f left join dim_product p on f.stock_code = p.stock_code) as left_join行数,
       count(*) as 事实表总行数
from fact_sales;
```

**你应该看到**：

| inner_join行数 | left_join行数 | 事实表总行数  |
| ------------ | ----------- | ------- |
| 1055371      | 1061164     | 1061164 |

**读这张表的关键**：

- 事实表 **1,061,164** 行
- INNER JOIN 后只剩 **1,055,371** 行 → **丢了 5,793 行**
- LEFT JOIN 后还是 **1,061,164** 行 → 一行没丢

**丢了什么**：`is_product = 0` 的那些行（`POST`、`M`、`BANK CHARGES` 等），它们在 `dim_product` 里没有对应记录。

**`LEFT JOIN` 是什么**：跟 `JOIN` 一样，但**左边的表所有行都保留**，右边找不到就填 `NULL`。

```text
left join dim_product p on f.stock_code = p.stock_code
```

结果里那 5,793 行的 `description` 是 `NULL`（空）。

**什么时候用哪个**：

| 你要什么              | 用哪个                                 |
| ----------------- | ----------------------------------- |
| 只要"两边都有"的数据       | `JOIN`（或写成 `INNER JOIN`）            |
| 左表全部保留，右表有就填、没有就空 | `LEFT JOIN`                         |
| 想知道"哪些数据在右表找不到"   | `LEFT JOIN` + `WHERE p.xxx IS NULL` |

**你项目里踩过的真实 bug**：一开始算商品 GMV 排行榜，`POST`（邮费）排在第一，

因为邮费金额大。后来加了 `is_product = 1` 才排掉。**这就是"非商品项"的由来。**

## 4.9 三表 JOIN + 日期维度

`dim_date` 里存了每一天的各种属性（年、月、星期几）。想看月度趋势，就得连它。

### 练习 4-13

```sql
select d.month_name as 月份, round(sum(f.amount), 2) as gmv
from fact_sales f
join dim_date d on d.date_key = f.date_key
where f.is_return = 0
group by d.year, d.month, d.month_name
order by min(d.date_key)
limit 6;
```

> 说明：`LIMIT` 和 `ORDER BY` 同时出现时，`ORDER BY` 先执行，所以会先排好序再取前 6 行。

**你应该看到**：

| 月份      | gmv       |
| ------- | --------- |
| 2009-12 | 825685.76 |
| 2010-01 | 652708.50 |
| 2010-02 | 553339.73 |
| 2010-03 | 833570.13 |
| 2010-04 | 681528.99 |
| 2010-05 | 659858.86 |

### ⚠️ 这里藏着一个大坑：GROUP BY 为什么写了三个字段？

```text
group by d.year, d.month, d.month_name     -- 写了三个字段
```

看起来 `month_name`（值长这样：`2009-12`、`2010-03`）已经能唯一标识一个月了，为什么还要 `year` 和 `month`？

**因为 `month_name` 是文本，文本排序是字典序。** 如果你想按月排序，`ORDER BY month_name` 会排出：

```
2009-12, 2010-01, 2010-02, 2010-10, 2010-11, 2010-12, 2010-03 ...
```

—— `2010-10` 跑到 `2010-03` 前面去了，因为字符 `'1'` 小于 `'3'`。

**三个解决方案**（我选了最稳的那个）：

1. ✅ `ORDER BY MIN(d.date_key)` —— 用数字日期排序，绝对正确（本文用的方法）
2. ✅ `ORDER BY d.year, d.month` —— 分两个数字字段排
3. ❌ `ORDER BY d.month_name` —— 会乱

**顺便说清 `GROUP BY` 为什么也要三个字段**：

按 `month_name` 分组理论上够了，但如果哪天数据里出现两个不同的月份共用同一个 `month_name`（理论上不会，但严谨点没错），

加上 `year, month` 更保险。**而且 `only_full_group_by` 模式要求：SELECT 里出现的非聚合列必须在 GROUP BY 里。**

## 4.10 自己练（这一章的练习最重要）

1. 算 `dim_customer` 表里 `country` 有几种（提示：`COUNT(DISTINCT country)`）
2. 按 `stock_code` 分组，算每个商品的销量合计 `SUM(quantity)`，取前 5
3. 数一数有多少个客户下过单（`customer_id` 要去重，还要排除空值）
4. 算出德国的总 GMV 和订单数，用一条 SQL 同时输出

<details>

<summary>点开看答案</summary>

```sql
-- 1
select count(distinct country) as 国家数 from dim_customer;

-- 2
select stock_code, sum(quantity) as 销量
from fact_sales where is_return = 0 and is_product = 1
group by stock_code order by 销量 desc limit 5;

-- 3
select count(distinct customer_id) as 下单客户数
from fact_sales
where is_return = 0 and customer_id is not null;

-- 4  -- 条件聚合的用法
select round(sum(case when country='Germany' then amount end), 2) as 德国GMV,
       count(distinct case when country='Germany' then invoice_no end) as 德国订单数
from fact_sales where is_return = 0;
```

</details>

---

# 第 5 章 窗口函数：面试的真正分水岭

**前 4 章如果你全会了，你已经能做 80% 的日常取数工作。**

这一章学完，你就能做"排名、累计、占比、分组内排名"这些分析岗天天要用的东西。

## 5.1 先理解它解决什么问题

假设你要"给客户按消费额排名"。用 `GROUP BY`：

```sql
select customer_id, sum(amount) as gmv
from fact_sales where is_return = 0 and customer_id is not null
group by customer_id
order by gmv desc limit 5;
```

结果有了，**但没有"名次"这一列**。你只能靠肉眼看第几行。

想加名次怎么办？没有窗口函数的话，你得：

1. 把结果导出到 Excel
2. 在 Excel 里加一列 `=ROW()-1`

**窗口函数就是"在 SQL 里完成这个动作"**：

```text
比原来只多了这一行 ↓
       rank() over (order by sum(amount) desc) as 名次
```

### 核心概念：`GROUP BY` vs 窗口函数

|      | `GROUP BY`     | 窗口函数              |
| ---- | -------------- | ----------------- |
| 行数变化 | **变少**（多行压成一行） | **不变**（每行都保留）     |
| 用途   | 汇总             | 在保留明细的同时算跨行的值     |
| 写法   | `GROUP BY 列`   | `函数() OVER (...)` |

**一句话记法**：`GROUP BY` 是"压缩"，窗口函数是"加一列"。

**`OVER` 这个词就是"在……之上"**，意思是"在这个窗口（一批行）之上算一个值，但每行都保留"。

## 5.2 练习 5-1：RANK 排名

```sql
select customer_id,
       round(sum(amount), 2) as gmv,
       rank() over (order by sum(amount) desc) as 名次
from fact_sales
where is_return = 0 and customer_id is not null
group by customer_id
order by 名次
limit 5;
```

**你应该看到**：

| customer_id | gmv       | 名次 |
| ----------- | --------- | -- |
| 18102       | 608821.65 | 1  |
| 14646       | 528602.52 | 2  |
| 14156       | 313946.37 | 3  |
| 14911       | 295972.63 | 4  |
| 17450       | 246973.09 | 5  |

**逐字解释**：

```text
rank() over (order by sum(amount) desc)
 ↑      ↑          ↑
 │      │          └─ 按什么排（注意里面可以写聚合函数）
 │      └─ 在什么"窗口"上算
 └─ 排名的函数
```

**为什么 `ORDER BY` 里面能写 `SUM(amount)`**：

因为窗口函数在 `GROUP BY` **之后**执行。这时候每个客户已经是"一行"了，这一行的 `SUM(amount)` 就是这个客户的总消费。

**执行顺序（背下来）**：

```
FROM → WHERE → GROUP BY → 窗口函数 → SELECT → ORDER BY → LIMIT
```

这个顺序解释了无数个"为什么"：

- 为什么窗口函数的 `ORDER BY` 里能写聚合函数？因为在 `GROUP BY` 之后
- 为什么 `WHERE` 里不能写 `RANK()`？因为 `WHERE` 在窗口函数之前执行，那时候还没有名次
- 为什么 `ORDER BY 名次` 可以用别名？因为 `ORDER BY` 最后执行（MySQL 允许，标准 SQL 严格来说不允许，但 MySQL 支持）

### RANK / DENSE_RANK / ROW_NUMBER 的区别（必考）

假设金额是 100, 100, 90, 80：

| 函数             | 结果         | 特点         |
| -------------- | ---------- | ---------- |
| `ROW_NUMBER()` | 1, 2, 3, 4 | 永远连续，不管并列  |
| `RANK()`       | 1, 1, 3, 4 | 并列跳号（跳过 2） |
| `DENSE_RANK()` | 1, 1, 2, 3 | 并列不跳号      |

**怎么记**：`RANK` 像奥运会（两个金牌就没有银牌，下一个是铜牌=第3）；`DENSE` 是"稠密"的，不跳。

## 5.3 练习 5-3：累计求和（帕累托的核心）

**需求**：按商品 GMV 从大到小排，算出"前 N 名加起来占总数的百分比"。

```sql
with prod as (
    select stock_code, sum(amount) as gmv
    from fact_sales
    where is_return = 0 and is_product = 1
    group by stock_code
)
select stock_code,
       round(gmv, 2) as gmv,
       round(sum(gmv) over (order by gmv desc), 2) as 累计,
       round(sum(gmv) over (), 2) as 全局总额
from prod
order by gmv desc
limit 5;
```


**你应该看到**：

| stock_code | gmv       | 累计         | 全局总额        |
| ---------- | --------- | ---------- | ----------- |
| 22423      | 344563.25 | 344563.25  | 20120021.23 |
| 85123A     | 267102.06 | 611665.31  | 20120021.23 |
| 85099B     | 185566.47 | 797231.78  | 20120021.23 |
| 23843      | 168469.60 | 965701.38  | 20120021.23 |
| 47566      | 149187.05 | 1114888.43 | 20120021.23 |

**盯着"累计"这一列看**：

```
344563.25                              ← 第1名自己的金额
344563.25 + 267102.06 = 611665.31      ← 前2名之和
611665.31 + 185566.47 = 797231.78      ← 前3名之和
797231.78 + 168469.60 = 965701.38      ← 前4名之和
```

**它在"滚雪球"。** 这就是累计求和。

### 关键区别：带不带 ORDER BY

```text
sum(gmv) over (order by gmv desc)   → 累计（每行的值都不同，越滚越大）
sum(gmv) over ()                     → 全局总额（每行都是同一个数 20120021.23）
```

**对照上面练习 5-3 的结果表看**：`累计` 那列每行都在变大，`全局总额` 那列每行都是 `20120021.23`。

这两列就是这两个写法的区别，一眼可见。

**这是窗口函数最容易考的点。** 记住：

> `OVER` 括号里**有 `ORDER BY`** = **累计**（从头累加到当前行）
>
> `OVER` 括号里**没有 `ORDER BY`** = **全局**（整个窗口一起算）

### `WITH ... AS (...)` 是什么

```text
with prod as (
    select stock_code, sum(amount) as gmv from 事实表 group by stock_code
)
select ... from prod
```

这叫 **CTE**（Common Table Expression，公用表表达式），俗称"临时表"或"子查询提起来写"。

**读法**："先把这个查询的结果叫 `prod`，然后用 `prod` 当一张表继续查。"

**为什么需要它**：因为窗口函数不能直接引用 `SUM(amount) AS gmv` 这个别名（窗口函数的执行时机比 SELECT 里的别名早）。

必须先算出 `gmv`，再在下一层用窗口函数。

**这就是"分两步写"的思路**——不硬凑成一句，先算第一步，再算第二步。**写复杂 SQL 全靠这招。**

### 用累计占比算帕累托

现在把它算成百分比：

```sql
with prod as (
    select stock_code, sum(amount) as gmv
    from fact_sales where is_return = 0 and is_product = 1
    group by stock_code
), ranked as (
    select stock_code, gmv,
           row_number() over (order by gmv desc) as rn,
           sum(gmv) over (order by gmv desc) as cum,
           sum(gmv) over () as total
    from prod
)
select rn, stock_code, round(gmv, 2) as gmv,
       round(cum / total * 100, 2) as 累计占比
from ranked
where rn <= 10
order by rn;
```

**你应该看到**（只列前 3 和后 1）：

| rn  | stock_code | gmv       | 累计占比%    |
| --- | ---------- | --------- | -------- |
| 1   | 22423      | 344563.25 | 1.71     |
| 2   | 85123A     | 267102.06 | 3.04     |
| 3   | 85099B     | 185566.47 | 3.96     |
| ... |            |           |          |
| 10  | 22197      | 80920.64  | **8.04** |

**业务结论（重要，记住能讲）**：

Top 10 商品只占 8.04% 的 GMV。说明这份数据是"长尾"结构——没有一个超级爆款撑起全部。

真正的 80% 要靠 1,000 多个商品（下一章 ABC 分析会看到）。

**这个结论反常识**：很多人以为电商都是"少数爆款贡献大部分销量"，但这家礼品批发商不是。

品种极多、每样都不多，这是**批发商**的典型特征（客户要什么就进什么）。

## 5.4 练习 5-4：CASE WHEN 分档

**需求**：按消费额把客户分三档，统计每档人数和总金额。

```sql
with c as (
    select customer_id, sum(amount) as gmv
    from fact_sales
    where is_return = 0 and customer_id is not null
    group by customer_id
)
select case
           when gmv >= 10000 then '高价值'
           when gmv >= 1000  then '中价值'
           else '低价值'
       end as 档位,
       count(*) as 人数,
       round(sum(gmv), 2) as 合计GMV
from c
group by 档位
order by 合计GMV desc;
```

**你应该看到**：

| 档位  | 人数   | 合计GMV      |
| --- | ---- | ---------- |
| 高价值 | 267  | 8958557.75 |
| 中价值 | 2480 | 7463526.40 |
| 低价值 | 3131 | 1321345.01 |

**业务解读**：267 个客户（占 4.5%）贡献了 43% 的 GMV。**这就是典型的二八法则。**

运营上意味着：这 267 个人要配备专属客户经理，剩下 3,131 个低价值客户用自动化邮件维护就行。

**`CASE WHEN` 的语法**（像 if-elif-else）：

```text
case when 条件1 then 值1
     when 条件2 then 值2
     else 兜底值
end
```

**注意**：`CASE WHEN` 是**从上往下匹配，命中就停**。所以 `gmv >= 10000` 必须写在 `gmv >= 1000` 前面。

写反了就全部落到"中价值"里（因为所有 ≥10000 的也 ≥1000）。

## 5.5 自己练

1. 用 `ROW_NUMBER()` 给商品按销量排名，取前 5，输出编码、销量、序号
2. 算出每个月的 GMV，同时给出"累计 GMV"（提示：`SUM(gmv) OVER (ORDER BY 月份)`）
3. 用 `CASE WHEN` 把订单按金额分成"大单(≥1000)/中单(100-999)/小单(<100)"三档，统计各档订单数

   （提示：先 `GROUP BY invoice_no` 算每单金额，再分档）

<details>

<summary>点开看答案</summary>

```sql
-- 1
select stock_code, sum(quantity) as 销量,
       row_number() over (order by sum(quantity) desc) as 序号
from fact_sales
where is_return = 0 and is_product = 1
group by stock_code
order by 序号 limit 5;

-- 2
with m as (
    select min(d.date_key) as 排序键, d.month_name as 月份, sum(f.amount) as gmv
    from fact_sales f join dim_date d on d.date_key = f.date_key
    where f.is_return = 0
    group by d.year, d.month, d.month_name
)
select 月份, round(gmv, 2) as 月度gmv,
       round(sum(gmv) over (order by 排序键), 2) as 累计gmv
from m order by 排序键 limit 6;
-- 结果：825685.76 / 1478394.26 / 2031733.99 / 2865304.12 / 3546833.11 / 4206691.97
-- 关键：sum(gmv) over (order by 排序键) 就是"累计"，这个 排序键 必须是数字且代表时间先后

-- 3
with o as (
    select invoice_no, sum(amount) as 单额 from fact_sales
    where is_return = 0 group by invoice_no
)
select case when 单额 >= 1000 then '大单'
            when 单额 >= 100  then '中单'
            else '小单' end as 档位,
       count(*) as 订单数
from o group by 档位 order by 订单数 desc;
```

</details>

---

# 第 6 章 拆解练习：自己写出 RFM 和 ABC

前面 5 章是"零件"。这一章把零件组装成**两个真实的分析模型**——

这两个模型是你项目里最值钱的东西，面试官听到"我自己写过 RFM"会明显加分。

## 6.1 怎么"拆解"一个复杂需求

**核心方法：不要想着一口气写完，先跑出最简单的一步，看到数据，再加下一层。**

我带你走一遍 RFM 的 6 步。

## 6.2 RFM 是什么

| 字母    | 全称        | 中文     | 衡量什么          |
| ----- | --------- | ------ | ------------- |
| **R** | Recency   | 最近一次消费 | 多久没来了（天，越小越好） |
| **F** | Frequency | 消费频次   | 买了几次（越大越好）    |
| **M** | Monetary  | 消费金额   | 花了多少钱（越大越好）   |

**用这三个指标给客户打分（各 1-5 分），组合出 6 种客户类型**，然后针对不同类型做不同运营动作。

## 6.3 第一步：先算一个客户的 M

不要一开始就想"全部客户"。**先盯住一个客户。**

进度给你看一下 Top 1 客户 `18102` 消费了多少：

```sql
select sum(amount) as gmv
from fact_sales
where is_return = 0 and customer_id = 18102;
```

**看到**：`608821.65`

✅ 一个小数字出来了。**这就是"拆解"的第一步——确认你能取到单个客户的数据。**

## 6.4 第二步：给这个客户按月拆开

```sql
select d.month_name as 月份, round(sum(f.amount), 2) as gmv
from fact_sales f
join dim_date d on d.date_key = f.date_key
where f.is_return = 0 and f.customer_id = 18102
group by d.year, d.month, d.month_name
order by min(d.date_key);
```

**你应该看到**（23 行）：

| 月份      | gmv      |
| ------- | -------- |
| 2009-12 | 41005.74 |
| 2010-01 | 38555.30 |
| 2010-02 | 24019.40 |
| 2010-03 | 21215.11 |
| 2010-04 | 16596.55 |
| ...     | ...      |
| 2011-06 | 41959.44 |
| 2011-08 | 985.92   |
| 2011-09 | 49622.18 |
| 2011-10 | 52681.27 |
| 2011-11 | 15331.08 |
| 2011-12 | 11485.54 |

**看这组数据能发现什么**（这个训练很重要，读数据的能力比写 SQL 更值钱）：

- 23 个月里只有 22 行 → 2010-09 那个月**一单没下**（注意 2010-08 之后直接跳到 2010-10）
- 2011 年整体在下滑（从 4 万多掉到 1 万多）
- 2011-08 只有 985.92，几乎停了

**一个本该是"最优质客户"的人，正在悄悄流失。** 如果这是真实业务，这就是要立刻打电话的客户。

**这一步教会你**：分组的时间序列能暴露"聚合数字"掩盖的问题。只看"总共 60 万"你什么也发现不了。

## 6.5 第三步：去掉 `WHERE customer_id = 18102`，对所有客户算

```sql
select customer_id,
       max(d.full_date) as 最后购买日,
       count(distinct f.invoice_no) as 频次,
       round(sum(f.amount), 2) as 金额
from fact_sales f
join dim_date d on d.date_key = f.date_key
where f.is_return = 0 and f.customer_id is not null
group by f.customer_id
order by 金额 desc
limit 5;
```

**你应该看到**：

| customer_id | 最后购买日      | 频次  | 金额        |
| ----------- | ---------- | --- | --------- |
| 18102       | 2011-12-09 | 145 | 608821.65 |
| 14646       | 2011-12-08 | 151 | 528602.52 |
| 14156       | 2011-11-30 | 156 | 313946.37 |
| 14911       | 2011-12-08 | 398 | 295972.63 |
| 17450       | 2011-12-01 | 51  | 246973.09 |

**这一步你已经有了 F（频次）和 M（金额）**，还差 R（多少天没买）。

**顺便算一下人均单笔金额**（金额 ÷ 频次）：

- `18102`：608,821 ÷ 145 = **4,198 元/单**
- `14911`：295,972 ÷ 398 = **744 元/单**

差了 **5.6 倍**。同样都是 Top 5 客户，但一个是"每单几万的大额采购"，

一个是"频繁小额补货"。**这两个人需要完全不同的维护方式**（大额客户配客户经理谈返点，小额高频客户优化下单流程/自动补货）。

**这就是为什么要做客户分层**：如果只看"总额 60 万"和"总额 29 万"，你会以为他们是同一类人。

## 6.6 第四步：把 R 算出来

R = "数据里最后一天" 减去 "这个客户最后一次购买"。

```sql
select customer_id,
       datediff((select max(full_date) from dim_date), max(d.full_date)) as 多少天没买
from fact_sales f
join dim_date d on d.date_key = f.date_key
where f.is_return = 0 and f.customer_id is not null
group by f.customer_id
order by 多少天没买 desc
limit 5;
```

**你应该看到**：一批 `多少天没买 = 738` 的客户（他们最后一次购买是 2009-12-01，也就是数据的**第一天**）。

**`DATEDIFF(日期1, 日期2)`** = 日期1 减去 日期2 的天数。

`(SELECT MAX(full_date) FROM dim_date)` 是个**子查询**，先算出全库最大日期（2011-12-09），再拿它当常数用。

**为什么用 `MAX(full_date) FROM dim_date` 而不是 `NOW()`**：

因为这是**历史数据**，最后一天是 2011-12-09。如果用 `NOW()`（今天），所有人都变成"5000 多天没买"，

RFM 就完全失效了。**算历史数据的 R，一定要用"数据里的最后一天"，不是"今天"。**

这个细节面试时说出来会很加分。

## 6.7 第五步：用 NTILE 打分

`NTILE(5)` = 把所有行按某个顺序**平均分成 5 组**，第 1 组打 1 分，第 5 组打 5 分。

```sql
with base as (
    select f.customer_id,
           datediff((select max(full_date) from dim_date), max(d.full_date)) as recency,
           count(distinct f.invoice_no) as frequency,
           sum(f.amount) as monetary
    from fact_sales f
    join dim_date d on d.date_key = f.date_key
    where f.is_return = 0 and f.customer_id is not null
    group by f.customer_id
)
select *,
       ntile(5) over (order by recency desc) as r,
       ntile(5) over (order by frequency)    as f,
       ntile(5) over (order by monetary)     as m
from base
limit 10;
```

**你应该看到**：10 行，每行有 `recency`、`frequency`、`monetary` 三个原始值和 `r`、`f`、`m` 三个 1-5 的分数。

### ⚠️ 最关键的问题：为什么 R 用 `DESC`，F 和 M 不用？

**先说 `NTILE` 的规则**：它按 `ORDER BY` 的顺序排队，**排在最后的那 1/5 拿 5 分**（最高分）。

**所以"拿高分" = "排在后面"**。

| 指标    | 好的客户长什么样     | 要让他拿高分，就得让他排后面 | 所以排序要             |
| ----- | ------------ | -------------- | ----------------- |
| R（天数） | 天数**小**（刚买过） | 天数小的排后面        | **`DESC`（从大到小排）** |
| F（次数） | 次数**大**      | 次数大的排后面        | 默认 `ASC`（从小到大排）   |
| M（金额） | 金额**大**      | 金额大的排后面        | 默认 `ASC`          |

**换个说法**：

R 是"多少天没买"，这是**反向指标**（数字大 = 差）。你希望差的人得低分，所以让数字大的排在前面（拿低分），数字小的排在后面（拿高分）→ 用 `DESC`。

F、M 是正向指标（数字大 = 好），数字大的自然排在后面拿高分 → 用 `ASC`。

**这样三个指标方向就统一了：分数高 = 状态好。** 如果 R 也用 `ASC`，就会出现"很久没买的人 R 得 5 分"，业务逻辑全乱。

## 6.8 第六步：用分数组合成 6 类客户

```sql
with base as (
    select f.customer_id,
           datediff((select max(full_date) from dim_date), max(d.full_date)) as recency,
           count(distinct f.invoice_no) as frequency,
           sum(f.amount) as monetary
    from fact_sales f
    join dim_date d on d.date_key = f.date_key
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
            when r >= 4 and f <= 2              then '新客户'
            when r <= 2 and f >= 4 and m >= 4   then '重要挽留客户'
            when r <= 2 and f <= 2              then '流失客户'
            when f >= 4 and m >= 4              then '重要保持客户'
            else '一般客户' end as 分层,
       count(*) as 人数,
       round(avg(monetary), 2) as 人均GMV
from scored
group by 分层
order by 人数 desc;
```


**你应该看到**：

| 分层     | 人数   | 人均GMV   |
| ------ | ---- | ------- |
| 一般客户   | 2004 | 1039.40 |
| 流失客户   | 1644 | 449.90  |
| 重要价值客户 | 1345 | 9081.16 |
| 重要保持客户 | 395  | 4107.56 |
| 新客户    | 287  | 397.38  |
| 重要挽留客户 | 203  | 4778.99 |

### 6 类的判断逻辑（读一遍就懂）

| 类型     | 条件        | 人话                               |
| ------ | --------- | -------------------------------- |
| 重要价值客户 | R高 F高 M高  | 最近买过、常买、花钱多 → **最好的客户**          |
| 新客户    | R高 F低     | 最近买过、但只买过一两次 → **刚来，要养成习惯**      |
| 重要挽留客户 | R低 F高 M高  | 很久没买、但曾经常买且花得多 → **曾经的大客户，正在流失** |
| 流失客户   | R低 F低     | 很久没买、也买得少 → **已经走了**             |
| 重要保持客户 | F高 M高（R中） | 常买、花得多，但最近不太活跃 → **要唤醒**         |
| 一般客户   | 其他        | 没啥特征                             |

### 业务解读（这段能直接说给面试官听）

- **重要价值客户 1,345 人，人均消费 9,081 元** —— 这是核心资产，要重点保护，别让他们掉出去
- **重要挽留客户只有 203 人，但人均 4,779 元** —— **ROI 最高的挽回目标**。人少、价值高、还救得回来。203 个人，一个客服一周就能全部打电话触达
- **流失客户 1,644 人，人均只有 450 元** —— 人多但不值钱，别浪费人力，用自动化邮件群发就行

**这个结论的价值**：如果老板问"客户运营预算该给谁"，你能用数据回答"先保住这 1,345 个重要的，再花一周打电话救那 203 个曾经的大客户，剩下 3,600 多个用自动化"。

## 6.9 ABC 商品分类（同样的套路，换个维度）

**逻辑**：按 GMV 从大到小累计，累计到 80% 的是 A 类，80-95% 是 B 类，剩下是 C 类。

```sql
with prod as (
    select stock_code, sum(amount) as gmv
    from fact_sales where is_return = 0 and is_product = 1
    group by stock_code
), r as (
    select stock_code, gmv,
           sum(gmv) over (order by gmv desc) as cum,
           sum(gmv) over () as total
    from prod
)
select case when cum / total <= 0.8 then 'A类'
            when cum / total <= 0.95 then 'B类'
            else 'C类' end as 类别,
       count(*) as sku数,
       round(sum(gmv), 2) as gmv,
       round(sum(gmv) / max(total) * 100, 2) as 占比
from r
group by 类别
order by gmv desc;
```

**你应该看到**：

| 类别 | sku数 | gmv         | 占比    |
| -- | ---- | ----------- | ----- |
| A类 | 1025 | 16093195.17 | 79.99 |
| B类 | 1261 | 3020259.53  | 15.01 |
| C类 | 2441 | 1006566.53  | 5.00  |

**业务结论**：

- **A 类 1,025 个 SKU（占全部 4,727 个商品的 21.7%）贡献 80% 的 GMV** → 这些必须保证不断货
- **C 类 2,441 个 SKU（51.6%）只贡献 5%** → **一半的商品几乎不赚钱**，占着仓库和采购精力

**给老板的建议**：C 类商品考虑清仓处理、不再补货，腾出的库存空间和采购人力投到 A 类。

**这个结论直接对应钱。**

**`MAX(total)` 是什么鬼**：因为在 `GROUP BY 类别` 之后，`total` 这个非聚合列不能直接用（违反 `only_full_group_by`）。

但每个 A 类行里的 `total` 都是同一个数（全局总额），所以用 `MAX(total)`（或 `MIN`、`SUM`、`AVG` 都行）取出来就能用。

**这是个实用小技巧，记住。**

## 6.10 复盘：你怎么从 0 写出这两个模型的

回头看你的路径：

```
第 1 步：一个客户的总额                    ← SELECT + WHERE + SUM
第 2 步：这个客户按月                      ← + JOIN + GROUP BY + ORDER BY
第 3 步：所有客户的 F 和 M                 ← 去掉 WHERE 的客户条件
第 4 步：加上 R                            ← + DATEDIFF + 子查询
第 5 步：NTILE 打分                        ← + WITH + 窗口函数
第 6 步：CASE WHEN 分类                    ← + CASE + 二次 GROUP BY
```

**每一步都只加了 1~2 个新东西，每一步都能跑出结果看。**

**这就是"拆解"。** 以后遇到任何复杂需求，都这么办：先跑最小的那一步，确认数据对，再加下一层。

**千万别一上来写 40 行 SQL 然后调试——你根本不知道错在哪一层。**

---

# 第 7 章 常见错误对照表（卡住就查这里）

## 7.1 报错速查

| 报错里出现                                  | 真实原因                                       | 怎么改                                  |
| -------------------------------------- | ------------------------------------------ | ------------------------------------ |
| `near 'FORM ...'`                      | 关键词拼错                                      | 检查 `FROM`/`SELECT`/`WHERE` 拼写        |
| `near 'FROM ...'` 但 FROM 没拼错           | **前一个词后面多了逗号**                             | 删掉 `FROM` 前面那个逗号                     |
| `Unknown column 'xxx'`                 | 列名写错或不存在                                   | 用 `Ctrl+B` 看表结构，或用补全                 |
| `Table 'xxx' doesn't exist`            | 表名写错                                       | 拼写检查；确认在 `biz_analytics` 库里          |
| `only_full_group_by`                   | 忘写 `GROUP BY`，或 SELECT 里有非聚合列不在 GROUP BY 里 | 见 4.3                                |
| `You have an error in your SQL syntax` | 语法错误（少了引号、括号不配对）                           | 看 `near` 后面那段                        |
| `Incorrect decimal value`              | 数字字段比较时用了字符串                               | `amount > '500'` → 改成 `amount > 500` |
| 结果全是 0                                 | 用了 `= NULL`                                | 改成 `IS NULL`                         |
| 结果行数比预期多很多                             | JOIN 时一对多导致行翻倍                             | 检查 `ON` 条件是否唯一                       |

## 7.2 逻辑错误（不报错，但结果错）

| 现象                          | 原因                               | 检查                       |
| --------------------------- | -------------------------------- | ------------------------ |
| GMV 比预想的低                   | 忘了 `WHERE is_return = 0`，退货负数扣减了 | 加过滤                      |
| 商品榜第一名是 `POST`/`M`          | 忘了 `is_product = 1`              | 加过滤                      |
| 订单数 = 行数                    | 忘了 `COUNT(DISTINCT invoice_no)`  | 加 `DISTINCT`             |
| 客户数偏大                       | 没排 `customer_id IS NULL`（游客）     | 加 `IS NOT NULL`          |
| 月份排序乱（2010-10 排在 2010-03 前） | 按文本月份排了                          | `ORDER BY MIN(date_key)` |
| "英国或法国且金额>1000"结果混进小额行      | `AND`/`OR` 没加括号                  | 加括号                      |
| 分档结果全落到一档                   | `CASE WHEN` 顺序反了（小条件写前面）         | 从大到小写                    |
| RFM 的 R 全是 5000 多天          | 用了 `NOW()` 而不是 `MAX(full_date)`  | 见 6.6                    |

## 7.3 必背的 6 个数字（对答案用）

跑完第 4 章，你的数字应该是这些：

| 指标          | SQL 要点                          | 正确值               |
| ----------- | ------------------------------- | ----------------- |
| 事实表行数       | `COUNT(*)`                      | 1,061,164         |
| 销售行数（非退货）   | `WHERE is_return=0`             | 1,041,670         |
| **全期 GMV**  | `SUM(amount) WHERE is_return=0` | **20,972,594.55** |
| 订单数         | `COUNT(DISTINCT invoice_no)`    | 40,077            |
| **客单价 AOV** | GMV ÷ 订单数                       | **523.31**        |
| 退货率         | 退货额 ÷ 销售额                       | 7.28%             |

**如果这 6 个数对上了，说明你的库和我的完全一致，后面所有题目的答案都能对。**

---

# 第 8 章 你现在能做什么（能力清单）

学完这 8 章，你实际掌握了这些东西——**这些就是能写进简历的**：

## 8.1 技术能力

- ✅ 会用 `SELECT` / `WHERE` / `ORDER BY` / `LIMIT` 取任意数据
- ✅ 会用 `COUNT` / `SUM` / `AVG` / `MIN` / `MAX` 做汇总
- ✅ 会用 `GROUP BY` + `HAVING` 做分组统计
- ✅ 会用 `INNER JOIN` / `LEFT JOIN` 关联多表（并且知道会丢行）
- ✅ 会用 `CASE WHEN` 做条件聚合和多维分档
- ✅ 会用 `WITH` (CTE) 把复杂查询拆成多步
- ✅ 会用 `RANK` / `ROW_NUMBER` / `NTILE` / 累计求和 等窗口函数
- ✅ 能独立实现 **RFM 客户分层** 和 **ABC 商品分类** 两个分析模型
- ✅ 会用 `MAX(full_date)` 而不是 `NOW()` 处理历史数据的 R 值

## 8.2 面试时能讲的三句话（背下来）

**第一句（讲项目）**：

> "我用 106 万行电商交易数据建了星型模型，4 张表：1 张事实表 + 3 张维度表，
>
> 用 SQL 实现了 RFM 客户分层和 ABC 商品分类，结论是 267 个客户贡献 43% 的 GMV。"

**第二句（讲细节，体现深度）**：

> "做 RFM 时踩过的坑是：R 值必须用数据里最后一天算，不能用 `NOW()`，
>
> 否则所有人都是几千天没买，分层就失效了。另外 `NTILE` 打分时 R 要 `DESC` 排，
>
> 因为 R 是反向指标，要让'天数小'的人拿高分。"

**第三句（讲业务结论，最值钱）**：

> "最重要的发现是 C 类商品：2,441 个 SKU 占一半的商品数，但只贡献 5% 的 GMV。
>
> 从运营上应该清仓，把采购和库存精力集中到 A 类的 1,025 个 SKU 上。"

---

# 附录 A：4 张表完整字段速查

### `fact_sales`（事实表）

| 字段            | 类型            | 说明                           |
| ------------- | ------------- | ---------------------------- |
| `sales_id`    | bigint        | 主键，自增                        |
| `invoice_no`  | varchar(20)   | 订单号                          |
| `line_no`     | smallint      | 订单内行号                        |
| `stock_code`  | varchar(32)   | 商品编码（外键→dim_product）         |
| `customer_id` | bigint        | 客户编号（外键→dim_customer，可为空=游客） |
| `date_key`    | int           | 日期键 20091201（外键→dim_date）    |
| `quantity`    | int           | 数量（退货时是负数）                   |
| `price`       | decimal(10,2) | 单价                           |
| `amount`      | decimal(14,2) | 金额 = quantity × price        |
| `is_return`   | tinyint(1)    | 1=退货 0=销售                    |
| `is_product`  | tinyint(1)    | 1=真实商品 0=邮费/手续费等             |
| `country`     | varchar(64)   | 国家                           |

### `dim_customer`

| 字段                 | 说明    |
| ------------------ | ----- |
| `customer_id`      | 主键    |
| `country`          | 国家    |
| `first_order_date` | 首次下单日 |
| `last_order_date`  | 最后下单日 |
| `total_orders`     | 历史订单数 |
| `total_amount`     | 历史总额  |
| `is_guest`         | 是否游客  |

### `dim_product`

| 字段            | 说明   |
| ------------- | ---- |
| `stock_code`  | 主键   |
| `description` | 商品名  |
| `avg_price`   | 平均单价 |

### `dim_date`

| 字段                           | 说明               |
| ---------------------------- | ---------------- |
| `date_key`                   | 主键，20091201      |
| `full_date`                  | 日期，2009-12-01    |
| `year` / `quarter` / `month` | 年/季/月            |
| `month_name`                 | 文本月份，如 `2009-12` |
| `day_of_month`               | 几号               |
| `weekday`                    | 1=周一 … 7=周日      |
| `is_weekend`                 | 是否周末             |

---

# 附录 B：学习路线（下一步学什么）

你现在在 **SQL 阶段**。这个项目完整的技术栈是：

```
① 数据库 SQL            ← 你在这里，已通关
② Python + pandas       ← 下一步：数据清洗（Excel → 干净的表）
③ ETL 流程              ← 三层怎么串起来、全量 vs 增量
④ FastAPI 后端          ← 写接口，把 SQL 包成 /api/xxx
⑤ ECharts 前端          ← 把数字变成图
⑥ 部署上线              ← 让别人能访问
```

**建议下一步学 ②**，因为你项目里最"值钱"的代码其实是 `etl/build_dw.py`——

它要处理 106 万行里的各种脏数据（大小写不统一、空值、非商品项），这些才是有经验工程师才会做的事。

**先别跳去学 ④⑤**。后端和前端都是"把数据搬来搬去"，技术难度低，面试也不考。

**SQL + 数据清洗才是数据岗真正看的东西。**

---

# 通关自检

- [ ] 第 2~4 章能不看答案，独立写出每一条 SQL
- [ ] 7.3 那 6 个数字全部对上
- [ ] 能解释 `WHERE` 和 `HAVING` 的区别
- [ ] 能解释 `INNER JOIN` 和 `LEFT JOIN` 的区别，并说出这份数据里丢的是哪 5,793 行
- [ ] 能解释 `SUM(x) OVER (ORDER BY y)` 和 `SUM(x) OVER ()` 的区别
- [ ] 能解释 `RANK` / `DENSE_RANK` / `ROW_NUMBER` 的区别
- [ ] 能独立写出 RFM，并解释"为什么 R 要 `DESC`"
- [ ] 能说出 ABC 分析给老板的业务建议
- [ ] 8.2 那三句话能脱稿讲出来

**全部打勾，SQL 这块面试就不会被问倒了。**

---

*本教材所有示例结果均在 `biz_analytics` 真实数据上执行验证，生成脚本见 `ba-fix-test/gen_tutorial.py`，原始输出见 `ba-fix-test/tutorial_snapshot.txt`。*
