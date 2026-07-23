<template>
  <article class="mainline-card">
    <header>
      <div>
        <span class="eyebrow">{{ item.category }} · {{ item.stage }}</span>
        <h3>{{ item.name }}</h3>
        <p>{{ item.reason }}</p>
      </div>
      <div class="mainline-score">
        <strong>{{ score(item.score) }}</strong>
        <RiskBadge :label="item.status" :kind="badgeKind" />
      </div>
    </header>

    <div class="mainline-metrics">
      <MetricCard :label="item.dynamic ? 'PE动态分位' : 'PE分位'" :value="`${item.pePercentile}%`" :detail="`PE ${item.pe}`" />
      <MetricCard :label="item.dynamic ? 'PB动态分位' : 'PB分位'" :value="`${item.pbPercentile}%`" :detail="`PB ${item.pb}`" />
      <MetricCard label="盈利收益率" :value="`${item.earningsYield}%`" :detail="`利差 ${item.earningsYieldSpread}%`" tone="good" />
      <MetricCard
        v-if="item.dynamic"
        label="涨跌/换手"
        :value="`${signedPct(item.dailyChangePct)}%`"
        :detail="`换手 ${item.turnoverRate ?? 0}%`"
        :tone="changeTone(item.dailyChangePct)"
      />
      <MetricCard v-else label="股息率" :value="`${item.dividendYield}%`" :detail="`ROE ${item.roe}%`" />
    </div>

    <dl class="evidence-grid">
      <div>
        <dt>估值证据</dt>
        <dd>{{ item.evidence.valuation }}</dd>
      </div>
      <div>
        <dt>分红与质量</dt>
        <dd>{{ item.evidence.dividend }}</dd>
      </div>
      <div>
        <dt>周期位置</dt>
        <dd>{{ item.evidence.cycle }}</dd>
      </div>
      <div>
        <dt>最大问题</dt>
        <dd>{{ item.evidence.risk }}</dd>
      </div>
    </dl>

    <div class="profile-panel">
      <div>
        <strong>价值分</strong>
        <p>{{ score(item.valueScore) }}，主要由 PE/PB 分位、股息率和盈利收益率利差构成。</p>
      </div>
      <div>
        <strong>质量分</strong>
        <p>{{ score(item.qualityScore) }}，用于避免只买便宜但盈利持续恶化的方向。</p>
      </div>
      <div>
        <strong>安全边际</strong>
        <p>{{ score(item.marginOfSafety) }}，低估越明显且逻辑风险越低，安全边际越高。</p>
      </div>
      <div>
        <strong>逻辑风险</strong>
        <p>{{ score(item.logicRiskScore) }}，风险越高越不能因为便宜直接重仓。</p>
      </div>
    </div>

    <footer>
      <span>{{ item.action }}</span>
      <span>{{ item.suggestedRatio }}</span>
      <button type="button" class="ghost-button" @click="emit('open-report', item)">研究报告</button>
      <small>{{ item.source }}</small>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { LowValuationScanItem } from "../types";
import MetricCard from "./MetricCard.vue";
import RiskBadge from "./RiskBadge.vue";
import { score } from "../utils/format";

const props = defineProps<{
  item: LowValuationScanItem;
}>();

const emit = defineEmits<{
  "open-report": [item: LowValuationScanItem];
}>();

const badgeKind = computed(() => {
  if (props.item.statusKey === "top") return "good";
  if (props.item.statusKey === "trap") return "warn";
  if (props.item.statusKey === "fair") return "danger";
  return "neutral";
});

function signedPct(value = 0) {
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function changeTone(value = 0): "neutral" | "good" | "warn" | "danger" {
  if (value >= 0) return "good";
  if (value <= -3) return "danger";
  return "warn";
}
</script>
