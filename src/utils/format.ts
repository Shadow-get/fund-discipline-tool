export function money(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

export function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function score(value: number) {
  return `${Math.round(value)} 分`;
}

export function safeNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function signedPercent(value: unknown) {
  const number = safeNumber(value);
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${number.toFixed(2)}%`;
}

export function returnClass(value: unknown) {
  const number = safeNumber(value);
  if (number > 0) return "return-positive";
  if (number < 0) return "return-negative";
  return "";
}
