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
