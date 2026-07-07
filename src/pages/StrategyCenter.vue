<template>
  <main class="page-stack">
    <section class="strategy-hero">
      <div>
        <span class="eyebrow">策略中心</span>
        <h2>先创建策略，再让系统按策略推荐执行</h2>
        <p>策略保存的是投资目标、仓位比例、热度阈值和执行纪律。账户绑定策略后，首页的加仓金额、暂停提示和卫星仓建议都会跟随当前策略。</p>
      </div>
      <div class="strategy-active-card">
        <span class="eyebrow">当前策略</span>
        <h3>{{ activeStrategy?.name ?? "未选择" }}</h3>
        <p>{{ activeStrategy?.recommendationReason ?? "请先创建或选择一个策略。" }}</p>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">系统推荐</span>
          <h2>{{ marketRecommendation.title }}</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="heatLabel" :kind="heatKind" />
          <button type="button" class="primary-button" @click="createRecommendedStrategy">按推荐创建策略</button>
        </div>
      </div>
      <p class="decision-copy">{{ marketRecommendation.action }}</p>
      <p class="data-note">{{ marketRecommendation.reason }}</p>

      <div class="indicator-grid">
        <article v-for="indicator in marketRecommendation.indicators" :key="indicator.key" class="indicator-card" :class="indicator.level">
          <span>{{ indicator.label }}</span>
          <strong>{{ indicator.value }}{{ indicator.unit }}</strong>
          <small>{{ indicator.detail }}</small>
        </article>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">创建策略</span>
          <h2>选择一个目标模板</h2>
        </div>
        <button type="button" class="primary-button" @click="useTemplateStrategy">使用这个策略</button>
      </div>

      <div class="strategy-template-grid">
        <button
          v-for="goal in strategyGoals"
          :key="goal"
          type="button"
          class="strategy-template-card"
          :class="{ active: selectedGoal === goal }"
          @click="selectedGoal = goal"
        >
          <strong>{{ strategyGoalLabels[goal] }}</strong>
          <span>{{ strategyGoalDescriptions[goal] }}</span>
        </button>
      </div>

      <div class="strategy-preview">
        <div>
          <span class="eyebrow">推荐配置</span>
          <h3>{{ selectedTemplate.name }}</h3>
          <p>{{ selectedTemplate.recommendationReason }}</p>
        </div>
        <div class="allocation-chip-grid">
          <span v-for="bucket in bucketOrder" :key="bucket">
            {{ bucketLabels[bucket] }} <strong>{{ Math.round(selectedTemplate.allocation[bucket] * 100) }}%</strong>
          </span>
        </div>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">我的策略</span>
          <h2>策略列表</h2>
        </div>
        <span class="data-note">默认策略只影响新账户创建；已有账户请到账户中心的“编辑账户”里重新绑定。</span>
      </div>

      <div class="strategy-list">
        <article v-for="strategy in strategies" :key="strategy.id" class="strategy-card" :class="{ active: strategy.id === activeStrategyId }">
          <header>
            <div>
              <span class="eyebrow">{{ strategyGoalLabels[strategy.goal] }} · {{ riskLabel(strategy.riskLevel) }}</span>
              <h3>{{ strategy.name }}</h3>
            </div>
            <RiskBadge :label="strategy.id === activeStrategyId ? '默认策略' : '可选策略'" :kind="strategy.id === activeStrategyId ? 'good' : 'neutral'" />
          </header>
          <p>{{ strategy.recommendationReason }}</p>
          <div class="compact-list">
            <span>月投入 {{ money(strategy.monthlyAmount) }}</span>
            <span>卫星上限 {{ strategy.satelliteCapPct }}%</span>
            <span>最大回撤 {{ strategy.maxDrawdownPct }}%</span>
            <span>期限 {{ strategy.horizonYears }} 年</span>
          </div>
          <div class="strategy-actions">
            <button type="button" class="ghost-button" @click="setDefaultStrategy(strategy.id)">设为默认</button>
            <button type="button" class="ghost-button danger" :disabled="strategies.length <= 1" @click="removeStrategy(strategy.id)">删除</button>
          </div>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import RiskBadge from "../components/RiskBadge.vue";
