import { fallbackLowValuationScan } from "../server/lowValuationSnapshot.mjs";
import { sendJson } from "./_utils.mjs";

export default async function handler(_req, res) {
  sendJson(res, 200, {
    ...fallbackLowValuationScan,
    mode: "fallback",
    message: "线上低估值接口暂未接入数据库/估值源，当前展示内置快照。",
  });
}
