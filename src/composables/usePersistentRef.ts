import { ref, watch, type Ref } from "vue";

function readStoredValue(key: string) {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures in private or restricted browser modes.
  }
}

export function usePersistentNumber(key: string, fallback: number): Ref<number> {
  const raw = readStoredValue(key);
  const parsed = raw == null ? fallback : Number(raw);
  const value = ref(Number.isFinite(parsed) ? parsed : fallback) as Ref<number>;

  watch(value, (nextValue) => {
    writeStoredValue(key, String(Number.isFinite(nextValue) ? nextValue : fallback));
  });

  return value;
}

export function usePersistentString<T extends string>(
  key: string,
  fallback: T,
  allowedValues?: readonly T[],
): Ref<T> {
  const raw = readStoredValue(key) as T | null;
  const initial = raw && (!allowedValues || allowedValues.includes(raw)) ? raw : fallback;
  const value = ref(initial) as Ref<T>;

  watch(value, (nextValue) => {
    writeStoredValue(key, nextValue);
  });

  return value;
}

export function usePersistentJson<T>(key: string, fallback: T): Ref<T> {
  const raw = readStoredValue(key);
  let initial = fallback;

  if (raw != null) {
    try {
      initial = JSON.parse(raw) as T;
    } catch {
      initial = fallback;
    }
  }

  const value = ref(initial) as Ref<T>;

  watch(
    value,
    (nextValue) => {
      writeStoredValue(key, JSON.stringify(nextValue));
    },
    { deep: true },
  );

  return value;
}
