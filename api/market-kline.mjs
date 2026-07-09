import { fetchMarketKline } from "../server/marketKline.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const code = params.get("code") ?? "cn_hs300";
    const period = params.get("period") ?? "week";
    sendJson(res, 200, await fetchMarketKline({ code, period }));
  } catch (error) {
    sendError(res, error, "Market kline failed");
  }
}
