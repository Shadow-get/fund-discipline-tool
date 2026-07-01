<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">组合体检</span>
          <h2>仓位结构检查</h2>
        </div>
        <RiskBadge :label="health.status" :kind="health.status === '结构均衡' ? 'good' : 'warn'" />
      </div>

      <div class="form-grid">
        <label>A股核心 <input v-model.number="holdings.chinaCore" type="number" step="1000" /></label>
        <label>美股/全球核心 <input v-model.number="holdings.globalCore" type="number" step="1000" /></label>
        <label>防守仓 <input v-model.number="holdings.defensive" type="number" step="1000" /></label>
        <label>卫星仓 <input v-model.number="holdings.satellite" type="number" step="1000" /></label>
        <label>等待资金 <input v-model.number="holdings.reserve" type="number" step="1000" /></label>
      </div>
    </section>

    <section class="metric-grid">
      <MetricCard label="总资产" :value="money(health.total)" />
      <MetricCard label="核心仓合计" :value="percent(health.weights.chinaCore + health.weights.globalCore)" />
      <MetricCard label="防守仓" :value="percent(health.weights.defensive)" />
      <MetricCard label="卫星仓" :value="percent(health.weights.satellite)" :tone="health.weights.satellite > 0.25 ? 'warn' : 'neutral'" />
    </section>

    <section>
      <h3>体检提示</h3>
      <ul class="plain-list">
        <li v-if="!health.warnings.length">当前结构接近均衡，按月复盘即可。</li>
        <li v-for="warning in health.warnings" :key="warning">{{ warning }}</li>
      </ul>
    </section>

    <ExplanationCard
      conclusion="组合体检先看结构，再看具体标的。"
      reason="小白最容易把单一热门主题买成主仓，组合体检会先检查核心、防守、卫星和等待资金是否失衡。"
      benefit="先控制大类仓位，再处理单个指数估值，能减少追涨杀跌。"
      risk="只看仓位不能判断估值贵不贵，因此仍需结合高低估买卖器。"
      trigger="卫星仓超过25%、核心仓低于40%、等待资金低于5%时触发复盘。"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import { getPortfolioHealth } from "../rules/portfolio";
import { money, percent } from "../utils/format";

const holdings = reactive({
  chinaCore: 50000,
  globalCore: 55000,
  defensive: 45000,
  satellite: 25000,
  reserve: 25000,
});

const health = computed(() => getPortfolioHealth(holdings));
</script>
