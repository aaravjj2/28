import type { Server, Socket } from "socket.io";
import type { Seat, Suit } from "@twenty-eight/shared";
import { getPublicStateForPlayer, RoomManager } from "./roomManager";
import { TurnTimerManager } from "./timers";

type ClientContext = {
  roomCode: string;
  playerId: string;
  sessionToken: string;
};

function getContext(socket: Socket): ClientContext | null {
  const roomCode = socket.data.roomCode as string | undefined;
  const playerId = socket.data.playerId as string | undefined;
  const sessionToken = socket.data.sessionToken as string | undefined;
  if (!roomCode || !playerId || !sessionToken) {
    return null;
  }
  return { roomCode, playerId, sessionToken };
}

function emitError(socket: Socket, message: string): void {
  socket.emit("error", { message });
}

function emitRoomState(io: Server, roomCode: string, roomManager: RoomManager): void {
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

function emitEvents(io: Server, roomCode: string, roomManager: RoomManager, socket: Socket): void {
  emitRoomState(io, roomCode, roomManager);

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    return;
  }

  const dealPhase = room.game?.playState ? "remaining" : "initial";
  socket.emit("hand_dealt", { dealPhase });
}

function setTurnDeadline(roomManager: RoomManager, roomCode: string, deadlineAt: number | null): void {
  const room = roomManager.getRoom(roomCode);
  if (room) {
    room.turnDeadlineAt = deadlineAt;
  }
}

function scheduleTurnTimer(
  io: Server,
  roomManager: RoomManager,
  timerManager: TurnTimerManager,
  roomCode: string
): void {
  const room = roomManager.getRoom(roomCode);
  if (!room?.game) {
    setTurnDeadline(roomManager, roomCode, null);
    return;
  }

  const phase = room.game.state.phase;
  if (phase !== "BIDDING" && phase !== "PLAYING_TRICKS") {
    timerManager.clear(roomCode);
    setTurnDeadline(roomManager, roomCode, null);
    emitRoomState(io, roomCode, roomManager);
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
    const result =
      phase === "BIDDING"
        ? roomManager.autoPassBid(roomCode)
        : roomManager.autoPlayCard(roomCode);

    if (!result || !result.ok) {
      return;
    }

    setTurnDeadline(roomManager, roomCode, null);
    emitRoomState(io, roomCode, roomManager);
    scheduleTurnTimer(io, roomManager, timerManager, roomCode);
  });

  setTurnDeadline(roomManager, roomCode, timer.deadlineAt);
  emitRoomState(io, roomCode, roomManager);
}

