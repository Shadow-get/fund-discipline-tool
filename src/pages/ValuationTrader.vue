<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">单标的诊断</span>
          <h2>高低估买卖器</h2>
        </div>
        <span class="data-note">卖出只在已有持仓且超配时触发</span>
      </div>

      <div class="form-grid">
        <label>
          指数/基金名称
          <input v-model="fundName" />
        </label>
        <label>
          总资产
          <input v-model.number="totalAssets" type="number" step="1000" />
        </label>
        <label>
          当前持仓金额
          <input v-model.number="currentAmount" type="number" step="1000" />
        </label>
        <label>
          目标仓位
          <input v-model.number="targetWeightPct" type="number" min="0" max="100" />
        </label>
        <label>
          底仓占目标仓位
          <input v-model.number="baseRatioPct" type="number" min="0" max="100" />
        </label>
        <label>
          热度分数
          <input v-model.number="heatScore" type="number" min="0" max="100" />
        </label>
        <label>
          基金价格
          <input v-model.number="fundPrice" type="number" min="0" step="0.01" />
        </label>
        <label>
          估值状态
          <select v-model="state">
            <option v-for="(label, key) in marketStateLabels" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
      </div>
    </section>

    <section class="metric-grid">
      <MetricCard label="定投倍率" :value="`${Math.round(multiplier * 100)}%`" detail="用于新增资金" />
      <MetricCard label="目标持仓" :value="money(sellPlan.targetAmount)" />
      <MetricCard label="底仓金额" :value="money(sellPlan.baseAmount)" />
      <MetricCard label="建议卖出" :value="money(sellPlan.suggestedSell)" :tone="sellPlan.needSell ? 'warn' : 'good'" />
    </section>

    <SellPlanCard :plan="sellPlan" />

    <ExplanationCard
      :conclusion="`${fundName}：${sellPlan.needSell ? '先分批减到目标仓位，再低速定投。' : '不为了猜顶部而卖出。'}`"
      :reason="sellPlan.needSell ? '当前持仓超过目标仓位，且热度分数较高，系统优先处理仓位风险。' : '当前没有明显超配，高估时更适合降低新增定投，而不是清仓。'"
      benefit="卖出规则以目标仓位和底仓为边界，避免情绪化全卖或满仓追买。"
      risk="高估资产可能继续上涨，过早减仓会牺牲部分收益；因此只卖超配部分。"
      trigger="回调10%-15%恢复正常定投；仓位超过目标130%时启动分批减仓。"
    />
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MetricCard from "../components/MetricCard.vue";
import SellPlanCard from "../components/SellPlanCard.vue";
import { useCoreCalculation } from "../composables/useCoreCalculation";
import { marketStateLabels } from "../data/indexPresets";
import { getDcaMultiplier } from "../rules/dca";
import { getSellPlan } from "../rules/sellPlan";
import { calculateDcaMultiplier, calculateSellPlan } from "../services/calculationApi";
import type { MarketState } from "../types";
import { money } from "../utils/format";

const fundName = ref("纳斯达克100");
const totalAssets = ref(200000);
const currentAmount = ref(70000);
const targetWeightPct = ref(25);
const baseRatioPct = ref(40);
const heatScore = ref(82);
const fundPrice = ref(1.5);
const state = ref<MarketState>("high");

function sellInput() {
  return {
    totalAssets: totalAssets.value,
    currentAmount: currentAmount.value,
    targetWeight: targetWeightPct.value / 100,
    baseRatio: baseRatioPct.value / 100,
    heatScore: heatScore.value,
    fundPrice: fundPrice.value,
  };
}

const { value: multiplier } = useCoreCalculation<number>(
  () => calculateDcaMultiplier({ state: state.value }),
  () => getDcaMultiplier(state.value),
);

const { value: sellPlan } = useCoreCalculation<ReturnType<typeof getSellPlan>>(
  () => calculateSellPlan<ReturnType<typeof sellInput>, ReturnType<typeof getSellPlan>>(sellInput()),
  () => getSellPlan(sellInput()),
);
</script>
