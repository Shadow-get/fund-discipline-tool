import { readJsonBody, sendJson } from "../_utils.mjs";

const allowedKeys = new Set(["accounts", "strategies"]);

function getKey(req) {
  const pathname = new URL(req.url ?? "", "https://example.com").pathname;
  return decodeURIComponent(pathname.split("/").filter(Boolean).at(-1) ?? "");
}

export default async function handler(req, res) {
  const key = getKey(req);
  if (!allowedKeys.has(key)) {
    sendJson(res, 404, { message: "Unknown app state key" });
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, {
      key,
      value: null,
      message: "Vercel serverless 未接入数据库，账户/策略数据使用浏览器本地存储。",
    });
    return;
  }

  if (req.method === "PUT") {
    const body = await readJsonBody(req);
    sendJson(res, 200, {
      key,
      value: body?.value ?? null,
      message: "已接收；当前线上版本不做跨设备持久化。",
    });
    return;
  }

  sendJson(res, 405, { message: "Method not allowed" });
}
