<template>
  <div class="table-wrap">
    <table class="allocation-table">
      <thead>
        <tr>
          <th>资产桶</th>
          <th>当前标的</th>
          <th>目标比例</th>
          <th>目标金额</th>
          <th>本月执行</th>
          <th>转入等待资金</th>
          <th>原因</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="line in plan.lines" :key="line.key">
          <td>
            <strong>{{ line.name }}</strong>
            <small class="cell-detail">{{ bucketDefinitionMap[line.key].short }}</small>
          </td>
          <td>
            <div class="target-list">
              <span v-for="target in targetList(line.key)" :key="`${target.name}-${target.code ?? ''}`" class="target-chip">
                <strong>{{ target.name }}</strong>
                <small v-if="target.code">{{ target.code }}</small>
                <small>{{ target.note }}</small>
              </span>
            </div>
          </td>
          <td>{{ percent(line.ratio) }}</td>
          <td>{{ money(line.targetAmount) }}</td>
          <td class="strong">{{ money(line.actualBuy) }}</td>
          <td>{{ money(line.deferred) }}</td>
          <td>{{ line.reason }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
import type { AssetBucket, MonthlyPlan } from "../types";
import { bucketDefinitionMap, defaultBucketTargets, type BucketTargetMap } from "../data/bucketEducation";
import { money, percent } from "../utils/format";

const props = defineProps<{
  plan: MonthlyPlan;
  targets?: BucketTargetMap;
}>();

function targetList(key: AssetBucket) {
  const customTargets = props.targets?.[key];
  return customTargets?.length ? customTargets : (defaultBucketTargets[key] ?? []);
}
</script>
