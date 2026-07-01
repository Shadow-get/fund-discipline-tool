import type { MainlineScanItem } from "../types";

export type MainlineProfile = {
  industryChain: string[];
  representatives: string[];
  coreLogic: string;
  cyclePosition: string;
  macroRisk: string;
  whyNotHeavy: string;
  reviewFocus: string[];
  buyRule: string;
  pauseRule: string;
};

const defaultProfile: MainlineProfile = {
  industryChain: ["指数或ETF代理", "资金趋势", "估值热度", "盈利验证"],
  representatives: ["以代表指数和ETF成分为准"],
  coreLogic: "系统先用公开行情判断资金和强弱，再用产业标签补足方向解释；结论只用于卫星仓，不替代核心宽基。",
  cyclePosition: "需要结合最新财报、订单、估值和价格走势复核，不能只看短期涨跌。",
  macroRisk: "高利率或流动性收紧会压制高估值资产，降息也要区分预防式降息和衰退式降息。",
  whyNotHeavy: "主线识别解决的是方向问题，不解决买入价格问题；高热度时仍要等待安全边际。",
  reviewFocus: ["成交额是否继续放大", "20/60日相对强弱是否维持", "估值热度是否继续上升"],
  buyRule: "未过热时按卫星仓分批；回调10%-15%且趋势未破坏时恢复正常买入。",
  pauseRule: "热度超过高位、估值分位极高或连续放量滞涨时暂停新增。",
};

