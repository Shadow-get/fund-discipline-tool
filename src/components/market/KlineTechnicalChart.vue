<template>
  <div class="kline-chart-shell" :class="{ loading }">
    <div v-if="!payload || !visiblePoints.length" class="chart-empty">
      <span v-if="loading" class="loading-spinner"></span>
      <strong>{{ loading ? "正在读取 K 线" : "暂无 K 线数据" }}</strong>
      <small>{{ loading ? "公开行情偶尔会慢一点，请稍等。" : "可以点击刷新重新读取。" }}</small>
    </div>
    <svg v-else class="kline-chart" :viewBox="`0 0 ${viewWidth} ${viewHeight}`" role="img">
      <line
        v-for="tick in priceTicks"
        :key="`grid-${tick}`"
        class="chart-grid-line"
        :x1="padding.left"
        :x2="viewWidth - padding.right"
        :y1="y(tick)"
        :y2="y(tick)"
      />
      <text
        v-for="tick in priceTicks"
        :key="`label-${tick}`"
        class="chart-axis-label"
        :x="viewWidth - padding.right + 8"
        :y="y(tick) + 4"
      >
        {{ formatPrice(tick) }}
      </text>

      <g
        v-for="(point, index) in visiblePoints"
        :key="point.date"
        class="candle-group"
        :class="{ active: hoveredPoint?.point.date === point.date }"
        @mouseenter="hoveredPoint = { point, index }"
        @mouseleave="hoveredPoint = null"
      >
        <rect
          class="candle-hit"
          :x="x(index) - candleSlotWidth / 2"
          :y="padding.top"
          :width="candleSlotWidth"
          :height="volumeBottom - padding.top"
        />
        <line
          class="candle-wick"
          :class="point.close >= point.open ? 'up' : 'down'"
          :x1="x(index)"
          :x2="x(index)"
          :y1="y(point.high)"
          :y2="y(point.low)"
        />
        <rect
          class="candle-body"
          :class="point.close >= point.open ? 'up' : 'down'"
          :x="x(index) - candleWidth / 2"
          :y="Math.min(y(point.open), y(point.close))"
          :width="candleWidth"
          :height="Math.max(1, Math.abs(y(point.open) - y(point.close)))"
          rx="1"
        />
        <rect
          class="volume-bar"
          :class="point.close >= point.open ? 'up' : 'down'"
          :x="x(index) - candleWidth / 2"
          :y="volumeY(point.volume)"
          :width="candleWidth"
          :height="Math.max(1, volumeBottom - volumeY(point.volume))"
        />
      </g>

      <path class="ma-line ma5" :d="maPath('ma5')" />
      <path class="ma-line ma20" :d="maPath('ma20')" />
      <path class="ma-line ma60" :d="maPath('ma60')" />

      <g
        v-for="level in visibleLevelLabels"
        :key="`${level.kind}-${level.label}-${level.value}`"
        class="technical-level-group"
        :class="{ active: isHoveredLevel(level) }"
        @mouseenter="hoveredLevel = level"
        @mouseleave="hoveredLevel = null"
      >
        <line
          class="technical-level-hit"
          :x1="padding.left"
          :x2="viewWidth - padding.right"
          :y1="y(level.value)"
          :y2="y(level.value)"
        />
        <line
          class="technical-level"
          :class="level.kind"
          :x1="padding.left"
          :x2="viewWidth - padding.right"
          :y1="y(level.value)"
          :y2="y(level.value)"
        />
        <circle class="technical-level-dot" :class="level.kind" :cx="viewWidth - padding.right - 2" :cy="y(level.value)" r="4" />
      </g>

      <g
        v-for="event in visibleEventMarkers"
        :key="`${event.type}-${event.date}`"
        class="technical-event-marker"
        :class="[event.severity, { active: isHoveredEvent(event) }]"
        @mouseenter="hoveredEvent = event"
        @mouseleave="hoveredEvent = null"
      >
        <circle class="event-marker-hit" :cx="event.x" :cy="event.y" r="13" />
        <circle class="event-marker-dot" :class="event.severity" :cx="event.x" :cy="event.y" r="7" />
        <text class="event-marker-label" :x="event.x" :y="event.y + 0.5" text-anchor="middle" dominant-baseline="central">
          {{ eventMarkerText(event.type) }}
        </text>
      </g>

      <g v-for="tick in dateTicks" :key="tick.date">
        <line class="chart-date-tick" :x1="tick.x" :x2="tick.x" :y1="priceBottom + 8" :y2="priceBottom + 14" />
        <text class="chart-date-label" :x="tick.x" :y="tick.row === 0 ? viewHeight - 22 : viewHeight - 8" text-anchor="middle">
          {{ tick.label }}
        </text>
      </g>
    </svg>

    <div v-if="loading && payload?.points.length" class="chart-loading-overlay">
      <span class="loading-spinner"></span>
      <strong>正在刷新 K 线</strong>
      <small>保留旧图，刷新完成后自动更新。</small>
    </div>

    <div v-if="hoveredEvent" class="chart-event-tooltip" :class="hoveredEvent.severity">
      <strong>{{ hoveredEvent.label }} · {{ hoveredEvent.date }}</strong>
      <span>收盘 {{ formatPrice(hoveredEvent.price) }} · 量能 {{ hoveredEvent.volumeRatio }}x</span>
      <p>{{ hoveredEvent.reason }}</p>
      <small>{{ hoveredEvent.hint }}</small>
    </div>

    <div v-if="hoveredPoint && !hoveredLevel && !hoveredEvent" class="chart-candle-tooltip">
      <strong>{{ hoveredPoint.point.date }}</strong>
      <div>
        <span>开盘 {{ formatPrice(hoveredPoint.point.open) }}</span>
        <span>收盘 {{ formatPrice(hoveredPoint.point.close) }}</span>
        <span>最高 {{ formatPrice(hoveredPoint.point.high) }}</span>
        <span>最低 {{ formatPrice(hoveredPoint.point.low) }}</span>
      </div>
      <p>
        涨跌幅 {{ signedValue(hoveredPoint.point.changePct) }}，成交量 {{ formatVolume(hoveredPoint.point.volume) }}，
        {{ ma20PositionText(hoveredPoint.point) }}
      </p>
    </div>

    <div v-if="hoveredLevel && !hoveredEvent" class="chart-level-tooltip" :class="hoveredLevel.kind">
      <strong>{{ hoveredLevel.label }} {{ formatPrice(hoveredLevel.value) }}</strong>
      <span>{{ hoveredLevel.kind === "support" ? "支撑位" : "压力位" }} · 距当前价 {{ hoveredLevel.distancePct }}%</span>
      <p>{{ levelExplanation(hoveredLevel) }}</p>
      <small>{{ levelTradeHint(hoveredLevel) }}</small>
    </div>

    <div v-if="payload?.analysis" class="chart-legend">
      <span class="ma5">MA5 {{ valueOrDash(payload.analysis.ma5) }}</span>
      <span class="ma20">MA20 {{ valueOrDash(payload.analysis.ma20) }}</span>
      <span class="ma60">MA60 {{ valueOrDash(payload.analysis.ma60) }}</span>
      <span>收盘 {{ valueOrDash(payload.analysis.close) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { KlinePoint, MarketKlineResponse, TechnicalEvent, TechnicalLevel } from "../../types";

type MaKey = "ma5" | "ma20" | "ma60";
type LevelLabel = TechnicalLevel & {
  rawY: number;
};
type EventMarker = TechnicalEvent & {
  index: number;
  x: number;
  y: number;
  point: KlinePoint;
};
type HoveredPoint = {
  point: KlinePoint;
  index: number;
};

const props = defineProps<{
  payload: MarketKlineResponse | null;
  loading?: boolean;
}>();

const viewWidth = 920;
const viewHeight = 460;
const padding = { top: 18, right: 76, bottom: 34, left: 42 };
const volumeTop = 356;
const volumeBottom = 422;
const priceBottom = 340;
const hoveredLevel = ref<LevelLabel | null>(null);
const hoveredEvent = ref<EventMarker | null>(null);
const hoveredPoint = ref<HoveredPoint | null>(null);

const visiblePoints = computed(() => props.payload?.points.slice(-86) ?? []);
const visibleLevels = computed<TechnicalLevel[]>(() => [
  ...(props.payload?.analysis?.supportLevels ?? []),
  ...(props.payload?.analysis?.resistanceLevels ?? []),
]);

const dateTicks = computed(() => {
  const points = visiblePoints.value;
  if (!points.length) return [];
  const desired = Math.min(10, points.length);
  const indexes = Array.from({ length: desired }, (_, index) => Math.round((index * (points.length - 1)) / Math.max(1, desired - 1)));
  return Array.from(new Set(indexes)).map((index, tickIndex) => ({
    index,
    date: points[index].date,
    label: formatDateLabel(points[index].date),
    x: x(index),
    row: tickIndex % 2,
  }));
});

const visibleLevelLabels = computed(() => {
  return visibleLevels.value.map((level) => ({
    ...level,
    rawY: y(level.value),
  }));
});

const visibleEventMarkers = computed<EventMarker[]>(() => {
  const dateIndexMap = new Map(visiblePoints.value.map((point, index) => [point.date, index]));
  return (props.payload?.analysis?.events ?? [])
    .map((event) => {
      const index = dateIndexMap.get(event.date);
      if (index == null) return null;
      const point = visiblePoints.value[index];
      return {
        ...event,
        index,
        point,
        x: x(index),
        y: Math.max(padding.top + 10, y(point.high) - 12),
      };
    })
    .filter((event): event is EventMarker => event != null)
    .slice(-12);
});

const priceRange = computed(() => {
  const values: number[] = [];
  for (const point of visiblePoints.value) {
    values.push(point.high, point.low);
    if (point.ma5) values.push(point.ma5);
    if (point.ma20) values.push(point.ma20);
    if (point.ma60) values.push(point.ma60);
  }
  for (const level of visibleLevels.value) {
    values.push(level.value);
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, max * 0.04, 1);
  return { min: min - spread * 0.08, max: max + spread * 0.12 };
});

const priceTicks = computed(() => {
  const { min, max } = priceRange.value;
  const step = (max - min) / 4;
  return Array.from({ length: 5 }, (_, index) => max - step * index);
});

const candleWidth = computed(() => {
  return Math.max(3, Math.min(9, candleSlotWidth.value * 0.62));
});

const candleSlotWidth = computed(() => {
  const chartWidth = viewWidth - padding.left - padding.right;
  return chartWidth / Math.max(1, visiblePoints.value.length);
});

const maxVolume = computed(() => Math.max(...visiblePoints.value.map((point) => point.volume), 1));

function x(index: number) {
  const chartWidth = viewWidth - padding.left - padding.right;
  if (visiblePoints.value.length <= 1) return padding.left;
  return padding.left + (chartWidth / (visiblePoints.value.length - 1)) * index;
}

function y(value: number) {
  const { min, max } = priceRange.value;
  const ratio = (value - min) / Math.max(1, max - min);
  return priceBottom - ratio * (priceBottom - padding.top);
}

function volumeY(value: number) {
  const ratio = value / maxVolume.value;
  return volumeBottom - ratio * (volumeBottom - volumeTop);
}

function maPath(key: MaKey) {
  const commands: string[] = [];
  visiblePoints.value.forEach((point: KlinePoint, index: number) => {
    const value = point[key];
    if (!value) return;
    commands.push(`${commands.length ? "L" : "M"} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`);
  });
  return commands.join(" ");
}

function formatPrice(value: number) {
  if (value >= 1000) return value.toFixed(0);
  if (value >= 100) return value.toFixed(1);
  return value.toFixed(2);
}

function signedValue(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)}%`;
}

function formatVolume(value: number) {
  if (value >= 100000000) return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`;
  return value.toFixed(0);
}

