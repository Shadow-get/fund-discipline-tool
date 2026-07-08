<template>
  <main class="market-dashboard">
    <section class="market-hero">
      <div>
        <span class="eyebrow">大盘看板</span>
        <h2>周线/月线技术雷达</h2>
        <p>首页只看市场状态：趋势结构、均线位置、支撑压力和板块热度。账户持仓、收益和执行记录统一放到账户中心。</p>
      </div>
      <div class="market-hero-panel">
        <span class="eyebrow">系统判断</span>
        <h3>{{ kline?.analysis?.trendLabel ?? "等待行情" }}</h3>
        <p>{{ kline?.analysis?.conclusion ?? "正在读取 K 线和市场热度。" }}</p>
        <div class="compact-list">
          <span>{{ periodLabel }}</span>
          <span>{{ kline?.mode === "live" ? "实时行情" : "缓存/降级" }}</span>
          <span>{{ kline ? formatDateTime(kline.updatedAt) : "--" }}</span>
        </div>
      </div>
    </section>

    <section class="metric-grid">
      <MetricCard
        label="当前收盘"
        :value="kline?.analysis ? price(kline.analysis.close) : '--'"
        :detail="kline?.analysis ? signedPercent(kline.analysis.changePct) : '等待行情'"
        :tone="kline?.analysis && kline.analysis.changePct >= 0 ? 'good' : 'warn'"
      />
      <MetricCard
        label="MA20偏离"
        :value="kline?.analysis ? signedPercent(kline.analysis.biasMa20) : '--'"
        :detail="kline?.analysis?.ma20 ? `MA20 ${price(kline.analysis.ma20)}` : '均线计算中'"
        :tone="kline?.analysis && Math.abs(kline.analysis.biasMa20) > 10 ? 'warn' : 'neutral'"
      />
      <MetricCard
        label="最近支撑"
        :value="supportLevel ? price(supportLevel.value) : '--'"
        :detail="supportLevel ? `${supportLevel.label} · 距 ${supportLevel.distancePct}%` : '暂无明确支撑'"
        :tone="supportLevel && supportLevel.distancePct < 3 ? 'warn' : 'neutral'"
      />
      <MetricCard
        label="最近压力"
        :value="resistanceLevel ? price(resistanceLevel.value) : '--'"
        :detail="resistanceLevel ? `${resistanceLevel.label} · 距 ${resistanceLevel.distancePct}%` : '暂无明确压力'"
        :tone="resistanceLevel && resistanceLevel.distancePct < 4 ? 'warn' : 'neutral'"
      />
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">K线指标</span>
          <h2>{{ activeTarget?.name ?? "市场标的" }} · {{ periodLabel }}</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="kline?.analysis?.trendLabel ?? '读取中'" :kind="analysisKind" />
          <button type="button" class="ghost-button" :disabled="klineLoading" @click="loadKline">
            {{ klineLoading ? "刷新中..." : "刷新K线" }}
          </button>
        </div>
      </div>

      <div class="market-chart-layout">
        <aside class="market-watchlist">
          <div class="segmented-control period-control">
            <button
              v-for="item in periodOptions"
              :key="item.value"
              type="button"
              :class="{ active: period === item.value }"
              @click="period = item.value"
            >
              {{ item.label }}
            </button>
          </div>

          <button
            v-for="target in watchlist"
            :key="target.id"
            type="button"
            class="watchlist-item"
            :class="{ active: selectedCode === target.id }"
            @click="selectedCode = target.id"
          >
            <span>{{ target.category }}</span>
            <strong>{{ target.name }}</strong>
            <small>{{ target.hint }}</small>
          </button>
        </aside>

        <div class="kline-panel">
          <div v-if="klineNotice" class="kline-alert" :class="{ danger: Boolean(klineError) }">
            <div>
              <strong>{{ klineNotice.title }}</strong>
              <span>{{ klineNotice.message }}</span>
              <small>{{ klineNotice.hint }}</small>
            </div>
            <button type="button" class="ghost-button" :disabled="klineLoading" @click="loadKline">
              {{ klineLoading ? "刷新中" : "重新刷新" }}
            </button>
          </div>
          <KlineTechnicalChart :payload="kline" :loading="klineLoading" />

          <div v-if="kline?.analysis && !hasAdvancedKlineAnalysis" class="kline-analysis-warning">
            当前只显示基础趋势分析；刷新或重启本地服务后，会加载金叉、死叉、放量、缩量等技术事件。
          </div>

          <div v-if="recentTechnicalEvents.length" class="technical-event-strip">
            <article v-for="event in recentTechnicalEvents" :key="`${event.date}-${event.type}`" :class="event.severity">
              <span>{{ event.date }}</span>
              <strong>{{ event.label }}</strong>
              <small>{{ event.reason }}</small>
            </article>
          </div>
          <div v-else-if="kline?.analysis" class="technical-event-empty">
            当前周期暂未识别到明显金叉、死叉、放量突破或缩量回踩节点，先按均线结构、支撑压力和量能变化观察。
          </div>

          <div v-if="dynamicGuide.length" class="chart-beginner-guide">
            <article v-for="item in dynamicGuide" :key="item.title" :class="item.tone">
              <strong>{{ item.title }}</strong>
              <span>{{ item.summary }}</span>
              <small>{{ item.detail }}</small>
            </article>
          </div>

          <div v-if="kline?.analysis" class="technical-summary-grid">
            <article>
              <span>20期涨幅</span>
              <strong :class="returnClass(kline.analysis.returns20)">{{ signedPercent(kline.analysis.returns20) }}</strong>
            </article>
            <article>
              <span>60期涨幅</span>
              <strong :class="returnClass(kline.analysis.returns60)">{{ signedPercent(kline.analysis.returns60) }}</strong>
            </article>
            <article>
              <span>量能变化</span>
              <strong>{{ kline.analysis.volumeRatio }}x</strong>
            </article>
            <article>
              <span>高点回撤</span>
              <strong :class="returnClass(kline.analysis.drawdownPct)">{{ signedPercent(kline.analysis.drawdownPct) }}</strong>
            </article>
          </div>

          <div v-if="kline?.analysis" class="technical-note-grid">
            <p>{{ kline.analysis.conclusion }}</p>
            <p>{{ kline.analysis.riskNote }}</p>
          </div>
        </div>
      </div>
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
          <span class="eyebrow">实时板块动态</span>
          <h2>主线、过热与观察方向</h2>
        </div>
        <span class="data-note">{{ scan?.message ?? "正在读取板块扫描。" }}</span>
      </div>

      <div class="sector-grid">
        <article v-for="item in sectorRows" :key="item.candidateId" class="sector-card">
          <header>
            <div>
              <span class="eyebrow">{{ item.category }}</span>
              <h3>{{ item.name }}</h3>
            </div>
            <RiskBadge :label="item.status" :kind="mainlineKind(item)" />
          </header>
          <p>{{ item.action }}</p>
          <div class="sector-metrics">
            <span>20日 <strong :class="returnClass(item.returns20)">{{ signedPercent(item.returns20) }}</strong></span>
            <span>60日 <strong :class="returnClass(item.returns60)">{{ signedPercent(item.returns60) }}</strong></span>
            <span>热度 <strong>{{ item.heatScore }}</strong></span>
            <span>估值 <strong>{{ item.valuationPercentile }}%</strong></span>
          </div>
        </article>
      </div>
    </section>

    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">机会与风险榜</span>
          <h2>先分层，再决定是否进入</h2>
        </div>
      </div>

      <div class="opportunity-lane-grid">
        <article>
          <span class="eyebrow">主线候选</span>
          <h3>趋势强但未极端拥挤</h3>
          <ul>
            <li v-for="item in groups.top.slice(0, 5)" :key="item.candidateId">{{ item.name }} · {{ item.stage }}</li>
          </ul>
        </article>
        <article>
          <span class="eyebrow">回调观察</span>
          <h3>证据链还需确认</h3>
          <ul>
            <li v-for="item in groups.watch.slice(0, 5)" :key="item.candidateId">{{ item.name }} · {{ item.stage }}</li>
          </ul>
        </article>
        <article>
          <span class="eyebrow">过热等待</span>
          <h3>不追高，等均线修复</h3>
          <ul>
            <li v-for="item in groups.overheated.slice(0, 5)" :key="item.candidateId">{{ item.name }} · 热度 {{ item.heatScore }}</li>
          </ul>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import KlineTechnicalChart from "../components/market/KlineTechnicalChart.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import { buildMarketRecommendation } from "../data/strategyWorkspace";
