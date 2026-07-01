import type { AssetBucket } from "../types";

export type BucketDefinition = {
  key: AssetBucket;
  label: string;
  short: string;
  role: string;
  examples: string;
  watch: string;
};

export type BucketTarget = {
  name: string;
  code?: string;
  note: string;
};

export type BucketTargetMap = Partial<Record<AssetBucket, BucketTarget[]>>;

export const bucketDefinitions: BucketDefinition[] = [
  {
    key: "chinaCore",
    label: "A股核心宽基",
    short: "A股主仓，不押单一行业",
    role: "承担中国权益市场的长期 beta，优先使用沪深300、中证A500、中证500等宽基，不因为某个主题短期很热就替代核心仓。",
    examples: "沪深300、中证A500、中证500、中证1000、创业板/科创只作为高波动补充。",
    watch: "看估值分位、市场成交额、政策预期和盈利修复；高估时降速，不直接清仓。",
  },
  {
    key: "globalCore",
    label: "美股/全球核心宽基",
    short: "海外主仓，分散单一市场",
    role: "承担全球科技和成熟市场权益暴露，平衡A股周期波动，主仓优先放标普500、纳斯达克100或全球宽基。",
    examples: "标普500、纳斯达克100、全球/发达市场宽基；QDII要额外看溢价和额度。",
    watch: "看美债收益率、美元流动性、估值和AI权重股盈利；高估时保留底仓、降低新增速度。",
  },
  {
    key: "defensive",
    label: "防守仓",
    short: "低波动缓冲垫",
    role: "在成长资产过热或市场下跌时降低组合波动，提供心理和资金缓冲，不负责追求最高弹性。",
    examples: "红利、红利低波、债基、货币基金、短债、等待资金。",
    watch: "看股息持续性、利率变化和行业集中度；防守仓上涨很多时也要防止估值拥挤。",
  },
  {
    key: "satellite",
    label: "产业增强/主线机会",
    short: "分成低速定投和机会建仓",
    role: "长期确定性较高但爆发不足的方向可做产业增强低速定投；高弹性热点只做触发式建仓，不替代宽基主仓。",
    examples: "产业增强如电力设备、红利低波；机会主线如CPO、半导体设备、证券、出海制造。",
    watch: "看20/60/120日相对强弱、成交拥挤度、产业订单和估值；热点过热时买入倍率降到0%-30%。",
  },
  {
    key: "reserve",
    label: "等待资金",
    short: "不是闲置，是下一次机会的弹药",
    role: "当估值过高、主线过热或证据不足时暂存资金，等待回调、估值修复或更清晰主线。",
    examples: "货币基金、现金管理、短债，按个人风险承受能力选择。",
    watch: "每周看触发条件是否满足；不要因为等待资金存在就临时追涨。",
  },
];

export const bucketDefinitionMap = Object.fromEntries(
  bucketDefinitions.map((item) => [item.key, item]),
) as Record<AssetBucket, BucketDefinition>;

export const defaultBucketTargets: BucketTargetMap = {
  chinaCore: [
    { name: "沪深300ETF", code: "510300/159919", note: "大盘核心底仓" },
    { name: "中证A500ETF", code: "560510/159338", note: "A股新核心宽基" },
    { name: "中证500ETF", code: "510500/159922", note: "中盘补充" },
  ],
  globalCore: [
    { name: "标普500ETF", code: "513500", note: "海外核心宽基" },
    { name: "纳指ETF", code: "513100/159941", note: "科技成长核心" },
  ],
  defensive: [
    { name: "红利低波ETF", code: "512890/515300", note: "低波防守" },
    { name: "红利ETF", code: "510880/515080", note: "现金流资产" },
    { name: "货币/短债", note: "等待资金承接" },
  ],
  satellite: [
    { name: "主线雷达第一名", note: "自动判断低速定投或机会建仓" },
  ],
  reserve: [
    { name: "货币基金/短债", note: "等待回调和再平衡" },
  ],
};