const profiles: Record<string, MainlineProfile> = {
  theme_export: {
    industryChain: ["品牌/整机出海", "汽车零部件", "工业母机", "家电与工具", "海外渠道"],
    representatives: ["比亚迪", "三花智控", "拓普集团", "银轮股份", "巨星科技", "美的集团"],
    coreLogic: "出海制造的逻辑不是单纯出口增长，而是中国制造企业在成本、工程能力、供应链响应和海外渠道上形成全球份额提升。",
    cyclePosition: "更偏业绩验证阶段：如果订单、海外收入占比和毛利率能兑现，行情持续性会强于纯故事主题。",
    macroRisk: "美元走强、海外需求放缓、关税和贸易摩擦会影响估值；人民币波动也会改变利润弹性。",
    whyNotHeavy: "它是多行业拼接主题，内部公司质量差异大，且容易受外需和贸易政策扰动，不适合替代核心宽基。",
    reviewFocus: ["海外收入增速是否继续高于内需", "毛利率有没有被价格战压低", "贸易壁垒或关税是否恶化"],
    buyRule: "趋势强、热度不过高时可作为卫星仓主线，按周或月分批，不追单日大涨。",
    pauseRule: "如果出现放量冲高、估值快速抬升或海外订单证伪，卫星仓降到观察。",
  },
  theme_ai_compute: {
    industryChain: ["GPU/ASIC", "服务器", "光模块", "PCB", "数据中心", "液冷与电力"],
    representatives: ["工业富联", "浪潮信息", "中际旭创", "新易盛", "沪电股份", "胜宏科技"],
    coreLogic: "AI算力是基础设施周期，但最受益的不是所有AI概念，而是订单能落到收入和利润的硬件、网络和数据中心环节。",
    cyclePosition: "从预期驱动进入订单和业绩验证，中后段要防止估值先走完、业绩追不上。",
    macroRisk: "高美债利率会压制长久期科技资产估值；美国科技巨头资本开支放缓会直接影响上游订单预期。",
    whyNotHeavy: "AI长期逻辑成立不等于当前价格便宜，算力链波动大、拥挤度高，必须限制在卫星仓。",
    reviewFocus: ["云厂商资本开支是否继续上修", "光模块和服务器订单是否兑现", "高位放量后是否出现滞涨"],
    buyRule: "只在热度回落或强趋势低吸时参与，卫星仓分批，避免一次性追高。",
    pauseRule: "热度高于80分、估值分位过高或核心权重连续大涨后，新增降到0%-30%。",
  },
  theme_semiconductor: {
    industryChain: ["设计", "制造", "设备", "材料", "封测", "国产替代"],
    representatives: ["北方华创", "中微公司", "韦尔股份", "兆易创新", "长电科技", "中芯国际"],
    coreLogic: "半导体是国产替代和AI硬件共振方向，但不同环节周期差异很大，设备和材料更看资本开支与国产化率。",
    cyclePosition: "容易在预期驱动和业绩验证之间摇摆，必须看订单、库存和扩产节奏。",
    macroRisk: "全球半导体周期、出口管制、美元流动性都会影响估值和订单。",
    whyNotHeavy: "行业弹性高但回撤也深，宽泛半导体ETF内部包含多个周期，不能用故事替代价格纪律。",
    reviewFocus: ["设备订单和国产化率", "晶圆厂资本开支", "库存周期是否见底"],
    buyRule: "回调后强弱仍领先宽基时分批，优先等热度从高位回到合理区。",
    pauseRule: "如果涨幅过快但订单没有跟上，或者估值进入极高区，暂停新增。",
  },
  theme_semiconductor_equipment: {
    industryChain: ["刻蚀/薄膜沉积", "清洗", "量测检测", "CMP", "零部件"],
    representatives: ["北方华创", "中微公司", "拓荆科技", "华海清科", "中科飞测", "芯源微"],
    coreLogic: "半导体设备比宽泛芯片更接近国产替代主战场，受益于晶圆厂扩产、设备国产化和先进制程突破。",
    cyclePosition: "属于资本开支周期方向，行情持续性要看订单兑现和国产替代率提升，而不是只看概念热度。",
    macroRisk: "外部限制、晶圆厂扩产推迟和高估值折现率上升都会放大波动。",
    whyNotHeavy: "设备股业绩弹性强但估值也容易透支，订单节奏一旦低于预期会快速杀估值。",
    reviewFocus: ["新签订单", "国产替代率", "晶圆厂资本开支", "估值分位"],
    buyRule: "作为AI硬件上游扩散方向，只在未过热时进入卫星仓，回调10%-15%后再加速。",
    pauseRule: "连续急涨、成交拥挤或订单真空期时暂停新增，等待财报验证。",
  },
  theme_advanced_packaging_hbm: {
    industryChain: ["HBM存储", "先进封装", "封测", "载板/材料", "测试设备"],
    representatives: ["长电科技", "通富微电", "甬矽电子", "雅克科技", "联瑞新材", "华海诚科"],
    coreLogic: "AI芯片升级会带动HBM、先进封装和材料需求，但A股映射链条更分散，需要确认订单和盈利兑现。",
    cyclePosition: "偏产业扩散阶段，容易从海外AI硬件景气向国内封测、材料和设备扩散。",
    macroRisk: "海外AI资本开支、存储价格周期和出口限制都会影响预期。",
    whyNotHeavy: "主题映射强但纯度不一，部分公司只是概念相关，不能用高弹性替代基本面验证。",
    reviewFocus: ["存储价格趋势", "先进封装产能利用率", "材料订单", "海外AI链资本开支"],
    buyRule: "只选择趋势和资金同时确认的ETF或组合，低速分批。",
    pauseRule: "当热度快速冲高但盈利证据不足时，卫星仓降速或等待。",
  },
  theme_cpo_comm: {
    industryChain: ["光模块", "光芯片", "连接器", "交换机", "CPO/硅光"],
    representatives: ["中际旭创", "新易盛", "天孚通信", "光迅科技", "华工科技", "剑桥科技"],
    coreLogic: "AI集群扩大带来高速互联需求，光模块和CPO是算力基础设施里订单弹性最强的环节之一。",
    cyclePosition: "已从预期驱动进入业绩验证，后续看800G/1.6T订单和毛利率。",
    macroRisk: "海外云厂商资本开支放缓、技术路线变化和贸易限制会影响估值。",
    whyNotHeavy: "高景气往往伴随高拥挤，业绩好也可能因为估值过高而回撤。",
    reviewFocus: ["海外大客户订单", "800G/1.6T渗透", "毛利率", "成交拥挤度"],
    buyRule: "强趋势中只低速参与，优先等回调和热度下降。",
    pauseRule: "热度高位、放量滞涨或订单预期下修时暂停新增。",
  },
  theme_liquid_cooling_power: {
    industryChain: ["液冷", "UPS/电源", "变压器", "储能", "数据中心配套"],
    representatives: ["英维克", "申菱环境", "科华数据", "科士达", "许继电气", "特变电工"],
    coreLogic: "AI数据中心从算力扩张走向电力和散热瓶颈，液冷、电源和电网配套可能成为下一阶段扩散方向。",
    cyclePosition: "偏AI基础设施扩散期，弹性通常晚于GPU和光模块，但持续性取决于订单落地。",
    macroRisk: "数据中心建设节奏、能源价格和资本开支变化会影响订单。",
    whyNotHeavy: "链条跨度大，纯度和订单确定性不同，不能把所有电力设备都当作AI主线。",
    reviewFocus: ["数据中心订单", "液冷渗透率", "电网投资", "项目交付节奏"],
    buyRule: "热度可控时可作为AI基础设施扩散方向低速定投；如果只是概念炒作，降到观察仓。",
    pauseRule: "如果只是概念扩散但成交和订单没有同步，或热度快速拥挤，暂停新增。",
  },
  theme_power_equipment: {
    industryChain: ["电网投资", "特高压", "变压器", "储能", "电力自动化", "数据中心电力配套"],
    representatives: ["许继电气", "平高电气", "特变电工", "思源电气", "国电南瑞", "阳光电源"],
    coreLogic: "电力设备更像长期产业增强：电气化、AI数据中心、电网改造和新能源消纳提供中长期需求，但弹性通常弱于CPO、半导体设备这类热点。",
    cyclePosition: "偏资本开支和基建周期，持续性来自订单和电网投资，不是单纯情绪主题。",
    macroRisk: "电网投资节奏、原材料价格、项目交付和利率变化会影响估值；如果新能源链价格战加剧，部分环节盈利会承压。",
    whyNotHeavy: "确定性较高不等于没有波动，电力设备内部差异大，仍应作为产业增强而不是替代宽基主仓。",
    reviewFocus: ["电网投资计划", "订单增速", "毛利率变化", "数据中心电力需求"],
    buyRule: "热度可控时可用卫星预算低速定投；热度偏高时降到50%，不追单日急涨。",
    pauseRule: "订单低于预期、热度拥挤或估值快速抬升时暂停新增。",
  },
  style_dividend_lowvol: {
    industryChain: ["高股息", "低波动", "公用事业", "能源", "金融"],
    representatives: ["长江电力", "中国神华", "中国移动", "工商银行", "陕西煤业"],
    coreLogic: "红利低波本质是现金流和防守资产，在风险偏好下降或利率下行阶段容易获得资金配置。",
    cyclePosition: "更像防守增强，不是成长主线；适合平滑组合波动。",
    macroRisk: "利率上行、分红不及预期或周期品盈利下行会压制表现。",
    whyNotHeavy: "红利也会拥挤，不能因为稳就无限加仓；行业集中度和盈利周期仍然存在。",
    reviewFocus: ["股息率", "分红持续性", "利率方向", "行业集中风险"],
    buyRule: "适合作为防守仓和等待资金替代的一部分，低估时逐步配置。",
    pauseRule: "当股息率被价格上涨压低、估值拥挤时降低新增。",
  },
  us_nasdaq100: {
    industryChain: ["AI平台", "云计算", "芯片", "软件", "消费科技"],
    representatives: ["英伟达", "微软", "苹果", "亚马逊", "Meta", "谷歌"],
    coreLogic: "纳斯达克100代表全球科技龙头和AI资本开支核心受益方，适合作为海外核心的一部分而不是短线主题。",
    cyclePosition: "长期产业逻辑仍强，但高位时更像估值和盈利共同验证阶段。",
    macroRisk: "美债收益率、美元流动性、通胀和美联储路径会显著影响估值。",
    whyNotHeavy: "龙头集中度高，估值敏感；高位不适合每天反向卖光，也不适合满仓追。",
    reviewFocus: ["美债收益率", "AI资本开支", "核心权重股财报", "QDII溢价"],
    buyRule: "作为核心仓保留定投，过热时降到原计划30%-50%，等待回调恢复。",
    pauseRule: "QDII高溢价、估值极端或财报证伪时暂停新增。",
  },
};

export function getMainlineProfile(item?: Pick<MainlineScanItem, "candidateId" | "name"> | null) {
  if (!item) return defaultProfile;
  return profiles[item.candidateId] ?? {
    ...defaultProfile,
    coreLogic: `${item.name} 当前由行情强弱和资金热度识别为候选方向，仍需用最新成分股、财报和估值复核。`,
  };
}
