<template>
  <section class="calendar-panel">
    <div class="section-heading">
      <div>
        <span class="eyebrow">收益日历</span>
        <h2>每日收益回测</h2>
      </div>
      <div class="month-switcher">
        <button type="button" class="ghost-button" @click="emit('moveMonth', -1)">上月</button>
        <strong>{{ selectedMonth }}</strong>
        <button type="button" class="ghost-button" @click="emit('moveMonth', 1)">下月</button>
      </div>
    </div>

    <div class="calendar-summary">
      <MetricCard label="本月收益" :value="money(monthProfit)" :tone="monthProfit >= 0 ? 'good' : 'warn'" />
      <MetricCard label="盈利天数" :value="`${positiveDays}/${returnDays}`" detail="只统计已有数据日" />
      <MetricCard label="单日最大亏损" :value="money(maxLoss)" :tone="maxLoss < 0 ? 'warn' : 'neutral'" />
      <MetricCard label="月末市值" :value="money(monthEndValue)" />
    </div>

    <div class="calendar-weekdays">
      <span v-for="day in weekdays" :key="day">{{ day }}</span>
    </div>
    <div class="return-calendar">
      <div v-for="blank in calendarOffset" :key="`blank-${blank}`" class="calendar-blank"></div>
      <div
        v-for="day in calendarDays"
        :key="day.date"
        class="calendar-day"
        :class="calendarTone(day.item?.profit ?? 0)"
      >
        <span>{{ day.day }}</span>
        <strong v-if="day.item">{{ money(day.item.profit) }}</strong>
        <small v-if="day.item">{{ signedPercent(day.item.returnPct) }}</small>
        <em v-else>未记录</em>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { CalendarDay } from "../../types";
import { money, safeNumber, signedPercent } from "../../utils/format";
import MetricCard from "../MetricCard.vue";

defineProps<{
  selectedMonth: string;
  weekdays: string[];
  calendarOffset: number;
  calendarDays: CalendarDay[];
  monthProfit: number;
  positiveDays: number;
  returnDays: number;
  maxLoss: number;
  monthEndValue: number;
}>();

const emit = defineEmits<{
  moveMonth: [offset: number];
}>();

function calendarTone(profit: unknown) {
  const number = safeNumber(profit);
  if (number > 0) return "positive";
  if (number < 0) return "negative";
  return "empty";
}
</script>
