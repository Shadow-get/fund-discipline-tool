<template>
  <section class="plan-strip">
    <div>
      <span>本月定投买入</span>
      <strong>{{ money(totalBuy) }}</strong>
    </div>
    <div>
      <span>本月转入等待</span>
      <strong>{{ money(reserve) }}</strong>
    </div>
    <div>
      <span>执行节奏</span>
      <strong>{{ frequency }}</strong>
      <small>{{ executionNote }}</small>
    </div>
    <div>
      <span>单次定投总额</span>
      <strong>{{ money(perExecution) }}</strong>
      <small>不是每个标的都买这个数</small>
    </div>
    <div v-if="plan" class="execution-breakdown">
      <span>单次拆分</span>
      <ul>
        <li v-for="line in activeLines" :key="line.key">
          <strong>{{ line.name }}</strong>
          <small>{{ money(line.actualBuy / divisor) }}</small>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Frequency, MonthlyPlan } from "../types";
import { getFrequencyLabel } from "../rules/dca";
import { money } from "../utils/format";

const props = defineProps<{
  totalBuy: number;
  reserve: number;
  frequency: Frequency;
  plan?: MonthlyPlan;
}>();

const frequency = computed(() => getFrequencyLabel(props.frequency));
const divisor = computed(() => {
  if (props.frequency === "daily") return 20;
  if (props.frequency === "weekly") return 4;
  if (props.frequency === "biweekly") return 2;
  return 1;
});

const perExecution = computed(() => props.totalBuy / divisor.value);
const executionNote = computed(() => {
  if (props.frequency === "daily") return "按20个交易日粗略拆分";
  if (props.frequency === "weekly") return "按4周粗略拆分";
  if (props.frequency === "biweekly") return "按2次粗略拆分";
  return "本月一次执行";
});

const activeLines = computed(() => props.plan?.lines.filter((line) => line.actualBuy > 0) ?? []);
</script>
