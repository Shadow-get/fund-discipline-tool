<template>
  <main class="page-stack" :class="{ 'is-loading-content': loading }" :aria-busy="loading">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">{{ pageCopy.eyebrow }}</span>
          <h2>{{ pageCopy.title }}</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="modeLabel" :kind="scan?.mode === 'live' ? 'good' : scan ? 'danger' : 'neutral'" />
          <button type="button" class="primary-button" :disabled="loading" @click="loadScan">
            {{ loading ? "刷新中..." : "刷新动态数据" }}
          </button>
        </div>
      </div>

      <details class="secondary-info-menu">
        <summary>策略说明与数据状态</summary>
        <p>{{ pageCopy.subtitle }}</p>

        <div class="metric-grid">
          <MetricCard label="候选数量" :value="filteredResults.length" :detail="pageCopy.metricDetail" />
          <MetricCard :label="pageCopy.primaryMetric" :value="groups.top.length" :detail="pageCopy.primaryDetail" tone="good" />
          <MetricCard label="观察名单" :value="groups.watch.length" detail="有赔率，但仍需确认" />
          <MetricCard label="便宜陷阱" :value="groups.trap.length" detail="低估不等于重仓" tone="warn" />
        </div>

        <div class="status-strip">
          <span>数据来源：{{ scan?.source ?? "-" }}</span>
          <span>无风险收益率假设：{{ scan?.riskFreeYield ?? 0 }}%</span>
          <span>更新时间：{{ updatedAt || "-" }}</span>
          <span>{{ scan?.message }}</span>
        </div>
        <p class="data-warning">
          {{ pageCopy.warning }}
        </p>

        <ExplanationCard
          :conclusion="valuationConclusion"
          :reason="valuationReason"
          :benefit="valuationBenefit"
          :risk="valuationRisk"
          :trigger="valuationTrigger"
        />
      </details>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <section>
      <SectionTitle eyebrow="List" title="机会列表" note="默认只显示关键字段；详情和解释放在二级菜单或研究报告里。" />
      <div class="table-wrap compact-opportunity-wrap">
        <table class="compact-opportunity-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>行业</th>
              <th>状态</th>
              <th>分</th>
              <th>PE</th>
              <th>PB</th>
              <th>盈利率</th>
              <th>利差</th>
              <th>涨跌/换手</th>
              <th>安全边际</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in compactRows" :key="item.candidateId">
              <td>
                <button type="button" class="table-link-button" @click="selectedItem = item">{{ item.name }}</button>
              </td>
              <td>{{ item.category }}</td>
              <td><RiskBadge :label="item.status" :kind="reportBadgeKind(item)" /></td>
              <td>{{ item.score }}</td>
              <td>{{ item.pe }}</td>
              <td>{{ item.pb }}</td>
              <td>{{ item.earningsYield }}%</td>
              <td>{{ item.earningsYieldSpread }}%</td>
              <td>{{ dynamicSignal(item) }}</td>
              <td>{{ item.marginOfSafety }}</td>
              <td>
                <button type="button" class="table-action-button" @click="selectedItem = item">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <AppDialog
      :open="Boolean(selectedItem)"
      :title="selectedItem ? `${selectedItem.name} 低估值研究报告` : '低估值研究报告'"
      :description="selectedItem?.reason ?? ''"
      eyebrow="Research"
      width="980px"
      @close="selectedItem = null"
    >
      <div v-if="selectedItem" class="valuation-report-dialog">
        <div class="stock-detail-hero">
          <div>
            <span class="eyebrow">{{ selectedItem.category }} · {{ selectedItem.stage }}</span>
            <h3>{{ reportFor(selectedItem).conclusion }}</h3>
            <p>{{ reportFor(selectedItem).positioning }}</p>
          </div>
          <div class="mainline-score">
            <strong>{{ selectedItem.score }}</strong>
            <RiskBadge :label="selectedItem.status" :kind="reportBadgeKind(selectedItem)" />
          </div>
        </div>

        <div class="financial-score-grid">
          <article>
            <span>{{ selectedItem.dynamic ? "PE动态分位" : "PE分位" }}</span>
            <strong>{{ selectedItem.pePercentile }}%</strong>
            <small>{{ selectedItem.dynamic ? "来自公开行情横截面" : "越低越便宜，但要防盈利下修" }}</small>
          </article>
          <article>
            <span>{{ selectedItem.dynamic ? "PB动态分位" : "PB分位" }}</span>
            <strong>{{ selectedItem.pbPercentile }}%</strong>
            <small>{{ selectedItem.dynamic ? "来自公开行情横截面" : "银行/周期股尤其要看PB" }}</small>
          </article>
          <article>
            <span>盈利收益率</span>
            <strong>{{ selectedItem.earningsYield }}%</strong>
            <small>100 / PE</small>
          </article>
          <article v-if="selectedItem.dynamic">
            <span>当日涨跌</span>
            <strong>{{ signedPct(selectedItem.dailyChangePct) }}%</strong>
            <small>换手 {{ selectedItem.turnoverRate ?? 0 }}%，资金 {{ selectedItem.fundFlowRatio ?? 0 }}%</small>
          </article>
          <article v-else>
            <span>股息率</span>
            <strong>{{ selectedItem.dividendYield }}%</strong>
            <small>现金回报质量</small>
          </article>
          <article>
            <span>ROE</span>
            <strong>{{ selectedItem.roe }}%</strong>
            <small>长期资本回报</small>
          </article>
          <article>
            <span>安全边际</span>
            <strong>{{ selectedItem.marginOfSafety }}</strong>
            <small>折价和风险后的综合分</small>
          </article>
        </div>

        <div class="stock-detail-section">
          <h4>为什么进入低估值池</h4>
          <div class="indicator-assessment-grid">
            <article v-for="item in reportFor(selectedItem).assessments" :key="item.label" :class="`assessment-${item.status}`">
              <div>
                <span>{{ item.label }}</span>
                <RiskBadge :label="assessmentLabel(item.status)" :kind="assessmentKind(item.status)" />
              </div>
              <strong>{{ item.value }}</strong>
              <p>{{ item.explanation }}</p>
            </article>
          </div>
        </div>

        <div class="financial-reason-grid">
          <article>
            <strong>价值投资视角</strong>
            <p>{{ reportFor(selectedItem).valueLens }}</p>
          </article>
          <article>
            <strong>趋势回弹视角</strong>
            <p>{{ reportFor(selectedItem).reboundLens }}</p>
          </article>
        </div>

        <div class="stock-detail-section">
          <h4>和个股观察为什么可能不一致</h4>
          <p>{{ reportFor(selectedItem).conflictExplanation }}</p>
        </div>

        <div class="financial-reason-grid">
          <article>
            <strong>加分项</strong>
            <ul>
              <li v-for="item in reportFor(selectedItem).positives" :key="item">{{ item }}</li>
            </ul>
          </article>
          <article>
            <strong>风险项</strong>
            <ul>
              <li v-for="item in reportFor(selectedItem).risks" :key="item">{{ item }}</li>
            </ul>
          </article>
        </div>
      </div>
    </AppDialog>

    <div v-if="loading" class="content-loading-overlay" role="status" aria-live="polite">
      <span class="loading-spinner"></span>
      <strong>正在刷新动态机会</strong>
      <small>正在读取公开行情快照，完成前不展示模型或旧快照。</small>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppDialog from "../components/AppDialog.vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { fetchLowValuationScan, pickActionableLowValuation, splitLowValuationGroups } from "../services/lowValuationData";
