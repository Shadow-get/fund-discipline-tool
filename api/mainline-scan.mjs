import { scanMainlines } from "../server/mainlineScan.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const forceFallback = params.get("fallback") === "1";
    const forceRefresh = params.get("refresh") === "1";
    sendJson(res, 200, await scanMainlines({ forceFallback, forceRefresh }));
  } catch (error) {
    sendError(res, error, "Mainline scan failed");
  }
}
