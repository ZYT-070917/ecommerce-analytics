"""一键启动：按需建仓 → 起服务 → 开浏览器。

用法：
    python run.py              数据库已有数据就直接起服务，没有才跑 ETL
    python run.py --rebuild    强制重跑 ETL（换数据源或改了清洗逻辑时用）
    python run.py --port 8080  换端口
    python run.py --no-browser 不自动开浏览器

相比原来的两步（先 python etl/build_dw.py，再 uvicorn api.main:app），
这里会自动判断该不该跑 ETL，省掉记忆成本和误操作。
"""

import argparse
import os
import socket
import sys
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))   # 保证从任意目录运行都能 import 到 api / etl


def log(msg: str) -> None:
    print(f"[启动] {msg}", flush=True)


def fact_rows() -> int | None:
    """返回事实表行数；库或表还不存在时返回 None（不抛异常）。"""
    from dotenv import load_dotenv
    from sqlalchemy import create_engine, text

    load_dotenv(ROOT / ".env")
    url = os.getenv("DATABASE_URL")
    if not url:
        sys.exit("找不到 DATABASE_URL。请先把 .env.example 复制成 .env，并填上你的 MySQL 密码。")

    try:
        engine = create_engine(url, pool_pre_ping=True)
        with engine.connect() as conn:
            return conn.execute(text("SELECT COUNT(*) FROM fact_sales")).scalar()
    except Exception:
        return None


def port_busy(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.settimeout(0.3)
        return s.connect_ex(("127.0.0.1", port)) == 0


def main() -> None:
    ap = argparse.ArgumentParser(description="电商经营分析平台 · 一键启动")
    ap.add_argument("--port", type=int, default=8000, help="监听端口，默认 8000")
    ap.add_argument("--rebuild", action="store_true", help="强制重跑 ETL")
    ap.add_argument("--no-browser", action="store_true", help="不自动打开浏览器")
    args = ap.parse_args()

    rows = fact_rows()
    need_etl = args.rebuild or not rows

    if need_etl:
        reason = "已指定 --rebuild" if args.rebuild else "数据库里还没有数据"
        log(f"{reason}，开始构建数据仓库（约 5 分钟，只需一次）…")
        from etl.build_dw import main as build
        build()
        rows = fact_rows()
        if not rows:
            sys.exit("ETL 跑完了但事实表仍然为空，请检查上方的错误输出。")
        log(f"建仓完成：fact_sales {rows:,} 行")
    else:
        log(f"数据已就绪：fact_sales {rows:,} 行，跳过 ETL（要重建请加 --rebuild）")

    if port_busy(args.port):
        sys.exit(f"端口 {args.port} 已被占用。换一个试试：python run.py --port {args.port + 1}")

    url = f"http://127.0.0.1:{args.port}"
    log(f"服务地址 {url}    接口文档 {url}/docs    Ctrl+C 停止")

    if not args.no_browser:
        # 等服务器真正监听后再开浏览器，否则会先看到"无法访问"
        threading.Timer(1.5, lambda: webbrowser.open(url)).start()

    import uvicorn
    from api.main import app
    uvicorn.run(app, host="127.0.0.1", port=args.port, log_level="info")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[启动] 已停止")
