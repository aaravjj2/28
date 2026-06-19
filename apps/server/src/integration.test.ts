import { createServer } from "node:http";
import { Server as SocketServer } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getLegalBidActions,
  getLegalPlayMoves,
  isAuctionReadyForTrump,
  SUITS,
  type Seat,
} from "@twenty-eight/shared";
import { BotScheduler } from "./bots/botScheduler";
import { registerSocketHandlers } from "./socketHandlers";
import { getPublicStateForPlayer, RoomManager } from "./roomManager";
import { TurnTimerManager } from "./timers";

type AckResponse = {
  ok: boolean;
  error?: string;
  roomCode?: string;
  playerId?: string;
  sessionToken?: string;
};

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeoutMs);
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function emitWithAck<T extends AckResponse>(
  socket: ClientSocket,
  event: string,
  payload: unknown = {}
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.emit(event, payload, (response: T) => {
      if (!response?.ok) {
        reject(new Error(response?.error ?? `${event} failed`));
        return;
      }
      resolve(response);
    });
  });
}

async function connectClient(port: number, openSockets: ClientSocket[]): Promise<ClientSocket> {
  const socket = ioClient(`http://localhost:${port}`, {
    transports: ["websocket"],
    forceNew: true,
  });
  openSockets.push(socket);
  await waitForEvent(socket, "connect");
  return socket;
}

