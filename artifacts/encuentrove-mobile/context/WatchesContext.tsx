import React, { createContext, useContext, ReactNode } from "react";
import { useWatches } from "@/hooks/useWatches";
import { SerVivienteConEstado } from "@/types";

interface WatchesContextValue {
  isWatching: (id: string) => boolean;
  toggleWatch: (ser: SerVivienteConEstado) => Promise<void>;
  watchCount: number;
}

const WatchesContext = createContext<WatchesContextValue>({
  isWatching: () => false,
  toggleWatch: async () => {},
  watchCount: 0,
});

export function WatchesProvider({ children }: { children: ReactNode }) {
  const { watches, isWatching, toggleWatch } = useWatches();
  return (
    <WatchesContext.Provider value={{ isWatching, toggleWatch, watchCount: watches.length }}>
      {children}
    </WatchesContext.Provider>
  );
}

export function useWatchesContext() {
  return useContext(WatchesContext);
}
