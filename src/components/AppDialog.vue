<template>
  <Teleport to="body">
    <div v-if="open" class="dialog-backdrop" @click.self="emit('close')">
      <section class="app-dialog" :style="{ maxWidth: width }" role="dialog" aria-modal="true" :aria-labelledby="titleId">
        <header class="dialog-header">
          <div>
            <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
            <h2 :id="titleId">{{ title }}</h2>
            <p v-if="description">{{ description }}</p>
          </div>
          <button type="button" class="dialog-close" aria-label="关闭对话框" @click="emit('close')">x</button>
        </header>

        <div class="dialog-body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="dialog-footer">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    eyebrow?: string;
    description?: string;
    width?: string;
  }>(),
  {
    eyebrow: "",
    description: "",
    width: "820px",
  },
);

const emit = defineEmits<{
  close: [];
}>();

const titleId = `dialog-title-${props.title.length}-${Math.random().toString(36).slice(2)}`;
</script>
