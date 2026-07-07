<template>
  <div class="app-shell">
    <aside class="sidebar">
      <div class="brand">
        <strong>指数纪律工具</strong>
        <span>本地规则 MVP</span>
      </div>
      <nav>
        <div v-for="group in groupedTabs" :key="group.name" class="nav-group">
          <span>{{ group.name }}</span>
          <button
            v-for="tab in group.tabs"
            :key="tab.key"
            type="button"
            :class="{ active: activeTab === tab.key }"
            @click="setActiveTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>
      </nav>
    </aside>

    <section class="content">
      <component :is="currentComponent" />
      <p class="content-disclaimer">
        仅用于投资分析、教育和自我规划参考，不构成具体投资顾问建议。
      </p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import AccountCenter from "./pages/AccountCenter.vue";
import AnnualHarvest from "./pages/AnnualHarvest.vue";
import Dashboard from "./pages/Dashboard.vue";
import LowValuationPage from "./pages/LowValuationPage.vue";
import MainlinePage from "./pages/MainlinePage.vue";
import MonthlyCashflow from "./pages/MonthlyCashflow.vue";
import PortfolioHealth from "./pages/PortfolioHealth.vue";
import ScenarioSimulator from "./pages/ScenarioSimulator.vue";
import StrategyCenter from "./pages/StrategyCenter.vue";
import ValuationTrader from "./pages/ValuationTrader.vue";

const tabs = [
  { key: "dashboard", label: "账户首页", group: "首页", component: Dashboard },
  { key: "accounts", label: "账户中心", group: "账户", component: AccountCenter },
  { key: "strategies", label: "策略中心", group: "策略", component: StrategyCenter },
  { key: "cashflow", label: "月现金流", group: "执行", component: MonthlyCashflow },
  { key: "portfolio", label: "组合体检", group: "执行", component: PortfolioHealth },
  { key: "mainline", label: "当年主线", group: "市场机会", component: MainlinePage },
  { key: "lowValuation", label: "低估值板块", group: "市场机会", component: LowValuationPage },
  { key: "valuation", label: "高低估买卖器", group: "工具", component: ValuationTrader },
  { key: "scenario", label: "情景模拟", group: "工具", component: ScenarioSimulator },
  { key: "harvest", label: "年度收割", group: "工具", component: AnnualHarvest },
] as const;

type TabKey = (typeof tabs)[number]["key"];
type NavigationDetail = TabKey | { tab: TabKey; target?: string };

const activeTab = ref<TabKey>("dashboard");
const currentComponent = computed(() => tabs.find((tab) => tab.key === activeTab.value)?.component ?? Dashboard);
const groupedTabs = computed(() => {
  const groups: Array<{ name: string; tabs: typeof tabs[number][] }> = [];
  for (const tab of tabs) {
    let group = groups.find((item) => item.name === tab.group);
    if (!group) {
      group = { name: tab.group, tabs: [] };
      groups.push(group);
    }
    group.tabs.push(tab);
  }
  return groups;
});

function isTabKey(value: unknown): value is TabKey {
  return typeof value === "string" && tabs.some((tab) => tab.key === value);
}

function setActiveTab(tabKey: TabKey, target?: string) {
  activeTab.value = tabKey;
  if (target) {
    void nextTick(() => {
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

function handleNavigate(event: Event) {
  const detail = (event as CustomEvent<unknown>).detail as NavigationDetail;
  if (isTabKey(detail)) {
    setActiveTab(detail);
    return;
  }

  if (detail && typeof detail === "object" && isTabKey(detail.tab)) {
    setActiveTab(detail.tab, detail.target);
  }
}

onMounted(() => {
  window.addEventListener("licai:navigate", handleNavigate);
});

onBeforeUnmount(() => {
  window.removeEventListener("licai:navigate", handleNavigate);
});
</script>
