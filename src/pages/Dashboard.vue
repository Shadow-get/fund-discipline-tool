<template>
  <main class="dashboard-workbench">
    <section class="workbench-hero">
      <div>
        <span class="eyebrow">首页总览</span>
        <h2>{{ activeAccount?.name ?? "账户首页" }}</h2>
        <p>首页只记录当前账户的数据和执行结果；加仓金额、暂停条件和卫星仓节奏由绑定策略与市场热度共同决定。</p>
      </div>

      <div class="strategy-active-card">
        <span class="eyebrow">当前策略</span>
        <h3>{{ activeStrategy?.name ?? "未绑定策略" }}</h3>
        <p>{{ activeStrategy?.recommendationReason ?? "请先到策略中心创建策略，再到账户中心绑定。" }}</p>
        <div class="compact-list">
          <span>月投入 {{ money(monthlyAmount) }}</span>
          <span>卫星上限 {{ activeStrategy?.satelliteCapPct ?? 0 }}%</span>
          <span>热度阈值 {{ activeStrategy?.heatControl.pauseHeatMin ?? 0 }}</span>
        </div>
      </div>
    </section>

    <NoticeStack :notices="notices" @dismiss="dismissNotice" />

    <section class="metric-grid">
      <MetricCard label="本次建议合计" :value="money(totalRecommended)" :detail="frequencyLabel" />
      <MetricCard label="本周已记录" :value="money(thisWeekExecuted)" :detail="weekLabel" :tone="thisWeekExecuted > 0 ? 'good' : 'neutral'" />
      <MetricCard label="本周待完成" :value="money(pendingAmount)" :detail="executionStateLabel" :tone="pendingAmount > 0 ? 'warn' : 'good'" />
      <MetricCard
        label="组合浮盈"
        :value="money(portfolioProfit)"
        :detail="signedPercent(portfolioReturnPct)"
        :tone="portfolioProfit >= 0 ? 'good' : 'warn'"
      />
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">市场热度</span>
          <h2>{{ marketRecommendation.title }}</h2>
        </div>
        <RiskBadge :label="heatLabel" :kind="heatKind" />
      </div>
      <p class="decision-copy">{{ marketRecommendation.action }}</p>
      <p class="data-note">{{ marketRecommendation.reason }}</p>
      <div class="indicator-grid">
        <article v-for="indicator in marketRecommendation.indicators" :key="indicator.key" class="indicator-card" :class="indicator.level">
          <span>{{ indicator.label }}</span>
          <strong>{{ indicator.value }}{{ indicator.unit }}</strong>
          <small>{{ indicator.detail }}</small>
        </article>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">策略调仓提示</span>
          <h2>本次额度如何被调整</h2>
        </div>
        <RiskBadge :label="`等待资金 ${money(plan.reserve)}`" :kind="plan.reserve > 0 ? 'warn' : 'good'" />
      </div>
      <div class="adjustment-grid">
        <article v-for="line in plan.lines" :key="line.key" class="adjustment-card" :class="line.state">
          <header>
            <div>
              <span class="eyebrow">{{ Math.round(line.ratio * 100) }}% 目标仓位</span>
              <h3>{{ line.name }}</h3>
            </div>
            <RiskBadge :label="lineActionLabel(line.actualBuy, line.targetAmount)" :kind="lineActionKind(line.actualBuy, line.targetAmount)" />
          </header>
          <div class="adjustment-metrics">
            <span>目标 {{ money(line.targetAmount) }}</span>
            <strong>执行 {{ money(line.actualBuy) }}</strong>
            <span>转入等待 {{ money(line.deferred) }}</span>
          </div>
          <p>{{ line.reason }}</p>
        </article>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">执行清单</span>
          <h2>本次加仓列表</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="quoteBadgeLabel" :kind="quoteMode === 'live' ? 'good' : 'warn'" />
          <button type="button" class="ghost-button" @click="navigateToAccounts">编辑持仓</button>
          <button type="button" class="ghost-button" :disabled="quoteLoading" @click="loadQuotes()">
            {{ quoteLoading ? "刷新中..." : "刷新行情" }}
          </button>
          <RiskBadge :label="executionStateLabel" :kind="pendingAmount > 0 ? 'warn' : 'good'" />
        </div>
      </div>
      <p class="data-warning compact-warning">
        今日涨跌优先使用东方财富公开行情；接口不可用时显示持仓维护里的手动值，并在卡片中标记“手动值”。
      </p>

      <div v-if="holdingRows.length" class="holding-action-grid">
        <HoldingActionCard
          v-for="row in holdingRows"
          :key="row.id"
          v-model:entry-amount="entryAmounts[row.id]"
          :row="row"
          :bucket-label="bucketLabels[row.bucket]"
          @submit="submitExecution(row)"
        />
      </div>
      <EmptyState
        v-else
        title="还没有持仓数据"
        description="你可以先保持为空；开始定投前，到“账户中心”里维护真实基金代码、成本和市值。"
      />
    </section>

    <ReturnCalendar
      id="dashboard-return-calendar"
      :selected-month="selectedMonth"
      :weekdays="weekdays"
      :calendar-offset="calendarOffset"
      :calendar-days="calendarDays"
      :month-profit="monthProfit"
      :positive-days="positiveDays"
      :return-days="returnDays"
      :max-loss="maxLoss"
      :month-end-value="monthEndValue"
      @move-month="moveMonth"
    />

    <ExecutionLogList :logs="weeklyLogs" @delete="deleteExecution" />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import EmptyState from "../components/dashboard/EmptyState.vue";