import { fetchLowValuationScan } from "../services/lowValuationData";
import { fetchMainlineScan, getMainlineStatusKind, splitMainlineGroups } from "../services/mainlineData";
import { fetchMarketKline } from "../services/marketKline";
import type {
  KlinePoint,
  KlinePeriod,
  LowValuationScanResponse,
  MainlineScanItem,
  MainlineScanResponse,
  MarketHeatLevel,
  MarketKlineResponse,
  TechnicalEvent,
  TechnicalGuideItem,
} from "../types";
import { returnClass, safeNumber, signedPercent } from "../utils/format";

type BadgeKind = "neutral" | "good" | "warn" | "danger";

const watchlist = [
  { id: "cn_hs300", name: "沪深300", category: "A股宽基", hint: "核心资产与大盘温度" },
  { id: "cn_csi500", name: "中证500", category: "A股宽基", hint: "中盘弹性与风险偏好" },
  { id: "cn_chinext", name: "创业板", category: "成长宽基", hint: "成长股风险偏好" },
  { id: "hk_tech", name: "恒生科技", category: "港股", hint: "港股科技与流动性" },
  { id: "us_nasdaq100", name: "纳斯达克100", category: "海外", hint: "美股科技与AI链" },
  { id: "style_dividend", name: "红利", category: "防守", hint: "高股息与低波防守" },
  { id: "theme_ai_compute", name: "AI算力", category: "AI基础设施", hint: "算力、云计算、AI主题" },
  { id: "theme_semiconductor", name: "半导体", category: "硬科技", hint: "芯片与国产替代" },
  { id: "theme_cpo_comm", name: "CPO/通信", category: "AI基础设施", hint: "光模块与通信链" },
  { id: "theme_liquid_cooling_power", name: "液冷/AI电力", category: "AI基础设施", hint: "数据中心电力扩散" },
];

