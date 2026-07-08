<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">个股趋势</span>
          <h2>个股趋势观察台</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="modeLabel" :kind="scan?.mode === 'live' ? 'good' : 'neutral'" />
          <button type="button" class="primary-button" :disabled="loading" @click="loadScan(false)">
            {{ loading ? "扫描中..." : "刷新扫描" }}
          </button>
        </div>
      </div>

      <form class="stock-search-bar" @submit.prevent="searchStock">
        <label>
          <span>检索公司</span>
          <input v-model.trim="searchText" placeholder="输入股票代码或公司名，例如 688256 / 寒武纪" />
        </label>
        <button type="submit" class="primary-button" :disabled="loading">搜索</button>
        <button type="button" class="ghost-button" :disabled="loading" @click="resetSearch">热门扫描</button>
      </form>

      <div class="metric-grid">
        <MetricCard label="样本数量" :value="scan?.results.length ?? 0" :detail="scan?.searchQuery ? '搜索结果' : '热门/潜力样本池'" />
        <MetricCard label="重点观察" :value="groups.top.length" detail="趋势、财报和风险较匹配" tone="good" />
        <MetricCard label="跟踪观察" :value="groups.watch.length" detail="有线索但证据未闭合" />
        <MetricCard label="过热等待" :value="groups.overheated.length" detail="强势但赔率下降" tone="warn" />
      </div>

      <div class="status-strip">
        <span>数据来源：{{ scan?.source ?? "-" }}</span>
        <span>更新时间：{{ updatedAt || "-" }}</span>
        <span>{{ scan?.message }}</span>
      </div>
      <p class="data-warning">
        打开页面默认优先扫描近期热门/潜力方向；搜索时会按公司名或代码单独分析。评级结合 40 日趋势、量价、相对强度、财报质量和风险拥挤度，不构成买卖建议。
      </p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <section v-if="scan?.sectorSummary?.length">
      <SectionTitle eyebrow="Sectors" title="优先关注板块" note="根据样本内重点/跟踪数量、平均得分和40日强度排序" />
      <div class="sector-rank-grid">
        <article v-for="sector in scan.sectorSummary" :key="sector.name">
          <header>
            <strong>{{ sector.name }}</strong>
            <RiskBadge :label="`${sector.avgScore}分`" :kind="sector.topCount >= 2 ? 'good' : 'neutral'" />
          </header>
          <div class="sector-metrics">
            <span>候选 <strong>{{ sector.count }}</strong></span>
            <span>有效 <strong>{{ sector.topCount }}</strong></span>
            <span>40日 <strong>{{ signedPercent(sector.avgReturn40) }}</strong></span>
          </div>
          <p>{{ sector.leaders.map((leader) => `${leader.name} ${leader.score}分`).join(" / ") }}</p>
        </article>
      </div>
    </section>

    <section>
      <SectionTitle eyebrow="Ratings" title="个股评级列表" note="点击详情查看财报、支撑压力和观察计划" />
      <div class="segmented-control stock-filter-control">
        <button v-for="option in filterOptions" :key="option.value" type="button" :class="{ active: activeFilter === option.value }" @click="activeFilter = option.value">
          {{ option.label }}
        </button>
      </div>

      <div class="table-wrap">
        <table class="stock-list-table">
          <thead>
            <tr>
              <th>公司</th>
              <th>评级</th>
              <th>状态</th>
              <th>40日/相对</th>
              <th>量能</th>
              <th>财报综合</th>
              <th>风险</th>
              <th>策略风格</th>
              <th>动作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredRows" :key="item.code">
              <td>
                <strong>{{ item.name }}</strong>
                <span class="cell-detail">{{ item.code }} · {{ item.industry }} · {{ item.discoverySource || item.theme }}</span>
              </td>
              <td>
                <strong>{{ item.rating }}</strong>
                <span class="cell-detail">{{ item.ratingText }}</span>
              </td>
              <td><RiskBadge :label="item.status" :kind="stockOpportunityKind(item.status)" /></td>
              <td>
                <strong :class="returnClass(item.return40)">{{ signedPercent(item.return40) }}</strong>
                <span class="cell-detail">相对 {{ signedPercent(item.relative40) }}</span>
              </td>
              <td>{{ item.volumeRatio }}x</td>
              <td>
                <strong>{{ item.financial.financialScore }}</strong>
                <span class="cell-detail">{{ item.financial.report }}</span>
              </td>
              <td>
                <strong>{{ item.riskScore }}</strong>
                <span class="cell-detail">MA20偏离 {{ signedPercent(item.biasMa20) }}</span>
              </td>
              <td>
                <strong>{{ item.institutionalView.strategyFit.style }}</strong>
                <span class="cell-detail">{{ item.institutionalView.strategyFit.fit }}</span>
              </td>
              <td>
                <button type="button" class="ghost-button" @click="selectedStock = item">详情</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!filteredRows.length" class="empty-note">当前筛选下暂无个股。</p>
    </section>

    <AppDialog
      :open="Boolean(selectedStock)"
      :title="selectedStock ? `${selectedStock.name} ${selectedStock.code}` : '个股详情'"
      eyebrow="个股观察详情"
      width="960px"
      :description="selectedStock?.ratingText ?? ''"
      @close="selectedStock = null"
    >
      <div v-if="selectedStock" class="stock-detail-dialog">
        <div class="stock-detail-hero">
          <div>
            <span class="eyebrow">{{ selectedStock.industry }} · {{ selectedStock.theme }} · {{ selectedStock.discoverySource || "实时扫描" }}</span>
            <h3>{{ selectedStock.action }}</h3>
            <p>{{ selectedStock.reason }}</p>
          </div>
          <div class="mainline-score">
            <strong>{{ selectedStock.score }}</strong>
            <RiskBadge :label="selectedStock.status" :kind="stockOpportunityKind(selectedStock.status)" />
          </div>
        </div>

        <div class="stock-metric-row">
          <span>收盘 <strong>{{ selectedStock.close }}</strong></span>
          <span>20日 <strong>{{ signedPercent(selectedStock.return20) }}</strong></span>
          <span>40日 <strong>{{ signedPercent(selectedStock.return40) }}</strong></span>
          <span>60日 <strong>{{ signedPercent(selectedStock.return60) }}</strong></span>
          <span>相对沪深300 <strong>{{ signedPercent(selectedStock.relative40) }}</strong></span>
          <span>回撤 <strong>{{ signedPercent(selectedStock.maxDrawdown) }}</strong></span>
        </div>

        <div class="stock-detail-section">
          <h4>机构式结论</h4>
          <p>{{ selectedStock.institutionalView.conclusion }}</p>
          <div class="strategy-fit-card">
            <div>
              <span>适配策略</span>
              <strong>{{ selectedStock.institutionalView.strategyFit.style }}</strong>
              <small>{{ selectedStock.institutionalView.strategyFit.master }} · {{ selectedStock.institutionalView.strategyFit.fit }}</small>
            </div>
            <p>{{ selectedStock.institutionalView.strategyFit.explanation }}</p>
          </div>
          <div class="institutional-detail-grid">
            <article>
              <span>周期/阶段</span>
              <strong>{{ selectedStock.stage }}</strong>
              <p>{{ selectedStock.institutionalView.cycle }}</p>
            </article>
            <article>
              <span>技术面</span>
              <strong>{{ selectedStock.trendScore }} 分</strong>
              <p>{{ selectedStock.institutionalView.technical }}</p>
            </article>
            <article>
              <span>财报面</span>
              <strong>{{ selectedStock.financial.financialScore }} 分</strong>
              <p>{{ selectedStock.institutionalView.financial }}</p>
            </article>
            <article>
              <span>风险扣分</span>
              <strong>{{ selectedStock.riskScore }} 分</strong>
              <p>{{ selectedStock.evidence.risk }}</p>
            </article>
          </div>
        </div>

        <div class="stock-detail-section">
          <h4>指标好不好</h4>
          <div class="indicator-assessment-grid">
            <article v-for="item in selectedStock.institutionalView.indicatorAssessments" :key="item.label" :class="`assessment-${item.status}`">
              <div>
                <span>{{ item.label }}</span>
                <RiskBadge :label="assessmentLabel(item.status)" :kind="assessmentKind(item.status)" />
              </div>
              <strong>{{ item.value }}</strong>
              <p>{{ item.explanation }}</p>
            </article>
          </div>
        </div>

        <dl class="evidence-grid">
          <div>
            <dt>趋势证据</dt>
            <dd>{{ selectedStock.evidence.trend }}</dd>
          </div>
          <div>
            <dt>量价证据</dt>
            <dd>{{ selectedStock.evidence.volume }}</dd>
          </div>
          <div>
            <dt>财报质量</dt>
            <dd>{{ selectedStock.evidence.quality }}</dd>
          </div>
          <div>
            <dt>支撑压力</dt>
            <dd>{{ selectedStock.evidence.risk }}</dd>
          </div>
        </dl>

        <div class="financial-score-grid">
          <article>
            <span>财报综合</span>
            <strong>{{ selectedStock.financial.financialScore }}</strong>
            <small>不是买入评级，只是基本面匹配度</small>
          </article>
          <article>
            <span>增长动能</span>
            <strong>{{ selectedStock.financial.growthScore }}</strong>
            <small>营收同比 + 净利同比</small>
          </article>
          <article>
            <span>盈利能力</span>
            <strong>{{ selectedStock.financial.profitabilityScore }}</strong>
            <small>ROE + 毛利率 + 净利率</small>
          </article>
          <article>
            <span>资产负债</span>
            <strong>{{ selectedStock.financial.balanceScore }}</strong>
            <small>负债率越高，安全边际要求越高</small>
          </article>
          <article>
            <span>现金流</span>
            <strong>{{ selectedStock.financial.cashFlowScore }}</strong>
            <small>经营现金流/营收</small>
          </article>
          <article>
            <span>质量锚</span>
            <strong>{{ selectedStock.financial.qualityAnchorScore }}</strong>
            <small>行业地位/经营确定性基础分</small>
          </article>
        </div>

        <div class="financial-grid">
          <article>
            <span>报告期</span>
            <strong>{{ selectedStock.financial.report }}</strong>
            <small>{{ selectedStock.financial.reportDate || selectedStock.financial.mode }}</small>
          </article>
          <article>
            <span>营收同比</span>
            <strong :class="returnClass(selectedStock.financial.revenueYoy)">{{ signedPercent(selectedStock.financial.revenueYoy) }}</strong>
          </article>
          <article>
            <span>净利同比</span>
            <strong :class="returnClass(selectedStock.financial.profitYoy)">{{ signedPercent(selectedStock.financial.profitYoy) }}</strong>
          </article>
          <article>
            <span>ROE</span>
            <strong>{{ selectedStock.financial.roe }}%</strong>
          </article>
          <article>
            <span>毛利率</span>
            <strong>{{ selectedStock.financial.grossMargin }}%</strong>
          </article>
          <article>
            <span>净利率</span>
            <strong>{{ selectedStock.financial.netMargin }}%</strong>
          </article>
          <article>
            <span>负债率</span>
            <strong>{{ selectedStock.financial.debtRatio }}%</strong>
          </article>
          <article>
            <span>经营现金流/营收</span>
            <strong :class="returnClass(selectedStock.financial.cashToRevenue)">{{ signedPercent(selectedStock.financial.cashToRevenue) }}</strong>
          </article>
        </div>

        <div class="stock-detail-section">
          <h4>为什么是这个财报分</h4>
          <div class="financial-reason-grid">
            <article>
              <strong>加分项</strong>
              <ul>
                <li v-for="item in selectedStock.financial.highlights" :key="item">{{ item }}</li>
              </ul>
            </article>
            <article>
              <strong>扣分项</strong>
              <ul>
                <li v-for="item in selectedStock.financial.deductions" :key="item">{{ item }}</li>
              </ul>
            </article>
          </div>
          <p>{{ selectedStock.financial.summary }}</p>
        </div>

        <div class="stock-detail-section">
          <h4>接下来怎么观察</h4>
          <div class="financial-reason-grid">
            <article>
              <strong>观察计划</strong>
              <ol>
                <li v-for="item in selectedStock.institutionalView.watchPlan" :key="item">{{ item }}</li>
              </ol>
            </article>
            <article>
              <strong>最大风险</strong>
              <ol>
                <li v-for="item in selectedStock.institutionalView.riskChecklist" :key="item">{{ item }}</li>
              </ol>
            </article>
          </div>
          <p>{{ selectedStock.method }}。系统只做观察评级，不等于买入评级；真正执行还要结合账户仓位、回撤承受力和当日盘口确认。</p>
        </div>
      </div>
    </AppDialog>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import AppDialog from "../components/AppDialog.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { fetchStockOpportunityScan, splitStockOpportunityGroups, stockOpportunityKind } from "../services/stockOpportunityData";
