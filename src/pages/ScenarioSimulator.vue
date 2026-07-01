<template>
  <main class="page-stack">
    <section>
      <div class="section-heading">
        <div>
          <span class="eyebrow">预案</span>
          <h2>回调加仓与高位减仓模拟器</h2>
        </div>
        <span class="data-note">提前写规则，避免下跌时临时决定</span>
      </div>

      <div class="form-grid">
        <label>等待资金 <input v-model.number="reserve" type="number" step="1000" /></label>
        <label>月定投原计划 <input v-model.number="monthlyDca" type="number" step="100" /></label>
        <label>当前目标仓位 <input v-model.number="targetWeight" type="number" min="0" max="100" /></label>
        <label>当前实际仓位 <input v-model.number="currentWeight" type="number" min="0" max="100" /></label>
      </div>
    </section>

    <section class="scenario-grid">
      <article>
        <span class="eyebrow">回调10%</span>
        <h3>恢复正常定投</h3>
        <strong>{{ money(monthlyDca) }}</strong>
        <p>不动用大量等待资金，只把降速定投恢复到原计划。</p>
      </article>
      <article>
        <span class="eyebrow">回调20%</span>
        <h3>动用30%等待资金</h3>
        <strong>{{ money(reserve * 0.3) }}</strong>
        <p>分2-4周补入，前提是产业和盈利逻辑没有破坏。</p>
      </article>
      <article>
        <span class="eyebrow">回调30%</span>
        <h3>动用剩余资金分批</h3>
        <strong>{{ money(reserve * 0.7) }}</strong>
        <p>分6-12周执行，避免一次性猜底。</p>
      </article>
      <article>
        <span class="eyebrow">上涨超配</span>
        <h3>{{ overTarget ? "启动再平衡" : "继续观察" }}</h3>
        <strong>{{ overTarget ? "月度减仓" : "不卖" }}</strong>
        <p>只有实际仓位超过目标120%时，才提示月度再平衡。</p>
      </article>
    </section>

    <TriggerRules
      title="触发规则"
      :rules="[
        '回调不是自动满仓，先确认产业和盈利逻辑没有破坏。',
        '等待资金只在触发条件出现时使用，不因为焦虑提前打光。',
        '高位减仓卖到目标仓位或底仓，不做情绪化清仓。',
      ]"
    />
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import TriggerRules from "../components/TriggerRules.vue";
import { money } from "../utils/format";

const reserve = ref(30000);
const monthlyDca = ref(3000);
const targetWeight = ref(25);
const currentWeight = ref(28);
const overTarget = computed(() => currentWeight.value > targetWeight.value * 1.2);
</script>
