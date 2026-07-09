export function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export function getSearchParams(req) {
  return new URL(req.url ?? "", "https://example.com").searchParams;
}

export function readJsonBody(req) {
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

export function sendError(res, error, fallbackMessage) {
  sendJson(res, 500, {
    mode: "error",
    source: "Vercel API",
    updatedAt: new Date().toISOString(),
    message: error instanceof Error ? error.message : fallbackMessage,
    results: [],
  });
}
