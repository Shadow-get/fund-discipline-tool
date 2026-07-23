export type FinancialLesson = {
  id: string;
  title: string;
  category: string;
  teacher: string;
  summary: string;
  concept: string;
  dailyExample: string;
  investorUse: string;
  mistake: string;
  action: string;
};

export const financialLessons: FinancialLesson[] = [
  {
    id: "margin-of-safety",
    title: "安全边际不是便宜两个字",
    category: "价值投资",
    teacher: "格雷厄姆 / 巴菲特 / 芒格",
    summary: "安全边际是用低价格覆盖判断错误、盈利波动和市场情绪的缓冲垫。",
    concept: "同样是低PE，如果盈利稳定、现金流好、负债可控，安全边际更可靠；如果盈利正在恶化，低PE可能只是陷阱。",
    dailyExample: "买房不是只看单价便宜，还要看地段、现金流、物业、未来供需和贷款压力。",
    investorUse: "低估值板块里，PE/PB分位只是第一层，还要结合ROE、股息率、盈利趋势和逻辑风险。",
    mistake: "把低估直接等同于可以买，忽略了盈利下修和行业逻辑破坏。",
    action: "看到低估时先问：便宜来自情绪错杀，还是来自基本面变差？",
  },
  {
    id: "opportunity-cost",
    title: "机会成本决定你的比较基准",
    category: "宏观金融",
    teacher: "巴菲特 / 芒格",
    summary: "买一个资产，不只是看它好不好，还要看它相比现金、债券、指数和其他机会是否更值得。",
    concept: "盈利收益率可以和无风险收益率比较。如果一个指数盈利收益率明显高于债券收益率，且盈利不恶化，赔率更有吸引力。",
    dailyExample: "一份工作薪水不错，但通勤极长、成长有限，就要和其他选择比较，而不是孤立判断。",
    investorUse: "低估值模块里的盈利收益率利差，就是把股票资产和无风险收益率做比较。",
    mistake: "只因为熟悉某个板块就买，忽略了更好的替代机会。",
    action: "每次加仓前写下：我为什么买它，而不是买宽基、债券或继续持有现金？",
  },
  {
    id: "cycle-stock",
    title: "周期股不能只看低PE",
    category: "周期与产业",
    teacher: "彼得林奇",
    summary: "周期股在利润高点时PE可能最低，在利润低点时PE反而最高。",
    concept: "钢铁、有色、化工、银行等周期行业，估值要结合供需、价格、库存、资本开支和盈利所处阶段。",
    dailyExample: "猪肉价格高时养殖企业利润好、估值看起来便宜，但如果扩产太多，后面利润可能反转。",
    investorUse: "趋势回弹板块会额外看周期修复和趋势确认，避免只因低PE买在景气下行期。",
    mistake: "在周期利润顶点看到低PE就重仓。",
    action: "周期股先判断：这是盈利底部修复，还是盈利高点回落？",
  },
  {
    id: "roe-quality",
    title: "ROE是长期复利的发动机",
    category: "公司质量",
    teacher: "芒格 / 段永平",
    summary: "长期看，企业能否持续用较高ROE再投资，决定了复利质量。",
    concept: "高ROE如果来自高杠杆并不一定好；更好的ROE来自品牌、成本优势、网络效应、渠道和管理效率。",
    dailyExample: "一家小店利润率高且能稳定开分店，比一次性赚快钱的生意更容易复利。",
    investorUse: "低估价值策略会把ROE和逻辑风险放在估值之后，避免买到便宜但低质的资产。",
    mistake: "只看当前利润，不看利润来自经营能力还是杠杆。",
    action: "看到高ROE时追问：它能持续吗？靠什么持续？",
  },
  {
    id: "liquidity",
    title: "流动性改变估值天花板",
    category: "宏观金融",
    teacher: "霍华德·马克斯",
    summary: "利率、美元、美债收益率和信用环境会影响市场愿意给成长资产多少估值。",
    concept: "高利率环境下，远期现金流折现更严，高估值成长股压力更大；降息环境也要区分预防式降息和衰退式降息。",
    dailyExample: "贷款利率变高时，房价承受力会下降，因为买家的月供压力变大。",
    investorUse: "风险新闻和主线热度模块要看流动性变化，避免在估值扩张尾部追高。",
    mistake: "只看行业故事，不看资金价格。",
    action: "每周看一次：美债收益率、美元指数、通胀和就业数据是否改变风险偏好。",
  },
];

export function getLessonForDate(date = new Date()) {
  const dayIndex = Math.floor(date.getTime() / 86400000);
  return financialLessons[Math.abs(dayIndex) % financialLessons.length];
}