import type { LowValuationScanItem, LowValuationScanResponse } from "../types";

const props = withDefaults(
  defineProps<{
    viewMode?: "value" | "rebound";
  }>(),
  {
    viewMode: "value",
  },
);

const scan = ref<LowValuationScanResponse | null>(null);
const loading = ref(false);
const error = ref("");
const selectedItem = ref<LowValuationScanItem | null>(null);

const filteredResults = computed(() => {
  const items = scan.value?.results ?? [];
  if (props.viewMode === "rebound") {
    return [...items]
      .filter((item) => item.cycleScore >= 50 || item.statusKey === "watch" || item.statusKey === "top")
      .sort((a, b) => b.cycleScore + b.score * 0.35 - (a.cycleScore + a.score * 0.35));
  }
  return [...items]
    .filter((item) => item.earningsYieldSpread >= 2 || item.marginOfSafety >= 45 || item.valueScore >= 55)
    .sort((a, b) => b.marginOfSafety + b.valueScore * 0.45 - (a.marginOfSafety + a.valueScore * 0.45));
});

const groups = computed(() => splitLowValuationGroups(filteredResults.value));
const topAction = computed(() => pickActionableLowValuation(filteredResults.value));
const compactRows = computed(() => filteredResults.value.slice(0, 80));

const pageCopy = computed(() => {
  if (props.viewMode === "rebound") {
    return {
      eyebrow: "估值 + 趋势",
      title: "趋势回弹机会",
      subtitle: "只看公开行情快照里的动态低估和资金修复，寻找低估后出现右侧确认的候选。",
      metricDetail: "动态低估后出现修复迹象的候选",
      primaryMetric: "回弹可观察",
      primaryDetail: "实时估值 + 资金修复",
      warning: "交易时段内只展示动态行情快照；若实时接口失败，不再用模型或内置快照替代。",
      topTitle: "回弹优先观察",
      topNote: "仍需等待价格和资金确认，不做一把梭。",
      watchTitle: "回弹跟踪",
      watchNote: "已有修复线索，但趋势或盈利证据还不完整。",
    };
  }
  return {
    eyebrow: "价值纪律",
    title: "低估价值策略",
    subtitle: "从公开行情快照的 PE、PB、盈利收益率、成交活跃和资金流判断，便宜是否值得继续跟踪。",
    metricDetail: "实时 PE/PB、成交、资金流",
    primaryMetric: "价值可观察",
    primaryDetail: "动态折价和安全边际较匹配",
    warning: "交易时段内只展示动态行情快照；低 PE/PB 仍要核对财报质量，不能因为便宜直接重仓。",
    topTitle: "价值优先观察",
    topNote: "重视安全边际，但仍然只适合分批。",
    watchTitle: "价值跟踪",
    watchNote: "便宜有证据，但盈利、质量或趋势还需要验证。",
  };
});

