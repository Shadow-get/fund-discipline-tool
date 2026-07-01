<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">新手入口</span>
          <h2>本月新增资金怎么分</h2>
        </div>
        <span class="data-note">先填金额，其他都有默认值</span>
      </div>

      <div class="flow-note">
        <strong>产品目标</strong>
        <p>这里只处理“本月新赚/新攒下来准备投资的钱”，系统自动拆成核心定投、卫星机会资金和等待资金，不要求你先判断每个市场贵不贵。</p>
      </div>

      <div class="form-grid single-input">
        <label>
          本月新增可投资金额
          <input v-model.number="monthlyAmount" type="number" min="0" step="100" />
          <small>不包含已有持仓，也不是账户总资产。先填这个数字就能生成本月方案。</small>
        </label>
      </div>

      <details class="advanced-settings cashflow-settings">
        <summary>组合偏好（可选）</summary>
        <div class="form-grid">
          <label>
            长期组合风格
            <select v-model="style">
              <option v-for="(label, key) in styleLabels" :key="key" :value="key">{{ label }}</option>
            </select>
            <small>这是用户偏好。默认用“主线/产业增强”：核心仓长期定投，卫星仓只在机会出现时动用。</small>
          </label>
          <label>
            执行拆分偏好
            <select v-model="volatility">
              <option value="low">低波动</option>
              <option value="medium">普通</option>
              <option value="high">高波动</option>
            </select>
            <small>这是用户风格，只影响日投、周投、月投的拆分节奏，不代表市场预测。</small>
          </label>
        </div>
      </details>

      <details class="advanced-settings cashflow-settings">
        <summary>市场状态（系统默认，可选修正）</summary>
        <p class="settings-note">这些是当前市场估值/热度状态，后续应由估值模块自动写入。小白不需要改，只有你明确认为系统判断偏差时再修正。</p>
        <div class="state-grid">
          <label v-for="key in stateKeys" :key="key">
            {{ bucketLabels[key] }}当前状态
            <select v-model="states[key]">
              <option v-for="(label, state) in marketStateLabels" :key="state" :value="state">{{ label }}</option>
            </select>
          </label>
        </div>
      </details>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">自动联动</span>
          <h2>卫星/产业增强决定</h2>
        </div>
        <RiskBadge :label="modeLabel" :kind="scan?.mode === 'live' ? 'good' : scan?.mode === 'cache' ? 'warn' : 'neutral'" />
      </div>

      <OpportunityBudgetPanel
        :deployment="satelliteDeployment"
        :monthly-satellite-budget="monthlySatelliteBudget"
        :target-name="topMainline?.name"
        :target-status="topMainline?.status"
      />

      <div class="decision-panel">
        <div>
          <span class="eyebrow">{{ style === "mainline" ? "卫星规则模式" : "普通风格模式" }}</span>
          <h3>{{ mainlineDecisionTitle }}</h3>
          <p>{{ mainlineDecision }}</p>
        </div>
        <dl>
          <div>
            <dt>为什么执行/等待</dt>
            <dd>{{ cashflowReason }}</dd>
          </div>
          <div>
            <dt>产业逻辑</dt>
            <dd>{{ activeProfile.coreLogic }}</dd>
          </div>
          <div>
            <dt>风险</dt>
            <dd>{{ cashflowRisk }}</dd>
          </div>
          <div>
            <dt>触发条件</dt>
            <dd>{{ cashflowTrigger }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section>
      <DcaPlanCard :total-buy="plan.totalBuy" :reserve="plan.reserve" :frequency="plan.executionFrequency" :plan="plan" />
      <AllocationTable :plan="plan" :targets="cashflowTargets" />
    </section>

    <ExplanationCard
      :conclusion="`本月核心定投 ${money(plan.totalBuy)}，卫星预算 ${money(monthlySatelliteBudget)} 进入机会资金池。`"
      :reason="cashflowReason"
      benefit="核心宽基负责长期定投；产业增强可以低速定投；热点主线只在触发条件满足时建仓。"
      :risk="cashflowRisk"
      :trigger="cashflowTrigger"
    />

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">解释</span>
          <h2>每个资产桶负责什么</h2>
        </div>
      </div>
      <div class="definition-grid">
        <article v-for="bucket in bucketDefinitions" :key="bucket.key" class="definition-card">
          <span class="eyebrow">{{ bucket.label }}</span>
          <h3>{{ bucket.short }}</h3>
          <p>{{ bucket.watch }}</p>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import AllocationTable from "../components/AllocationTable.vue";
import DcaPlanCard from "../components/DcaPlanCard.vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import OpportunityBudgetPanel from "../components/OpportunityBudgetPanel.vue";
import RiskBadge from "../components/RiskBadge.vue";
import { bucketDefinitions, type BucketTargetMap } from "../data/bucketEducation";
import { bucketLabels, strategyTemplates, styleLabels } from "../data/strategyTemplates";
import { getMainlineProfile } from "../data/mainlineKnowledge";
import { marketStateLabels } from "../data/indexPresets";
import { generateMonthlyPlan } from "../rules/allocation";
import { getSatelliteDeployment } from "../rules/satelliteOpportunity";
import { fetchMainlineScan, pickActionableMainline } from "../services/mainlineData";
import type { AssetBucket, MainlineScanResponse, MarketState, Style } from "../types";
import { money } from "../utils/format";

const monthlyAmount = ref(3000);
const style = ref<Style>("mainline");
const volatility = ref<"low" | "medium" | "high">("medium");
const stateKeys: Exclude<AssetBucket, "reserve">[] = ["chinaCore", "globalCore", "defensive", "satellite"];
const states = reactive<Record<Exclude<AssetBucket, "reserve">, MarketState>>({
  chinaCore: "fair",
  globalCore: "fair",
  defensive: "fair",
  satellite: "high",
});

const scan = ref<MainlineScanResponse | null>(null);
const topMainline = computed(() => pickActionableMainline(scan.value?.results ?? []));
const activeProfile = computed(() => getMainlineProfile(topMainline.value));
const satelliteDeployment = computed(() => getSatelliteDeployment(topMainline.value));
const hasAnyHotMainline = computed(() => (scan.value?.results ?? []).some((item) => item.status === "过热等待"));
const allMainlinesUnavailable = computed(() => {
  const results = scan.value?.results ?? [];
  return results.length > 0 && !topMainline.value;
});

const plan = computed(() =>
  generateMonthlyPlan({
    monthlyAmount: monthlyAmount.value,
    style: style.value,
    volatility: volatility.value,
    states,
    overrides:
      style.value === "mainline"
        ? {
            satellite: {
              multiplier: 0,
              reason: "卫星预算不按月机械定投，先并入机会资金池，再按主线/产业增强规则决定是否执行。",
            },
          }
        : undefined,
  }),
);

const monthlySatelliteBudget = computed(() => monthlyAmount.value * (strategyTemplates[style.value]?.satellite ?? 0));

const cashflowTargets = computed<BucketTargetMap>(() => ({
  satellite: topMainline.value
    ? [
        {
          name: topMainline.value.name,
          code: topMainline.value.representativeEtfs.join("/"),
          note: `${topMainline.value.status} · ${topMainline.value.stage}`,
        },
        {
          name: satelliteDeployment.value.mode === "strategic-dca" ? "产业增强纪律" : "机会建仓纪律",
          note: `${satelliteDeployment.value.label} · 资金池口径`,
        },
      ]
    : [
        {
          name: "等待主线",
          note: "没有可用方向时，卫星预算转入等待资金",
        },
      ],
}));

const modeLabel = computed(() => {
  if (!scan.value) return "主线加载中";
  if (scan.value.mode === "live") return "公开数据";
  if (scan.value.mode === "cache") return "缓存数据";
  if (scan.value.mode === "fallback") return "内置快照";
  return "数据异常";
});

const mainlineDecisionTitle = computed(() => {
  if (style.value !== "mainline") return "当前未启用卫星规则模式";
  if (topMainline.value) return satelliteDeployment.value.title;
  if (hasAnyHotMainline.value) return "热门方向过热，本月机会预算等待";
  return "没有可用方向，本月不强买主题";
});

const mainlineDecision = computed(() => {
  if (style.value !== "mainline") {
    return "当前按所选风格模板分配，主线雷达只作为参考，不自动改变卫星仓。";
  }

  if (topMainline.value) {
    return `系统选择 ${topMainline.value.name} 作为卫星/产业增强参考。本月 ${money(monthlySatelliteBudget.value)} 不直接机械买入，而是进入机会资金池；下方面板会按你的可支配机会额度、已消耗额度和目标仓位计算建议动用比例。${satelliteDeployment.value.reason}`;
  }

  return `主线雷达没有找到可执行方向，本月卫星预算 ${money(monthlySatelliteBudget.value)} 进入等待资金，等回调或资金强弱重新确认。`;
});

const cashflowReason = computed(() => {
  if (style.value !== "mainline") {
    return "系统先按风格模板分配到A股核心、美股/全球核心、防守仓和卫星仓，再按估值状态调整买入倍率。";
  }

  if (topMainline.value) {
    return `主线雷达选择 ${topMainline.value.name}：${topMainline.value.reason} ${satelliteDeployment.value.reason}`;
  }

  return "当年主线模式下，当前没有清晰且不过热的候选，卫星预算优先进入等待资金。";
});

const cashflowRisk = computed(() => {
  if (style.value === "mainline" && topMainline.value) {
    return `${topMainline.value.evidence.heat} ${activeProfile.value.whyNotHeavy}`;
  }

  if (allMainlinesUnavailable.value) return "所有主线都不可买时，最大风险不是踏空一两天，而是在过热区把卫星仓一次性打满。";
  return "如果高估资产继续上涨，降速定投可能阶段性跑输满额买入。";
});

const cashflowTrigger = computed(() => {
  if (style.value === "mainline" && topMainline.value) {
    return `${satelliteDeployment.value.trigger} ${activeProfile.value.pauseRule}`;
  }

  if (style.value === "mainline") {
    return "主线候选回调10%-15%、热度回到合理区，或资金/强弱继续确认时，再提高卫星仓买入速度。";
  }

  return "当高估板块回调10%-15%或估值回到合理区，恢复正常定投。";
});

watch([style, topMainline, allMainlinesUnavailable], () => {
  if (style.value !== "mainline") return;

  if (allMainlinesUnavailable.value || !topMainline.value) {
    states.satellite = "overheated";
  } else {
    states.satellite = satelliteDeployment.value.state;
  }
});

onMounted(async () => {
  scan.value = await fetchMainlineScan();
});
</script>
