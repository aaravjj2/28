export const DEFAULT_TURN_TIMEOUT_MS = 30_000;

export type TurnTimerCallback = () => void;

export type TurnTimer = {
  playerId: string;
  phase: "BIDDING" | "PLAYING_TRICKS";
  clear: () => void;
};

export class TurnTimerManager {
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly timeoutMs: number;

  constructor(timeoutMs = DEFAULT_TURN_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  start(roomCode: string, playerId: string, phase: TurnTimer["phase"], onExpire: TurnTimerCallback): TurnTimer {
    this.clear(roomCode);

    const timeout = setTimeout(() => {
      this.timers.delete(roomCode);
      onExpire();
    }, this.timeoutMs);

    this.timers.set(roomCode, timeout);

    return {
      playerId,
      phase,
      clear: () => this.clear(roomCode),
    };
  }

  clear(roomCode: string): void {
    const existing = this.timers.get(roomCode);
    if (existing) {
      clearTimeout(existing);
      this.timers.delete(roomCode);
    }
  }

  clearAll(): void {
    for (const timeout of this.timers.values()) {
      clearTimeout(timeout);
    }
    this.timers.clear();
  }
}