export function registerSocketHandlers(
  io: Server,
  roomManager: RoomManager,
  timerManager: TurnTimerManager
): void {
  io.on("connection", (socket) => {
    socket.on("create_room", (payload: { displayName?: string }, ack?: (response: unknown) => void) => {
      const displayName = payload?.displayName?.trim();
      if (!displayName) {
        emitError(socket, "Display name is required");
        ack?.({ ok: false, error: "Display name is required" });
        return;
      }

      const result = roomManager.createRoom(displayName, socket.id);
      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      const { room, player, roomCode } = result.data;
      socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.playerId = player.id;
      socket.data.sessionToken = player.sessionToken;

      socket.emit("room_created", {
        roomCode,
        playerId: player.id,
        sessionToken: player.sessionToken,
      });

      emitRoomState(io, roomCode, roomManager);
      ack?.({
        ok: true,
        roomCode,
        playerId: player.id,
        sessionToken: player.sessionToken,
      });
    });

    socket.on(
      "join_room",
      (
        payload: {
          roomCode?: string;
          displayName?: string;
          playerId?: string;
          sessionToken?: string;
        },
        ack?: (response: unknown) => void
      ) => {
        const roomCode = payload?.roomCode?.trim().toUpperCase();
        if (!roomCode) {
          emitError(socket, "Room code is required");
          ack?.({ ok: false, error: "Room code is required" });
          return;
        }

        const reconnect =
          payload.playerId && payload.sessionToken
            ? { playerId: payload.playerId, sessionToken: payload.sessionToken }
            : undefined;

        const displayName = payload.displayName?.trim() ?? "Player";
        const result = roomManager.joinRoom(roomCode, displayName, socket.id, reconnect);
        if (!result.ok) {
          emitError(socket, result.error);
          ack?.({ ok: false, error: result.error });
          return;
        }

        const { room, player } = result.data;
        socket.join(room.code);
        socket.data.roomCode = room.code;
        socket.data.playerId = player.id;
        socket.data.sessionToken = player.sessionToken;

        if (reconnect) {
          socket.emit("reconnect_success", {
            roomCode: room.code,
            playerId: player.id,
          });
        } else {
          socket.emit("room_joined", {
            roomCode: room.code,
            playerId: player.id,
            sessionToken: player.sessionToken,
          });
        }

        const publicState = getPublicStateForPlayer(room, player.id);
        if (publicState) {
          socket.emit("room_state_updated", { state: publicState });
        }

        emitRoomState(io, room.code, roomManager);
        ack?.({
          ok: true,
          roomCode: room.code,
          playerId: player.id,
          sessionToken: player.sessionToken,
        });
      }
    );

    socket.on("choose_seat", (payload: { seat?: number }, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      if (payload?.seat !== 0 && payload?.seat !== 1 && payload?.seat !== 2 && payload?.seat !== 3) {
        emitError(socket, "Invalid seat");
        ack?.({ ok: false, error: "Invalid seat" });
        return;
      }

      const result = roomManager.chooseSeat(
        context.roomCode,
        context.playerId,
        context.sessionToken,
        payload.seat as Seat
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      emitRoomState(io, context.roomCode, roomManager);
      ack?.({ ok: true });
    });

    socket.on("leave_room", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.leaveRoom(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.leave(context.roomCode);
      delete socket.data.roomCode;
      delete socket.data.playerId;
      delete socket.data.sessionToken;
      timerManager.clear(context.roomCode);
      setTurnDeadline(roomManager, context.roomCode, null);
      emitRoomState(io, context.roomCode, roomManager);
      ack?.({ ok: true });
    });

    socket.on("start_game", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.startGame(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.emit("game_started", { roomCode: context.roomCode });
      emitEvents(io, context.roomCode, roomManager, socket);
      scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      ack?.({ ok: true });
    });

    socket.on("place_bid", (payload: { value?: number }, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      if (typeof payload?.value !== "number") {
        emitError(socket, "Bid value is required");
        ack?.({ ok: false, error: "Bid value is required" });
        return;
      }

      const result = roomManager.placeBid(
        context.roomCode,
        context.playerId,
        context.sessionToken,
        payload.value
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.emit("bidding_updated", { roomCode: context.roomCode });
      emitRoomState(io, context.roomCode, roomManager);
      scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      ack?.({ ok: true });
    });

    socket.on("pass_bid", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.passBid(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.emit("bidding_updated", { roomCode: context.roomCode });
      emitRoomState(io, context.roomCode, roomManager);
      scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      ack?.({ ok: true });
    });

    socket.on("select_trump", (payload: { suit?: Suit }, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      if (!payload?.suit) {
        emitError(socket, "Trump suit is required");
        ack?.({ ok: false, error: "Trump suit is required" });
        return;
      }

      const result = roomManager.selectTrump(
        context.roomCode,
        context.playerId,
        context.sessionToken,
        payload.suit
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      socket.emit("trump_selected_hidden", { roomCode: context.roomCode });
      emitEvents(io, context.roomCode, roomManager, socket);
      scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      ack?.({ ok: true });
    });

    socket.on("play_card", (payload: { cardId?: string }, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      if (!payload?.cardId) {
        emitError(socket, "Card id is required");
        ack?.({ ok: false, error: "Card id is required" });
        return;
      }

      const roomBefore = roomManager.getRoom(context.roomCode);
      const trumpRevealedBefore = roomBefore?.game?.state.trumpRevealed ?? false;
      const tricksBefore = roomBefore?.game?.state.completedTricks.length ?? 0;

      const result = roomManager.playCard(
        context.roomCode,
        context.playerId,
        context.sessionToken,
        payload.cardId
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      const roomAfter = roomManager.getRoom(context.roomCode);
      if (roomAfter?.game?.state.trumpRevealed && !trumpRevealedBefore) {
        io.to(context.roomCode).emit("trump_revealed", { roomCode: context.roomCode });
      }

      if ((roomAfter?.game?.state.completedTricks.length ?? 0) > tricksBefore) {
        const trick = roomAfter?.game?.state.completedTricks[tricksBefore];
        io.to(context.roomCode).emit("trick_completed", {
          roomCode: context.roomCode,
          trickNumber: trick?.trickNumber,
        });
      }

      socket.emit("trick_updated", { roomCode: context.roomCode });
      emitRoomState(io, context.roomCode, roomManager);

      if (roomAfter?.game?.state.phase === "ROUND_SCORING" && roomAfter.game.lastRoundResult) {
        io.to(context.roomCode).emit("round_completed", {
          roomCode: context.roomCode,
          result: roomAfter.game.lastRoundResult,
        });
      }

      if (roomAfter?.game?.state.phase === "MATCH_OVER") {
        const winner =
          roomAfter.game.state.matchScore.teamA >= roomAfter.game.state.targetScore
            ? "A"
            : "B";
        io.to(context.roomCode).emit("match_completed", { roomCode: context.roomCode, winner });
        timerManager.clear(context.roomCode);
      } else {
        scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      }

      ack?.({ ok: true });
    });

    socket.on("request_state_sync", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.requestStateSync(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      const room = roomManager.getRoom(context.roomCode);
      if (room) {
        const publicState = getPublicStateForPlayer(room, context.playerId);
        if (publicState) {
          socket.emit("room_state_updated", { state: publicState });
        }
      }

      ack?.({ ok: true });
    });

    socket.on("start_next_round", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.startNextRound(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      emitEvents(io, context.roomCode, roomManager, socket);
      scheduleTurnTimer(io, roomManager, timerManager, context.roomCode);
      ack?.({ ok: true });
    });

    socket.on("rematch", (_payload: unknown, ack?: (response: unknown) => void) => {
      const context = getContext(socket);
      if (!context) {
        emitError(socket, "Not authenticated");
        ack?.({ ok: false, error: "Not authenticated" });
        return;
      }

      const result = roomManager.rematch(
        context.roomCode,
        context.playerId,
        context.sessionToken
      );

      if (!result.ok) {
        emitError(socket, result.error);
        ack?.({ ok: false, error: result.error });
        return;
      }

      timerManager.clear(context.roomCode);
      setTurnDeadline(roomManager, context.roomCode, null);
      emitRoomState(io, context.roomCode, roomManager);
      ack?.({ ok: true });
    });

    socket.on("disconnect", () => {
      const context = getContext(socket);
      roomManager.handleDisconnect(socket.id);
      if (context) {
        emitRoomState(io, context.roomCode, roomManager);
      }
    });
  });
}
