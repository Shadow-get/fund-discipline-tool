<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>指数纪律工具</strong>
        <span>本地规则 MVP</span>
      </div>
      <nav>
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </nav>
      <p class="disclaimer">仅用于投资分析、教育和自我规划参考，不构成具体投资顾问建议。</p>
    </aside>

    <section class="content">
      <component :is="currentComponent" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AnnualHarvest from "./pages/AnnualHarvest.vue";
import Dashboard from "./pages/Dashboard.vue";
import MainlinePage from "./pages/MainlinePage.vue";
import MonthlyCashflow from "./pages/MonthlyCashflow.vue";
import PortfolioHealth from "./pages/PortfolioHealth.vue";
import ScenarioSimulator from "./pages/ScenarioSimulator.vue";
import ValuationTrader from "./pages/ValuationTrader.vue";

const tabs = [
  { key: "dashboard", label: "总览", component: Dashboard },
  { key: "cashflow", label: "月现金流", component: MonthlyCashflow },
  { key: "valuation", label: "高低估买卖器", component: ValuationTrader },
  { key: "mainline", label: "当年主线", component: MainlinePage },
  { key: "portfolio", label: "组合体检", component: PortfolioHealth },
  { key: "scenario", label: "情景模拟", component: ScenarioSimulator },
  { key: "harvest", label: "年度收割", component: AnnualHarvest },
] as const;

const activeTab = ref<(typeof tabs)[number]["key"]>("dashboard");
const currentComponent = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.component ?? Dashboard);
</script>
