<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">A股增强</span>
          <h2>年度收益收割器</h2>
        </div>
        <span class="data-note">可选策略 · 不适合作为全市场默认策略</span>
      </div>

      <div class="form-grid">
        <label>年初本金基准 <input v-model.number="startPrincipal" type="number" step="1000" /></label>
        <label>全年投入本金 <input v-model.number="annualContribution" type="number" step="1000" /></label>
        <label>年末市值 <input v-model.number="endValue" type="number" step="1000" /></label>
        <label>估值分位 <input v-model.number="valuationPercentile" type="number" min="0" max="100" /></label>
        <label>当前仓位 <input v-model.number="currentWeight" type="number" min="0" max="100" /></label>
        <label>目标仓位 <input v-model.number="targetWeight" type="number" min="0" max="100" /></label>
        <label>原月定投额 <input v-model.number="originalMonthlyDca" type="number" step="100" /></label>
      </div>
    </section>

    <section class="metric-grid">
      <MetricCard label="年度收益" :value="money(plan.profit)" />
      <MetricCard label="收割比例" :value="`${Math.round(plan.harvestRatio * 100)}%`" />
      <MetricCard label="建议收割" :value="money(plan.harvestAmount)" :tone="plan.harvestAmount > 0 ? 'warn' : 'good'" />
      <MetricCard label="下一年月定投" :value="money(plan.nextYearMonthlyDca)" />
    </section>

    <ExplanationCard
      :conclusion="plan.harvestAmount > 0 ? '可以收割部分A股收益，并摊回下一年定投。' : '暂不机械收割收益。'"
      :reason="plan.reason"
      benefit="把震荡市里的浮盈转成下一年的现金流，避免盈利后完全不知道怎么处理。"
      :risk="plan.risk"
      trigger="年度收益、估值分位和仓位超配同时满足时再开启。"
    />
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MetricCard from "../components/MetricCard.vue";
import { useCoreCalculation } from "../composables/useCoreCalculation";
import { getHarvestPlan } from "../rules/annualHarvest";
import { calculateHarvestPlan } from "../services/calculationApi";
import { money } from "../utils/format";

const startPrincipal = ref(60000);
const annualContribution = ref(12000);
const endValue = ref(76000);
const valuationPercentile = ref(75);
const currentWeight = ref(28);
const targetWeight = ref(25);
const originalMonthlyDca = ref(1000);

function harvestInput() {
  return {
    startPrincipal: startPrincipal.value,
    annualContribution: annualContribution.value,
    endValue: endValue.value,
    valuationPercentile: valuationPercentile.value,
    currentWeight: currentWeight.value / 100,
    targetWeight: targetWeight.value / 100,
    originalMonthlyDca: originalMonthlyDca.value,
  };
}

const { value: plan } = useCoreCalculation<ReturnType<typeof getHarvestPlan>>(
  () => calculateHarvestPlan<ReturnType<typeof harvestInput>, ReturnType<typeof getHarvestPlan>>(harvestInput()),
  () => getHarvestPlan(harvestInput()),
);
</script>