function ma20PositionText(point: KlinePoint) {
  if (!point.ma20) return "MA20 数据不足";
  const bias = ((point.close - point.ma20) / point.ma20) * 100;
  const side = bias >= 0 ? "高于" : "低于";
  return `收盘价${side} MA20 ${Math.abs(bias).toFixed(2)}%`;
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month) return value;
  return day ? `${year.slice(2)}/${month}/${day}` : `${year.slice(2)}/${month}`;
}

function valueOrDash(value: number | null | undefined) {
  return value == null ? "--" : formatPrice(value);
}

function isHoveredLevel(level: LevelLabel) {
  return (
    hoveredLevel.value?.kind === level.kind &&
    hoveredLevel.value?.label === level.label &&
    hoveredLevel.value?.value === level.value
  );
}

function isHoveredEvent(event: EventMarker) {
  return hoveredEvent.value?.type === event.type && hoveredEvent.value?.date === event.date;
}

function eventMarkerText(type: TechnicalEvent["type"]) {
  const labelMap: Record<TechnicalEvent["type"], string> = {
    goldenCross: "金",
    deathCross: "死",
    volumeBreakout: "突",
    volumeStart: "启",
    shrinkPullback: "缩",
    dryVolume: "缩",
    volumeStall: "滞",
    volumeBreakdown: "破",
    maRecover: "上",
    maBreakdown: "破",
  };
  return labelMap[type];
}

