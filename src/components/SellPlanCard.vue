<template>
  <section class="sell-card">
    <header>
      <div>
        <span class="eyebrow">减仓计划</span>
        <h3>{{ plan.needSell ? "需要分批再平衡" : "暂不需要卖出" }}</h3>
      </div>
      <RiskBadge :label="plan.needSell ? '超配' : '正常'" :kind="plan.needSell ? 'warn' : 'good'" />
    </header>

    <div class="sell-grid">
      <MetricCard label="目标持仓" :value="money(plan.targetAmount)" />
      <MetricCard label="底仓金额" :value="money(plan.baseAmount)" />
      <MetricCard label="建议卖出" :value="money(plan.suggestedSell)" :tone="plan.needSell ? 'warn' : 'good'" />
      <MetricCard
        v-if="plan.needSell"
        label="每日金额"
        :value="money(plan.dailySellAmount ?? 0)"
        :detail="`${Math.round(plan.dailyShares ?? 0)} 份/日`"
      />
    </div>
    <p class="muted">{{ plan.message }}</p>
  </section>
</template>

<script setup lang="ts">
import MetricCard from "./MetricCard.vue";
import RiskBadge from "./RiskBadge.vue";
import { money } from "../utils/format";

defineProps<{
  plan: {
    needSell: boolean;
    targetAmount: number;
    baseAmount: number;
    suggestedSell: number;
    dailySellAmount?: number;
    dailyShares?: number;
    message: string;
  };
}>();
</script>
