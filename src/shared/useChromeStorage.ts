import { useState, useEffect, useCallback, useRef } from 'react';

const isChromeStorageAvailable = (): boolean =>
  typeof chrome !== 'undefined' &&
  typeof chrome.storage !== 'undefined' &&
  typeof chrome.storage.local !== 'undefined';

/**
 * Hook React générique et synchronisé en temps réel avec `chrome.storage.local`.
 * Supporte un fallback transparent sur `localStorage` si ouvert hors contexte d'extension.
 */
export function useChromeStorage<T>(
  key: string,
  initialValue: T
): [T, (valOrUpdater: T | ((prev: T) => T)) => void, boolean] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const valueRef = useRef<T>(initialValue);
  valueRef.current = storedValue;

  useEffect(() => {
    let isMounted = true;

    if (isChromeStorageAvailable()) {
      chrome.storage.local.get([key], (result) => {
        if (!isMounted) return;
        if (result[key] !== undefined) {
          setStoredValue(result[key] as T);
          valueRef.current = result[key] as T;
        } else {
          chrome.storage.local.set({ [key]: initialValue });
        }
        setIsLoaded(true);
      });

      const handleStorageChange = (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string
      ) => {
        if (areaName === 'local' && changes[key] !== undefined) {
          const newValue = changes[key].newValue as T;
          if (newValue !== undefined) {
            setStoredValue(newValue);
            valueRef.current = newValue;
          }
        }
      };

      chrome.storage.onChanged.addListener(handleStorageChange);
      return () => {
        isMounted = false;
        chrome.storage.onChanged.removeListener(handleStorageChange);
      };
    } else {
      // Fallback localStorage pour prévisualisation locale éventuelle
      try {
        const raw = window.localStorage.getItem(key);
        if (raw !== null) {
          const parsed = JSON.parse(raw) as T;
          setStoredValue(parsed);
          valueRef.current = parsed;
        } else {
          window.localStorage.setItem(key, JSON.stringify(initialValue));
        }
      } catch (err) {
        console.error(`Erreur de lecture localStorage pour "${key}":`, err);
      }
      setIsLoaded(true);

      const handleWindowStorage = (e: StorageEvent) => {
        if (e.key === key && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as T;
            setStoredValue(parsed);
            valueRef.current = parsed;
          } catch {
            // ignore
          }
        }
      };
      window.addEventListener('storage', handleWindowStorage);
      return () => {
        isMounted = false;
        window.removeEventListener('storage', handleWindowStorage);
      };
    }
  }, [key]);

  const setValue = useCallback(
    (valOrUpdater: T | ((prev: T) => T)) => {
      if (isChromeStorageAvailable()) {
        // Pour éviter toute condition de concurrence entre fenêtres, on calcule depuis la ref la plus fraîche
        const nextValue =
          typeof valOrUpdater === 'function'
            ? (valOrUpdater as (prev: T) => T)(valueRef.current)
            : valOrUpdater;

        setStoredValue(nextValue);
        valueRef.current = nextValue;
        chrome.storage.local.set({ [key]: nextValue });
      } else {
        const nextValue =
          typeof valOrUpdater === 'function'
            ? (valOrUpdater as (prev: T) => T)(valueRef.current)
            : valOrUpdater;

        setStoredValue(nextValue);
        valueRef.current = nextValue;
        try {
          window.localStorage.setItem(key, JSON.stringify(nextValue));
        } catch (err) {
          console.error(`Erreur d'écriture localStorage pour "${key}":`, err);
        }
      }
    },
    [key]
  );

  return [storedValue, setValue, isLoaded];
}
