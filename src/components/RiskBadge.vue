<template>
  <span class="risk-badge" :class="kind">{{ label }}</span>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  kind?: "neutral" | "good" | "warn" | "danger";
}>();
</script>