import { usePersistentString } from "../composables/usePersistentRef";
import { useStrategiesStore } from "../composables/useWorkspaceStore";
import { bucketLabels } from "../data/strategyTemplates";
import {
  buildMarketRecommendation,
  createStrategyFromRecommendation,
  createStrategyTemplate,
  strategyGoalDescriptions,
  strategyGoalLabels,
} from "../data/strategyWorkspace";
import { fetchLowValuationScan } from "../services/lowValuationData";
import { fetchMainlineScan } from "../services/mainlineData";
import type {
  AssetBucket,
  LowValuationScanResponse,
  MainlineScanResponse,
  MarketHeatLevel,
  StrategyGoal,
  StrategyRiskLevel,
} from "../types";
import { money } from "../utils/format";

type StrategyBucket = AssetBucket;

const strategies = useStrategiesStore();
const activeStrategyId = usePersistentString<string>("licai.activeStrategyId", "strategy-balanced-core");
const selectedGoal = ref<StrategyGoal>("balancedCore");
const mainlineScan = ref<MainlineScanResponse | null>(null);
const lowValuationScan = ref<LowValuationScanResponse | null>(null);

const strategyGoals: StrategyGoal[] = ["steadyDca", "balancedCore", "globalCoreFirst", "aggressiveSatellite", "retirement", "custom"];
const bucketOrder: StrategyBucket[] = ["chinaCore", "globalCore", "defensive", "satellite", "reserve"];

const activeStrategy = computed(() => strategies.value.find((strategy) => strategy.id === activeStrategyId.value) ?? strategies.value[0]);
const selectedTemplate = computed(() => createStrategyTemplate(selectedGoal.value));
const marketRecommendation = computed(() => buildMarketRecommendation(mainlineScan.value, lowValuationScan.value));

const heatLabelMap: Record<MarketHeatLevel, string> = {
  cold: "低热度",
  normal: "正常",
  warm: "偏暖",
  hot: "偏热",
  overheated: "过热",
};

const heatLabel = computed(() => heatLabelMap[marketRecommendation.value.heatLevel]);
const heatKind = computed(() => {
  if (marketRecommendation.value.heatLevel === "hot" || marketRecommendation.value.heatLevel === "overheated") return "warn";
  if (marketRecommendation.value.heatLevel === "cold") return "good";
  return "neutral";
});

function riskLabel(level: StrategyRiskLevel) {
  if (level === "low") return "低风险";
  if (level === "high") return "高风险";
  return "中风险";
}

function createRecommendedStrategy() {
  const next = createStrategyFromRecommendation(marketRecommendation.value);
  next.id = `${next.id}-${strategies.value.length + 1}`;
  strategies.value.unshift(next);
  setDefaultStrategy(next.id);
}

function useTemplateStrategy() {
  const existing = strategies.value.find((strategy) => strategy.goal === selectedGoal.value);
  if (existing && selectedGoal.value !== "custom") {
    setDefaultStrategy(existing.id);
    return;
  }

  const next = createStrategyTemplate(selectedGoal.value, strategies.value.length + 1);
  strategies.value.unshift(next);
  setDefaultStrategy(next.id);
}

function setDefaultStrategy(strategyId: string) {
  activeStrategyId.value = strategyId;
}

function removeStrategy(id: string) {
  if (strategies.value.length <= 1) return;
  strategies.value = strategies.value.filter((strategy) => strategy.id !== id);
  if (activeStrategyId.value === id) {
    activeStrategyId.value = strategies.value[0]?.id ?? "";
  }
}

onMounted(async () => {
  const [mainline, lowValuation] = await Promise.all([fetchMainlineScan(), fetchLowValuationScan()]);
  mainlineScan.value = mainline;
  lowValuationScan.value = lowValuation;
});
</script>
