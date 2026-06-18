import type { RoomManager } from "../roomManager";
import { BotManager } from "./botManager";

const MIN_BOT_DELAY_MS = 500;
const MAX_BOT_DELAY_MS = 1_200;

export type BotActionCallback = (roomCode: string) => void;

export class BotScheduler {
  private readonly pending = new Map<string, NodeJS.Timeout>();
  private readonly random: () => number;
  private readonly instantActions: boolean;
  private readonly botManager: BotManager;

  constructor(
    roomManager: RoomManager,
    options: { random?: () => number; instantActions?: boolean } = {}
  ) {
    this.botManager = new BotManager(roomManager);
    this.random = options.random ?? Math.random;
    this.instantActions = options.instantActions ?? false;
  }

  get manager(): BotManager {
    return this.botManager;
  }

  clear(roomCode: string): void {
    const timeout = this.pending.get(roomCode);
    if (timeout) {
      clearTimeout(timeout);
      this.pending.delete(roomCode);
    }
  }

  clearAll(): void {
    for (const timeout of this.pending.values()) {
      clearTimeout(timeout);
    }
    this.pending.clear();
  }

  schedule(roomCode: string, onComplete: BotActionCallback): void {
    this.clear(roomCode);

    const run = () => {
      this.pending.delete(roomCode);
      const result = this.botManager.executeTurn(roomCode);
      if (!result?.ok) {
        return;
      }
      onComplete(roomCode);
    };

    if (this.instantActions) {
      run();
      return;
    }

    const delay =
      MIN_BOT_DELAY_MS +
      Math.floor(this.random() * (MAX_BOT_DELAY_MS - MIN_BOT_DELAY_MS + 1));
    const timeout = setTimeout(run, delay);
    this.pending.set(roomCode, timeout);
  }

  maybeSchedule(roomCode: string, onComplete: BotActionCallback): boolean {
    if (this.botManager.getCurrentBotSeat(roomCode) === null) {
      return false;
    }
    this.schedule(roomCode, onComplete);
    return true;
  }
}
