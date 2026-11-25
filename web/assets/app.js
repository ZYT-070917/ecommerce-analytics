/* ==========================================================================
   电商经营分析 · 前端逻辑（翻页版）
   分层：工具 → 主题 → 数据预加载 → 图表 → 表格 → 翻页 → 装配

   设计前提：五个页面全部一次性预载、一次性渲染。
   翻页只做 transform，绝不发请求，所以永远看不到"加载中"。
   ========================================================================== */
(() => {
  "use strict";

  const API = "/api";
  const el = (id) => document.getElementById(id);

  /* ── 1. 工具 ─────────────────────────────────────────────────────────── */

  /** 金额：自动选 M / k，保留可观位数 */
  function money(v, withSign = true) {
    const n = Number(v) || 0;
    const abs = Math.abs(n);
    const sign = withSign ? "£" : "";
    if (abs >= 1e6) return sign + (n / 1e6).toFixed(2) + "M";
    if (abs >= 1e3) return sign + (n / 1e3).toFixed(1) + "k";
    return sign + n.toFixed(0);
  }

  /** 金额（完整数字，千分位）—— 表格与 tooltip 用 */
  const moneyFull = (v) =>
    "£" + Number(v || 0).toLocaleString("en-GB", { maximumFractionDigits: 0 });

  const num = (v) => Number(v || 0).toLocaleString("zh-CN");
  const pct = (v, d = 1) => (Number(v) || 0).toFixed(d) + "%";
  const clip = (s, n) => (s && s.length > n ? s.slice(0, n) + "…" : s || "");

  /** 千分位缩写，给坐标轴用 */
  const kfmt = (v) => (v >= 1e6 ? v / 1e6 + "M" : v >= 1e3 ? v / 1e3 + "k" : v);

  /* ── 2. 主题 ─────────────────────────────────────────────────────────── */

  /* 每套主题除了主色，还带一组"表面色"：底色 / 卡片 / 凹陷面 / 描边，
     这样换主题时整页的冷暖调一起变，而不是只换按钮颜色。 */
  const THEMES = [
    { id: "blue",   name: "靛蓝", accent: "#1d4ed8", rgb: "29, 78, 216",
      bg: "#f1f4fb", surface: "#ffffff", sunk: "#f7fafe",
      bd: "#e3e9f3", bd2: "#d3dced",
      c: ["#1d4ed8", "#3b82f6", "#60a5fa", "#93c5fd", "#c7dbfb", "#f0b429", "#b45309"] },
    { id: "teal",   name: "青碧", accent: "#0f766e", rgb: "15, 118, 110",
      bg: "#eaf5f2", surface: "#fcfffe", sunk: "#f3fbf8",
      bd: "#d7eae5", bd2: "#c2e0d8",
      c: ["#0f766e", "#14b8a6", "#2dd4bf", "#7dd3d0", "#cdf3ee", "#f59e0b", "#b45309"] },
    { id: "violet", name: "罗兰", accent: "#6d28d9", rgb: "109, 40, 217",
      bg: "#f2effb", surface: "#fefcff", sunk: "#f7f4fe",
      bd: "#e5dff4", bd2: "#d4caea",
      c: ["#6d28d9", "#8b5cf6", "#a78bfa", "#c4b5fd", "#e6defb", "#f59e0b", "#b45309"] },
    { id: "amber",  name: "琥珀", accent: "#b45309", rgb: "180, 83, 9",
      bg: "#fdf4e4", surface: "#fffdf9", sunk: "#fdf8ef",
      bd: "#f1e2c9", bd2: "#e6cca9",
      c: ["#b45309", "#d97706", "#f59e0b", "#fbbf24", "#fbe8c4", "#0f766e", "#1d4ed8"] },
    { id: "rose",   name: "绯红", accent: "#be123c", rgb: "190, 18, 60",
      bg: "#fdeff2", surface: "#fffcfd", sunk: "#fdf4f6",
      bd: "#f5dde2", bd2: "#eec4cd",
      c: ["#be123c", "#e11d48", "#fb7185", "#fda4af", "#fde2e7", "#0f766e", "#1d4ed8"] },
    { id: "ink",    name: "墨夜", dark: true, accent: "#7aa2ff", rgb: "122, 162, 255",
      c: ["#7aa2ff", "#5b8def", "#94b8ff", "#b9d0ff", "#3a4a66", "#f0b429", "#ffb86b"] }
  ];

  let T = THEMES[0];

  /** 图表调色板：随深浅模式与主题联动 */
  function P() {
    const dark = !!T.dark;
    return {
      c: T.c,
      axis:      dark ? "#7183a0" : "#7e8ca1",
      split:     dark ? "rgba(255,255,255,.06)" : (T.bd || "#f1f4f9"),
      border:    dark ? "#121a28" : (T.surface || "#ffffff"),
      tipBg:     dark ? "rgba(8,12,20,.96)" : "rgba(16,24,40,.94)",
      titleText: dark ? "#e8eefb" : "#101828"
    };
  }

  const axisBase = (p) => ({
    axisLine: { lineStyle: { color: p.split } },
    axisTick: { show: false },
    axisLabel: { color: p.axis, fontSize: 11 }
  });

  const tooltipBase = (p) => ({
    backgroundColor: p.tipBg,
    borderWidth: 0,
    padding: [9, 13],
    textStyle: { color: "#fff", fontSize: 12, lineHeight: 19 },
    extraCssText: "border-radius:9px;box-shadow:0 8px 30px rgba(16,24,40,.28)"
  });

  /** 浅色主题要整套换表面色；深色主题交回 body.is-dark 的规则，避免两处打架 */
  const SURFACE_VARS = ["--bg", "--surface", "--surface-sunk", "--border", "--border-strong"];

  function applyTheme(id, persist = true) {
    const t = THEMES.find((x) => x.id === id) || THEMES[0];
    T = t;
    const root = document.documentElement.style;
    root.setProperty("--accent", t.accent);
    root.setProperty("--accent-rgb", t.rgb);
    root.setProperty("--accent-soft", `rgba(${t.rgb}, .10)`);

    if (t.dark) {
      SURFACE_VARS.forEach((k) => root.removeProperty(k));
    } else {
      root.setProperty("--bg", t.bg);
      root.setProperty("--surface", t.surface);
      root.setProperty("--surface-sunk", t.sunk);
      root.setProperty("--border", t.bd);
      root.setProperty("--border-strong", t.bd2);
      // 浏览器地址栏 / 移动端状态栏也跟着主题走
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", t.bg);
    }

    document.body.classList.toggle("is-dark", !!t.dark);

    t.c.forEach((color, i) => root.setProperty(`--c${i + 1}`, color));

    document.querySelectorAll(".swatch").forEach((s) => {
      s.classList.toggle("is-active", s.dataset.theme === t.id);
    });

    if (persist) {
      try { localStorage.setItem("ea-theme", t.id); } catch (_) { /* 隐私模式忽略 */ }
    }

    if (D.kpi) renderCharts();   // 数据已在内存，换主题不重新请求
  }

  function buildThemes() {
    const box = el("themes");
    box.innerHTML = THEMES.map(
      (t) => `<button class="swatch" type="button" data-theme="${t.id}"
                title="${t.name}" aria-label="主题：${t.name}"
                style="--sw:${t.accent}"></button>`
    ).join("");
    box.addEventListener("click", (e) => {
      const btn = e.target.closest(".swatch");
      if (btn) applyTheme(btn.dataset.theme);
    });
  }

  /* ── 3. 数据层：一次拿全，之后翻页零请求 ─────────────────────────────── */

  const D = {};   // { kpi, trend, rfm, abc, country, weekday, top, pareto }

  async function get(path) {
    const r = await fetch(API + path, { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`${path} 返回 ${r.status}`);
    return r.json();
  }

  async function preload(onStep) {
    const jobs = [
      ["kpi",     "/kpi"],
      ["trend",   "/trend"],
      ["rfm",     "/rfm"],
      ["abc",     "/abc"],
      ["country", "/country?limit=10"],
      ["weekday", "/weekday"],
      ["top",     "/top-products?limit=30"],
      ["pareto",  "/pareto?top=12"]
    ];
    let done = 0;
    await Promise.all(
      jobs.map(async ([key, path]) => {
        D[key] = await get(path);
        done += 1;
        onStep && onStep(done, jobs.length);
      })
    );
  }

  /* ── 4. 图表 ─────────────────────────────────────────────────────────── */

  const charts = {};

  function chart(id) {
    if (!charts[id]) {
      charts[id] = echarts.init(el(id), null, { renderer: "canvas" });
    }
    return charts[id];
  }

  /** 5 页分栏 KPI 迷你走势 */
  function sparkline(values) {
    const w = 260, h = 32;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min || 1;
    const stepX = w / Math.max(values.length - 1, 1);
    const pts = values.map((v, i) => [i * stepX, h - 5 - ((v - min) / span) * (h - 12)]);
    const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const area = `${line} L${w} ${h} L0 ${h} Z`;
    const rgb = T.rgb;
    const fillId = `sg-${T.id}`;

    return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <defs><linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(${rgb})" stop-opacity=".22"/>
        <stop offset="100%" stop-color="rgb(${rgb})" stop-opacity="0"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#${fillId})"/>
      <path d="${line}" fill="none" stroke="rgb(${rgb})" stroke-width="1.7"
            stroke-linejoin="round" stroke-linecap="round"
            vector-effect="non-scaling-stroke"/>
    </svg>`;
  }

  function renderTrend() {
    const p = P();
    const rows = D.trend;
    const months = rows.map((r) => r.month);
    const partial = D.kpi.date_to.slice(0, 7);
    const partialDay = Number(D.kpi.date_to.slice(8, 10));
    const isPartial = partialDay < 25 && months.includes(partial);

    chart("c-trend").setOption({
      grid: { left: 46, right: 46, top: 28, bottom: 46 },
      tooltip: {
        ...tooltipBase(p),
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: p.axis, opacity: .35 } },
        formatter: (ps) => {
          const r = rows[ps[0].dataIndex];
          return `<b>${r.month}</b><br/>GMV　${moneyFull(r.gmv)}<br/>` +
                 `订单　${num(r.orders)} 单<br/>客户　${num(r.customers)} 人`;
        }
      },
      legend: {
        data: ["GMV", "订单数"], right: 4, top: 0,
        itemWidth: 12, itemHeight: 6,
        textStyle: { color: p.axis, fontSize: 11 }
      },
      xAxis: {
        type: "category", data: months, boundaryGap: false,
        ...axisBase(p),
        axisLabel: { ...axisBase(p).axisLabel, interval: 1, rotate: 38, margin: 12 },
        splitLine: { show: false }
      },
      yAxis: [
        {
          type: "value", ...axisBase(p), axisLine: { show: false },
          axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
          splitLine: { lineStyle: { color: p.split } }
        },
        {
          type: "value", ...axisBase(p), axisLine: { show: false },
          axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "GMV", type: "line", smooth: 0.25,
          symbol: "circle", symbolSize: 5, showSymbol: false,
          data: rows.map((r) => r.gmv),
          lineStyle: { width: 2.4, color: p.c[0] },
          itemStyle: { color: p.c[0], borderColor: p.border, borderWidth: 2 },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `rgba(${T.rgb}, .22)` },
                { offset: 1, color: `rgba(${T.rgb}, 0)` }
              ]
            }
          },
          markLine: isPartial ? {
            silent: true, symbol: "none",
            lineStyle: { color: p.c[5], type: "dashed", width: 1 },
            label: { formatter: `仅 ${partialDay} 天`, color: p.c[5], fontSize: 10, position: "insideEndTop" },
            data: [{ xAxis: partial }]
          } : undefined
        },
        {
          name: "订单数", type: "line", yAxisIndex: 1, smooth: 0.25, symbol: "none",
          data: rows.map((r) => r.orders),
          lineStyle: { width: 1.6, color: p.c[5], type: [5, 4] }
        }
      ]
    }, true);
  }

  function renderRfm() {
    const p = P();
    const rows = D.rfm;
    const totalCustomers = rows.reduce((s, r) => s + r.customers, 0);

    chart("c-rfm").setOption({
      tooltip: {
        ...tooltipBase(p), trigger: "item",
        formatter: (x) =>
          `<b>${x.name}</b><br/>人数　${num(x.value)}（${x.percent}%）<br/>` +
          `人均消费　${moneyFull(x.data.monetary)}`
      },
      legend: {
        orient: "vertical", right: 0, top: "middle",
        itemWidth: 9, itemHeight: 9, itemGap: 12,
        textStyle: { color: p.titleText, fontSize: 11.5 },
        formatter: (name) => {
          const r = rows.find((x) => x.segment === name);
          return `${name}  ${num(r.customers)}`;
        }
      },
      title: {
        text: num(totalCustomers), subtext: "参与分层客户",
        left: "35%", top: "43%", textAlign: "center",
        textStyle: { fontSize: 21, fontWeight: 650, color: p.titleText },
        subtextStyle: { fontSize: 11, color: p.axis }
      },
      series: [{
        type: "pie", radius: ["50%", "72%"], center: ["36%", "54%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: p.border, borderWidth: 2, borderRadius: 3 },
        label: { show: false }, labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 7 },
        data: rows.map((r, i) => ({
          name: r.segment, value: r.customers, monetary: r.avg_monetary,
          itemStyle: { color: p.c[i % p.c.length] }
        }))
      }]
    }, true);
  }

  function renderAbc() {
    const p = P();
    const rows = D.abc;
    const a = rows.find((r) => r.abc_class.startsWith("A"));

    chart("c-abc").setOption({
      tooltip: {
        ...tooltipBase(p), trigger: "item",
        formatter: (x) => {
          const r = rows[x.dataIndex];
          const totalSku = rows.reduce((s, y) => s + y.sku_count, 0);
          return `<b>${r.abc_class}</b><br/>GMV 占　${pct(r.gmv_share_pct)}<br/>` +
                 `SKU 数　${num(r.sku_count)}（${pct((r.sku_count / totalSku) * 100)}）<br/>` +
                 `GMV　${moneyFull(r.gmv)}`;
        }
      },
      legend: {
        orient: "vertical", right: 0, top: "middle",
        itemWidth: 9, itemHeight: 9, itemGap: 14,
        textStyle: { color: p.titleText, fontSize: 11.5 },
        formatter: (name) => {
          const r = rows.find((x) => x.abc_class === name);
          return `${name.split("(")[0]}  ${pct(r.gmv_share_pct, 0)}`;
        }
      },
      title: {
        text: pct(a.gmv_share_pct, 0), subtext: "A 类营收占比",
        left: "35%", top: "43%", textAlign: "center",
        textStyle: { fontSize: 21, fontWeight: 650, color: p.titleText },
        subtextStyle: { fontSize: 11, color: p.axis }
      },
      series: [{
        type: "pie", radius: ["50%", "72%"], center: ["36%", "54%"],
        itemStyle: { borderColor: p.border, borderWidth: 2, borderRadius: 3 },
        label: { show: false }, labelLine: { show: false },
        emphasis: { scale: true, scaleSize: 7 },
        data: rows.map((r, i) => ({
          name: r.abc_class, value: r.gmv,
          itemStyle: { color: [p.c[0], p.c[2], p.c[4]][i % 3] }
        }))
      }]
    }, true);
  }

  function renderCountry() {
    const p = P();
    const rows = D.country;
    const total = rows.reduce((s, r) => s + r.gmv, 0);
    const asc = [...rows].reverse();   // 分类轴自下而上，反转后最大值在顶部

    chart("c-country").setOption({
      grid: { left: 106, right: 58, top: 8, bottom: 22 },
      tooltip: {
        ...tooltipBase(p), trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: `rgba(${T.rgb}, .06)` } },
        formatter: (ps) => {
          const r = asc[ps[0].dataIndex];
          return `<b>${r.country}</b><br/>GMV　${moneyFull(r.gmv)}（${pct((r.gmv / total) * 100)}）<br/>` +
                 `客户　${num(r.customers)} 人`;
        }
      },
      xAxis: {
        type: "value", ...axisBase(p), axisLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
        splitLine: { lineStyle: { color: p.split } }
      },
      yAxis: {
        type: "category", data: asc.map((r) => r.country),
        ...axisBase(p), splitLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, width: 98, overflow: "truncate", fontSize: 11.5 }
      },
      series: [{
        type: "bar",
        data: asc.map((r, i) => ({
          value: r.gmv,
          itemStyle: { color: i === asc.length - 1 ? p.c[0] : p.c[3] }
        })),
        barWidth: "62%",
        itemStyle: { borderRadius: [0, 4, 4, 0] },
        label: {
          show: true, position: "right", fontSize: 10.5, color: p.axis,
          formatter: (x) => ((x.value / total) * 100).toFixed(1) + "%"
        }
      }]
    }, true);
  }

  function renderWeekday() {
    const p = P();
    const rows = D.weekday;
    const vals = rows.map((r) => r.avg_gmv);
    const max = Math.max(...vals);
    const min = Math.min(...vals);

    chart("c-weekday").setOption({
      grid: { left: 52, right: 16, top: 18, bottom: 28 },
      tooltip: {
        ...tooltipBase(p), trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: `rgba(${T.rgb}, .06)` } },
        formatter: (ps) => {
          const r = rows[ps[0].dataIndex];
          return `<b>${r.weekday}</b><br/>日均 GMV　${moneyFull(r.avg_gmv)}`;
        }
      },
      xAxis: {
        type: "category", data: rows.map((r) => r.weekday),
        ...axisBase(p), splitLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, fontSize: 11.5 }
      },
      yAxis: {
        type: "value", ...axisBase(p), axisLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
        splitLine: { lineStyle: { color: p.split } }
      },
      series: [{
        type: "bar", barWidth: "46%",
        data: rows.map((r) => ({
          value: r.avg_gmv,
          itemStyle: {
            color: r.avg_gmv === max ? p.c[0] : r.avg_gmv === min ? p.c[4] : p.c[2],
            borderRadius: [4, 4, 0, 0]
          }
        })),
        emphasis: { itemStyle: { color: p.c[1] } }
      }]
    }, true);
  }

  /** 第 3 页副图：月度订单数与客户数（同为计数，共用一个轴） */
  function renderVolume() {
    const p = P();
    const rows = D.trend;

    chart("c-volume").setOption({
      grid: { left: 52, right: 20, top: 32, bottom: 32 },
      tooltip: {
        ...tooltipBase(p), trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: p.axis, opacity: .35 } },
        formatter: (ps) => {
          const r = rows[ps[0].dataIndex];
          return `<b>${r.month}</b><br/>订单　${num(r.orders)} 单<br/>客户　${num(r.customers)} 人`;
        }
      },
      legend: {
        data: ["订单数", "客户数"], right: 4, top: 0,
        itemWidth: 12, itemHeight: 6,
        textStyle: { color: p.axis, fontSize: 11 }
      },
      xAxis: {
        type: "category", data: rows.map((r) => r.month), boundaryGap: false,
        ...axisBase(p),
        axisLabel: { ...axisBase(p).axisLabel, interval: 3, rotate: 30, margin: 10 },
        splitLine: { show: false }
      },
      yAxis: {
        type: "value", ...axisBase(p), axisLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
        splitLine: { lineStyle: { color: p.split } }
      },
      series: [
        {
          name: "订单数", type: "line", smooth: 0.25, showSymbol: false,
          data: rows.map((r) => r.orders),
          lineStyle: { width: 2.2, color: p.c[0] },
          areaStyle: {
            color: {
              type: "linear", x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: `rgba(${T.rgb}, .18)` },
                { offset: 1, color: `rgba(${T.rgb}, 0)` }
              ]
            }
          }
        },
        {
          name: "客户数", type: "line", smooth: 0.25, showSymbol: false,
          data: rows.map((r) => r.customers),
          lineStyle: { width: 1.6, color: p.c[5], type: [5, 4] }
        }
      ]
    }, true);
  }

  function renderPareto() {
    const p = P();
    const par = D.pareto;
    const nameOf = new Map(D.top.map((t) => [t.stock_code, t.description]));
    const labels = par.map((x) => clip(nameOf.get(x.stock_code) || x.stock_code, 14));

    chart("c-pareto").setOption({
      grid: { left: 46, right: 46, top: 34, bottom: 52 },
      legend: {
        data: ["单品 GMV", "累计占比"], right: 2, top: 0,
        itemWidth: 11, itemHeight: 6,
        textStyle: { color: p.axis, fontSize: 10.5 }
      },
      tooltip: {
        ...tooltipBase(p), trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: `rgba(${T.rgb}, .06)` } },
        formatter: (ps) => {
          const r = par[ps[0].dataIndex];
          return `<b>#${r.rn}　${nameOf.get(r.stock_code) || r.stock_code}</b><br/>` +
                 `单品 GMV　${moneyFull(r.gmv)}<br/>累计贡献　${pct(r.cum_pct)}`;
        }
      },
      xAxis: {
        type: "category", data: labels,
        ...axisBase(p), splitLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, interval: 0, rotate: 36, fontSize: 9.5, margin: 8 }
      },
      yAxis: [
        {
          type: "value", ...axisBase(p), axisLine: { show: false },
          axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
          splitLine: { lineStyle: { color: p.split } }
        },
        {
          type: "value", max: 100, ...axisBase(p), axisLine: { show: false },
          axisLabel: { ...axisBase(p).axisLabel, formatter: "{value}%" },
          splitLine: { show: false }
        }
      ],
      series: [
        {
          name: "单品 GMV", type: "bar", barWidth: "52%",
          data: par.map((x) => x.gmv),
          itemStyle: { color: p.c[3], borderRadius: [3, 3, 0, 0] },
          emphasis: { itemStyle: { color: p.c[1] } }
        },
        {
          name: "累计占比", type: "line", yAxisIndex: 1, smooth: 0.2,
          symbol: "circle", symbolSize: 4.5,
          data: par.map((x) => x.cum_pct),
          lineStyle: { width: 2, color: p.c[6] },
          itemStyle: { color: p.c[6], borderColor: p.border, borderWidth: 1.5 },
          markLine: {
            silent: true, symbol: "none",
            lineStyle: { color: p.split, type: "dashed", width: 1 },
            label: { formatter: "80% 临界", color: p.axis, fontSize: 9.5, position: "insideEndTop" },
            data: [{ yAxis: 80 }]
          }
        }
      ]
    }, true);
  }

  /** 第 5 页右图：GMV 前十单品 */
  function renderProducts() {
    const p = P();
    const top = D.top.slice(0, 10);
    const asc = [...top].reverse();
    const max = Math.max(...top.map((t) => t.gmv));

    chart("c-products").setOption({
      grid: { left: 118, right: 54, top: 8, bottom: 22 },
      tooltip: {
        ...tooltipBase(p), trigger: "axis",
        axisPointer: { type: "shadow", shadowStyle: { color: `rgba(${T.rgb}, .06)` } },
        formatter: (ps) => {
          const r = asc[ps[0].dataIndex];
          return `<b>${r.description || r.stock_code}</b><br/>` +
                 `GMV　${moneyFull(r.gmv)}<br/>销量　${num(r.qty)} 件<br/>` +
                 `订单　${num(r.orders)} 单`;
        }
      },
      xAxis: {
        type: "value", ...axisBase(p), axisLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, formatter: kfmt },
        splitLine: { lineStyle: { color: p.split } }
      },
      yAxis: {
        type: "category",
        data: asc.map((r) => clip(r.description || r.stock_code, 18)),
        ...axisBase(p), splitLine: { show: false },
        axisLabel: { ...axisBase(p).axisLabel, width: 110, overflow: "truncate", fontSize: 10.5 }
      },
      series: [{
        type: "bar", barWidth: "58%",
        data: asc.map((r) => ({
          value: r.gmv,
          itemStyle: { color: r.gmv === max ? p.c[0] : p.c[3], borderRadius: [0, 4, 4, 0] }
        })),
        emphasis: { itemStyle: { color: p.c[1] } }
      }]
    }, true);
  }

  function renderCharts() {
    if (!D.kpi) return;
    renderTrend();
    renderRfm();
    renderAbc();
    renderCountry();
    renderWeekday();
    renderVolume();
    renderPareto();
    renderProducts();
    el("gmv-spark").innerHTML = sparkline(D.trend.map((r) => r.gmv));
  }

  /* ── 5. 文字与表格（只在启动时跑一次，换主题不动它们） ───────────────── */

  function renderText() {
    const kpi = D.kpi;
    const trend = D.trend;
    const rfm = D.rfm;
    const abc = D.abc;
    const country = D.country;
    const weekday = D.weekday;
    const top = D.top.slice(0, 10);
    const par = D.pareto;

    /* 顶部状态 */
    el("period-text").textContent = `${kpi.date_from.slice(0, 7)} — ${kpi.date_to.slice(0, 7)}`;
    el("rows-pill").textContent = `${num(kpi.line_count)} 行明细`;

    /* KPI */
    el("kpi-gmv").textContent = money(kpi.gmv);
    el("kpi-orders").textContent = num(kpi.orders);
    el("kpi-customers").textContent = num(kpi.customers);
    el("kpi-aov").textContent = money(kpi.aov);
    el("kpi-return").innerHTML = pct(kpi.return_rate, 2).replace("%", "<span class='unit'>%</span>");

    const peak = trend.reduce((a, b) => (b.gmv > a.gmv ? b : a), trend[0]);
    el("kpi-gmv-foot").textContent = `峰值 ${peak.month} · ${money(peak.gmv)}`;

    el("rows-pill").textContent =
      `${kpi.date_from} 至 ${kpi.date_to} · ${num(kpi.line_count)} 行明细 · 金额单位 £`;

    /* 趋势 */
    el("badge-trend").textContent = `峰值 ${peak.month.slice(2)}`;
    const partial = kpi.date_to.slice(0, 7);
    const partialDay = Number(kpi.date_to.slice(8, 10));
    const isPartial = partialDay < 25 && trend.some((r) => r.month === partial);
    el("insight-trend").innerHTML =
      `峰值出现在 <b>${peak.month}</b>（${money(peak.gmv)} / ${num(peak.orders)} 单）。` +
      (isPartial
        ? `<span class="muted">末尾 ${partial} 仅含 ${partialDay} 天数据，下滑不代表经营恶化。</span>`
        : "");

    /* RFM */
    const totalCustomers = rfm.reduce((s, r) => s + r.customers, 0);
    const totalGmvRfm = rfm.reduce((s, r) => s + r.total_gmv, 0);
    const topSeg = rfm[0];
    const retain = rfm.find((r) => r.segment.includes("挽留"));
    const churn = rfm.find((r) => r.segment.includes("流失"));

    el("badge-rfm").textContent = `${num(totalCustomers)} 人`;
    el("badge-rfm-total").textContent = `${rfm.length} 个分层`;
    el("rfm-note").textContent = `R 最近购买 · F 购买频次 · M 消费金额 · 各按五分位打分`;
    el("insight-rfm").innerHTML =
      `<b>${topSeg.segment}</b>仅占 ${pct((topSeg.customers / totalCustomers) * 100)} 的人数，` +
      `却贡献 ${pct((topSeg.total_gmv / totalGmvRfm) * 100)} 的客户营收。`;

    el("rfm-strip").innerHTML = [
      { label: "核心客户 GMV 占比", value: pct((topSeg.total_gmv / totalGmvRfm) * 100), accent: true },
      { label: "可召回人数", value: num(retain ? retain.customers : 0) + " 人" },
      { label: "已流失人数", value: num(churn ? churn.customers : 0) + " 人" }
    ].map((m) => `<div>
        <p class="m-label">${m.label}</p>
        <p class="m-value ${m.accent ? "accent" : ""}">${m.value}</p>
      </div>`).join("");

    /* ABC */
    const totalSku = abc.reduce((s, r) => s + r.sku_count, 0);
    const a = abc.find((r) => r.abc_class.startsWith("A"));
    el("badge-abc").textContent = `${num(totalSku)} SKU`;
    el("badge-abc-total").textContent = `${abc.length} 个分类`;
    el("abc-note").textContent = `按累计 GMV 贡献划分 · A 80% / B 95% / C 尾部`;
    el("insight-abc").innerHTML =
      `A 类 <b>${pct((a.sku_count / totalSku) * 100)} 的 SKU 贡献了 ${pct(a.gmv_share_pct)} 的营收</b>，` +
      `尾部一半 SKU 只分到 5%。`;

    /* 周内 */
    const vals = weekday.map((r) => r.avg_gmv);
    const maxW = Math.max(...vals);
    const minW = Math.min(...vals);
    const maxRow = weekday[vals.indexOf(maxW)];
    const minRow = weekday[vals.indexOf(minW)];
    el("badge-weekday").textContent = `峰值 ${maxRow.weekday}`;
    el("weekday-note").textContent = `以各星期出现的天数折算日均，排除天数不均的影响`;
    el("insight-weekday").innerHTML =
      `<b>${maxRow.weekday}</b>日均 ${money(maxRow.avg_gmv)} 最高，` +
      `${minRow.weekday}只有 ${money(minRow.avg_gmv)}，相差 ${(maxW / minW).toFixed(1)} 倍。`;

    /* 月度订单/客户 */
    const peakOrders = trend.reduce((a2, b) => (b.orders > a2.orders ? b : a2), trend[0]);
    el("badge-volume").textContent = `${num(peakOrders.orders)} 单峰值`;
    el("insight-volume").innerHTML =
      `订单与客户数在 <b>${peakOrders.month}</b> 同步见顶（${num(peakOrders.orders)} 单 / ` +
      `${num(peakOrders.customers)} 人），两者的缺口即老客复购强度。`;

    /* 国家 */
    const topCountryGmv = country.reduce((s, r) => s + r.gmv, 0);
    const uk = country[0];
    el("badge-country").textContent = `${country.length} 个市场`;
    el("market-note").textContent = `十个市场合计占全站 GMV 的绝大部分`;
    el("insight-country").innerHTML =
      `<b>${uk.country}</b> 占这十个市场 GMV 的 ${pct((uk.gmv / topCountryGmv) * 100)}，` +
      `其余市场合计不到 ${pct(100 - (uk.gmv / topCountryGmv) * 100, 0)}。`;

    /* 商品 */
    el("badge-products").textContent = `Top ${top.length}`;
    el("insight-products").innerHTML =
      `冠军单品 <b>${clip(top[0].description, 26)}</b> 卖出 ${num(top[0].qty)} 件、` +
      `贡献 ${money(top[0].gmv)}。`;

    /* 帕累托 */
    const lastPar = par[par.length - 1];
    el("badge-pareto").textContent = `Top${par.length} 占 ${pct(lastPar.cum_pct)}`;
    el("insight-pareto").innerHTML =
      `头部 ${par.length} 个单品只贡献 <b>${pct(lastPar.cum_pct)}</b> 的营收 —— ` +
      `不是爆款驱动结构，真正的临界点要到第 1000 名以后。`;
  }

  /* ── 6. 表格 ─────────────────────────────────────────────────────────── */

  function renderRows(tableEl, rows, columns, sortState) {
    tableEl.querySelector("tbody").innerHTML = rows
      .map((r) => "<tr>" + columns.map((c) => `<td class="${c.cls || ""}">${c.render(r)}</td>`).join("") + "</tr>")
      .join("");

    tableEl.querySelectorAll("thead th").forEach((th) => {
      th.classList.remove("sort-asc", "sort-desc");
      if (sortState.key === th.dataset.sort) {
        th.classList.add(sortState.dir === 1 ? "sort-asc" : "sort-desc");
      }
    });
  }

  function sortable(tableEl, data, columns) {
    const sortState = { key: null, dir: 1 };
    const draw = () => {
      const rows = [...data];
      if (sortState.key) {
        const isNum = tableEl.querySelector(`th[data-sort="${sortState.key}"]`)?.dataset.type === "num";
        rows.sort((a, b) => {
          const x = a[sortState.key], y = b[sortState.key];
          return (isNum ? x - y : String(x).localeCompare(String(y), "zh")) * sortState.dir;
        });
      }
      renderRows(tableEl, rows, columns, sortState);
    };

    tableEl.querySelectorAll("thead th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sort;
        sortState.dir = sortState.key === key ? -sortState.dir : -1;   // 首次点击降序
        sortState.key = key;
        draw();
      });
    });

    draw();
  }

  function renderTables() {
    const rfm = D.rfm;
    const abc = D.abc;
    const totalGmvRfm = rfm.reduce((s, r) => s + r.total_gmv, 0);
    const totalSku = abc.reduce((s, r) => s + r.sku_count, 0);

    sortable(el("table-rfm"), rfm, [
      { render: (r) => `<span class="tag">${r.segment}</span>` },
      { cls: "ta-r", render: (r) => num(r.customers) },
      { cls: "ta-r", render: (r) => num(r.avg_recency_days) },
      { cls: "ta-r", render: (r) => num(r.avg_frequency) },
      { cls: "ta-r", render: (r) => moneyFull(r.avg_monetary) },
      {
        cls: "ta-r strong cell-bar",
        render: (r) => `<span style="--p:${((r.total_gmv / totalGmvRfm) * 100).toFixed(1)}%">` +
                       `${moneyFull(r.total_gmv)}</span>`
      }
    ]);

    sortable(
      el("table-abc"),
      abc.map((r) => ({ ...r, sku_pct: (r.sku_count / totalSku) * 100 })),
      [
        { render: (r) => `<span class="tag" title="${r.abc_class}">${r.abc_class.split("(")[0]}</span>` },
        { cls: "ta-r", render: (r) => num(r.sku_count) },
        { cls: "ta-r", render: (r) => moneyFull(r.gmv) },
        {
          cls: "ta-r strong cell-bar",
          render: (r) => `<span style="--p:${r.gmv_share_pct}%">${pct(r.gmv_share_pct, 2)}</span>`
        },
        { cls: "ta-r", render: (r) => pct(r.sku_pct) }
      ]
    );
  }

  /* ── 7. 翻页 ─────────────────────────────────────────────────────────── */

  const PAGE_META = [
    { title: "经营概览" },
    { title: "客户价值" },
    { title: "运营节律" },
    { title: "商品结构" },
    { title: "市场与单品" }
  ];

  const state = { page: 0, total: 0, locked: false };
  let track = null, viewport = null;
  let pages = [], railItems = [];

  /** 支持 #3 这样的深链，直接落到第 3 页（页码从 1 开始，对人友好） */
  function hashPage() {
    const m = location.hash.match(/\d+/);
    if (!m) return 0;
    return Math.max(0, Math.min(PAGE_META.length - 1, Number(m[0]) - 1));
  }

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function buildRail() {
    const rail = el("rail");
    rail.innerHTML = PAGE_META.map((m, i) => `
      <button class="rail-item" type="button" data-goto="${i}" aria-label="第 ${i + 1} 页：${m.title}">
        <span class="rail-label">${m.title}</span>
        <span class="rail-dot"></span>
      </button>`).join("");
    railItems = [...rail.querySelectorAll(".rail-item")];
    rail.addEventListener("click", (e) => {
      const btn = e.target.closest(".rail-item");
      if (btn) go(Number(btn.dataset.goto));
    });
  }

  function applyPage() {
    track.style.transform = `translate3d(${(-state.page * 100) / state.total}%, 0, 0)`;
    document.documentElement.style.setProperty("--i", state.page);

    pages.forEach((p, i) => p.classList.toggle("is-active", i === state.page));
    railItems.forEach((r, i) => {
      r.classList.toggle("is-active", i === state.page);
      r.setAttribute("aria-current", i === state.page ? "page" : "false");
    });

    el("hint").classList.toggle("is-quiet", state.page > 0);
  }

  function go(target) {
    const i = Math.max(0, Math.min(state.total - 1, target));
    if (i === state.page) return;
    state.page = i;
    applyPage();
    try { history.replaceState(null, "", "#" + (i + 1)); } catch (_) { /* file:// 下忽略 */ }
  }

  /** 一次翻一页，并给动画留出冷却，避免触控板惯性连翻好几页 */
  function step(dir) {
    if (state.locked) return;
    const next = state.page + dir;
    if (next < 0 || next >= state.total) return;
    state.locked = true;
    go(next);
    setTimeout(() => { state.locked = false; }, reduced ? 60 : 820);
  }

  function bindPaging() {
    track = el("track");
    viewport = el("viewport");
    pages = [...document.querySelectorAll(".page")];
    state.total = pages.length;

    document.documentElement.style.setProperty("--n", state.total);
    track.style.setProperty("--n", state.total);

    // 入场错峰：给每个页面的一级元素编号
    pages.forEach((p) => {
      [...p.children].forEach((n, i) => n.style.setProperty("--i", i));
      p.querySelectorAll(".split > *").forEach((n, i) => n.style.setProperty("--i", i + 1));
    });

    /* 滚轮 */
    viewport.addEventListener("wheel", (e) => {
      if (window.innerWidth <= 900) return;          // 窄屏改成纵向滚动
      if (Math.abs(e.deltaY) < 8) return;
      e.preventDefault();
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    /* 键盘 */
    document.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const next = ["ArrowDown", "ArrowRight", "PageDown", " "].includes(e.key);
      const prev = ["ArrowUp", "ArrowLeft", "PageUp"].includes(e.key);
      if (e.key === "Home") { e.preventDefault(); go(0); return; }
      if (e.key === "End") { e.preventDefault(); go(state.total - 1); return; }
      if (next) { e.preventDefault(); step(1); }
      if (prev) { e.preventDefault(); step(-1); }
    });

    /* 触控滑动 */
    let sx = 0, sy = 0;
    viewport.addEventListener("touchstart", (e) => {
      sx = e.touches[0].clientX; sy = e.touches[0].clientY;
    }, { passive: true });

    viewport.addEventListener("touchend", (e) => {
      if (window.innerWidth <= 900) return;
      const dx = e.changedTouches[0].clientX - sx;
      const dy = e.changedTouches[0].clientY - sy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) step(dx < 0 ? 1 : -1);
    }, { passive: true });

    state.page = hashPage();
    applyPage();
  }

  /* ── 8. 光标柔光：卡片跟随指针，替代静态高亮 ─────────────────────────── */

  function bindSpotlight() {
    if (!window.matchMedia("(hover: hover)").matches) return;
    document.addEventListener("pointermove", (e) => {
      const node = e.target.closest(".card, .kpi");
      if (!node) return;
      const r = node.getBoundingClientRect();
      node.style.setProperty("--mx", `${e.clientX - r.left}px`);
      node.style.setProperty("--my", `${e.clientY - r.top}px`);
    }, { passive: true });
  }

  /* ── 9. 尺寸自适应 ───────────────────────────────────────────────────── */

  function bindResize() {
    let timer = null;
    window.addEventListener("resize", () => {
      clearTimeout(timer);
      timer = setTimeout(() => Object.values(charts).forEach((c) => c.resize()), 140);
    });
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(() => Object.values(charts).forEach((c) => c.resize()));
      ro.observe(el("viewport"));
    }
  }

  /* ── 10. 装配 ────────────────────────────────────────────────────────── */

  // 遮罩的"显形"在 index.html 的内联脚本里完成，这里只负责收场
  function hideIntro() {
    const box = el("intro");
    box.classList.remove("is-show");
    box.classList.add("is-done");
    box.setAttribute("aria-hidden", "true");
  }

  function introProgress(done, total) {
    el("intro-bar").style.width = `${(done / total) * 100}%`;
    el("intro-note").textContent = `正在装配 5 个分析视图… ${done}/${total}`;
  }

  function introError(err) {
    const box = el("intro");
    box.classList.add("is-show", "is-error");
    el("intro-note").textContent =
      "数据没拿到：" + (err.message || "未知错误") + "。请确认 MySQL 与后端已启动。";
    document.getElementById("conn-dot").classList.add("is-error");
    el("period-text").textContent = "数据仓库连接失败";
  }

  /**
   * 启动：
   * 1) 先把 8 个接口全部取完（只有这一步会等待）
   * 2) 一次性渲染五个页面
   * 3) 之后再怎么翻页、换主题，都不会有加载态
   *
   * 首屏由 <html class="is-booting"> 兜住：外壳从第一次绘制起就是隐藏的，
   * 数据到齐后整体淡入，不会先露出"—"指标和空图表。
   * 遮罩在 HTML 里就显形（不等 JS 解析），所以从第一帧起就是"盖住"的状态，
   * 中间没有空白帧，也没有半个页面的闪烁。
   */
  async function boot() {
    buildThemes();
    buildRail();
    bindPaging();
    bindSpotlight();
    bindResize();

    const savedTheme = (() => {
      try { return localStorage.getItem("ea-theme"); } catch (_) { return null; }
    })();
    // 支持 ?theme=ink 直接指定配色（分享链接时有用）
    const urlTheme = new URLSearchParams(location.search).get("theme");
    applyTheme(urlTheme || savedTheme || "blue", !urlTheme);

    // 遮罩在 HTML 里就已显形（见 index.html 的内联脚本），这里不再排队等待
    try {
      await preload(introProgress);
    } catch (err) {
      introError(err);
      el("intro-retry").addEventListener("click", () => {
        el("intro").classList.remove("is-error");
        boot();
      }, { once: true });
      return;
    }

    try {
      if (typeof echarts === "undefined") throw new Error("图表库 echarts.min.js 没有加载成功");
      renderText();
      renderCharts();
      renderTables();
    } catch (err) {
      introError(err);
      return;
    }

    // 首屏定位到深链指定的那一页，禁用动画，避免一睁眼就看到从第 1 页滑过去
    track.classList.add("no-anim");
    applyPage();

    // 撤掉 is-booting 让外壳淡入，同时收掉遮罩：交叉过渡，中间不露空白帧
    requestAnimationFrame(() => {
      document.documentElement.classList.remove("is-booting");
      hideIntro();
      requestAnimationFrame(() => track.classList.remove("no-anim"));
      setTimeout(() => Object.values(charts).forEach((c) => c.resize()), 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
