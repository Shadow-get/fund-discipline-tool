<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">估值纪律</span>
          <h2>低估值板块</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="modeLabel" :kind="scan?.mode === 'model' ? 'good' : 'neutral'" />
          <button type="button" class="primary-button" :disabled="loading" @click="loadScan">
            {{ loading ? "扫描中..." : "刷新低估扫描" }}
          </button>
        </div>
      </div>

      <div class="metric-grid">
        <MetricCard label="候选数量" :value="scan?.results.length ?? 0" detail="宽基/红利/消费/医药/港股" />
        <MetricCard label="低估可定投" :value="groups.top.length" detail="安全边际和质量同时合格" tone="good" />
        <MetricCard label="低估观察" :value="groups.watch.length" detail="便宜但需要确认" />
        <MetricCard label="便宜但需验证" :value="groups.trap.length" detail="低估不等于重仓" tone="warn" />
      </div>

      <div class="status-strip">
        <span>数据来源：{{ scan?.source ?? "-" }}</span>
        <span>无风险收益率假设：{{ scan?.riskFreeYield ?? 0 }}%</span>
        <span>更新时间：{{ updatedAt || "-" }}</span>
        <span>{{ scan?.message }}</span>
      </div>
      <p class="data-warning">
        当前低估值模块使用内置估值样本，适合验证算法和纪律流程；真实投资前需要替换为最新 PE/PB、股息率、盈利增速和财报数据。
      </p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <ExplanationCard
      :conclusion="valuationConclusion"
      :reason="valuationReason"
      :benefit="valuationBenefit"
      :risk="valuationRisk"
      :trigger="valuationTrigger"
    />

    <section>
      <SectionTitle eyebrow="Formula" title="公式来源" note="把指数基金方法论工程化，不等同于真实投顾模型" />
      <div class="compact-list method-list">
        <span v-for="method in scan?.methodology ?? []" :key="method">{{ method }}</span>
      </div>
    </section>

    <section v-if="groups.top.length">
      <SectionTitle eyebrow="Buy List" title="低估可定投" note="仍然只适合分批，不适合一次性满仓" />
      <div class="mainline-results">
        <LowValuationResultCard v-for="item in groups.top" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section v-if="groups.watch.length">
      <SectionTitle eyebrow="Watch" title="低估观察" note="价格有折价，但盈利或趋势确认还不充分" />
      <div class="mainline-results">
        <LowValuationResultCard v-for="item in groups.watch" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section v-if="groups.trap.length">
      <SectionTitle eyebrow="Trap" title="便宜但需验证" note="低 PE 可能来自盈利下修或产业逻辑恶化" />
      <div class="mainline-results">
        <LowValuationResultCard v-for="item in groups.trap" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section v-if="groups.fair.length">
      <SectionTitle eyebrow="Fair" title="暂不进入区" note="折价不足或风险调整后赔率不够" />
      <div class="compact-list">
        <span v-for="item in groups.fair" :key="item.candidateId">{{ item.name }} · {{ item.score }}分</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import LowValuationResultCard from "../components/LowValuationResultCard.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { fetchLowValuationScan, pickActionableLowValuation, splitLowValuationGroups } from "../services/lowValuationData";
import type { LowValuationScanResponse } from "../types";

const scan = ref<LowValuationScanResponse | null>(null);
const loading = ref(false);
const error = ref("");

const groups = computed(() => splitLowValuationGroups(scan.value?.results ?? []));
const topAction = computed(() => pickActionableLowValuation(scan.value?.results ?? []));

const modeLabel = computed(() => {
  if (!scan.value) return "未扫描";
  if (scan.value.mode === "model") return "估值模型";
  if (scan.value.mode === "fallback") return "内置快照";
  return "数据异常";
});

const updatedAt = computed(() => {
  if (!scan.value?.updatedAt) return "";
  return new Date(scan.value.updatedAt).toLocaleString("zh-CN", { hour12: false });
});

const valuationConclusion = computed(() => {
  if (!scan.value) return "正在读取低估值池，先不做结论。";
  if (topAction.value) return `当前优先低估方向：${topAction.value.name}，但只适合分批和仓位约束。`;
  if (groups.value.trap.length) return "有便宜方向，但多数仍需验证基本面，不适合因为低估值直接重仓。";
  return "当前没有足够清晰的低估值机会，等待估值或盈利证据改善。";
});

const valuationReason = computed(() => {
  if (!topAction.value) return "模型没有找到估值折价、盈利收益率、质量和风险同时合格的候选。";
  return `${topAction.value.reason} ${topAction.value.evidence.valuation} ${topAction.value.evidence.dividend}`;
});

const valuationBenefit = computed(() => {
  if (!topAction.value) return "把低估池和主线池分开，可以避免只追强势，也避免只因便宜买入逻辑变差的资产。";
  return `${topAction.value.action}；建议比例：${topAction.value.suggestedRatio}。`;
});

const valuationRisk = computed(() => {
  if (!topAction.value) return "低估可能持续很久，甚至来自盈利恶化；需要等待财报、现金流和资金趋势确认。";
  return `${topAction.value.evidence.risk} 低估值资产可能长期不涨，仓位应由安全边际和基本面验证共同决定。`;
});

const valuationTrigger = computed(() => {
  if (!topAction.value) return "PE/PB 分位继续下行、股息率上升、盈利不再下修，或资金重新流入时再提高定投。";
  return "分批条件：估值仍在低位、盈利没有继续恶化、股息或现金流可持续；暂停条件：盈利下修、行业逻辑破坏或估值修复后安全边际消失。";
});

async function loadScan() {
  loading.value = true;
  error.value = "";
  try {
    scan.value = await fetchLowValuationScan();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "低估值扫描失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadScan();
});
</script>
