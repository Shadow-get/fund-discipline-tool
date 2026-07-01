import type { MainlineScanItem, MarketState } from "../types";

const strategicDcaIds = new Set([
  "theme_power_equipment",
  "theme_liquid_cooling_power",
  "style_dividend_lowvol",
  "style_dividend",
  "style_soedividend",
]);

export type SatelliteDeployment = {
  multiplier: number;
  state: MarketState;
  label: string;
  title: string;
  mode: "strategic-dca" | "opportunity-build" | "wait";
  reason: string;
  trigger: string;
};

export function getSatelliteDeployment(item?: MainlineScanItem | null): SatelliteDeployment {
  if (!item) {
    return {
      multiplier: 0,
      state: "overheated",
      label: "0%机会预算",
      title: "没有可用主线，本月不建仓",
      mode: "wait",
      reason: "卫星仓不是长期定投池；没有清晰主线时，机会预算全部进入等待资金。",
      trigger: "等主线雷达出现主线候选，或观察区方向回调后资金强弱继续确认，再启用卫星建仓。",
    };
  }

  if (strategicDcaIds.has(item.candidateId) && item.status !== "过热等待" && item.status !== "暂不进入") {
    if (item.heatScore < 70) {
      return {
        multiplier: 1,
        state: "fair",
        label: "100%产业增强",
        title: `${item.name} 可低速定投`,
        mode: "strategic-dca",
        reason: `${item.name} 更偏长期确定性和产业增强，爆发力不一定强，但在热度可控时可以使用卫星预算低速定投。`,
        trigger: "热度升高或估值拥挤时降到50%；跌破产业逻辑或资金持续流出时暂停。",
      };
    }

    return {
      multiplier: 0.5,
      state: "high",
      label: "50%产业增强",
      title: `${item.name} 降速定投`,
      mode: "strategic-dca",
      reason: `${item.name} 具备长期配置属性，但当前热度不低，只使用卫星预算的50%低速定投，剩余进入等待资金。`,
      trigger: "回调后热度下降可恢复到100%；热度继续升高则暂停新增。",
    };
  }

  if (item.status === "过热等待" || item.status === "暂不进入") {
    return {
      multiplier: 0,
      state: "overheated",
      label: "0%机会预算",
      title: `${item.name} 不触发建仓`,
      mode: "wait",
      reason: `${item.name} 当前为${item.status}，卫星仓不做机械定投，本月机会预算进入等待资金。`,
      trigger: "等待热度降到合理区、回调10%-15%，并且资金强弱没有明显破坏。",
    };
  }

  if (item.status === "可小仓观察") {
    return {
      multiplier: item.heatScore >= 72 ? 0 : 0.1,
      state: item.heatScore >= 72 ? "overheated" : "high",
      label: item.heatScore >= 72 ? "0%机会预算" : "10%跟踪仓",
      title: item.heatScore >= 72 ? `${item.name} 只观察不买` : `${item.name} 只建立跟踪仓`,
      mode: item.heatScore >= 72 ? "wait" : "opportunity-build",
      reason:
        item.heatScore >= 72
          ? `${item.name} 有线索但热度偏高，先不动用卫星预算。`
          : `${item.name} 证据链还不完整，只允许用卫星机会预算的10%建立跟踪仓，不做长期定投。`,
      trigger: "继续跑赢宽基、成交不拥挤，或回调后热度下降，再考虑提高到30%。",
    };
  }

  if (item.heatScore < 65) {
    return {
      multiplier: 0.5,
      state: "fair",
      label: "50%分批建仓",
      title: `${item.name} 触发标准建仓`,
      mode: "opportunity-build",
      reason: `${item.name} 是主线候选且热度未明显拥挤，可动用卫星机会预算的50%分批建仓。`,
      trigger: "若后续继续确认且未过热，下一轮再补；若热度快速升高，剩余预算继续等待。",
    };
  }

  return {
    multiplier: 0.3,
    state: "high",
    label: "30%低速建仓",
    title: `${item.name} 触发低速建仓`,
    mode: "opportunity-build",
    reason: `${item.name} 是主线候选，但热度已经偏高，只动用卫星机会预算的30%，不做满额定投。`,
    trigger: "回调10%-15%且趋势未破坏时再提高建仓比例；热度升高则暂停。",
  };
}
