import { scanStockOpportunities } from "../server/stockOpportunityScan.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const forceFallback = params.get("fallback") === "1";
    const query = params.get("query") ?? "";
    sendJson(res, 200, await scanStockOpportunities({ forceFallback, query }));
  } catch (error) {
    sendError(res, error, "Stock opportunity scan failed");
  }
}
