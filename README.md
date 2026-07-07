# Fund Discipline Tool

一个用于指数基金纪律投资练习的本地 Vue 工具。当前重点功能包括：

- 月度现金流分配
- 高低估买卖器
- 当年主线雷达
- 产业增强/机会资金池
- 组合体检与情景模拟

本项目仅用于投资分析、教育和自我规划参考，不构成具体投资顾问建议。

## Python 计算核心

核心规则已经沉到 `pycore/licai_core`：

- `rules.py`：月度计划、年度收割、组合体检、定投倍数、卖出计划。
- `mainline_scan.py`：主线雷达行情扫描、热度评分、状态分组、缓存/快照兜底。
- `cli.py`：统一 JSON stdin/stdout 调用入口。

Vite 开发服务通过 `server/pythonCore.mjs` 调用 Python。前端页面优先请求 `/api/calculate`，如果本地 API 或 Python 不可用，会退回原来的 TypeScript 规则，避免页面空白。

## 开发

```bash
npm run dev
```

如 5173 被占用，可临时指定端口：

```powershell
$env:VITE_PORT="5174"; node scripts/start-dev.mjs
```

生产构建：

```bash
npm run build
```

直接测试 Python 核心：

```powershell
$env:PYTHONPATH="D:\GPT\licai\pycore"
'{"action":"portfolio_health","payload":{"chinaCore":50000,"globalCore":55000,"defensive":45000,"satellite":25000,"reserve":25000}}' | python -m licai_core.cli
```
