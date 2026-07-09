import { scanMarketRiskNews } from "../server/marketRiskNews.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const forceFallback = params.get("fallback") === "1";
    sendJson(res, 200, await scanMarketRiskNews({ forceFallback }));
  } catch (error) {
    sendError(res, error, "Market risk news scan failed");
  }
}