describe("server integration", () => {
  let httpServer: ReturnType<typeof createServer>;
  let io: SocketServer;
  let port: number;
  let roomManager: RoomManager;
  const openSockets: ClientSocket[] = [];

  beforeAll(async () => {
    httpServer = createServer();
    io = new SocketServer(httpServer, { cors: { origin: "*" } });
    roomManager = new RoomManager(() => 0.5);
    const botScheduler = new BotScheduler(roomManager, { instantActions: true });
    registerSocketHandlers(io, roomManager, new TurnTimerManager(60_000), botScheduler);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (!address || typeof address === "string") {
          throw new Error("Failed to bind test server");
        }
        port = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    for (const socket of openSockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
    await Promise.allSettled([
      new Promise<void>((resolve) => {
        io.close(() => resolve());
      }),
      new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      }),
    ]);
  });

  it("completes a full round across four sockets without leaking hidden info", async () => {
    const hostSocket = await connectClient(port, openSockets);
    const host = await emitWithAck<AckResponse>(hostSocket, "create_room", {
      displayName: "Host",
    });

    const clients: Array<{
      socket: ClientSocket;
      playerId: string;
      sessionToken: string;
      seat: Seat;
    }> = [
      {
        socket: hostSocket,
        playerId: host.playerId!,
        sessionToken: host.sessionToken!,
        seat: 0,
      },
    ];

    for (let seat = 1; seat < 4; seat += 1) {
      const socket = await connectClient(port, openSockets);
      const joined = await emitWithAck<AckResponse>(socket, "join_room", {
        roomCode: host.roomCode,
        displayName: `Player${seat}`,
      });
      clients.push({
        socket,
        playerId: joined.playerId!,
        sessionToken: joined.sessionToken!,
        seat: seat as Seat,
      });
    }

    for (const client of clients) {
      await emitWithAck(client.socket, "choose_seat", { seat: client.seat });
    }

    await emitWithAck(hostSocket, "start_game");

    const roomCode = host.roomCode!;
    let biddingComplete = false;
    let safety = 0;
    while (!biddingComplete && safety < 40) {
      const room = roomManager.getRoom(roomCode);
      const bidding = room?.game?.biddingState;
      if (!bidding || isAuctionReadyForTrump(bidding)) {
        biddingComplete = true;
        break;
      }

      const seat = bidding.currentTurnSeat;
      const client = clients.find((entry) => entry.seat === seat);
      if (!client) {
        throw new Error(`Missing client for seat ${seat}`);
      }

      if (
        room?.game?.state.phase === "STAKE_MULTIPLIER" ||
        bidding.stakeMultiplierPhase === "defender" ||
        bidding.stakeMultiplierPhase === "bidder"
      ) {
        await emitWithAck(client.socket, "pass_stake_multiplier");
        safety += 1;
        continue;
      }

      const actions = getLegalBidActions(bidding, seat);
      const action = actions.includes("PASS") ? "PASS" : actions[0];
      if (action === "PASS") {
        await emitWithAck(client.socket, "pass_bid");
      } else if (typeof action === "number") {
        await emitWithAck(client.socket, "place_bid", { value: action });
      }

      safety += 1;
    }

    const roomAfterBidding = roomManager.getRoom(roomCode)!;
    const declarerClient = clients.find(
      (client) => roomAfterBidding.seats[client.seat] === roomAfterBidding.game?.state.declarerPlayerId
    );
    if (!declarerClient) {
      throw new Error("Declarer client not found");
    }

    const declarerHand =
      getPublicStateForPlayer(roomAfterBidding, declarerClient.playerId)?.myHand ?? [];
    const trumpSuit = SUITS.find((suit) => declarerHand.some((card) => card.suit === suit));
    if (!trumpSuit) {
      throw new Error("No trump suit available");
    }
    const concealedCardId = declarerHand.find((card) => card.suit === trumpSuit)?.id;
    if (!concealedCardId) {
      throw new Error("No concealed trump card available");
    }

    await emitWithAck(declarerClient.socket, "select_trump", {
      suit: trumpSuit,
      concealedCardId,
    });

    const roomAfterTrump = roomManager.getRoom(roomCode)!;
    if (roomAfterTrump.game?.state.phase === "THANI_DECLARATION") {
      await emitWithAck(declarerClient.socket, "skip_thani");
    }

    const roomAfterThani = roomManager.getRoom(roomCode)!;
    for (const client of clients) {
      if (client.playerId === declarerClient.playerId) {
        continue;
      }
      const publicState = getPublicStateForPlayer(roomAfterThani, client.playerId)!;
      expect(publicState.trumpSuit).toBeNull();
      expect(publicState.phase).toBe("PLAYING_TRICKS");
    }

    let playComplete = false;
    safety = 0;
    while (!playComplete && safety < 64) {
      const room = roomManager.getRoom(roomCode);
      const play = room?.game?.playState;
      if (!play || play.complete || room?.game?.state.phase !== "PLAYING_TRICKS") {
        playComplete = true;
        break;
      }

      const seat = play.currentTurnSeat;
      const client = clients.find((entry) => entry.seat === seat);
      if (!client) {
        throw new Error(`Missing play client for seat ${seat}`);
      }

      const legalIds = getLegalPlayMoves(play, seat);
      const cardId = legalIds[0];
      if (!cardId) {
        throw new Error("No legal play");
      }

      await emitWithAck(client.socket, "play_card", { cardId });
      safety += 1;
    }

    const finalRoom = roomManager.getRoom(roomCode)!;
    expect(finalRoom.game?.state.phase).toBe("ROUND_SCORING");
    expect(finalRoom.game?.lastRoundResult).toBeTruthy();
    expect(
      (finalRoom.game?.lastRoundResult?.teamAPoints ?? 0) +
        (finalRoom.game?.lastRoundResult?.teamBPoints ?? 0)
    ).toBe(28);

    for (const client of clients) {
      const publicState = getPublicStateForPlayer(finalRoom, client.playerId)!;

      for (const other of clients) {
        if (other.playerId === client.playerId) {
          continue;
        }
        const otherCards = finalRoom.game!.state.handsByPlayerId[other.playerId] ?? [];
        for (const card of otherCards) {
          expect(publicState.myHand.some((mine) => mine.id === card.id)).toBe(false);
        }
      }
    }

    for (const client of clients) {
      client.socket.disconnect();
    }
  }, 30_000);
});
