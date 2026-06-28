import { useState, useEffect, useCallback } from "react";
import { loadHistory, saveHistory, markAllRead, NotifRecord } from "@/lib/watchStorage";

export function useNotificationHistory() {
  const [history, setHistory] = useState<NotifRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const h = await loadHistory();
    setHistory(h);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markRead = useCallback(async () => {
    await markAllRead();
    setHistory((prev) => prev.map((r) => ({ ...r, read: true })));
  }, []);

  const clearAll = useCallback(async () => {
    await saveHistory([]);
    setHistory([]);
  }, []);

  const unreadCount = history.filter((r) => !r.read).length;

  return { history, loaded, unreadCount, refresh, markRead, clearAll };
}
