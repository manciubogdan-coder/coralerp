import { useEffect, useState } from "react";

const readStoredValue = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key) ?? sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const usePersistentState = <T,>(key: string, fallback: T) => {
  const [value, setValue] = useState<T>(() => readStoredValue(key, fallback));

  useEffect(() => {
    setValue(readStoredValue(key, fallback));
  }, [key]);

  useEffect(() => {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      sessionStorage.setItem(key, serialized);
    } catch {
      // ignore storage failures
    }
  }, [key, value]);

  return [value, setValue] as const;
};