import ExecutionLogList from "../components/dashboard/ExecutionLogList.vue";
import HoldingActionCard from "../components/dashboard/HoldingActionCard.vue";
import NoticeStack from "../components/dashboard/NoticeStack.vue";
import ReturnCalendar from "../components/dashboard/ReturnCalendar.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import { usePersistentString } from "../composables/usePersistentRef";
import { useAccountsStore, useStrategiesStore } from "../composables/useWorkspaceStore";
import { createDefaultDailyReturns, currentMonthKey, defaultHoldings } from "../data/dashboardWorkspace";
import { bucketLabels } from "../data/strategyTemplates";
import { buildMarketRecommendation } from "../data/strategyWorkspace";
import { generateMonthlyPlan } from "../rules/allocation";
import { getFrequencyLabel } from "../rules/dca";
import { getSatelliteDeployment } from "../rules/satelliteOpportunity";
import { fetchHoldingQuotes } from "../services/holdingQuotes";
import { fetchLowValuationScan } from "../services/lowValuationData";
import { fetchMainlineScan, pickActionableMainline } from "../services/mainlineData";
import type {
  AccountProfile,
  CalendarDay,
  AssetBucket,
  DailyReturnItem,
  DashboardHoldingRow,
  ExecutionLog,
  HoldingItem,
  HoldingQuote,
  HoldingQuoteResponse,
  LowValuationScanResponse,
  MainlineScanResponse,
  MarketHeatLevel,
  MarketState,
  Notice,
  NoticeKind,
} from "../types";
import { money, safeNumber, signedPercent } from "../utils/format";

type HoldingBucket = Exclude<AssetBucket, "reserve">;

const bucketOptions: HoldingBucket[] = ["chinaCore", "globalCore", "defensive", "satellite"];
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

const accounts = useAccountsStore();
const strategies = useStrategiesStore();
const activeAccountId = usePersistentString("licai.activeAccountId", "account-default");
const selectedMonth = usePersistentString("licai.dashboard.selectedMonth", currentMonthKey());

const scan = ref<MainlineScanResponse | null>(null);
const lowValuationScan = ref<LowValuationScanResponse | null>(null);
const quoteScan = ref<HoldingQuoteResponse | null>(null);
const quoteLoading = ref(false);
const entryAmounts = reactive<Record<string, number>>({});
const notices = ref<Notice[]>([]);

const activeAccount = computed(() => accounts.value.find((account) => account.id === activeAccountId.value) ?? accounts.value[0]);
const activeStrategy = computed(() => {
  const strategyId = activeAccount.value?.strategyId;
  return strategies.value.find((strategy) => strategy.id === strategyId) ?? strategies.value[0];
});
const monthlyAmount = computed(() => activeStrategy.value?.monthlyAmount ?? 0);
const style = computed(() => activeStrategy.value?.style ?? "balanced");
const volatility = computed(() => activeStrategy.value?.volatility ?? "medium");
const holdings = computed({
  get: () => activeAccount.value?.holdings ?? [],
  set: (value: HoldingItem[]) => {
    if (activeAccount.value) activeAccount.value.holdings = value;
  },
});
const executionLogs = computed({
  get: () => activeAccount.value?.executionLogs ?? [],
  set: (value: ExecutionLog[]) => {
    if (activeAccount.value) activeAccount.value.executionLogs = value;
  },
});
const dailyReturns = computed({
  get: () => activeAccount.value?.dailyReturns ?? [],
  set: (value: DailyReturnItem[]) => {
    if (activeAccount.value) activeAccount.value.dailyReturns = value;
  },
});

