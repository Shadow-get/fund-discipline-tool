<template>
  <section>
    <details class="advanced-settings holdings-editor" open>
      <summary>持仓代码与成本维护</summary>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>代码</th>
              <th>名称</th>
              <th>资产桶</th>
              <th>成本</th>
              <th>市值</th>
              <th>手动涨跌%</th>
              <th>桶内权重</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="holding in holdings" :key="holding.id">
              <td><input v-model="holding.code" /></td>
              <td><input v-model="holding.name" /></td>
              <td>
                <select v-model="holding.bucket">
                  <option v-for="bucket in bucketOptions" :key="bucket" :value="bucket">{{ bucketLabels[bucket] }}</option>
                </select>
              </td>
              <td><input v-model.number="holding.costAmount" type="number" min="0" step="100" /></td>
              <td><input v-model.number="holding.marketValue" type="number" min="0" step="100" /></td>
              <td><input v-model.number="holding.todayReturnPct" type="number" step="0.01" /></td>
              <td><input v-model.number="holding.bucketShare" type="number" min="0" step="0.1" /></td>
              <td><button type="button" class="ghost-button danger" @click="emit('remove', holding.id)">删除</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="primary-button add-holding-button" @click="emit('add')">新增持仓</button>
    </details>
  </section>
</template>

<script setup lang="ts">
import type { AssetBucket, HoldingItem } from "../../types";

type HoldingBucket = Exclude<AssetBucket, "reserve">;

defineProps<{
  holdings: HoldingItem[];
  bucketOptions: HoldingBucket[];
  bucketLabels: Record<string, string>;
}>();

const emit = defineEmits<{
  add: [];
  remove: [id: string];
}>();
</script>
