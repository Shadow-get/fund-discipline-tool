<template>
  <main class="page-stack">
    <section class="strategy-hero">
      <div>
        <span class="eyebrow">账户中心</span>
        <h2>账户承载数据，策略驱动建议</h2>
        <p>一个账户绑定一个主要策略。首页的加仓金额、暂停条件、卫星仓比例和收益记录都会跟随当前账户变化。</p>
      </div>
      <div class="strategy-active-card">
        <span class="eyebrow">当前账户</span>
        <h3>{{ activeAccount?.name ?? "未选择账户" }}</h3>
        <p>{{ activeStrategy?.name ?? "未绑定策略" }}</p>
        <div class="compact-list">
          <span>{{ activeAccount?.holdings.length ?? 0 }} 个标的</span>
          <span>资产 {{ money(activeAccount ? accountAsset(activeAccount) : 0) }}</span>
          <span>收益 {{ signedMoney(activeAccount ? accountProfit(activeAccount) : 0) }}</span>
        </div>
        <button type="button" class="primary-button" @click="openCreateDialog">新建账户</button>
      </div>
    </section>

    <NoticeStack :notices="notices" @dismiss="dismissNotice" />

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">我的账户</span>
          <h2>账户列表</h2>
        </div>
        <span class="data-note">账户只在“编辑账户”里修改持仓和绑定策略；策略中心负责模板，账户中心负责真实组合。</span>
      </div>

      <div class="account-list">
        <article v-for="account in accounts" :key="account.id" class="account-card" :class="{ active: account.id === activeAccountId }">
          <header>
            <div>
              <span class="eyebrow">{{ account.id === activeAccountId ? "当前账户" : "账户" }}</span>
              <h3>{{ account.name }}</h3>
            </div>
            <div class="account-card-actions">
              <RiskBadge :label="account.id === activeAccountId ? '当前组合' : '可切换'" :kind="account.id === activeAccountId ? 'good' : 'neutral'" />
              <button type="button" class="ghost-button" @click="openEditDialog(account)">编辑</button>
            </div>
          </header>

          <div class="account-strategy-line">
            <span>当前策略</span>
            <strong>{{ strategyName(account.strategyId) }}</strong>
            <small>{{ strategySummary(account.strategyId) }}</small>
          </div>

          <div class="account-insight-grid">
            <article class="account-insight">
              <span>账户资产</span>
              <strong>{{ money(accountAsset(account)) }}</strong>
              <small>持仓 {{ account.holdings.length }} 个 · 现金池 {{ money(account.cashReserve) }}</small>
            </article>
            <article class="account-insight" :class="profitTone(accountProfit(account))">
              <span>持仓收益</span>
              <strong>{{ signedMoney(accountProfit(account)) }}</strong>
              <small>{{ signedPercent(accountReturnPct(account)) }} · 成本 {{ money(accountCost(account)) }}</small>
            </article>
            <article class="account-insight" :class="profitTone(accountMonthProfit(account))">
              <span>本月收益</span>
              <strong>{{ signedMoney(accountMonthProfit(account)) }}</strong>
              <small>收益日历 {{ account.dailyReturns.length }} 天数据</small>
            </article>
            <button type="button" class="account-insight account-link-metric" @click="openDashboardCalendar(account)">
              <span>执行记录</span>
              <strong>{{ account.executionLogs.length }}</strong>
              <small>{{ latestExecutionLabel(account) }} · 点击查看日历</small>
            </button>
          </div>

          <div class="compact-list">
            <span>持仓市值 {{ money(accountHoldingValue(account)) }}</span>
            <span>累计执行 {{ money(accountExecutionAmount(account)) }}</span>
            <span>创建 {{ formatDate(account.createdAt) }}</span>
          </div>

          <div class="strategy-actions">
            <button type="button" class="ghost-button" @click="setActiveAccount(account)">设为当前账户</button>
            <button type="button" class="ghost-button danger" :disabled="accounts.length <= 1" @click="removeAccount(account.id)">删除</button>
          </div>
        </article>
      </div>
    </section>

    <ReturnCalendar
      id="account-return-calendar"
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

    <ExecutionLogList
      :logs="activeExecutionLogs"
      title="账户执行记录"
      description="记录来自当前账户，会影响持仓成本、收益统计和后续复盘。"
      @delete="deleteExecution"
    />

    <AppDialog
      :open="editDialogOpen"
      eyebrow="编辑账户"
      :title="editDraft ? editDraft.name : '编辑账户'"
      description="修改账户名称、绑定策略、现金池和持仓成本。保存后会影响首页的推荐金额、收益和执行清单。"
      @close="closeEditDialog"
    >
      <div v-if="editDraft" class="account-dialog-stack">
        <div class="account-create-grid">
          <label>
            账户名称
            <input v-model="editDraft.name" />
          </label>
          <label>
            绑定策略
            <select v-model="editDraft.strategyId">
              <option v-for="strategy in strategies" :key="strategy.id" :value="strategy.id">{{ strategy.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="selectedEditStrategy" class="account-create-summary">
          <div>
            <span class="eyebrow">策略影响</span>
            <h3>{{ selectedEditStrategy.name }}</h3>
            <p>{{ selectedEditStrategy.recommendationReason }}</p>
          </div>
          <div class="compact-list">
            <span>月投入 {{ money(selectedEditStrategy.monthlyAmount) }}</span>
            <span>卫星上限 {{ selectedEditStrategy.satelliteCapPct }}%</span>
            <span>最大回撤 {{ selectedEditStrategy.maxDrawdownPct }}%</span>
          </div>
          <p class="data-note">切换策略只影响后续首页建议，不会自动改写历史执行记录和已录入成本。</p>
        </div>

        <label class="cash-input-card">
          现金池
          <input v-model.number="editDraft.cashReserve" type="number" min="0" step="100" />
          <small>现金池会计入账户总资产，但不会进入持仓收益率计算。</small>
        </label>

        <HoldingsEditor
          :holdings="editDraft.holdings"
          :bucket-options="bucketOptions"
          :bucket-labels="bucketLabels"
          @add="addDraftHolding"
          @remove="removeDraftHolding"
        />
      </div>

      <template #footer>
        <button type="button" class="ghost-button" @click="closeEditDialog">取消</button>
        <button type="button" class="primary-button" :disabled="!editDraft" @click="saveAccountEdit">保存账户</button>
      </template>
    </AppDialog>

    <AppDialog
      :open="createDialogOpen"
      eyebrow="新建账户"
      title="按策略创建账户"
      description="先选择账户名称和绑定策略，系统会把推荐标的、代码和执行提示一起放入新账户。"
      @close="closeCreateDialog"
    >
      <div class="account-dialog-stack">
        <div class="account-create-grid">
          <label>
            账户名称
            <input v-model="newAccountName" />
          </label>
          <label>
            绑定策略
            <select v-model="newStrategyId">
              <option v-for="strategy in strategies" :key="strategy.id" :value="strategy.id">{{ strategy.name }}</option>
            </select>
          </label>
        </div>

        <div v-if="selectedStrategy" class="account-create-summary">
          <div>
            <span class="eyebrow">策略摘要</span>
            <h3>{{ selectedStrategy.name }}</h3>
            <p>{{ selectedStrategy.recommendationReason }}</p>
          </div>
          <div class="compact-list">
            <span>月投入 {{ money(selectedStrategy.monthlyAmount) }}</span>
            <span>卫星上限 {{ selectedStrategy.satelliteCapPct }}%</span>
            <span>最大回撤 {{ selectedStrategy.maxDrawdownPct }}%</span>
          </div>
        </div>

        <div class="market-signal-panel" :class="marketRecommendation.heatLevel">
          <div>
            <span class="eyebrow">实时市场风控</span>
            <h3>{{ marketLoading ? "正在读取市场数据" : marketRecommendation.title }}</h3>
            <p>{{ marketRecommendation.action }}</p>
            <small>{{ marketSourceLabel }}</small>
          </div>
          <div class="market-signal-actions">
            <RiskBadge :label="marketLoading ? '读取中' : heatLabel" :kind="heatKind" />
            <button type="button" class="ghost-button" :disabled="marketLoading" @click="loadMarketSignals">
              {{ marketLoading ? "刷新中..." : "刷新数据" }}
            </button>
          </div>
          <div class="market-indicator-mini-grid">
            <article v-for="indicator in marketRecommendation.indicators" :key="indicator.key">
              <span>{{ indicator.label }}</span>
              <strong>{{ indicator.value }}{{ indicator.unit }}</strong>
            </article>
          </div>
          <p v-if="marketError" class="data-warning">{{ marketError }}</p>
        </div>

        <div>
          <div class="section-heading compact">
            <div>
              <span class="eyebrow">系统推荐标的</span>
              <h3>创建后会出现在账户列表和首页执行清单</h3>
            </div>
            <span class="data-note">仓位只是策略目标比例，真实金额由你后续录入和提交。</span>
          </div>

          <div v-if="targetRecommendations.length" class="target-recommendation-grid">
            <article v-for="target in targetRecommendations" :key="target.id" class="target-recommendation-card">
              <header>
                <div>
                  <span class="code-pill">{{ target.code }}</span>
                  <h3>{{ target.name }}</h3>
                  <small>{{ bucketLabels[target.bucket] }}</small>
                </div>
                <div class="target-action-stack">
                  <RiskBadge :label="target.realtimeLabel" :kind="target.realtimeKind" />
                  <strong>{{ target.allocationPct }}%</strong>
                </div>
              </header>
              <p>{{ target.role }}</p>
              <div class="target-meta">
                <span>{{ target.realtimeHint }}</span>
                <span>{{ target.tradeHint }}</span>
                <span>{{ target.riskNote }}</span>
              </div>
            </article>
          </div>
          <p v-else class="empty-note">当前策略没有可载入的推荐标的，可以先创建空账户后手动添加。</p>
        </div>
      </div>

      <template #footer>
        <button type="button" class="ghost-button" @click="closeCreateDialog">取消</button>
        <button type="button" class="ghost-button" @click="createAccount('empty')">只创建空账户</button>
        <button type="button" class="primary-button" :disabled="!selectedStrategy" @click="createAccount('recommended')">
          创建并载入推荐标的
        </button>
      </template>
    </AppDialog>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import AppDialog from "../components/AppDialog.vue";
import ExecutionLogList from "../components/dashboard/ExecutionLogList.vue";
import HoldingsEditor from "../components/dashboard/HoldingsEditor.vue";
import NoticeStack from "../components/dashboard/NoticeStack.vue";
import ReturnCalendar from "../components/dashboard/ReturnCalendar.vue";
import RiskBadge from "../components/RiskBadge.vue";
import { usePersistentString } from "../composables/usePersistentRef";
import { useAccountsStore, useStrategiesStore } from "../composables/useWorkspaceStore";
import { currentMonthKey } from "../data/dashboardWorkspace";
import { bucketLabels } from "../data/strategyTemplates";
import {
  buildMarketRecommendation,
  createInitialHoldingsFromStrategy,
  getStrategyTargetRecommendations,
} from "../data/strategyWorkspace";
import { fetchLowValuationScan } from "../services/lowValuationData";
import { fetchMainlineScan, getMainlineStatusKind } from "../services/mainlineData";
import type {
  AccountProfile,
  AssetBucket,
  CalendarDay,
  DailyReturnItem,
  ExecutionLog,
  HoldingItem,
  LowValuationScanItem,
  LowValuationScanResponse,
  MainlineScanItem,
  MainlineScanResponse,
  MarketHeatLevel,
  Notice,
  NoticeKind,
  StrategyTargetRecommendation,
} from "../types";
import { money, safeNumber, signedPercent } from "../utils/format";

type BadgeKind = "neutral" | "good" | "warn" | "danger";
type HoldingBucket = Exclude<AssetBucket, "reserve">;
type TargetWithSignal = StrategyTargetRecommendation & {
  realtimeLabel: string;
  realtimeKind: BadgeKind;
  realtimeHint: string;
};

const bucketOptions: HoldingBucket[] = ["chinaCore", "globalCore", "defensive", "satellite"];
const weekdays = ["一", "二", "三", "四", "五", "六", "日"];
const accounts = useAccountsStore();
const strategies = useStrategiesStore();
const activeAccountId = usePersistentString<string>("licai.activeAccountId", "account-default");
const activeStrategyId = usePersistentString<string>("licai.activeStrategyId", "strategy-balanced-core");
const selectedMonth = usePersistentString<string>("licai.accountCenter.selectedMonth", currentMonthKey());

const createDialogOpen = ref(false);
const editDialogOpen = ref(false);
const editDraft = ref<AccountProfile | null>(null);
const notices = ref<Notice[]>([]);
const newAccountName = ref("新账户");
const newStrategyId = ref(activeStrategyId.value);
const marketLoading = ref(false);
const marketError = ref("");
const mainlineScan = ref<MainlineScanResponse | null>(null);
const lowValuationScan = ref<LowValuationScanResponse | null>(null);

const activeAccount = computed(() => accounts.value.find((account) => account.id === activeAccountId.value) ?? accounts.value[0]);
const activeStrategy = computed(() => strategies.value.find((strategy) => strategy.id === activeAccount.value?.strategyId) ?? strategies.value[0]);
const activeExecutionLogs = computed(() => activeAccount.value?.executionLogs ?? []);
const activeDailyReturns = computed(() => activeAccount.value?.dailyReturns ?? []);
const selectedStrategy = computed(() => strategies.value.find((strategy) => strategy.id === newStrategyId.value) ?? strategies.value[0]);
const selectedEditStrategy = computed(() => strategies.value.find((strategy) => strategy.id === editDraft.value?.strategyId) ?? null);
const marketRecommendation = computed(() => buildMarketRecommendation(mainlineScan.value, lowValuationScan.value));
const targetRecommendations = computed<TargetWithSignal[]>(() =>
  selectedStrategy.value
    ? getStrategyTargetRecommendations(selectedStrategy.value).map((target) => enrichTargetWithSignal(target))
    : [],
);

const heatLabelMap: Record<MarketHeatLevel, string> = {
  cold: "低热度",
  normal: "正常",
  warm: "偏暖",
  hot: "偏热",
  overheated: "过热",
};
const heatLabel = computed(() => heatLabelMap[marketRecommendation.value.heatLevel]);
const heatKind = computed<BadgeKind>(() => {
  if (marketRecommendation.value.heatLevel === "hot" || marketRecommendation.value.heatLevel === "overheated") return "warn";
  if (marketRecommendation.value.heatLevel === "cold") return "good";
  return "neutral";
});
const marketSourceLabel = computed(() => {
  if (marketLoading.value) return "正在读取主线热度、估值拥挤和低估值机会。";
  if (!mainlineScan.value && !lowValuationScan.value) return "尚未读取市场数据，打开弹窗后会自动刷新。";
  const mainlineLabel = mainlineScan.value
    ? `主线：${modeLabel(mainlineScan.value.mode)} · ${mainlineScan.value.source} · ${formatDateTime(mainlineScan.value.updatedAt)}`
    : "主线：未读取";
  const lowValueLabel = lowValuationScan.value
    ? `低估值：${modeLabel(lowValuationScan.value.mode)} · ${lowValuationScan.value.source} · ${formatDateTime(lowValuationScan.value.updatedAt)}`
    : "低估值：未读取";
  return `${mainlineLabel}；${lowValueLabel}`;
});

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

function strategyName(strategyId: string) {
  return strategies.value.find((strategy) => strategy.id === strategyId)?.name ?? "未绑定策略";
}

function strategySummary(strategyId: string) {
  const strategy = strategies.value.find((item) => item.id === strategyId);
  if (!strategy) return "请先在编辑账户里绑定策略。";
  return `月投入 ${money(strategy.monthlyAmount)} · 卫星上限 ${strategy.satelliteCapPct}% · 回撤线 ${strategy.maxDrawdownPct}%`;
}

function accountHoldingValue(account: AccountProfile) {
  return account.holdings.reduce((sum, holding) => sum + safeNumber(holding.marketValue), 0);
}

function accountAsset(account: AccountProfile) {
  return accountHoldingValue(account) + safeNumber(account.cashReserve);
}

function accountCost(account: AccountProfile) {
  return account.holdings.reduce((sum, holding) => sum + safeNumber(holding.costAmount), 0);
}

function accountProfit(account: AccountProfile) {
  return accountHoldingValue(account) - accountCost(account);
}

function accountReturnPct(account: AccountProfile) {
  const cost = accountCost(account);
  return cost > 0 ? (accountProfit(account) / cost) * 100 : 0;
}

function accountMonthProfit(account: AccountProfile) {
  const month = currentMonthKey();
  return account.dailyReturns
    .filter((item) => item.date.startsWith(month))
    .reduce((sum, item) => sum + safeNumber(item.profit), 0);
}

function accountExecutionAmount(account: AccountProfile) {
  return account.executionLogs.reduce((sum, log) => sum + safeNumber(log.amount), 0);
}

function latestExecutionLabel(account: AccountProfile) {
  const latest = [...account.executionLogs].sort((a, b) => b.executedAt.localeCompare(a.executedAt))[0];
  return latest ? `${latest.executedAt} 最近 ${money(latest.amount)}` : "暂无提交";
}

function signedMoney(value: unknown) {
  const number = safeNumber(value);
  if (number > 0) return `+${money(number)}`;
  if (number < 0) return `-${money(Math.abs(number))}`;
  return money(0);
}

function profitTone(value: unknown): BadgeKind {
  const number = safeNumber(value);
  if (number > 0) return "good";
  if (number < 0) return "warn";
  return "neutral";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" });
}

function cloneAccount(account: AccountProfile): AccountProfile {
  return {
    ...account,
    holdings: account.holdings.map((holding) => ({ ...holding })),
    executionLogs: account.executionLogs.map((log) => ({ ...log })),
    dailyReturns: account.dailyReturns.map((item) => ({ ...item })),
  };
}

function openEditDialog(account: AccountProfile) {
  editDraft.value = cloneAccount(account);
  editDialogOpen.value = true;
}

function closeEditDialog() {
  editDialogOpen.value = false;
  editDraft.value = null;
}

function saveAccountEdit() {
  if (!editDraft.value) return;
  const index = accounts.value.findIndex((account) => account.id === editDraft.value?.id);
  if (index < 0) return;

  const nextAccount = cloneAccount(editDraft.value);
  accounts.value[index] = nextAccount;
  if (nextAccount.id === activeAccountId.value && nextAccount.strategyId) {
    activeStrategyId.value = nextAccount.strategyId;
  }

  closeEditDialog();
  notify("success", "账户已保存", `${nextAccount.name} 的策略、现金池和持仓数据已更新。`);
}

function addDraftHolding() {
  if (!editDraft.value) return;
  const nextHolding: HoldingItem = {
    id: `holding-${Date.now()}`,
    code: "000000",
    name: "新持仓",
    bucket: "chinaCore",
    costAmount: 0,
    marketValue: 0,
    todayReturnPct: 0,
    bucketShare: 1,
  };
  editDraft.value.holdings.push(nextHolding);
}

function removeDraftHolding(id: string) {
  if (!editDraft.value) return;
  editDraft.value.holdings = editDraft.value.holdings.filter((holding) => holding.id !== id);
}

function openDashboardCalendar(account: AccountProfile) {
  activeAccountId.value = account.id;
  if (account.strategyId) activeStrategyId.value = account.strategyId;
  window.requestAnimationFrame(() => {
    document.getElementById("account-return-calendar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function setActiveAccount(account: AccountProfile) {
  activeAccountId.value = account.id;
  if (account.strategyId) activeStrategyId.value = account.strategyId;
  notify("success", "已切换当前账户", `首页会按 ${account.name} 的持仓、策略和执行记录重新计算。`);
}

function modeLabel(mode: string) {
  const map: Record<string, string> = {
    live: "实时行情",
    cache: "最近缓存",
    fallback: "内置快照",
    model: "估值模型",
    error: "读取异常",
  };
  return map[mode] ?? mode;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function findMainlineForTarget(target: StrategyTargetRecommendation): MainlineScanItem | undefined {
  return mainlineScan.value?.results.find(
    (item) => item.representativeEtfs.includes(target.code) || item.name.includes(target.name.replace("ETF", "")),
  );
}

function findLowValuationForTarget(target: StrategyTargetRecommendation): LowValuationScanItem | undefined {
  return lowValuationScan.value?.results.find(
    (item) =>
      item.representativeEtfs.includes(target.code) ||
      target.name.includes(item.name) ||
      (target.name.includes("红利") && item.name.includes("红利")),
  );
}

function enrichTargetWithSignal(target: StrategyTargetRecommendation): TargetWithSignal {
  const mainline = findMainlineForTarget(target);
  const lowValue = findLowValuationForTarget(target);
  const heatLevel = marketRecommendation.value.heatLevel;
  const satelliteThrottle = marketRecommendation.value.satelliteThrottle;
  let realtimeLabel = "正常配置";
  let realtimeKind: BadgeKind = "neutral";
  let realtimeHint = "当前没有极端风控信号，按绑定策略的长期比例进入账户。";

  if (target.bucket === "satellite") {
    if (!selectedStrategy.value?.allowSatellite || satelliteThrottle <= 0) {
      return {
        ...target,
        realtimeLabel: "暂停新增",
        realtimeKind: "danger",
        realtimeHint: "当前策略或市场热度不支持主题仓新增；推荐比例不变，但创建后只作为观察提示。",
      };
    }

    if (mainline && getMainlineStatusKind(mainline) === "overheated") {
      realtimeLabel = "过热等待";
      realtimeKind = "warn";
      realtimeHint = `${mainline.name} 当前为${mainline.status}，系统建议：${mainline.action}`;
    } else if (satelliteThrottle <= 0.3) {
      realtimeLabel = "降速观察";
      realtimeKind = "warn";
      realtimeHint = "市场热度偏高，卫星仓只保留小比例验证，不作为本周主要买入方向。";
    } else if (mainline) {
      realtimeLabel = "主线候选";
      realtimeKind = "good";
      realtimeHint = `${mainline.name} 处于${mainline.stage}，系统建议：${mainline.action}`;
    }
  } else if (target.bucket === "defensive") {
    if (heatLevel === "hot" || heatLevel === "overheated") {
      realtimeLabel = "防守优先";
      realtimeKind = "good";
      realtimeHint = "市场热度偏高，防守仓承担降低组合波动和等待再平衡资金的角色。";
    } else if (lowValue) {
      realtimeLabel = lowValue.status;
      realtimeKind = lowValue.statusKey === "trap" ? "warn" : "good";
      realtimeHint = `${lowValue.name}：${lowValue.action}`;
    }
  } else {
    if (heatLevel === "hot" || heatLevel === "overheated") {
      realtimeLabel = "低速定投";
      realtimeKind = "warn";
      realtimeHint = "市场整体偏热，核心宽基保留定投但降低一次性买入冲动。";
    } else if (lowValue && lowValue.statusKey !== "trap") {
      realtimeLabel = lowValue.status;
      realtimeKind = lowValue.statusKey === "top" ? "good" : "warn";
      realtimeHint = `${lowValue.name}：${lowValue.reason}`;
    } else if (heatLevel === "cold") {
      realtimeLabel = "可增强";
      realtimeKind = "good";
      realtimeHint = "市场热度较低，若用户现金流稳定，可按策略提高核心仓执行纪律。";
    }
  }

  return {
    ...target,
    realtimeLabel,
    realtimeKind,
    realtimeHint,
  };
}

async function loadMarketSignals() {
  marketLoading.value = true;
  marketError.value = "";

  try {
    const [mainlinePayload, lowValuationPayload] = await Promise.all([fetchMainlineScan(), fetchLowValuationScan()]);
    mainlineScan.value = mainlinePayload;
    lowValuationScan.value = lowValuationPayload;
    if (mainlinePayload.mode !== "live") {
      marketError.value = mainlinePayload.message;
    }
  } catch (error) {
    marketError.value = `市场数据读取失败，先按本地策略模板展示。原因：${error instanceof Error ? error.message : "未知错误"}`;
  } finally {
    marketLoading.value = false;
  }
}

function resetCreateForm() {
  newAccountName.value = `账户 ${accounts.value.length + 1}`;
  newStrategyId.value = activeStrategyId.value || activeAccount.value?.strategyId || strategies.value[0]?.id || "";
}

function openCreateDialog() {
  resetCreateForm();
  createDialogOpen.value = true;
  void loadMarketSignals();
}

function closeCreateDialog() {
  createDialogOpen.value = false;
}

function createAccount(mode: "recommended" | "empty") {
  const strategy = selectedStrategy.value;
  const strategyId = strategy?.id ?? strategies.value[0]?.id ?? "";
  const id = `account-${Date.now()}`;
  const holdings = mode === "recommended" && strategy ? createInitialHoldingsFromStrategy(strategy) : [];
  const nextAccount: AccountProfile = {
    id,
    name: newAccountName.value.trim() || "新账户",
    strategyId,
    holdings,
    executionLogs: [],
    dailyReturns: [],
    cashReserve: 0,
    createdAt: new Date().toISOString(),
  };

  accounts.value.unshift(nextAccount);
  activeAccountId.value = id;
  if (strategyId) activeStrategyId.value = strategyId;
  closeCreateDialog();
  resetCreateForm();
  notify(
    "success",
    "账户已创建",
    mode === "recommended" ? "已载入策略推荐标的，可点击编辑补充成本和市值。" : "已创建空账户，可点击编辑手动维护持仓。",
  );
}

function removeAccount(id: string) {
  if (accounts.value.length <= 1) return;
  const target = accounts.value.find((account) => account.id === id);
  accounts.value = accounts.value.filter((account) => account.id !== id);
  if (activeAccountId.value === id) {
    activeAccountId.value = accounts.value[0]?.id ?? "";
    activeStrategyId.value = accounts.value[0]?.strategyId ?? activeStrategyId.value;
  }
  notify("success", "账户已删除", `${target?.name ?? "该账户"} 已从账户列表移除。`);
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

const monthlyReturnItems = computed<DailyReturnItem[]>(() =>
  activeDailyReturns.value.filter((item) => item.date.startsWith(selectedMonth.value)),
);
const dailyReturnMap = computed(() => new Map(monthlyReturnItems.value.map((item) => [item.date, item])));
const monthProfit = computed(() => monthlyReturnItems.value.reduce((sum, item) => sum + safeNumber(item.profit), 0));
const returnDays = computed(() => monthlyReturnItems.value.length);
const positiveDays = computed(() => monthlyReturnItems.value.filter((item) => safeNumber(item.profit) > 0).length);
const maxLoss = computed(() => Math.min(0, ...monthlyReturnItems.value.map((item) => safeNumber(item.profit))));
const monthEndValue = computed(() => {
  const items = monthlyReturnItems.value;
  return items.length ? safeNumber(items[items.length - 1].marketValue) : activeAccount.value ? accountHoldingValue(activeAccount.value) : 0;
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

function updateHoldingAmount(code: string, amount: number) {
  const target = activeAccount.value?.holdings.find((holding) => holding.code === code);
  if (!target) return;
  target.costAmount = Math.max(0, safeNumber(target.costAmount) + amount);
  target.marketValue = Math.max(0, safeNumber(target.marketValue) + amount);
}

function deleteExecution(id: string) {
  if (!activeAccount.value) return;
  const target = activeAccount.value.executionLogs.find((log: ExecutionLog) => log.id === id);
  if (!target) {
    notify("danger", "撤销失败", "没有找到这条执行记录，可能已经被删除。");
    return;
  }

  activeAccount.value.executionLogs = activeAccount.value.executionLogs.filter((log: ExecutionLog) => log.id !== id);
  updateHoldingAmount(target.code, -target.amount);
  notify("success", "已撤销记录", `${target.code} 的 ${money(target.amount)} 已从执行记录和持仓成本中扣回。`);
}
</script>
