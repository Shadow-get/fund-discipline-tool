<template>
  <section>
    <div class="section-heading">
      <div>
        <span class="eyebrow">执行记录</span>
        <h2>本周提交信息</h2>
      </div>
      <span class="data-note">记录会用于判断本周是否已经完成加仓</span>
    </div>

    <div v-if="logs.length" class="execution-log-list">
      <article v-for="log in logs" :key="log.id" class="execution-log-item">
        <div>
          <strong>{{ log.code }} · {{ log.name }}</strong>
          <span>{{ log.executedAt }} · {{ log.note }}</span>
        </div>
        <b>{{ money(log.amount) }}</b>
        <button type="button" class="ghost-button danger" @click="emit('delete', log.id)">撤销</button>
      </article>
    </div>
    <p v-else class="empty-note">本周还没有提交执行记录。</p>
  </section>
</template>

<script setup lang="ts">
import type { ExecutionLog } from "../../types";
import { money } from "../../utils/format";

defineProps<{
  logs: ExecutionLog[];
}>();

const emit = defineEmits<{
  delete: [id: string];
}>();
</script>
