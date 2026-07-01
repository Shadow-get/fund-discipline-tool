<template>
  <section class="metric-card" :class="tone">
    <span class="metric-label">{{ label }}</span>
    <strong>{{ value }}</strong>
    <small v-if="detail">{{ detail }}</small>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "good" | "warn" | "danger";
}>();
</script>
