<template>
  <div class="section-heading">
    <div>
      <span class="eyebrow">{{ eyebrow }}</span>
      <h2>{{ title }}</h2>
    </div>
    <span v-if="note" class="data-note">{{ note }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow: string;
  title: string;
  note?: string;
}>();
</script>
