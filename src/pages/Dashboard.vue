<template>
  <main class="page-grid">
    <section class="section-wide">
      <div class="section-heading">
        <div>
          <span class="eyebrow">总览</span>
          <h2>本月纪律方案</h2>
        </div>
        <span class="data-note">{{ scanNote }}</span>
      </div>
      <DcaPlanCard :total-buy="plan.totalBuy" :reserve="plan.reserve" :frequency="plan.executionFrequency" :plan="plan" />
      <OpportunityBudgetPanel
        :deployment="satelliteDeployment"
        :monthly-satellite-budget="monthlySatelliteBudget"
        :target-name="topAction?.name"
        :target-status="topAction?.status"
      />
      <AllocationTable :plan="plan" :targets="dashboardTargets" />
    </section>

    <section class="section-wide">
      <div class="section-heading">
        <div>
          <span class="eyebrow">资产桶</span>
          <h2>先分清每笔钱的任务</h2>
        </div>
      </div>
      <div class="definition-grid">
        <article v-for="bucket in bucketDefinitions" :key="bucket.key" class="definition-card">
          <span class="eyebrow">{{ bucket.label }}</span>
          <h3>{{ bucket.short }}</h3>
          <p>{{ bucket.role }}</p>
          <small>{{ bucket.examples }}</small>
        </article>
      </div>
    </section>

    <ExplanationCard
      :conclusion="dashboardConclusion"
      :reason="dashboardReason"
      :benefit="dashboardBenefit"
      :risk="dashboardRisk"
      :trigger="dashboardTrigger"
    />

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">主线识别</span>
          <h2>当前资金方向</h2>
        </div>
      </div>
      <div class="rank-list">
        <article v-for="item in mainlines.slice(0, 6)" :key="item.candidateId" class="rank-item">
          <div>
            <strong>{{ item.name }}</strong>
            <span>{{ item.stage }} · {{ item.status }} · 热度{{ item.heatScore }}分</span>
            <p>{{ item.reason }}</p>
          </div>
          <b>{{ score(item.score) }}</b>
        </article>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">复盘提示</span>
          <h2>本周看什么</h2>
        </div>
      </div>
      <TriggerRules title="执行规则" :rules="reviewRules" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AllocationTable from "../components/AllocationTable.vue";
import DcaPlanCard from "../components/DcaPlanCard.vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import OpportunityBudgetPanel from "../components/OpportunityBudgetPanel.vue";
import TriggerRules from "../components/TriggerRules.vue";
import { bucketDefinitions, type BucketTargetMap } from "../data/bucketEducation";
import { strategyTemplates } from "../data/strategyTemplates";
import { getMainlineProfile } from "../data/mainlineKnowledge";
import { generateMonthlyPlan } from "../rules/allocation";
import { getSatelliteDeployment } from "../rules/satelliteOpportunity";
import { fetchMainlineScan, pickActionableMainline, splitMainlineGroups } from "../services/mainlineData";
import type { MainlineScanResponse } from "../types";
import { score } from "../utils/format";

const scan = ref<MainlineScanResponse | null>(null);

const mainlines = computed(() => scan.value?.results ?? []);
const groups = computed(() => splitMainlineGroups(mainlines.value));
const topAction = computed(() => pickActionableMainline(mainlines.value));
const topProfile = computed(() => getMainlineProfile(topAction.value));
const satelliteDeployment = computed(() => getSatelliteDeployment(topAction.value));

const plan = computed(() =>
  generateMonthlyPlan({
    monthlyAmount: 3000,
    style: "balanced",
    volatility: "medium",
    states: {
      chinaCore: "fair",
      globalCore: "fair",
      defensive: "fair",
      satellite: satelliteDeployment.value.state,
    },
    overrides: {
      satellite: {
        multiplier: 0,
        reason: "卫星预算不按月机械定投，进入机会资金池，由机会额度面板按可用资金和触发条件给出建议。",
      },
    },
  }),
);

const monthlySatelliteBudget = computed(() => 3000 * strategyTemplates.balanced.satellite);

const dashboardTargets = computed<BucketTargetMap>(() => ({
  satellite: topAction.value
    ? [
        {
          name: topAction.value.name,
          code: topAction.value.representativeEtfs.join("/"),
          note: `${topAction.value.status} · ${topAction.value.stage}`,
        },
        {
          name: satelliteDeployment.value.mode === "strategic-dca" ? "产业增强纪律" : "机会建仓纪律",
          note: satelliteDeployment.value.label,
        },
      ]
    : [
        {
          name: "等待主线",
          note: "无清晰主线时不买主题",
        },
      ],
}));

const scanNote = computed(() => {
  if (!scan.value) return "主线雷达加载中";
  const mode = scan.value.mode === "live" ? "公开数据" : scan.value.mode === "cache" ? "缓存数据" : "内置快照";
  return `${scan.value.source} · ${mode}`;
});

const dashboardConclusion = computed(() => {
  if (!scan.value) return "正在读取主线雷达，本月先按核心仓纪律执行。";
  if (topAction.value) {
    return `本月核心仓正常推进，卫星仓优先观察 ${topAction.value.name}。`;
  }
  if (groups.value.overheated.length) {
    return "主线方向有热度但安全边际不足，卫星仓降速，等待资金上升。";
  }
  return "当前没有清晰主线，不为了追热点强行买卫星仓。";
});

const dashboardReason = computed(() => {
  if (!topAction.value) {
    return "主线雷达没有找到资金、强弱、趋势和热度同时合格的方向，所以新增资金先回到核心宽基、防守仓和等待资金。";
  }

  return `${topAction.value.name} 的证据链：${topAction.value.evidence.fund} ${topAction.value.evidence.strength} ${topProfile.value.coreLogic}`;
});

const dashboardBenefit = computed(() => {
  if (!topAction.value) return "小白只需要先守住仓位结构，不会因为每天热点变化而反复换方向。";
  return satelliteDeployment.value.mode === "strategic-dca"
    ? `参与方式是产业增强低速定投，不替代宽基主仓；这样既能跟踪 ${topAction.value.name}，又不破坏A股核心和全球核心。`
    : `参与方式是卫星仓触发式建仓，而不是长期机械定投；这样既能跟踪 ${topAction.value.name}，又不破坏A股核心和全球核心。`;
});

const dashboardRisk = computed(() => {
  if (!topAction.value) return "风险是等待期间可能阶段性跑输热门主题，但避免了在高位把本金一次性打满。";
  return `${topAction.value.evidence.heat} ${topProfile.value.whyNotHeavy}`;
});

const dashboardTrigger = computed(() => {
  if (!topAction.value) return "等主线雷达出现主线候选，或观察区方向回调后资金强弱继续确认，再恢复卫星仓买入。";
  return `${satelliteDeployment.value.trigger} 暂停条件：${topProfile.value.pauseRule}`;
});

const reviewRules = computed(() => {
  if (!topAction.value) {
    return [
      "每周刷新主线雷达，如果没有主线候选，卫星仓资金优先进入等待资金。",
      "A股核心宽基按估值分位执行，不用科创或半导体替代整个A股主仓。",
      "美股/全球核心高位时保留底仓和低速定投，重点检查美债利率、QDII溢价和核心权重财报。",
    ];
  }

  return [
    `主线：${topAction.value.name}。本周重点看：${topProfile.value.reviewFocus.join("、")}。`,
    `执行：${satelliteDeployment.value.label}，且只影响卫星/产业增强仓，不改变核心宽基结构。`,
    `暂停：${topProfile.value.pauseRule}`,
  ];
});

onMounted(async () => {
  scan.value = await fetchMainlineScan();
});
</script>
