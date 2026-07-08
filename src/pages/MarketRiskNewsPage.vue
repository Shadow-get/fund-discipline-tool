<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">危机征兆</span>
          <h2>泡沫与衰退新闻雷达</h2>
        </div>
        <div class="action-row">
          <RiskBadge :label="news?.overallRisk.label ?? '未扫描'" :kind="news?.overallRisk.level ?? 'neutral'" />
          <button type="button" class="primary-button" :disabled="loading" @click="loadNews(false)">
            {{ loading ? "捕获中..." : "刷新新闻信号" }}
          </button>
        </div>
      </div>

      <div class="metric-grid">
        <MetricCard label="综合风险" :value="news?.overallRisk.score ?? 0" :detail="news?.overallRisk.label ?? '等待捕获'" :tone="news?.overallRisk.level ?? 'neutral'" />
        <MetricCard label="命中新闻" :value="signalItems.length" detail="含风险关键词的新闻" />
        <MetricCard label="信号类别" :value="activeSignals" detail="六类历史征兆" :tone="activeSignals >= 3 ? 'warn' : 'neutral'" />
        <MetricCard label="新闻源" :value="sourceCount" detail="官方RSS源" />
      </div>

      <div class="status-strip">
        <span>数据来源：{{ news?.source ?? "-" }}</span>
        <span>更新时间：{{ updatedAt || "-" }}</span>
        <span>{{ news?.message }}</span>
      </div>
      <p class="data-warning">
        1929 和 2000 不是机械预测模板；这里抽象为投机狂热、杠杆扩张、流动性转向、信用压力、盈利证据变差、市场宽度变窄六类征兆。命中越多，越应降低追高和杠杆冲动。
      </p>
      <p v-if="error" class="error-text">{{ error }}</p>
    </section>

    <section class="risk-conclusion-panel" :class="news?.overallRisk.level ?? 'neutral'">
      <div>
        <span class="eyebrow">今日结论</span>
        <h2>{{ news?.conclusion ?? "等待新闻扫描完成。" }}</h2>
        <p>{{ news?.action ?? "扫描后会直接给出风险判断和操作节奏建议。" }}</p>
      </div>
      <ul>
        <li v-for="reason in news?.reasons ?? []" :key="reason">{{ reason }}</li>
      </ul>
    </section>

    <ExplanationCard
      conclusion="这个模块监控的是风险聚集，不预测哪一天崩盘。"
      reason="1929年前的保证金交易和投机狂热、2000年前互联网估值叙事和盈利兑现不足，都说明泡沫尾部通常不是单一信号，而是估值、杠杆、流动性、信用和盈利同时恶化。"
      benefit="把新闻转成结构化信号后，可以帮助你判断当前是否应该降低追高、减少主题仓、提高现金和等待回踩。"
      risk="新闻关键词会有误判，且官方RSS覆盖面有限。真实判断仍需要结合估值、市场宽度、信用利差、美债收益率、财报和价格走势。"
      trigger="当三类以上信号同时升温，尤其是流动性转向 + 信用压力 + 盈利下修同时出现时，应进入风险控制模式。"
    />

    <section>
      <SectionTitle eyebrow="Signals" title="今日征兆摘要" note="按历史危机前常见线索归类" />
      <div class="risk-signal-grid">
        <article v-for="signal in news?.signalSummary ?? []" :key="signal.key" :class="{ active: signal.count }">
          <span>{{ signal.name }}</span>
          <strong>{{ signal.count ?? 0 }}</strong>
          <p>{{ signal.history }}</p>
        </article>
      </div>
    </section>

    <section>
      <SectionTitle eyebrow="News" title="命中新闻" note="只展示与风险模板有关的条目" />
      <div v-if="signalItems.length" class="news-risk-list">
        <article v-for="item in signalItems" :key="`${item.source}-${item.title}`">
          <header>
            <div>
              <span class="eyebrow">{{ item.source }} · {{ formatDate(item.publishedAt) }}</span>
              <h3>{{ item.takeaway || item.title }}</h3>
            </div>
            <RiskBadge :label="`${item.riskScore}分`" :kind="item.riskScore >= 36 ? 'warn' : 'neutral'" />
          </header>
          <p>{{ item.title }}</p>
          <div class="compact-list">
            <span v-for="signal in item.signals" :key="signal.key">{{ signal.name }} · {{ signal.hits?.join(" / ") }}</span>
          </div>
          <a v-if="item.url" :href="item.url" target="_blank" rel="noreferrer">打开来源</a>
        </article>
      </div>
      <p v-else class="empty-note">当前新闻源未命中明显危机征兆关键词，继续观察流动性、信用和盈利数据。</p>
    </section>

    <section>
      <SectionTitle eyebrow="History" title="历史模板" note="用于提醒，不用于机械预测" />
      <div class="risk-template-grid">
        <article v-for="template in news?.templates ?? []" :key="template.key">
          <strong>{{ template.name }}</strong>
          <p>{{ template.history }}</p>
          <small>{{ template.keywords.slice(0, 8).join(" / ") }}</small>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import ExplanationCard from "../components/ExplanationCard.vue";
import MetricCard from "../components/MetricCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { fetchMarketRiskNews } from "../services/marketRiskNewsData";
import type { MarketRiskNewsResponse } from "../types";

const news = ref<MarketRiskNewsResponse | null>(null);
const loading = ref(false);
const error = ref("");

const signalItems = computed(() => (news.value?.items ?? []).filter((item) => item.signals.length));
const activeSignals = computed(() => (news.value?.signalSummary ?? []).filter((signal) => (signal.count ?? 0) > 0).length);
const sourceCount = computed(() => new Set((news.value?.items ?? []).map((item) => item.source)).size);
const updatedAt = computed(() => {
  if (!news.value?.updatedAt) return "";
  return new Date(news.value.updatedAt).toLocaleString("zh-CN", { hour12: false });
});

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "-";
  return date.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function loadNews(forceFallback: boolean) {
  loading.value = true;
  error.value = "";
  try {
    news.value = await fetchMarketRiskNews(forceFallback);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "新闻风险捕获失败";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  void loadNews(false);
});
</script>
