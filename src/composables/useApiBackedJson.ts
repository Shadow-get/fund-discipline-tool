import { watch, type Ref } from "vue";
import { usePersistentJson } from "./usePersistentRef";

type Normalizer<T> = (value: T) => T;

export function useApiBackedJson<T>(
  storageKey: string,
  fallback: T,
  apiKey: string,
  normalize: Normalizer<T> = (value) => value,
): Ref<T> {
  const value = usePersistentJson<T>(storageKey, normalize(fallback));
  value.value = normalize(value.value);

  let hydrated = false;
  let saveTimer: ReturnType<typeof window.setTimeout> | null = null;

  function saveToApi(nextValue: T) {
    if (typeof window === "undefined") return;
    void fetch(`/api/app-state/${apiKey}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: normalize(nextValue) }),
    }).catch(() => {
      // localStorage has already been updated by usePersistentJson.
    });
  }

  if (typeof window !== "undefined") {
    fetch(`/api/app-state/${apiKey}`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ value: T | null }>;
      })
      .then((payload) => {
        value.value = normalize(payload.value ?? value.value);
      })
      .catch(() => {
        value.value = normalize(value.value);
      })
      .finally(() => {
        hydrated = true;
        saveToApi(value.value);
      });
  } else {
    hydrated = true;
  }

  watch(
    value,
    (nextValue) => {
      if (!hydrated || typeof window === "undefined") return;
      if (saveTimer) window.clearTimeout(saveTimer);
      saveTimer = window.setTimeout(() => {
        saveToApi(nextValue);
      }, 250);
    },
    { deep: true },
  );

  return value;
}
