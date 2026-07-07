<template>
  <div v-if="notices.length" class="toast-region" aria-live="polite">
    <article v-for="notice in notices" :key="notice.id" class="toast" :class="notice.kind">
      <strong>{{ notice.title }}</strong>
      <span>{{ notice.message }}</span>
      <button type="button" @click="emit('dismiss', notice.id)">关闭</button>
    </article>
  </div>
</template>

<script setup lang="ts">
import type { Notice } from "../../types";

defineProps<{
  notices: Notice[];
}>();

const emit = defineEmits<{
  dismiss: [id: string];
}>();
</script>
