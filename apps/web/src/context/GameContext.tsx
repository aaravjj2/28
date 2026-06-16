import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { useGameSocket } from "../socket/useGameSocket";

type GameSocketContextValue = ReturnType<typeof useGameSocket>;

export const GameSocketContext = createContext<GameSocketContextValue | null>(null);

export function GameSocketProvider({ children }: { children: ReactNode }) {
  const value = useGameSocket();
  return <GameSocketContext.Provider value={value}>{children}</GameSocketContext.Provider>;
}

export function useGame() {
  const context = useContext(GameSocketContext);
  if (!context) {
    throw new Error("useGame must be used within GameSocketProvider");
  }
  return context;
}
