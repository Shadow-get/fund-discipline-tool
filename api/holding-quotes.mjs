import { fetchHoldingQuotes } from "../server/holdingQuotes.mjs";
import { sendError, sendJson, getSearchParams } from "./_utils.mjs";

export default async function handler(req, res) {
  try {
    const params = getSearchParams(req);
    const codes = String(params.get("codes") ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean);
    sendJson(res, 200, await fetchHoldingQuotes(codes));
  } catch (error) {
    sendError(res, error, "Holding quotes failed");
  }
}
