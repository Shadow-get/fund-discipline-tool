<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">每日一课</span>
          <h2>金融知识与大师方法</h2>
          <p>每天轮换一个宏观金融、价值投资或生活金融概念，把投资动作和底层原理连接起来。</p>
        </div>
        <RiskBadge :label="lesson.category" kind="neutral" />
      </div>

      <article class="lesson-hero">
        <span class="eyebrow">{{ lesson.teacher }}</span>
        <h3>{{ lesson.title }}</h3>
        <p>{{ lesson.summary }}</p>
      </article>
    </section>

    <section>
      <SectionTitle eyebrow="Today" title="今天学什么" note="不是行情预测，而是建立长期可复用的判断框架" />
      <div class="lesson-grid">
        <article>
          <span>核心概念</span>
          <p>{{ lesson.concept }}</p>
        </article>
        <article>
          <span>生活例子</span>
          <p>{{ lesson.dailyExample }}</p>
        </article>
        <article>
          <span>怎么用到投资</span>
          <p>{{ lesson.investorUse }}</p>
        </article>
        <article>
          <span>常见错误</span>
          <p>{{ lesson.mistake }}</p>
        </article>
      </div>
    </section>

    <ExplanationCard
      conclusion="今天只练一个动作"
      :reason="lesson.action"
      benefit="长期看，稳定的投资能力来自可重复的判断框架，而不是每天追不同的故事。"
      risk="任何大师方法都不能机械套用；巴菲特、芒格、段永平更强调能力圈、现金流和长期赔率，不代表所有低估资产都值得买。"
      trigger="把今天这条规则写进你的观察清单，下次看到相似资产时先用它过滤一遍。"
    />

    <section>
      <SectionTitle eyebrow="Library" title="课程库" note="后续可以继续扩充宏观、估值、财报、周期和行为金融" />
      <div class="compact-list">
        <span v-for="item in lessons" :key="item.id">{{ item.category }} · {{ item.title }}</span>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import ExplanationCard from "../components/ExplanationCard.vue";
import RiskBadge from "../components/RiskBadge.vue";
import SectionTitle from "../components/SectionTitle.vue";
import { financialLessons, getLessonForDate } from "../data/financialLessons";

const lesson = getLessonForDate();
const lessons = financialLessons;
</script>
