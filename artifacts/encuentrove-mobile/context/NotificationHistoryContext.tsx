import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  loadHistory,
  markAllRead,
  saveHistory,
  subscribeToNotifications,
  NotifRecord,
} from "@/lib/watchStorage";

interface NotifHistoryContextValue {
  history: NotifRecord[];
  unreadCount: number;
  refresh: () => Promise<void>;
  markRead: () => Promise<void>;
  clearAll: () => Promise<void>;
}

const NotifHistoryContext = createContext<NotifHistoryContextValue>({
  history: [],
  unreadCount: 0,
  refresh: async () => {},
  markRead: async () => {},
  clearAll: async () => {},
});

export function NotificationHistoryProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<NotifRecord[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    const h = await loadHistory();
    if (mountedRef.current) setHistory(h);
  }, []);

  useEffect(() => {
    refresh();
    const unsub = subscribeToNotifications(refresh);
    return unsub;
  }, [refresh]);

  const markRead = useCallback(async () => {
    await markAllRead();
    if (mountedRef.current) setHistory((prev) => prev.map((r) => ({ ...r, read: true })));
  }, []);

  const clearAll = useCallback(async () => {
    await saveHistory([]);
    if (mountedRef.current) setHistory([]);
  }, []);

  const unreadCount = history.filter((r) => !r.read).length;

  return (
    <NotifHistoryContext.Provider value={{ history, unreadCount, refresh, markRead, clearAll }}>
      {children}
    </NotifHistoryContext.Provider>
  );
}

export function useNotifHistory() {
  return useContext(NotifHistoryContext);
}
