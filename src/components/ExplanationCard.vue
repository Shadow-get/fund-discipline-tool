<template>
  <section class="explanation-card">
    <div>
      <span class="eyebrow">结论</span>
      <h3>{{ conclusion }}</h3>
    </div>
    <dl>
      <div>
        <dt>原因</dt>
        <dd>{{ reason }}</dd>
      </div>
      <div>
        <dt>好处</dt>
        <dd>{{ benefit }}</dd>
      </div>
      <div>
        <dt>风险</dt>
        <dd>{{ risk }}</dd>
      </div>
      <div>
        <dt>触发条件</dt>
        <dd>{{ trigger }}</dd>
      </div>
    </dl>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  conclusion: string;
  reason: string;
  benefit: string;
  risk: string;
  trigger: string;
}>();
</script>