import type { StockOpportunityItem, StockOpportunityResponse, StockOpportunityStatus } from "../types";
import { returnClass, signedPercent } from "../utils/format";

type FilterValue = "active" | "all" | StockOpportunityStatus;

const scan = ref<StockOpportunityResponse | null>(null);
const loading = ref(false);
const error = ref("");
const searchText = ref("");
const activeFilter = ref<FilterValue>("active");
const selectedStock = ref<StockOpportunityItem | null>(null);

const filterOptions: Array<{ value: FilterValue; label: string }> = [
  { value: "active", label: "观察池" },
  { value: "all", label: "全部" },
  { value: "重点观察", label: "重点" },
  { value: "跟踪观察", label: "跟踪" },
  { value: "过热等待", label: "过热" },
  { value: "暂不观察", label: "剔除" },
];

const groups = computed(() => splitStockOpportunityGroups(scan.value?.results ?? []));
const filteredRows = computed(() => {
  const rows = scan.value?.results ?? [];
  if (activeFilter.value === "active") return rows.filter((item) => item.status !== "暂不观察");
  return activeFilter.value === "all" ? rows : rows.filter((item) => item.status === activeFilter.value);
});
const modeLabel = computed(() => {
  if (!scan.value) return "未扫描";
  if (scan.value.mode === "live") return "公开行情";
  if (scan.value.mode === "fallback") return "内置样本";
  return "数据异常";
});
const updatedAt = computed(() => {
  if (!scan.value?.updatedAt) return "";
  return new Date(scan.value.updatedAt).toLocaleString("zh-CN", { hour12: false });
});

async function loadScan(forceFallback: boolean, query = "") {
  loading.value = true;
  error.value = "";
  selectedStock.value = null;
  try {
    scan.value = await fetchStockOpportunityScan(forceFallback, query);
    activeFilter.value = "active";
  } catch (err) {
    error.value = err instanceof Error ? err.message : "个股观察扫描失败";
  } finally {
    loading.value = false;
  }
}

function assessmentLabel(status: string) {
  if (status === "good") return "好";
  if (status === "neutral") return "中性";
  if (status === "warn") return "偏弱";
  return "风险";
}

function assessmentKind(status: string) {
  if (status === "good") return "good";
  if (status === "warn") return "warn";
  if (status === "bad") return "danger";
  return "neutral";
}

function searchStock() {
  void loadScan(false, searchText.value);
}

function resetSearch() {
  searchText.value = "";
  void loadScan(false);
}

onMounted(() => {
  void loadScan(false);
});
</script>