const topMainline = computed(() => pickActionableMainline(scan.value?.results ?? []));
const satelliteDeployment = computed(() => getSatelliteDeployment(topMainline.value));
const marketRecommendation = computed(() => buildMarketRecommendation(scan.value, lowValuationScan.value));
const satelliteMultiplier = computed(() => {
  if (!activeStrategy.value?.allowSatellite) return 0;
  return Math.min(satelliteDeployment.value.multiplier, marketRecommendation.value.satelliteThrottle);
});
const states = computed<Record<HoldingBucket, MarketState>>(() => ({
  chinaCore: "fair",
  globalCore: "fair",
  defensive: "fair",
  satellite: satelliteMultiplier.value <= 0 ? "overheated" : satelliteDeployment.value.state,
}));

const plan = computed(() =>
  generateMonthlyPlan({
    monthlyAmount: monthlyAmount.value,
    style: style.value,
    volatility: volatility.value,
    states: states.value,
    template: activeStrategy.value?.allocation,
    overrides: {
      satellite: {
        multiplier: satelliteMultiplier.value,
        reason: activeStrategy.value?.allowSatellite
          ? `${satelliteDeployment.value.reason} 市场热度约束：${marketRecommendation.value.action}`
          : "当前策略不允许卫星仓新增，主题机会只观察不执行。",
      },
    },
  }),
);

const divisor = computed(() => {
  if (plan.value.executionFrequency === "daily") return 20;
  if (plan.value.executionFrequency === "weekly") return 4;
  if (plan.value.executionFrequency === "biweekly") return 2;
  return 1;
});

const frequencyLabel = computed(() => `${getFrequencyLabel(plan.value.executionFrequency)} · 本次按 ${divisor.value} 份拆分`);

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const todayKey = computed(() => localDateKey(new Date()));
const weekStartKey = computed(() => localDateKey(getWeekStart(new Date())));
const weekEndKey = computed(() => localDateKey(addDays(getWeekStart(new Date()), 6)));
const weekLabel = computed(() => `${weekStartKey.value} 至 ${weekEndKey.value}`);

const weeklyLogs = computed(() =>
  executionLogs.value.filter((log) => log.executedAt >= weekStartKey.value && log.executedAt <= weekEndKey.value),
);

const weeklyExecutedByCode = computed(() => {
  const map = new Map<string, number>();
  for (const log of weeklyLogs.value) {
    map.set(log.code, (map.get(log.code) ?? 0) + safeNumber(log.amount));
  }
  return map;
});

const quoteMap = computed(() => new Map((quoteScan.value?.quotes ?? []).map((quote) => [quote.code, quote])));
const quoteMode = computed(() => quoteScan.value?.mode ?? "fallback");
const quoteBadgeLabel = computed(() => {
  if (quoteLoading.value) return "行情刷新中";
  if (!quoteScan.value) return "行情未刷新";
  if (quoteScan.value.mode === "live") return "东方财富行情";
  return "手动涨跌";
});
const heatLabelMap: Record<MarketHeatLevel, string> = {
  cold: "低热度",
  normal: "正常",
  warm: "偏暖",
  hot: "偏热",
  overheated: "过热",
};
const heatLabel = computed(() => heatLabelMap[marketRecommendation.value.heatLevel]);
const heatKind = computed(() => {
  if (marketRecommendation.value.heatLevel === "hot" || marketRecommendation.value.heatLevel === "overheated") return "warn";
  if (marketRecommendation.value.heatLevel === "cold") return "good";
  return "neutral";
});

function normalizeBucket(value: unknown): HoldingBucket {
  return bucketOptions.includes(value as HoldingBucket) ? (value as HoldingBucket) : "chinaCore";
}

function roundTradeAmount(value: unknown) {
  const number = safeNumber(value);
  if (number < 50) return 0;
  return Math.round(number / 100) * 100;
}

function lineActionLabel(actualBuy: number, targetAmount: number) {
  if (targetAmount <= 0) return "无目标";
  if (actualBuy <= 0) return "暂不进入";
  if (actualBuy < targetAmount) return "降速执行";
  return "正常执行";
}

function lineActionKind(actualBuy: number, targetAmount: number) {
  if (targetAmount <= 0) return "neutral";
  if (actualBuy <= 0) return "danger";
  if (actualBuy < targetAmount) return "warn";
  return "good";
}

