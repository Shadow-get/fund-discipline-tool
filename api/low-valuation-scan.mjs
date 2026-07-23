import { scanLowValuation, scanLowValuationDynamic } from "../server/lowValuationScan.mjs";
import { fallbackLowValuationScan } from "../server/lowValuationSnapshot.mjs";
import { lowValuationUniverse } from "../server/lowValuationUniverse.mjs";
import { getSearchParams, sendJson } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    if (params.get("dynamic") === "1") {
      try {
        sendJson(res, 200, await scanLowValuationDynamic({ riskFreeYield: 2.2, fast: params.get("fast") === "1" }));
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

    sendJson(
      res,
      200,
      scanLowValuation({
        universe: lowValuationUniverse,
        fallback: fallbackLowValuationScan,
        riskFreeYield: 2.2,
      }),
    );
  } catch (error) {
    sendJson(res, 200, {
      ...fallbackLowValuationScan,
      mode: "fallback",
      message: `低估值模型异常，当前展示内置快照。原因：${error instanceof Error ? error.message : "未知错误"}`,
    });
  }
}
