import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import * as Notifications from "expo-notifications";
import {
  loadWatches,
  saveWatches,
  appendNotification,
  WatchEntry,
} from "@/lib/watchStorage";
import { getAllSeres, invalidateFeedCache } from "@/lib/api";
import { SerVivienteConEstado } from "@/types";
import { acquireExpoPushToken } from "@/hooks/useNotificationSetup";

const POLL_INTERVAL_MS = 90_000;
const REGISTER_DEBOUNCE_MS = 2_000;

const ESTADO_LABELS: Record<string, string> = {
  BUSCADO: "Buscado/a",
  LOCALIZADO_BIEN: "Localizado/a — Bien",
  EN_REFUGIO: "En refugio",
  NECESITA_ASISTENCIA_MEDICA: "Necesita asistencia médica",
};

export function deriveStableKey(ser: SerVivienteConEstado): string {
  if (ser.cedula?.trim()) return ser.cedula.trim();
  return `${ser.tipo_ser}::${ser.nombre ?? ""}::${ser.apellido ?? ""}`;
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (domain) return `https://${domain}`;
  return "";
}

async function registerWatchesWithServer(watches: WatchEntry[]): Promise<void> {
  const token = await acquireExpoPushToken();
  if (!token || watches.length === 0) return;
  try {
    const base = getBaseUrl();
    await fetch(`${base}/api/watches/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        watches: watches.map((w) => ({
          stableKey: w.stableKey,
          lastKnownEstado: w.lastKnownEstado,
          nombre: w.nombre,
        })),
      }),
    });
  } catch {}
}

async function checkChangesViaServer(watches: WatchEntry[]): Promise<Array<{ stableKey: string; oldEstado: string; newEstado: string }>> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/watches/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        watches: watches.map((w) => ({
          stableKey: w.stableKey,
          lastKnownEstado: w.lastKnownEstado,
          nombre: w.nombre,
        })),
      }),
    });
    if (!res.ok) throw new Error(`watches/check HTTP ${res.status}`);
    const data = await res.json() as { success: boolean; changed: Array<{ stableKey: string; oldEstado: string; newEstado: string }> };
    return data.changed ?? [];
  } catch {
    return checkChangesClientFallback(watches);
  }
}

async function checkChangesClientFallback(watches: WatchEntry[]): Promise<Array<{ stableKey: string; oldEstado: string; newEstado: string }>> {
  try {
    invalidateFeedCache();
    const all: SerVivienteConEstado[] = await getAllSeres();
    const byStableKey = new Map<string, string>(all.map((s) => [deriveStableKey(s), s.estadoActual]));
    return watches
      .filter((w) => {
        const cur = byStableKey.get(w.stableKey);
        return cur !== undefined && cur !== w.lastKnownEstado;
      })
      .map((w) => ({
        stableKey: w.stableKey,
        oldEstado: w.lastKnownEstado,
        newEstado: byStableKey.get(w.stableKey)!,
      }));
  } catch {
    return [];
  }
}

async function applyChanges(watches: WatchEntry[], changes: Array<{ stableKey: string; oldEstado: string; newEstado: string }>): Promise<WatchEntry[]> {
  if (changes.length === 0) return watches;
  const changeMap = new Map(changes.map((c) => [c.stableKey, c]));

  const updated: WatchEntry[] = [];
  for (const watch of watches) {
    const change = changeMap.get(watch.stableKey);
    if (change) {
      const oldLabel = ESTADO_LABELS[change.oldEstado] ?? change.oldEstado;
      const newLabel = ESTADO_LABELS[change.newEstado] ?? change.newEstado;

      await appendNotification({
        serId: watch.id,
        serNombre: watch.nombre,
        oldEstado: change.oldEstado,
        newEstado: change.newEstado,
        timestamp: new Date().toISOString(),
        read: false,
      });

      if (Platform.OS !== "web") {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: `📍 ${watch.nombre}`,
            body: `Estado cambió: ${oldLabel} → ${newLabel}`,
            data: { serId: watch.id },
          },
          trigger: null,
        });
      }

      updated.push({ ...watch, lastKnownEstado: change.newEstado });
    } else {
      updated.push(watch);
    }
  }

  await saveWatches(updated);
  return updated;
}

export function useWatches() {
  const [watches, setWatches] = useState<WatchEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const watchesRef = useRef<WatchEntry[]>([]);
  const registerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadWatches().then((w) => {
      watchesRef.current = w;
      setWatches(w);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    watchesRef.current = watches;
  }, [watches]);

  const scheduleRegister = useCallback((w: WatchEntry[]) => {
    if (registerTimerRef.current) clearTimeout(registerTimerRef.current);
    registerTimerRef.current = setTimeout(() => {
      registerWatchesWithServer(w).catch(() => {});
    }, REGISTER_DEBOUNCE_MS);
  }, []);

  const poll = useCallback(async () => {
    const current = watchesRef.current;
    if (current.length === 0) return;
    const changes = await checkChangesViaServer(current);
    if (changes.length > 0) {
      const updated = await applyChanges(current, changes);
      watchesRef.current = updated;
      setWatches(updated);
      scheduleRegister(updated);
    }
  }, [scheduleRegister]);

  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loaded, poll]);

  useEffect(() => {
    if (!loaded) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") poll();
    });
    return () => sub.remove();
  }, [loaded, poll]);

  const isWatching = useCallback(
    (id: string) => watchesRef.current.some((w) => w.id === id),
    []
  );

  const addWatch = useCallback(async (ser: SerVivienteConEstado) => {
    const existing = watchesRef.current;
    const stableKey = deriveStableKey(ser);
    if (existing.some((w) => w.id === ser.id || w.stableKey === stableKey)) return;

    const nombre =
      ser.tipo_ser === "PERSONA"
        ? [ser.nombre, ser.apellido].filter(Boolean).join(" ") || "Sin nombre"
        : ser.nombre || "Animal sin nombre";

    const entry: WatchEntry = {
      id: ser.id,
      stableKey,
      nombre,
      tipo: ser.tipo_ser,
      lastKnownEstado: ser.estadoActual,
      addedAt: new Date().toISOString(),
    };

    const updated = [...existing, entry];
    watchesRef.current = updated;
    setWatches(updated);
    await saveWatches(updated);
    scheduleRegister(updated);
  }, [scheduleRegister]);

  const removeWatch = useCallback(async (id: string) => {
    const existing = watchesRef.current;
    const updated = existing.filter((w) => w.id !== id);
    watchesRef.current = updated;
    setWatches(updated);
    await saveWatches(updated);
    scheduleRegister(updated);
  }, [scheduleRegister]);

  const toggleWatch = useCallback(
    async (ser: SerVivienteConEstado) => {
      if (isWatching(ser.id)) {
        await removeWatch(ser.id);
      } else {
        await addWatch(ser);
      }
    },
    [isWatching, addWatch, removeWatch]
  );

  return { watches, isWatching, addWatch, removeWatch, toggleWatch, loaded };
}
