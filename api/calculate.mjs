import { readJsonBody, sendJson } from "./_utils.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    sendJson(res, 405, { message: "Method not allowed" });
    return;
  }

  await readJsonBody(req).catch(() => ({}));
  sendJson(res, 501, {
    mode: "fallback",
    message: "线上 Python 计算服务暂未启用，前端将使用浏览器内置规则计算。",
  });
}