const modeLabel = computed(() => {
  if (!scan.value) return "未扫描";
  if (scan.value.mode === "live") return "动态数据";
  if (scan.value.mode === "model") return "非动态模型";
  if (scan.value.mode === "fallback") return "非动态快照";
  return "数据异常";
});

const updatedAt = computed(() => {
  if (!scan.value?.updatedAt) return "";
  return new Date(scan.value.updatedAt).toLocaleString("zh-CN", { hour12: false });
});

const valuationConclusion = computed(() => {
  if (!scan.value) return "正在读取低估值池，先不做结论。";
  if (topAction.value) return `当前优先低估方向：${topAction.value.name}，但只适合分批和仓位约束。`;
  if (groups.value.trap.length) return "有便宜方向，但多数仍需验证基本面，不适合因为低估值直接重仓。";
  return "当前没有足够清晰的低估值机会，等待估值或盈利证据改善。";
});

const valuationReason = computed(() => {
  if (!topAction.value) return "动态行情没有找到估值折价、盈利收益率、资金修复和风险同时合格的候选。";
  return `${topAction.value.reason} ${topAction.value.evidence.valuation} ${topAction.value.evidence.dividend}`;
});

const valuationBenefit = computed(() => {
  if (!topAction.value) return "把动态低估池和主线池分开，可以避免只追强势，也避免只因便宜买入逻辑变差的资产。";
  return `${topAction.value.action}；建议比例：${topAction.value.suggestedRatio}。`;
});

const valuationRisk = computed(() => {
  if (!topAction.value) return "低估可能持续很久，甚至来自盈利恶化；需要等待财报、现金流和资金趋势确认。";
  return `${topAction.value.evidence.risk} 低估值资产可能长期不涨，仓位应由安全边际和基本面验证共同决定。`;
});

