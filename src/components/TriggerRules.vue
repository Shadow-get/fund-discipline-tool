<template>
  <section class="trigger-rules">
    <h3>{{ title }}</h3>
    <ul>
      <li v-for="rule in rules" :key="rule">{{ rule }}</li>
    </ul>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  rules: string[];
}>();
</script>