const periodOptions: Array<{ value: KlinePeriod; label: string }> = [
  { value: "day", label: "日线" },
  { value: "week", label: "周线" },
  { value: "month", label: "月线" },
];

const selectedCode = ref("cn_hs300");
const period = ref<KlinePeriod>("week");
const kline = ref<MarketKlineResponse | null>(null);
const klineLoading = ref(false);
const klineError = ref("");
const scan = ref<MainlineScanResponse | null>(null);
const lowValuationScan = ref<LowValuationScanResponse | null>(null);

const activeTarget = computed(() => watchlist.find((item) => item.id === selectedCode.value));
const periodLabel = computed(() => periodOptions.find((item) => item.value === period.value)?.label ?? "周线");
const supportLevel = computed(() => kline.value?.analysis?.supportLevels[0]);
const resistanceLevel = computed(() => kline.value?.analysis?.resistanceLevels[0]);
const hasAdvancedKlineAnalysis = computed(() => {
  const analysis = kline.value?.analysis;
  return Boolean(analysis && Array.isArray(analysis.events) && Array.isArray(analysis.guide) && analysis.guide.length);
});
const recentTechnicalEvents = computed(() => {
  const events = kline.value?.analysis?.events;
  return Array.isArray(events) ? events.slice(-5).reverse() : [];
});
const dynamicGuide = computed<TechnicalGuideItem[]>(() => {
  const analysis = kline.value?.analysis;
  if (!analysis) return [];
  if (Array.isArray(analysis.guide) && analysis.guide.length) return analysis.guide;

  return [
    {
      title: "基础趋势判断",
      summary: analysis.conclusion,
      detail: analysis.riskNote,
      tone: analysisKind.value,
    },
    {
      title: "均线位置",
      summary: analysis.ma20
        ? `当前收盘 ${price(analysis.close)}，MA20 ${price(analysis.ma20)}，偏离 ${signedPercent(analysis.biasMa20)}。`
        : "当前均线数据不足，先观察价格区间。",
      detail: "金叉/死叉等事件需要接口返回完整技术事件后展示；基础判断先看收盘价是否站在 MA20、MA60 上方。",
      tone: analysis.status === "bullish" ? "good" : analysis.status === "broken" ? "danger" : "warn",
    },
    {
      title: "量能变化",
      summary: `近5期量能约为前20期均量的 ${analysis.volumeRatio} 倍。`,
      detail: "上涨放量通常代表资金确认度提升；下跌放量代表抛压更重；缩量回踩则更像观察区。",
      tone: analysis.volumeRatio >= 1.4 ? "warn" : analysis.volumeRatio <= 0.7 ? "neutral" : "good",
    },
    {
      title: "支撑压力",
      summary: supportLevel.value
        ? `最近支撑：${supportLevel.value.label} ${price(supportLevel.value.value)}，距离 ${supportLevel.value.distancePct}%。`
        : resistanceLevel.value
          ? `最近压力：${resistanceLevel.value.label} ${price(resistanceLevel.value.value)}，距离 ${resistanceLevel.value.distancePct}%。`
          : "暂时没有非常清晰的支撑压力。",
      detail: resistanceLevel.value
        ? `上方压力：${resistanceLevel.value.label} ${price(resistanceLevel.value.value)}，距离 ${resistanceLevel.value.distancePct}%。`
        : "支撑压力更适合用来规划分批和风控，不要当成确定预测。",
      tone: "neutral",
    },
  ];
});
const klineNotice = computed(() => {
  if (klineError.value) {
    return {
      title: "K线读取失败",
      message: klineError.value,
      hint: "通常是公开行情接口临时断开、超时或返回数据不足。可以稍后重新刷新，或先切换其他标的查看。",
    };
  }

  if (kline.value && kline.value.mode !== "live") {
    return {
      title: "公开行情暂不可用，已展示降级走势",
      message: kline.value.message,
      hint: "降级走势只用于保持看板可读，不作为真实价格依据；请在行情恢复后重新刷新。",
    };
  }

  return null;
});
const groups = computed(() => splitMainlineGroups(scan.value?.results ?? []));
const sectorRows = computed(() => (scan.value?.results ?? []).slice(0, 12));
const marketRecommendation = computed(() => buildMarketRecommendation(scan.value, lowValuationScan.value));
const analysisKind = computed<BadgeKind>(() => {
  const status = kline.value?.analysis?.status;
  if (status === "bullish") return "good";
  if (status === "overheated" || status === "watch") return "warn";
  if (status === "broken") return "danger";
  return "neutral";
});

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