const valuationTrigger = computed(() => {
  if (!topAction.value) return "PE/PB 动态分位继续下行、盈利收益率利差扩大，或资金重新流入时再提高跟踪优先级。";
  return "分批条件：动态估值仍在低位、盈利没有继续恶化、成交和资金没有同步走弱；暂停条件：盈利下修、行业逻辑破坏或估值修复后安全边际消失。";
});

function reportBadgeKind(item: LowValuationScanItem) {
  if (item.statusKey === "top") return "good";
  if (item.statusKey === "trap") return "warn";
  if (item.statusKey === "fair") return "danger";
  return "neutral";
}

function assessmentLabel(status: string) {
  if (status === "good") return "好";
  if (status === "neutral") return "中性";
  if (status === "warn") return "待确认";
  return "风险";
}

function assessmentKind(status: string) {
  if (status === "good") return "good";
  if (status === "warn") return "warn";
  if (status === "bad") return "danger";
  return "neutral";
}

function metricStatus(value: number, good: number, neutral: number, reverse = false) {
  if (reverse) {
    if (value <= good) return "good";
    if (value <= neutral) return "neutral";
    if (value <= neutral + 20) return "warn";
    return "bad";
  }
  if (value >= good) return "good";
  if (value >= neutral) return "neutral";
  if (value >= neutral - 20) return "warn";
  return "bad";
}

