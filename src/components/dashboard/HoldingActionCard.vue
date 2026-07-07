<template>
  <article class="holding-action-card" :class="{ completed: row.completed }">
    <header>
      <div>
        <span class="code-pill">{{ row.code }}</span>
        <h3>{{ row.name }}</h3>
        <small>{{ bucketLabel }}</small>
      </div>
      <RiskBadge :label="row.badgeLabel" :kind="row.completed ? 'good' : row.recommendedAmount > 0 ? 'warn' : 'neutral'" />
    </header>

    <div class="holding-stat-grid">
      <div>
        <span>持仓市值</span>
        <strong>{{ money(row.marketValue) }}</strong>
      </div>
      <div>
        <span>累计收益率</span>
        <strong :class="returnClass(row.returnPct)">{{ signedPercent(row.returnPct) }}</strong>
      </div>
      <div>
        <span>持仓浮盈</span>
        <strong :class="returnClass(row.profitPct)">{{ money(row.profit) }}</strong>
      </div>
      <div>
        <span>今日涨跌</span>
        <strong :class="returnClass(row.todayReturnPct)">{{ signedPercent(row.todayReturnPct) }}</strong>
        <small>{{ row.quoteLabel }}</small>
      </div>
    </div>

    <div class="recommendation-band">
      <div>
        <span>本次建议</span>
        <strong>{{ money(row.recommendedAmount) }}</strong>
        <small>{{ row.reason }}</small>
      </div>
      <label>
        实际加仓
        <input v-model.number="entryAmountModel" type="number" min="0" step="100" />
      </label>
      <button type="button" class="primary-button" @click="emit('submit')">
        记录完成
      </button>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DashboardHoldingRow } from "../../types";
import { money, returnClass, signedPercent } from "../../utils/format";
import RiskBadge from "../RiskBadge.vue";

const props = defineProps<{
  row: DashboardHoldingRow;
  bucketLabel: string;
  entryAmount: number;
}>();

const emit = defineEmits<{
  "update:entryAmount": [value: number];
  submit: [];
}>();

const entryAmountModel = computed({
  get: () => props.entryAmount,
  set: (value) => emit("update:entryAmount", Number(value)),
});
</script>