function price(value: unknown) {
  const number = safeNumber(value);
  if (number >= 1000) return number.toFixed(0);
  if (number >= 100) return number.toFixed(1);
  return number.toFixed(2);
}

function pct(current: number, previous: number | null | undefined) {
  return previous ? ((current - previous) / previous) * 100 : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}

function averageVolume(points: KlinePoint[], endIndex: number, size = 20) {
  const start = Math.max(0, endIndex - size);
  const slice = points.slice(start, endIndex);
  if (!slice.length) return 0;
  return slice.reduce((sum, point) => sum + safeNumber(point.volume), 0) / slice.length;
}

function volumeRatioAt(points: KlinePoint[], index: number) {
  const average = averageVolume(points, index);
  return average ? safeNumber(points[index]?.volume) / average : 1;
}

function crossedUp(previousFast: number | null, previousSlow: number | null, fast: number | null, slow: number | null) {
  return previousFast != null && previousSlow != null && fast != null && slow != null && previousFast <= previousSlow && fast > slow;
}

function crossedDown(previousFast: number | null, previousSlow: number | null, fast: number | null, slow: number | null) {
  return previousFast != null && previousSlow != null && fast != null && slow != null && previousFast >= previousSlow && fast < slow;
}

function createTechnicalEvent(
  point: KlinePoint,
  type: TechnicalEvent["type"],
  label: string,
  volumeRatio: number,
  severity: TechnicalEvent["severity"],
  reason: string,
  hint: string,
): TechnicalEvent {
  return {
    date: point.date,
    type,
    label,
    price: round(point.close),
    volumeRatio: round(volumeRatio),
    severity,
    reason,
    hint,
  };
}

