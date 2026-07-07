<template>
  <div class="settings-card">
    <header>
      <div>
        <span class="eyebrow">用户设置</span>
        <h3>{{ setupTitle }}</h3>
      </div>
      <RiskBadge :label="setupBadge" :kind="setupKind" />
    </header>

    <div class="settings-fields">
      <label>
        本月新增资金
        <input v-model.number="monthlyAmountModel" type="number" min="0" step="100" />
      </label>
      <label>
        长期风格
        <select v-model="styleModel">
          <option v-for="key in styleOptions" :key="key" :value="key">{{ styleLabels[key] }}</option>
        </select>
      </label>
    </div>

    <div class="segmented-control" aria-label="执行拆分">
      <button
        v-for="option in volatilityOptions"
        :key="option.value"
        type="button"
        :class="{ active: volatility === option.value }"
        @click="emit('update:volatility', option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="setup-actions">
      <button type="button" class="primary-button" @click="emit('clear')">
        我还没开始定投，初始化为空
      </button>
      <button type="button" class="ghost-button" @click="emit('restore')">
        载入示例
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { Style } from "../../types";
import RiskBadge from "../RiskBadge.vue";

type Volatility = "low" | "medium" | "high";

const props = defineProps<{
  setupTitle: string;
  setupBadge: string;
  setupKind: "neutral" | "good" | "warn" | "danger";
  monthlyAmount: number;
  style: Style;
  styleOptions: Style[];
  styleLabels: Record<Style, string>;
  volatility: Volatility;
  volatilityOptions: Array<{ value: Volatility; label: string }>;
}>();

const emit = defineEmits<{
  "update:monthlyAmount": [value: number];
  "update:style": [value: Style];
  "update:volatility": [value: Volatility];
  clear: [];
  restore: [];
}>();

const monthlyAmountModel = computed({
  get: () => props.monthlyAmount,
  set: (value) => emit("update:monthlyAmount", Number(value)),
});

const styleModel = computed({
  get: () => props.style,
  set: (value) => emit("update:style", value),
});
</script>
