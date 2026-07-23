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

    <div class="mainline-decision-grid">
      <article>
        <span>{{ decisionTitle }}</span>
        <strong>{{ decisionVerdict }}</strong>
        <p>{{ decisionReason }}</p>
      </article>
      <article>
        <span>信号拆解</span>
        <strong>{{ signalSummary.title }}</strong>
        <p>{{ signalSummary.detail }}</p>
      </article>
      <article>
        <span>成为主线还差什么</span>
        <strong>{{ upgradeCondition.title }}</strong>
        <p>{{ upgradeCondition.detail }}</p>
      </article>
    </div>

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
import { getMainlineStatusKind } from "../services/mainlineData";

const props = defineProps<{
  item: MainlineScanItem;
}>();

const profile = computed(() => getMainlineProfile(props.item));
const statusKind = computed(() => getMainlineStatusKind(props.item));

const badgeKind = computed(() => {
  if (props.item.status === "主线候选") return "good";
  if (props.item.status === "过热等待") return "warn";
  if (props.item.status === "暂不进入") return "danger";
  return "neutral";
});

const decisionTitle = computed(() => {
  if (statusKind.value === "top") return "为什么是主线候选";
  if (statusKind.value === "watch") return "为什么只是观察";
  if (statusKind.value === "overheated") return "为什么不能追";
  return "为什么暂不进入";
});

const decisionVerdict = computed(() => {
  if (statusKind.value === "top") return "资金、强弱和热度同时达标";
  if (statusKind.value === "watch") return "有线索，但证据链没有闭合";
  if (statusKind.value === "overheated") return "逻辑可能成立，但价格纪律不允许";
  return "趋势、资金或赔率不足";
});

const signalSummary = computed(() => {
  const shortTerm = props.item.returns20 > 8 ? "短线强" : props.item.returns20 > 0 ? "短线修复" : "短线偏弱";
  const midTerm = props.item.returns60 > 12 ? "中期强" : props.item.returns60 > 0 ? "中期修复" : "中期未确认";
  const longTerm = props.item.returns120 > 15 ? "长周期强" : props.item.returns120 > 0 ? "长周期一般" : "长周期仍弱";
  const heat =
    props.item.heatScore >= 86 || props.item.valuationPercentile >= 88
      ? "热度/拥挤过高"
      : props.item.heatScore >= 70
        ? "热度偏高"
        : "热度可控";
  return {
    title: `${shortTerm} · ${midTerm} · ${longTerm}`,
    detail: `20/60/120日收益分别为 ${props.item.returns20}% / ${props.item.returns60}% / ${props.item.returns120}%，热度 ${props.item.heatScore} 分、估值/拥挤 ${props.item.valuationPercentile}%。系统把它和沪深300做相对强弱比较后，再扣除高热度追涨风险。`,
  };
});

const decisionReason = computed(() => {
  if (props.item.candidateId === "theme_brokerage") {
    return "证券ETF更像风险偏好和成交额修复的弹性代理，不是AI、半导体那种产业基础设施主线。短期涨幅和资金线索存在，但120日仍为负，说明中期趋势还没有完全扭转，所以只能放在观察区。";
  }
  if (props.item.category === "海外") {
    return "海外宽基可以是账户长期核心配置，但主线雷达只判断是否适合用卫星仓加速买入。没有明显跑赢和资金共振时，仍可能显示暂不进入卫星机会。";
  }
  if (statusKind.value === "watch") {
    return `${props.item.reason} 现在更像“候选方向”，还需要成交、相对强弱和估值热度继续配合。`;
  }
  if (statusKind.value === "overheated") {
    return `${props.item.reason} 当前主要问题不是产业逻辑，而是热度和估值拥挤已经挤压安全边际。`;
  }
  if (statusKind.value === "top") {
    return `${props.item.reason} 但它也只适合作为卫星仓，不能替代核心宽基。`;
  }
  return `${props.item.reason} 不进入不是否定长期逻辑，而是当前没有给出足够好的价格和趋势组合。`;
});

const upgradeCondition = computed(() => {
  if (statusKind.value === "overheated") {
    return {
      title: "先等降温",
      detail: "热度降回70分附近、估值拥挤回落，且回调后相对强弱没有破坏，再考虑恢复卫星仓买入。",
    };
  }
  if (statusKind.value === "watch") {
    return {
      title: props.item.candidateId === "theme_brokerage" ? "成交额和指数共振" : "强弱和盈利验证",
      detail:
        props.item.candidateId === "theme_brokerage"
          ? "需要市场成交额持续放大、两融/风险偏好改善、指数突破后不快速回落，并且120日收益转正，才更像券商贝塔主线。"
          : "需要20/60/120日趋势更连续、相对宽基强弱维持、热度不过高，并且产业订单或财报能验证。",
    };
  }
  if (statusKind.value === "top") {
    return {
      title: "保持主线资格",
      detail: "继续看成交额、相对强弱、财报/订单兑现和热度分位；如果放量滞涨或估值过热，就从主线降为观察。",
    };
  }
  return {
    title: "重新进入条件",
    detail: "至少需要资金代理、20/60日相对强弱和趋势结构同步修复；单日反弹不足以进入卫星仓。",
  };
});
</script>
