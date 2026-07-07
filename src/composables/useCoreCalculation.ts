import { ref, watchEffect, type Ref } from "vue";

export function useCoreCalculation<T>(loader: () => Promise<T>, fallback: () => T) {
  const value = ref(fallback()) as Ref<T>;
  const loading = ref(false);
  const error = ref("");
  let runId = 0;

  watchEffect((onCleanup) => {
    const currentRun = ++runId;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });

    value.value = fallback();
    loading.value = true;
    error.value = "";

    void loader()
      .then((result) => {
        if (cancelled || currentRun !== runId) return;
        value.value = result;
      })
      .catch((err) => {
        if (cancelled || currentRun !== runId) return;
        error.value = err instanceof Error ? err.message : "Python calculation failed";
      })
      .finally(() => {
        if (cancelled || currentRun !== runId) return;
        loading.value = false;
      });
  });

  return { value, loading, error };
}