const holdingRows = computed<DashboardHoldingRow[]>(() => {
  const lineMap = new Map(plan.value.lines.map((line) => [line.key, line]));

  return holdings.value.map((holding) => {
    const bucket = normalizeBucket(holding.bucket);
    const line = lineMap.get(bucket);
    const peers = holdings.value.filter((item) => normalizeBucket(item.bucket) === bucket);
    const totalShare = peers.reduce((sum, item) => sum + Math.max(0, safeNumber(item.bucketShare, 1)), 0) || peers.length || 1;
    const share = Math.max(0, safeNumber(holding.bucketShare, 1)) / totalShare;
    const rawRecommended = ((line?.actualBuy ?? 0) / divisor.value) * share;
    const recommendedAmount = roundTradeAmount(rawRecommended);
    const executedAmount = safeNumber(weeklyExecutedByCode.value.get(holding.code));
    const quote = quoteMap.value.get(holding.code) as HoldingQuote | undefined;
    const todayReturnPct = safeNumber(quote?.changePct ?? holding.todayReturnPct);
    const marketValue = safeNumber(holding.marketValue);
    const costAmount = safeNumber(holding.costAmount);
    const profit = marketValue - costAmount;
    const returnPct = costAmount > 0 ? (profit / costAmount) * 100 : 0;
    const completed = recommendedAmount <= 0 || executedAmount >= recommendedAmount;

    return {
      ...holding,
      bucket,
      costAmount,
      marketValue,
      recommendedAmount,
      executedAmount,
      completed,
      profit,
      profitPct: returnPct,
      returnPct,
      todayReturnPct,
      quoteLabel: quote ? `${quote.source} · ${quote.price}` : "手动值",
      reason: line?.reason ?? "当前没有对应资产桶计划。",
      badgeLabel: completed ? "已完成" : recommendedAmount > 0 ? "待加仓" : "观察",
    };
  });
});

watch(
  holdingRows,
  (rows) => {
    for (const row of rows) {
      if (entryAmounts[row.id] == null) {
        entryAmounts[row.id] = row.recommendedAmount;
      }
    }
  },
  { immediate: true },
);

const totalRecommended = computed(() => holdingRows.value.reduce((sum, row) => sum + row.recommendedAmount, 0));
const thisWeekExecuted = computed(() => weeklyLogs.value.reduce((sum, log) => sum + safeNumber(log.amount), 0));
const pendingAmount = computed(() => Math.max(0, totalRecommended.value - thisWeekExecuted.value));
const executionStateLabel = computed(() => (pendingAmount.value > 0 ? "本周待执行" : "本周完成"));
const totalCost = computed(() => holdings.value.reduce((sum, item) => sum + safeNumber(item.costAmount), 0));
const totalMarketValue = computed(() => holdings.value.reduce((sum, item) => sum + safeNumber(item.marketValue), 0));
const portfolioProfit = computed(() => totalMarketValue.value - totalCost.value);
const portfolioReturnPct = computed(() => (totalCost.value > 0 ? (portfolioProfit.value / totalCost.value) * 100 : 0));

function notify(kind: NoticeKind, title: string, message: string) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  notices.value = [{ id, kind, title, message }, ...notices.value].slice(0, 4);

  window.setTimeout(() => {
    dismissNotice(id);
  }, 4500);
}

function dismissNotice(id: string) {
  notices.value = notices.value.filter((notice) => notice.id !== id);
}

function navigateToAccounts() {
  window.dispatchEvent(new CustomEvent("licai:navigate", { detail: "accounts" }));
}

function updateHoldingAmount(code: string, amount: number) {
  const target = holdings.value.find((holding) => holding.code === code);
  if (!target) return;
  target.costAmount = Math.max(0, safeNumber(target.costAmount) + amount);
  target.marketValue = Math.max(0, safeNumber(target.marketValue) + amount);
}

function submitExecution(row: (typeof holdingRows.value)[number]) {
  const amount = Number(entryAmounts[row.id] ?? row.recommendedAmount);
  if (!Number.isFinite(amount) || amount <= 0) {
    notify("warn", "记录未提交", `${row.code} 的实际加仓金额需要大于 0。`);
    return;
  }

  executionLogs.value.unshift({
    id: `${Date.now()}-${row.id}`,
    code: row.code,
    name: row.name,
    amount,
    executedAt: todayKey.value,
    note: "首页清单提交",
  });
  updateHoldingAmount(row.code, amount);
  entryAmounts[row.id] = row.recommendedAmount;

  const afterExecuted = row.executedAmount + amount;
  if (row.recommendedAmount > 0 && afterExecuted > row.recommendedAmount) {
    notify(
      "warn",
      "已记录，超过本次建议",
      `${row.code} 已记录 ${money(amount)}，本周累计 ${money(afterExecuted)}，高于建议 ${money(row.recommendedAmount)}。`,
    );
    return;
  }

  if (row.recommendedAmount === 0) {
    notify("warn", "已记录观察项", `${row.code} 当前系统建议为 0，已按你的手动金额记录 ${money(amount)}。`);
    return;
  }

  notify("success", "记录完成", `${row.code} 已记录加仓 ${money(amount)}，持仓成本和本周完成状态已更新。`);
}