function detectFrontendTechnicalEvents(points: KlinePoint[]): TechnicalEvent[] {
  if (points.length < 3) return [];

  const events: TechnicalEvent[] = [];
  const start = Math.max(1, points.length - 90);

  for (let index = start; index < points.length; index += 1) {
    const point = points[index];
    const previous = points[index - 1];
    const recent20 = points.slice(Math.max(0, index - 20), index);
    if (!point || !previous || !recent20.length) continue;

    const volumeRatio = volumeRatioAt(points, index);
    const previous20High = Math.max(...recent20.map((item) => item.high));
    const previous20Low = Math.min(...recent20.map((item) => item.low));

    if (crossedUp(previous.ma5, previous.ma20, point.ma5, point.ma20)) {
      events.push(
        createTechnicalEvent(
          point,
          "goldenCross",
          "MA5金叉MA20",
          volumeRatio,
          "good",
          "短期均线向上穿过MA20，说明短线动能开始强于中期趋势。",
          "金叉需要结合放量、站上平台高点或回踩不破来确认，不等于立刻买入。",
        ),
      );
    }

    if (crossedDown(previous.ma5, previous.ma20, point.ma5, point.ma20)) {
      events.push(
        createTechnicalEvent(
          point,
          "deathCross",
          "MA5死叉MA20",
          volumeRatio,
          "danger",
          "短期均线向下跌破MA20，说明短线动能转弱。",
          "死叉后要观察是否只是回踩；如果同时放量跌破MA20，风险等级更高。",
        ),
      );
    }

    if (crossedUp(previous.close, previous.ma20, point.close, point.ma20)) {
      events.push(
        createTechnicalEvent(
          point,
          "maRecover",
          "收盘站回MA20",
          volumeRatio,
          "good",
          "收盘价重新站上MA20，中期趋势有修复迹象。",
          "站回MA20后仍要看能否连续站稳，最好配合量能温和放大。",
        ),
      );
    }

    if (crossedDown(previous.close, previous.ma20, point.close, point.ma20)) {
      events.push(
        createTechnicalEvent(
          point,
          "maBreakdown",
          "收盘跌破MA20",
          volumeRatio,
          "danger",
          "收盘价跌破MA20，说明价格进入中期均线下方。",
          "跌破MA20后先降低追高和一次性加仓冲动，等止跌或重新站回再确认。",
        ),
      );
    }

    if (point.close > previous20High && volumeRatio >= 1.25) {
      events.push(
        createTechnicalEvent(
          point,
          "volumeBreakout",
          "放量突破",
          volumeRatio,
          "good",
          "收盘突破近20期平台高点，同时成交量高于均量。",
          "这是趋势确认信号之一，但如果距离MA20太远，仍要防突破后回踩。",
        ),
      );
    }

    if (point.close < previous20Low && volumeRatio >= 1.25) {
      events.push(
        createTechnicalEvent(
          point,
          "volumeBreakdown",
          "放量破位",
          volumeRatio,
          "danger",
          "收盘跌破近20期平台低点，同时成交量放大。",
          "这通常不是普通波动，后续要观察能否快速收回平台。",
        ),
      );
    }

    if (point.ma20 && Math.abs(pct(point.close, point.ma20)) <= 2.5 && point.close >= point.ma20 && volumeRatio <= 0.85) {
      events.push(
        createTechnicalEvent(
          point,
          "shrinkPullback",
          "缩量回踩MA20",
          volumeRatio,
          "neutral",
          "价格回到MA20附近，成交量低于均量，抛压暂时不重。",
          "缩量回踩更像观察区，等止跌或重新放量上行再确认。",
        ),
      );
    }

    if (volumeRatio <= 0.65) {
      events.push(
        createTechnicalEvent(
          point,
          "dryVolume",
          "明显缩量",
          volumeRatio,
          "warn",
          "成交量明显低于20期均量，说明交易意愿下降。",
          "缩量可能是惜售，也可能是资金退潮，要结合价格是否守住支撑判断。",
        ),
      );
    }

    if (volumeRatio >= 1.5 && Math.abs(point.changePct) <= 1.2 && point.high >= previous20High * 0.98) {
      events.push(
        createTechnicalEvent(
          point,
          "volumeStall",
          "放量滞涨",
          volumeRatio,
          "warn",
          "成交明显放大，但价格没有有效上行，且靠近前高或压力区。",
          "这常代表分歧加大，需要看后续能否继续放量突破。",
        ),
      );
    }
  }

  const last = points[points.length - 1];
  const lastVolumeRatio = volumeRatioAt(points, points.length - 1);
  if (last?.ma20 && last.close < last.ma20 && !events.slice(-5).some((event) => event.type === "maBreakdown")) {
    events.push(
      createTechnicalEvent(
        last,
        "maBreakdown",
        "当前低于MA20",
        lastVolumeRatio,
        "danger",
        "当前收盘价位于MA20下方，短中期结构偏弱。",
        "先看能否收回MA20；收回前不宜把回落简单当成低吸机会。",
      ),
    );
  } else if (last?.ma20 && last.close >= last.ma20 && !events.slice(-5).some((event) => event.type === "maRecover")) {
    events.push(
      createTechnicalEvent(
        last,
        "maRecover",
        "当前站在MA20上方",
        lastVolumeRatio,
        "good",
        "当前收盘价位于MA20上方，中期趋势尚未明显破坏。",
        "仍要观察MA20方向和量能，避免在偏离过大时追高。",
      ),
    );
  }

  return events
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((event, index, list) => {
      const previous = list[index - 1];
      return !(previous && previous.date === event.date && previous.type === event.type);
    })
    .slice(-18);
}

