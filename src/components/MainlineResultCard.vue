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
      <MetricCard label="20日" :value="`${item.returns20}%`" />
      <MetricCard label="60日" :value="`${item.returns60}%`" />
      <MetricCard label="120日" :value="`${item.returns120}%`" />
      <MetricCard label="热度" :value="score(item.heatScore)" :tone="item.heatScore >= 80 ? 'warn' : 'neutral'" />
    </div>

    <dl class="evidence-grid">
      <div>
        <dt>资金证据</dt>
        <dd>{{ item.evidence.fund }}</dd>
      </div>
      <div>
        <dt>强弱证据</dt>
        <dd>{{ item.evidence.strength }}</dd>
      </div>
      <div>
        <dt>估值/热度</dt>
        <dd>{{ item.evidence.heat }}</dd>
      </div>
      <div>
        <dt>产业/政策</dt>
        <dd>{{ item.evidence.policy }}</dd>
      </div>
    </dl>

    <div class="profile-panel">
      <div>
        <strong>产业链</strong>
        <p>{{ profile.industryChain.join(" / ") }}</p>
      </div>
      <div>
        <strong>代表环节/公司</strong>
        <p>{{ profile.representatives.join("、") }}</p>
      </div>
      <div>
        <strong>主线逻辑</strong>
        <p>{{ profile.coreLogic }}</p>
      </div>
      <div>
        <strong>为什么不直接重仓</strong>
        <p>{{ profile.whyNotHeavy }}</p>
      </div>
    </div>

    <div class="review-panel">
      <strong>复盘看什么</strong>
      <ul>
        <li v-for="focus in profile.reviewFocus" :key="focus">{{ focus }}</li>
      </ul>
    </div>

    <footer>
      <span>{{ item.action }}</span>
      <span>{{ item.suggestedSatelliteRatio }}</span>
      <small>{{ item.source }}</small>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { MainlineScanItem } from "../types";
import { getMainlineProfile } from "../data/mainlineKnowledge";
import MetricCard from "./MetricCard.vue";
import RiskBadge from "./RiskBadge.vue";
import { score } from "../utils/format";

const props = defineProps<{
  item: MainlineScanItem;
}>();

const profile = computed(() => getMainlineProfile(props.item));

const badgeKind = computed(() => {
  if (props.item.status === "主线候选") return "good";
  if (props.item.status === "过热等待") return "warn";
  if (props.item.status === "暂不进入") return "danger";
  return "neutral";
});
</script>
