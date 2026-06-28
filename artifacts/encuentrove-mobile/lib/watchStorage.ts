import AsyncStorage from "@react-native-async-storage/async-storage";

const WATCHES_KEY = "@encuentrove/watches_v2";
const HISTORY_KEY = "@encuentrove/notif_history_v1";

export interface WatchEntry {
  id: string;
  stableKey: string;
  nombre: string;
  tipo: string;
  lastKnownEstado: string;
  addedAt: string;
}

export interface NotifRecord {
  id: string;
  serId: string;
  serNombre: string;
  oldEstado: string;
  newEstado: string;
  timestamp: string;
  read: boolean;
}

type Listener = () => void;
const notifListeners = new Set<Listener>();

export function subscribeToNotifications(fn: Listener): () => void {
  notifListeners.add(fn);
  return () => notifListeners.delete(fn);
}

export async function loadWatches(): Promise<WatchEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(WATCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveWatches(watches: WatchEntry[]): Promise<void> {
  try {
    await AsyncStorage.setItem(WATCHES_KEY, JSON.stringify(watches));
  } catch {}
}

export async function loadHistory(): Promise<NotifRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveHistory(history: NotifRecord[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

export async function appendNotification(record: Omit<NotifRecord, "id">): Promise<void> {
  const history = await loadHistory();
  const newRecord: NotifRecord = { ...record, id: `${Date.now()}-${Math.random()}` };
  const updated = [newRecord, ...history].slice(0, 200);
  await saveHistory(updated);
  notifListeners.forEach((fn) => fn());
}

export async function markAllRead(): Promise<void> {
  const history = await loadHistory();
  const updated = history.map((r) => ({ ...r, read: true }));
  await saveHistory(updated);
}