function reportFor(item: LowValuationScanItem) {
  const isBank = item.name.includes("银行") || item.representativeIndex.includes("银行");
  const isDividend = item.name.includes("红利") || item.dividendYield >= 4.5;
  const valueFit = item.valueScore >= 70 && item.logicRiskScore <= 45 ? "较适合价值观察" : "只能谨慎观察";
  const reboundFit = item.cycleScore >= 65 ? "已有修复线索" : item.cycleScore >= 50 ? "修复线索一般" : "趋势回弹证据不足";
  const isDynamic = Boolean(item.dynamic);

  return {
    conclusion:
      props.viewMode === "rebound"
        ? `${item.name} 属于${reboundFit}的低估候选，不等于已经确认反转。`
        : `${item.name} 属于${valueFit}的低估候选，核心是安全边际和现金回报。`,
    positioning: isDynamic
      ? "该候选来自交易时段公开行情快照，优先看实时 PE/PB、盈利收益率、成交活跃度和资金流；它是动态观察名单，不等同于长期买入结论。"
      : isBank
        ? "银行进入低估值池，是因为PB/PE、股息率和ROE提供了估值赔率；但它仍受净息差、地产链、资产质量影响，所以个股观察可能不强。"
        : isDividend
        ? "红利类资产进入低估值池，主要来自股息率、盈利收益率和低估值分位；但高股息拥挤或资源周期下行会削弱赔率。"
        : "低估值池先看估值和安全边际，再看质量、周期和趋势确认；它回答的是便宜是否值得等，不是短期能不能立刻涨。",
    assessments: [
      {
        label: isDynamic ? "PE/PB动态分位" : "PE/PB分位",
        value: `${item.pePercentile}% / ${item.pbPercentile}%`,
        status: metricStatus(Math.min(item.pePercentile, item.pbPercentile), 25, 45, true),
        explanation: isDynamic
          ? `PE ${item.pe}、PB ${item.pb}。这里是当次公开行情横截面分位，越低说明相对全市场越便宜。`
          : `PE ${item.pe}、PB ${item.pb}。分位越低说明市场给的价格越便宜，但低估也可能来自盈利下修。`,
      },
      {
        label: "盈利收益率利差",
        value: `${item.earningsYieldSpread}%`,
        status: metricStatus(item.earningsYieldSpread, 6, 3),
        explanation: `盈利收益率 ${item.earningsYield}% 对比无风险收益率，利差越高，理论安全垫越厚。`,
      },
      {
        label: isDynamic ? "涨跌与换手" : "股息与ROE",
        value: isDynamic ? `${signedPct(item.dailyChangePct)}% / ${item.turnoverRate ?? 0}%` : `${item.dividendYield}% / ${item.roe}%`,
        status: isDynamic ? metricStatus((item.dailyChangePct ?? 0) + Math.min(4, item.turnoverRate ?? 0), 4, 1) : metricStatus(item.dividendYield + item.roe * 0.25, 7, 4.5),
        explanation: isDynamic
          ? `动态页此处看当日涨跌和换手率；股息率需要另行核对财报与分红数据。`
          : `股息率体现现金回报，ROE体现资本回报。价值策略更喜欢可持续分红和稳定ROE。`,
      },
      {
        label: "安全边际",
        value: `${item.marginOfSafety}`,
        status: metricStatus(item.marginOfSafety, 65, 50),
        explanation: "安全边际综合估值折价、股息、盈利收益率和逻辑风险；不是单看PE低。",
      },
      {
        label: "周期/回弹",
        value: `${item.cycleScore}`,
        status: metricStatus(item.cycleScore, 68, 52),
        explanation: "周期分越高，说明低估后的修复线索越多；趋势回弹菜单更看重这一项。",
      },
      {
        label: "逻辑风险",
        value: `${item.logicRiskScore}`,
        status: metricStatus(item.logicRiskScore, 35, 55, true),
        explanation: "风险分越高，越可能是低估陷阱。银行要看净息差、资产质量和地产链；消费要看需求和库存。",
      },
    ],
    valueLens: isDynamic
      ? "价值视角先看实时 PE/PB 是否给出折价，再看盈利收益率利差和动态资金是否支持继续观察；但低估不等于安全，必须回到最新财报、行业景气和现金流验证。"
      : isBank
      ? "银行的价值逻辑主要是低PB、较高股息率和ROE仍在可接受区间，类似价值投资里的“价格明显低于账面和盈利能力”。但巴菲特/芒格不会只因便宜买银行，还会看资产质量、管理层、风控和长期ROE。"
      : "价值视角参考巴菲特、芒格、段永平：先看生意能否长期赚钱，再看价格是否给足安全边际；股息率和盈利收益率是现金回报线索，ROE和逻辑风险决定能不能长期等。",
    reboundLens:
      item.cycleScore >= 65
        ? "回弹视角认为它已有周期修复线索，但仍需要资金、均线和盈利预期继续确认。"
        : "回弹视角还不充分，当前更像低估左侧，不适合因为便宜直接提高仓位。",
    conflictExplanation: isDynamic
      ? "动态低估页先用实时行情筛出可能便宜的候选；个股观察还会看更完整的40日趋势、财报质量和风险扣分，所以两边评级可能不完全一致。"
      : "低估值模块看的是板块/指数层面的估值赔率，个股观察看的是单只股票的趋势、资金和财报兑现。银行板块低估，代表指数层面便宜；但具体银行股如果没有趋势、成交和盈利改善，个股观察仍然可以不给强评级。",
    positives: [
      item.evidence.valuation,
      item.evidence.dividend,
      `建议动作：${item.action}`,
      `建议仓位：${item.suggestedRatio}`,
    ],
    risks: [
      item.evidence.risk,
      "低估可能长期存在，便宜不代表马上修复。",
      "如果盈利继续下修，低PE会被动升高，低估逻辑会失效。",
    ],
  };
}

function signedPct(value = 0) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function dynamicSignal(item: LowValuationScanItem) {
  if (item.dynamic) return `${signedPct(item.dailyChangePct)}% / ${item.turnoverRate ?? 0}%`;
  return `${item.dividendYield}% / ROE ${item.roe}%`;
}

async function loadScan() {
  loading.value = true;
  error.value = "";
  try {
    const payload = await fetchLowValuationScan({ dynamicOnly: true });
    if (payload.mode !== "live") {
      scan.value = null;
      error.value = payload.message || "动态低估值扫描未返回实时数据";
      return;
    }
    scan.value = payload;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "低估值扫描失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadScan();
});
</script>