function deleteExecution(id: string) {
  const target = executionLogs.value.find((log) => log.id === id);
  if (!target) {
    notify("danger", "撤销失败", "没有找到这条执行记录，可能已经被删除。");
    return;
  }

  executionLogs.value = executionLogs.value.filter((log) => log.id !== id);
  updateHoldingAmount(target.code, -target.amount);
  notify("success", "已撤销记录", `${target.code} 的 ${money(target.amount)} 已从本周记录和持仓成本中扣回。`);
}

function clearLocalData() {
  holdings.value = [];
  executionLogs.value = [];
  dailyReturns.value = [];
  if (activeAccount.value) activeAccount.value.cashReserve = 0;
  selectedMonth.value = currentMonthKey();
  quoteScan.value = null;

  for (const key of Object.keys(entryAmounts)) {
    delete entryAmounts[key];
  }

  notify("success", "已清空当前账户", "当前账户的持仓、执行记录和收益日历已清空；策略配置仍保留在策略中心。");
}

function restoreDemoData() {
  holdings.value = defaultHoldings.map((holding) => ({ ...holding, id: `${holding.id}-${activeAccount.value?.id ?? "demo"}` }));
  executionLogs.value = [];
  dailyReturns.value = createDefaultDailyReturns();
  selectedMonth.value = currentMonthKey();
  quoteScan.value = null;

  for (const key of Object.keys(entryAmounts)) {
    delete entryAmounts[key];
  }

  notify("success", "示例已载入", "已恢复演示持仓和收益日历，执行记录保持为空。");
  void loadQuotes(true);
}

async function loadQuotes(silent = false) {
  quoteLoading.value = true;
  try {
    quoteScan.value = await fetchHoldingQuotes(holdings.value.map((holding) => holding.code));
    if (!silent) {
      if (quoteScan.value.mode === "live") {
        notify("success", "行情已刷新", quoteScan.value.message);
      } else {
        notify("warn", "使用手动涨跌", quoteScan.value.message);
      }
    }
  } catch (error) {
    quoteScan.value = {
      mode: "fallback",
      source: "本地持仓",
      updatedAt: new Date().toISOString(),
      message: `行情刷新失败，继续使用手动涨跌。原因：${error instanceof Error ? error.message : "未知错误"}`,
      quotes: [],
    };
    if (!silent) {
      notify("danger", "行情刷新失败", quoteScan.value.message);
    }
  } finally {
    quoteLoading.value = false;
  }
}

function parseMonth(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return { year, month: month - 1 };
}

function moveMonth(offset: number) {
  const { year, month } = parseMonth(selectedMonth.value);
  const next = new Date(year, month + offset, 1);
  selectedMonth.value = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
}

const monthlyReturnItems = computed(() => dailyReturns.value.filter((item) => item.date.startsWith(selectedMonth.value)));
const dailyReturnMap = computed(() => new Map(monthlyReturnItems.value.map((item) => [item.date, item])));
const monthProfit = computed(() => monthlyReturnItems.value.reduce((sum, item) => sum + safeNumber(item.profit), 0));
const returnDays = computed(() => monthlyReturnItems.value.length);
const positiveDays = computed(() => monthlyReturnItems.value.filter((item) => safeNumber(item.profit) > 0).length);
const maxLoss = computed(() => Math.min(0, ...monthlyReturnItems.value.map((item) => safeNumber(item.profit))));
const monthEndValue = computed(() => {
  const items = monthlyReturnItems.value;
  return items.length ? safeNumber(items[items.length - 1].marketValue) : totalMarketValue.value;
});

const calendarOffset = computed(() => {
  const { year, month } = parseMonth(selectedMonth.value);
  const firstDay = new Date(year, month, 1).getDay();
  return (firstDay + 6) % 7;
});

const calendarDays = computed<CalendarDay[]>(() => {
  const { year, month } = parseMonth(selectedMonth.value);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  return Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return {
      day,
      date,
      item: dailyReturnMap.value.get(date),
    };
  });
});

onMounted(async () => {
  await Promise.all([
    fetchMainlineScan().then((payload) => (scan.value = payload)),
    fetchLowValuationScan().then((payload) => (lowValuationScan.value = payload)),
    loadQuotes(true),
  ]);
});
</script>
