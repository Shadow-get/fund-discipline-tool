<template>
  <section class="opportunity-panel">
    <div class="section-heading compact">
      <div>
        <span class="eyebrow">机会额度</span>
        <h3>卫星资金池</h3>
      </div>
      <span class="data-note">{{ deployment.label }}</span>
    </div>

    <div class="opportunity-inputs">
      <label>
        机会金总额
        <input v-model.number="quota" type="number" min="0" step="500" />
        <small>你愿意拿出来做卫星/产业增强的钱</small>
      </label>
      <label>
        已投入机会金
        <input v-model.number="consumed" type="number" min="0" step="500" />
        <small>已经买入卫星方向的本金</small>
      </label>
      <label>
        最低执行金额
        <input v-model.number="minAmount" type="number" min="0" step="100" />
        <small>低于这个金额就继续攒</small>
      </label>
    </div>

    <details class="advanced-settings">
      <summary>高级仓位上限</summary>
      <div class="opportunity-inputs">
        <label>
          账户总金额
          <input v-model.number="totalAssets" type="number" min="0" step="1000" />
          <small>全部基金/现金合计，用于限制卫星仓不超配</small>
        </label>
        <label>
          当前卫星市值
          <input v-model.number="currentSatellite" type="number" min="0" step="500" />
          <small>卫星持仓当前值；默认可等于已投入机会金</small>
        </label>
        <label>
          卫星上限%
          <input v-model.number="targetPct" type="number" min="0" max="30" step="1" />
          <small>默认15%，新手不建议频繁调</small>
        </label>
      </div>
    </details>

    <div class="opportunity-summary">
      <MetricCard label="已投入" :value="percent(consumedRatio)" :detail="`${money(consumed)} / ${money(quota)}`" />
      <MetricCard label="可用机会资金" :value="money(opportunityCapital)" :detail="capitalDetail" />
      <MetricCard label="建议动用比例" :value="`${suggestedPercent}%`" :detail="targetName || '等待信号'" />
      <MetricCard label="建议执行" :value="money(recommendedAmount)" :detail="executionDetail" tone="good" />
    </div>

    <div class="tip-bubble" :class="tipKind">
      <strong>{{ tipTitle }}</strong>
      <p>{{ tipText }}</p>
      <small>下次提示：{{ deployment.trigger }}</small>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { SatelliteDeployment } from "../rules/satelliteOpportunity";
import { money, percent } from "../utils/format";
import MetricCard from "./MetricCard.vue";

const props = defineProps<{
  deployment: SatelliteDeployment;
  monthlySatelliteBudget: number;
  targetName?: string;
  targetStatus?: string;
}>();

function readNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw == null ? fallback : Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

const quota = ref(readNumber("licai.opportunity.quota", 10000));
const consumed = ref(readNumber("licai.opportunity.consumed", 0));
const totalAssets = ref(readNumber("licai.opportunity.totalAssets", 100000));
const currentSatellite = ref(readNumber("licai.opportunity.currentSatellite", consumed.value));
const targetPct = ref(readNumber("licai.opportunity.targetPct", 15));
const minAmount = ref(readNumber("licai.opportunity.minAmount", 500));

watch(consumed, (value) => {
  try {
    if (!localStorage.getItem("licai.opportunity.currentSatellite")) {
      currentSatellite.value = value;
    }
  } catch {
    currentSatellite.value = value;
  }
});

watch([quota, consumed, totalAssets, currentSatellite, targetPct, minAmount], () => {
  try {
    localStorage.setItem("licai.opportunity.quota", String(quota.value));
    localStorage.setItem("licai.opportunity.consumed", String(consumed.value));
    localStorage.setItem("licai.opportunity.totalAssets", String(totalAssets.value));
    localStorage.setItem("licai.opportunity.currentSatellite", String(currentSatellite.value));
    localStorage.setItem("licai.opportunity.targetPct", String(targetPct.value));
    localStorage.setItem("licai.opportunity.minAmount", String(minAmount.value));
  } catch {
    // localStorage may be unavailable in restricted browser modes.
  }
});

const targetAmount = computed(() => Math.max(0, totalAssets.value * (targetPct.value / 100)));
const satelliteRoom = computed(() => Math.max(0, targetAmount.value - currentSatellite.value));
const remainingQuota = computed(() => Math.max(0, quota.value - consumed.value));
const opportunityCapital = computed(() =>
  Math.max(0, Math.min(remainingQuota.value + props.monthlySatelliteBudget, satelliteRoom.value)),
);
const rawRecommended = computed(() => opportunityCapital.value * props.deployment.multiplier);
const recommendedAmount = computed(() => {
  if (rawRecommended.value < minAmount.value) return 0;
  return Math.min(opportunityCapital.value, Math.floor(rawRecommended.value / 100) * 100);
});
const consumedRatio = computed(() => (quota.value > 0 ? consumed.value / quota.value : 0));
const suggestedPercent = computed(() => Math.round(props.deployment.multiplier * 100));
const capitalDetail = computed(() => {
  if (satelliteRoom.value <= 0) return "卫星仓已达目标上限";
  return `剩余额度+本月预算 ${money(props.monthlySatelliteBudget)}`;
});
const executionDetail = computed(() => {
  if (recommendedAmount.value > 0) return props.targetStatus ?? props.deployment.mode;
  if (rawRecommended.value > 0) return `低于最低执行 ${money(minAmount.value)}`;
  return "本次等待";
});
const tipKind = computed(() => {
  if (recommendedAmount.value > 0) return "good";
  if (rawRecommended.value > 0) return "warn";
  return "neutral";
});
const tipTitle = computed(() => {
  if (!props.targetName) return "等待更清晰的机会";
  if (recommendedAmount.value > 0) return `${props.targetName} 可执行`;
  if (rawRecommended.value > 0) return `${props.targetName} 先攒够执行金额`;
  return `${props.targetName} 暂不执行`;
});
const tipText = computed(() => {
  if (satelliteRoom.value <= 0) return "你的卫星仓已经达到目标仓位，本次不建议继续加仓。";
  if (recommendedAmount.value > 0) {
    return `建议使用可用机会资金的 ${suggestedPercent.value}%，本次执行 ${money(recommendedAmount.value)}。买入后把“已投入机会金”增加同等金额。`;
  }
  if (rawRecommended.value > 0) {
    return `当前规则会给出 ${money(rawRecommended.value)}，但低于最低执行金额，先进入等待资金，避免碎片化交易。`;
  }
  return "当前没有触发加仓条件，机会额度保留。";
});
</script>
