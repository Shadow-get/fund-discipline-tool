import { scanStockOpportunities } from "../server/stockOpportunityScan.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const forceFallback = params.get("fallback") === "1";
    const query = params.get("query") ?? "";
    const fast = params.get("fast") !== "0" && !query.trim();
    sendJson(res, 200, await scanStockOpportunities({ forceFallback, query, fast }));
  } catch (error) {
    sendError(res, error, "Stock opportunity scan failed");
  }
}