function enrichKlinePayload(payload: MarketKlineResponse): MarketKlineResponse {
  if (!payload.analysis) return payload;

  const analysis = payload.analysis;
  const events = Array.isArray(analysis.events) && analysis.events.length ? analysis.events : detectFrontendTechnicalEvents(payload.points);
  const latestEvents = events.slice(-4).reverse();
  const guide: TechnicalGuideItem[] =
    Array.isArray(analysis.guide) && analysis.guide.length
      ? analysis.guide
      : [
          {
            title: "基础趋势判断",
            summary: analysis.conclusion,
            detail: analysis.riskNote,
            tone: analysisKind.value,
          },
          {
            title: "均线位置",
            summary: analysis.ma20
              ? `当前收盘 ${price(analysis.close)}，MA20 ${price(analysis.ma20)}，偏离 ${signedPercent(analysis.biasMa20)}。`
              : "当前均线数据不足，先观察价格区间。",
            detail: "金叉/死叉看的是短线动能是否重新强于中期趋势，最好结合量能确认。",
            tone: analysis.status === "bullish" ? "good" : analysis.status === "broken" ? "danger" : "warn",
          },
          {
            title: "近期技术事件",
            summary: latestEvents.length ? latestEvents.map((event) => `${event.date} ${event.label}`).join("；") : "当前暂无明显金叉、死叉或放量节点。",
            detail: latestEvents[0]?.hint ?? "没有明显事件时，先按均线结构、支撑压力和量能变化观察。",
            tone: latestEvents[0]?.severity ?? "neutral",
          },
          {
            title: "支撑压力",
            summary: supportLevel.value
              ? `最近支撑：${supportLevel.value.label} ${price(supportLevel.value.value)}，距离 ${supportLevel.value.distancePct}%。`
              : resistanceLevel.value
                ? `最近压力：${resistanceLevel.value.label} ${price(resistanceLevel.value.value)}，距离 ${resistanceLevel.value.distancePct}%。`
                : "暂时没有非常清晰的支撑压力。",
            detail: resistanceLevel.value
              ? `上方压力：${resistanceLevel.value.label} ${price(resistanceLevel.value.value)}，距离 ${resistanceLevel.value.distancePct}%。`
              : "支撑压力更适合用来规划分批和风控，不要当成确定预测。",
            tone: "neutral",
          },
        ];

  return {
    ...payload,
    analysis: {
      ...analysis,
      events,
      guide,
    },
  };
}

function mainlineKind(item: MainlineScanItem): BadgeKind {
  const status = getMainlineStatusKind(item);
  if (status === "top") return "good";
  if (status === "watch") return "warn";
  if (status === "overheated") return "danger";
  return "neutral";
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadKline() {
  klineLoading.value = true;
  klineError.value = "";
  const requestCode = selectedCode.value;
  const requestPeriod = period.value;
  const canKeepOldChart = kline.value?.target.id === requestCode && kline.value?.period === requestPeriod;
  try {
    kline.value = enrichKlinePayload(await fetchMarketKline(requestCode, requestPeriod));
  } catch (error) {
    klineError.value = `K线读取失败：${error instanceof Error ? error.message : "未知错误"}`;
    if (!canKeepOldChart) {
      kline.value = null;
    }
  } finally {
    klineLoading.value = false;
  }
}

watch([selectedCode, period], () => {
  void loadKline();
});

onMounted(async () => {
  await Promise.all([
    loadKline(),
    fetchMainlineScan().then((payload) => (scan.value = payload)),
    fetchLowValuationScan().then((payload) => (lowValuationScan.value = payload)),
  ]);
});
</script>
