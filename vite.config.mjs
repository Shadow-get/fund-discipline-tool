import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fallbackLowValuationScan } from "./server/lowValuationSnapshot.mjs";
import { lowValuationUniverse } from "./server/lowValuationUniverse.mjs";
import { fallbackMainlineScan } from "./server/mainlineSnapshot.mjs";
import { fetchHoldingQuotes } from "./server/holdingQuotes.mjs";
import { fetchMarketKline } from "./server/marketKline.mjs";
import { scanMarketRiskNews } from "./server/marketRiskNews.mjs";
import { scanMainlines } from "./server/mainlineScan.mjs";
import { mainlineUniverse } from "./server/mainlineUniverse.mjs";
import { scanLowValuation, scanLowValuationDynamic } from "./server/lowValuationScan.mjs";
import { runPythonCore } from "./server/pythonCore.mjs";
import { scanStockOpportunities } from "./server/stockOpportunityScan.mjs";
import { isAllowedStateKey, readAppState, writeAppState } from "./server/appStateStore.mjs";

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

export default defineConfig({
  base: "./",
  plugins: [
    vue(),
    {
      name: "python-core-api",
      configureServer(server) {
        server.middlewares.use("/api/app-state", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const key = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
            if (!isAllowedStateKey(key)) {
              sendJson(res, 404, { message: "Unknown app state key" });
              return;
            }

            if (req.method === "GET") {
              sendJson(res, 200, { key, value: await readAppState(key) });
              return;
            }

            if (req.method === "PUT") {
              const body = await readJsonBody(req);
              sendJson(res, 200, { key, value: await writeAppState(key, body?.value ?? null) });
              return;
            }

            sendJson(res, 405, { message: "Method not allowed" });
          } catch (error) {
            sendJson(res, 500, { message: error instanceof Error ? error.message : "App state request failed" });
          }
        });

        server.middlewares.use("/api/calculate", async (req, res) => {
          if (req.method !== "POST") {
            sendJson(res, 405, { message: "Method not allowed" });
            return;
          }

          try {
            const body = await readJsonBody(req);
            const action = body?.action;
            if (typeof action !== "string") {
              sendJson(res, 400, { message: "Missing calculation action" });
              return;
            }

            const payload = await runPythonCore(action, body?.payload ?? {}, { timeoutMs: 12000 });
            sendJson(res, 200, payload);
          } catch (error) {
            sendJson(res, 500, {
              message: error instanceof Error ? error.message : "Python calculation failed",
            });
          }
        });

        server.middlewares.use("/api/mainline-scan", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const forceFallback = url.searchParams.get("fallback") === "1";
            const forceRefresh = url.searchParams.get("refresh") === "1";
            let payload;

            try {
              payload = await scanMainlines({ forceFallback, forceRefresh });
            } catch (jsError) {
              payload = await runPythonCore(
                "mainline_scan",
                {
                  forceFallback,
                  forceRefresh,
                  universe: mainlineUniverse,
                  fallback: fallbackMainlineScan,
                },
                { timeoutMs: 45000 },
              );
              payload.message = `${payload.message} JS 主线扫描异常，已切换 Python 扫描。原因：${
                jsError instanceof Error ? jsError.message : "未知错误"
              }`;
            }

            sendJson(res, 200, payload);
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              message: error instanceof Error ? error.message : "Mainline scan failed",
              results: [],
            });
          }
        });

        server.middlewares.use("/api/low-valuation-scan", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const dynamic = url.searchParams.get("dynamic") === "1";
            const fast = url.searchParams.get("fast") === "1";
            let payload;

            if (dynamic) {
              try {
                sendJson(res, 200, await scanLowValuationDynamic({ riskFreeYield: 2.2, fast }));
              } catch (error) {
                sendJson(res, 200, {
                  mode: "error",
                  source: "动态公开行情",
                  updatedAt: new Date().toISOString(),
                  riskFreeYield: 2.2,
                  message: `动态低估值扫描失败：${error instanceof Error ? error.message : "未知错误"}`,
                  methodology: [],
                  results: [],
                });
              }
              return;
            }

            try {
              payload = await runPythonCore(
                "low_valuation_scan",
                {
                  universe: lowValuationUniverse,
                  fallback: fallbackLowValuationScan,
                  riskFreeYield: 2.2,
                },
                { timeoutMs: 12000 },
              );
            } catch (error) {
              payload = scanLowValuation({
                universe: lowValuationUniverse,
                fallback: fallbackLowValuationScan,
                riskFreeYield: 2.2,
              });
              payload.message = `${payload.message} Python 低估值扫描不可用，已切换 JS 模型。原因：${
                error instanceof Error ? error.message : "未知错误"
              }`;
            }

            sendJson(res, 200, payload);
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              message: error instanceof Error ? error.message : "Low valuation scan failed",
              results: [],
            });
          }
        });

        server.middlewares.use("/api/stock-opportunities", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const forceFallback = url.searchParams.get("fallback") === "1";
            const query = url.searchParams.get("query") ?? "";
            sendJson(res, 200, await scanStockOpportunities({ forceFallback, query }));
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              source: "本地服务",
              updatedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : "Stock opportunity scan failed",
              methodology: [],
              results: [],
            });
          }
        });

        server.middlewares.use("/api/market-risk-news", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const forceFallback = url.searchParams.get("fallback") === "1";
            sendJson(res, 200, await scanMarketRiskNews({ forceFallback }));
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              source: "本地服务",
              updatedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : "Market risk news scan failed",
              overallRisk: { score: 0, level: "neutral", label: "数据异常" },
              templates: [],
              signalSummary: [],
              items: [],
            });
          }
        });

        server.middlewares.use("/api/holding-quotes", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const codes = (url.searchParams.get("codes") ?? "")
              .split(",")
              .map((code) => code.trim())
              .filter(Boolean);

            try {
              const payload = await fetchHoldingQuotes(codes);
              sendJson(res, 200, payload);
            } catch (error) {
              sendJson(res, 200, {
                mode: "fallback",
                source: "本地持仓",
                updatedAt: new Date().toISOString(),
                message: `东方财富行情暂不可用，继续使用手动涨跌。原因：${error instanceof Error ? error.message : "未知错误"}`,
                quotes: [],
              });
            }
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              source: "本地持仓",
              updatedAt: new Date().toISOString(),
              message: error instanceof Error ? error.message : "Holding quote scan failed",
              quotes: [],
            });
          }
        });

        server.middlewares.use("/api/market-kline", async (req, res) => {
          try {
            const url = new URL(req.url ?? "", "http://127.0.0.1");
            const code = url.searchParams.get("code") ?? "cn_hs300";
            const period = url.searchParams.get("period") ?? "week";
            const payload = await fetchMarketKline({ code, period });
            sendJson(res, 200, payload);
          } catch (error) {
            sendJson(res, 500, {
              mode: "error",
              source: "本地服务",
              updatedAt: new Date().toISOString(),
              period: "week",
              target: {
                id: "unknown",
                name: "未知标的",
                category: "未知",
                representativeIndex: "未知",
                code: "",
                secid: "",
              },
              message: error instanceof Error ? error.message : "Market kline failed",
              points: [],
              analysis: null,
            });
          }
        });
      },
    },
  ],
});