function levelExplanation(level: TechnicalLevel) {
  const side = level.kind === "support" ? "下方支撑" : "上方压力";
  if (level.label.includes("MA20")) {
    return `${level.label}来自最近20个周期收盘价均值，是判断中期趋势是否仍健康的关键线。当前被标为${side}，说明价格正围绕中期趋势线交易。`;
  }
  if (level.label.includes("MA60")) {
    return `${level.label}来自最近60个周期收盘价均值，更偏中长期趋势。它通常不是精准买卖点，而是判断大级别趋势有没有破坏的参考。`;
  }
  if (level.label.includes("平台低点")) {
    return `${level.label}取最近20个周期里的最低价，代表这一段震荡区间的下沿，价格接近这里时要观察是否缩量止跌。`;
  }
  if (level.label.includes("平台高点")) {
    return `${level.label}取最近20个周期里的最高价，代表这一段震荡区间的上沿，价格接近这里时容易遇到抛压或需要放量突破。`;
  }
  if (level.label.includes("前低")) {
    return `${level.label}来自近期局部低点${level.date ? `（${level.date}）` : ""}，说明这里曾经有资金承接，后续回踩需要观察是否再次有效。`;
  }
  if (level.label.includes("前高")) {
    return `${level.label}来自近期局部高点${level.date ? `（${level.date}）` : ""}，说明这里曾经出现过获利盘或套牢盘压力。`;
  }
  return `${level.label}是系统根据近期价格结构自动识别的${side}，需要结合成交量和均线方向一起判断。`;
}

function levelTradeHint(level: TechnicalLevel) {
  if (level.kind === "support") {
    return "交易理解：接近支撑不等于立刻买入，更适合等止跌、缩量或重新站回短均线后分批确认。";
  }
  return "交易理解：接近压力不等于立刻卖出，但如果放量失败或长上影，应降低追高和一次性加仓的冲动。";
}
</script>
