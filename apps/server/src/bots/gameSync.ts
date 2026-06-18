import type { Server } from "socket.io";
import { getPublicStateForPlayer, type RoomManager } from "../roomManager";
import type { TurnTimerManager } from "../timers";
import { BotScheduler } from "./botScheduler";

export type GameSyncContext = {
  io: Server;
  roomManager: RoomManager;
  timerManager: TurnTimerManager;
  botScheduler: BotScheduler;
};

export function emitRoomState(context: GameSyncContext, roomCode: string): void {
  const { io, roomManager } = context;
  const room = roomManager.getRoom(roomCode);
  if (!room) {
    return;
  }

  for (const player of room.players.values()) {
    if (!player.socketId) {
      continue;
    }
    const publicState = getPublicStateForPlayer(room, player.id);
    if (publicState) {
      io.to(player.socketId).emit("room_state_updated", { state: publicState });
    }
  }
}

function setTurnDeadline(roomManager: RoomManager, roomCode: string, deadlineAt: number | null): void {
  const room = roomManager.getRoom(roomCode);
  if (room) {
    room.turnDeadlineAt = deadlineAt;
  }
}

function scheduleTurnTimer(context: GameSyncContext, roomCode: string): void {
  const { io, roomManager, timerManager } = context;
  const room = roomManager.getRoom(roomCode);
  if (!room?.game) {
    setTurnDeadline(roomManager, roomCode, null);
    return;
  }

  const phase = room.game.state.phase;
  if (phase !== "BIDDING" && phase !== "PLAYING_TRICKS") {
    timerManager.clear(roomCode);
    setTurnDeadline(roomManager, roomCode, null);
    emitRoomState(context, roomCode);
    return;
  }

  const currentSeat = room.game.state.currentTurnSeat;
  if (currentSeat === null) {
    setTurnDeadline(roomManager, roomCode, null);
    return;
  }

  const currentPlayerId = room.seats[currentSeat];
  if (!currentPlayerId) {
    setTurnDeadline(roomManager, roomCode, null);
    return;
  }

  const timer = timerManager.start(roomCode, currentPlayerId, phase, () => {
    try {
      const result =
        phase === "BIDDING"
          ? roomManager.autoPassBid(roomCode)
          : roomManager.autoPlayCard(roomCode);

      if (!result || !result.ok) {
        return;
      }

      setTurnDeadline(roomManager, roomCode, null);
      onBotActionComplete(context, roomCode);
    } catch (error) {
      console.error(`Turn timer auto-action failed for room ${roomCode}:`, error);
    }
  });

  setTurnDeadline(roomManager, roomCode, timer.deadlineAt);
  emitRoomState(context, roomCode);
}

export function onBotActionComplete(context: GameSyncContext, roomCode: string): void {
  const { io, roomManager, timerManager, botScheduler } = context;
  const room = roomManager.getRoom(roomCode);
  if (!room?.game) {
    return;
  }

  if (room.game.state.phase === "ROUND_SCORING" && room.game.lastRoundResult) {
    io.to(roomCode).emit("round_completed", {
      roomCode,
      result: room.game.lastRoundResult,
    });
  }

  if (room.game.state.phase === "MATCH_OVER") {
    const winner =
      room.game.state.matchScore.teamA >= room.game.state.targetScore ? "A" : "B";
    io.to(roomCode).emit("match_completed", { roomCode, winner });
    timerManager.clear(roomCode);
    botScheduler.clear(roomCode);
    emitRoomState(context, roomCode);
    return;
  }

  emitRoomState(context, roomCode);
  scheduleBotOrTurnTimer(context, roomCode);
}

export function scheduleBotOrTurnTimer(context: GameSyncContext, roomCode: string): void {
  const { roomManager, timerManager, botScheduler } = context;

  if (botScheduler.maybeSchedule(roomCode, (code) => onBotActionComplete(context, code))) {
    timerManager.clear(roomCode);
    setTurnDeadline(roomManager, roomCode, null);
    emitRoomState(context, roomCode);
    return;
  }

  scheduleTurnTimer(context, roomCode);
}

export function syncAfterPlayCard(
  context: GameSyncContext,
  roomCode: string,
  before: { trumpRevealed: boolean; tricksCount: number }
): void {
  const { io, roomManager } = context;
  const room = roomManager.getRoom(roomCode);
  if (!room?.game) {
    return;
  }

  if (room.game.state.trumpRevealed && !before.trumpRevealed) {
    io.to(roomCode).emit("trump_revealed", { roomCode });
  }

  if (room.game.state.completedTricks.length > before.tricksCount) {
    const trick = room.game.state.completedTricks[before.tricksCount];
    io.to(roomCode).emit("trick_completed", {
      roomCode,
      trickNumber: trick?.trickNumber,
    });
  }

  onBotActionComplete(context, roomCode);
}
