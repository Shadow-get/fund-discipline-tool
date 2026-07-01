<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">资金方向</span>
          <h2>当年主线雷达</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="modeLabel" :kind="scan?.mode === 'live' ? 'good' : scan?.mode === 'cache' ? 'warn' : 'neutral'" />
          <button type="button" class="primary-button" :disabled="loading" @click="loadScan(false)">
            {{ loading ? "扫描中..." : "刷新主线扫描" }}
          </button>
        </div>
      </div>

      <div class="metric-grid">
        <MetricCard label="候选数量" :value="scan?.results.length ?? 0" detail="宽基/风格/行业/海外" />
        <MetricCard label="主线候选" :value="groups.top.length" detail="可进入卫星仓候选" tone="good" />
        <MetricCard label="观察区" :value="groups.watch.length" detail="证据链未完全闭合" />
        <MetricCard label="过热等待" :value="groups.overheated.length" detail="资金强但安全边际不足" tone="warn" />
      </div>

      <div class="status-strip">
        <span>数据来源：{{ scan?.source ?? "-" }}</span>
        <span>更新时间：{{ updatedAt || "-" }}</span>
        <span>{{ scan?.message }}</span>
      </div>
      <p v-if="scan && scan.mode !== 'live'" class="data-warning">
        当前不是实时公开行情：{{ scan.mode === "cache" ? "正在使用最近缓存" : "正在使用内置快照" }}。结论可以用于演示纪律流程，但真实投资前要刷新数据。
      </p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <ExplanationCard
      :conclusion="mainlineConclusion"
      :reason="mainlineReason"
      :benefit="mainlineBenefit"
      :risk="mainlineRisk"
      :trigger="mainlineTrigger"
    />

    <section v-if="topAction">
      <SectionTitle eyebrow="Decision" title="当前优先主线" note="只作为卫星仓参考，不替代核心宽基" />
      <div class="decision-panel">
        <div>
          <span class="eyebrow">{{ topAction.category }} · {{ topAction.stage }}</span>
          <h3>{{ topAction.name }}</h3>
          <p>{{ activeProfile.coreLogic }}</p>
        </div>
        <dl>
          <div>
            <dt>周期位置</dt>
            <dd>{{ activeProfile.cyclePosition }}</dd>
          </div>
          <div>
            <dt>宏观风险</dt>
            <dd>{{ activeProfile.macroRisk }}</dd>
          </div>
          <div>
            <dt>买入规则</dt>
            <dd>{{ activeProfile.buyRule }}</dd>
          </div>
          <div>
            <dt>暂停规则</dt>
            <dd>{{ activeProfile.pauseRule }}</dd>
          </div>
        </dl>
      </div>
    </section>

    <section v-if="groups.top.length">
      <SectionTitle eyebrow="Top" title="主线候选" note="可作为当年主线卫星仓候选，但仍需分批" />
      <div class="mainline-results">
        <MainlineResultCard v-for="item in groups.top" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section v-if="groups.watch.length">
      <SectionTitle eyebrow="Watch" title="观察区" note="有线索，但资金、强弱或热度条件还不完整" />
      <div class="mainline-results">
        <MainlineResultCard v-for="item in groups.watch.slice(0, 12)" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section v-if="groups.overheated.length">
      <SectionTitle eyebrow="Heat" title="过热区" note="不是看好就追高，先等安全边际回来" />
      <div class="mainline-results">
        <MainlineResultCard v-for="item in groups.overheated.slice(0, 12)" :key="item.candidateId" :item="item" />
      </div>
    </section>

    <section>
      <SectionTitle eyebrow="Rejected" title="暂不进入区" note="低分候选不进入主线仓位" />
      <div class="compact-list">
        <span v-for="item in groups.rejected.slice(0, 28)" :key="item.candidateId">{{ item.name }} · {{ item.score }}分</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MainlineResultCard from "../components/MainlineResultCard.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { getMainlineProfile } from "../data/mainlineKnowledge";
import { fetchMainlineScan, pickActionableMainline, splitMainlineGroups } from "../services/mainlineData";
import type { MainlineScanResponse } from "../types";

const scan = ref<MainlineScanResponse | null>(null);
const loading = ref(false);
const error = ref("");

const groups = computed(() => splitMainlineGroups(scan.value?.results ?? []));
const topAction = computed(() => pickActionableMainline(scan.value?.results ?? []));
const activeProfile = computed(() => getMainlineProfile(topAction.value));

const modeLabel = computed(() => {
  if (!scan.value) return "未扫描";
  if (scan.value.mode === "live") return "公开数据";
  if (scan.value.mode === "cache") return "缓存数据";
  if (scan.value.mode === "fallback") return "内置快照";
  return "数据异常";
});

const updatedAt = computed(() => {
  if (!scan.value?.updatedAt) return "";
  return new Date(scan.value.updatedAt).toLocaleString("zh-CN", { hour12: false });
});

const mainlineConclusion = computed(() => {
  if (!scan.value) return "正在扫描公开行情，先不做主线结论。";
  if (topAction.value) return `当前优先主线：${topAction.value.name}，建议只进入卫星仓。`;
  if (groups.value.overheated.length) return "有热门方向，但多数处在过热等待区，本月不适合追高。";
  return "当前没有足够清晰的主线，卫星仓以等待为主。";
});

const mainlineReason = computed(() => {
  if (!topAction.value) {
    return "系统没有找到资金方向、相对强弱、趋势持续性和估值热度同时合格的候选。";
  }

  return `${topAction.value.reason} ${topAction.value.evidence.fund} ${topAction.value.evidence.strength}`;
});

const mainlineBenefit = computed(() => {
  if (!topAction.value) return "不硬买主题可以保留现金流弹性，等主线和价格都更清楚时再出手。";
  return `${activeProfile.value.coreLogic} 建议动作：${topAction.value.action}；比例：${topAction.value.suggestedSatelliteRatio}。`;
});

const mainlineRisk = computed(() => {
  if (!topAction.value) return "风险是空仓等待可能短期跑输，但可以避免在没有安全边际时追热点。";
  return `${topAction.value.evidence.heat} ${activeProfile.value.whyNotHeavy}`;
});

const mainlineTrigger = computed(() => {
  if (!topAction.value) return "出现主线候选、观察区候选回调后资金继续确认，或热度回到合理区，再恢复卫星仓买入。";
  return `${activeProfile.value.buyRule} ${activeProfile.value.pauseRule}`;
});

async function loadScan(forceFallback: boolean) {
  loading.value = true;
  error.value = "";
  try {
    scan.value = await fetchMainlineScan(forceFallback);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "主线扫描失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadScan(false);
});
</script>
