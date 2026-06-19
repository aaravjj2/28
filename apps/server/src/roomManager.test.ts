import { describe, expect, it } from "vitest";
import {
  assertPublicStateHasNoHiddenLeaks,
  getLegalBidActions,
  getLegalPlayMoves,
  isAuctionReadyForTrump,
  SUITS,
  type Seat,
} from "@twenty-eight/shared";
import { getPublicStateForPlayer, RoomManager } from "./roomManager";

function createSeededManager(
  seed = 0.42,
  options?: { matchTargetScore?: number; thaniEnabled?: boolean }
): RoomManager {
  let value = seed;
  return new RoomManager(
    () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    },
    options
  );
}

function setupFourPlayerRoom(manager: RoomManager) {
  const host = manager.createRoom("Host", "socket-host");
  expect(host.ok).toBe(true);
  if (!host.ok) {
    throw new Error("host create failed");
  }

  const roomCode = host.data.roomCode;
  const players: Array<{
    result: ReturnType<RoomManager["createRoom"]> | ReturnType<RoomManager["joinRoom"]>;
    socketId: string;
    seat: Seat;
  }> = [
    { result: host, socketId: "socket-host", seat: 0 as Seat },
  ];

  for (let i = 1; i < 4; i += 1) {
    const joined = manager.joinRoom(roomCode, `Player${i}`, `socket-${i}`);
    expect(joined.ok).toBe(true);
    if (!joined.ok) {
      throw new Error("join failed");
    }
    players.push({ result: joined, socketId: `socket-${i}`, seat: i as Seat });
  }

  for (const entry of players) {
    if (!entry.result.ok) {
      continue;
    }
    const choose = manager.chooseSeat(
      roomCode,
      entry.result.data.player.id,
      entry.result.data.player.sessionToken,
      entry.seat
    );
    expect(choose.ok).toBe(true);
  }

  return { roomCode, players, hostPlayer: host.data.player };
}

describe("RoomManager", () => {
  it("creates a room successfully", () => {
    const manager = createSeededManager();
    const result = manager.createRoom("Alice", "socket-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.roomCode).toHaveLength(6);
      expect(result.data.player.isHost).toBe(true);
    }
  });

  it("allows four players to join", () => {
    const manager = createSeededManager();
    const { roomCode } = setupFourPlayerRoom(manager);
    const room = manager.getRoom(roomCode);
    expect(room?.players.size).toBe(4);
  });

  it("rejects a fifth player", () => {
    const manager = createSeededManager();
    const { roomCode } = setupFourPlayerRoom(manager);
    const fifth = manager.joinRoom(roomCode, "Fifth", "socket-5");
    expect(fifth.ok).toBe(false);
    if (!fifth.ok) {
      expect(fifth.error).toBe("Room is full");
    }
  });

  it("allows players to choose seats", () => {
    const manager = createSeededManager();
    const created = manager.createRoom("Host", "socket-host");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const choose = manager.chooseSeat(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      2
    );
    expect(choose.ok).toBe(true);
    expect(manager.getRoom(created.data.roomCode)?.seats[2]).toBe(created.data.player.id);
  });

  it("rejects duplicate seat selection", () => {
    const manager = createSeededManager();
    const { roomCode, players } = setupFourPlayerRoom(manager);
    const playerOne = players[1];
    const host = players[0];
    if (!playerOne?.result.ok || !host?.result.ok) {
      throw new Error("missing players");
    }
    const duplicate = manager.chooseSeat(
      roomCode,
      host.result.data.player.id,
      host.result.data.player.sessionToken,
      playerOne.seat
    );
    expect(duplicate.ok).toBe(false);
  });

  it("rejects non-host start game", () => {
    const manager = createSeededManager();
    const { roomCode, players } = setupFourPlayerRoom(manager);
    const guest = players[1];
    if (!guest?.result.ok) {
      throw new Error("missing guest");
    }
    const start = manager.startGame(
      roomCode,
      guest.result.data.player.id,
      guest.result.data.player.sessionToken
    );
    expect(start.ok).toBe(false);
  });

  it("requires four seated players to start", () => {
    const manager = createSeededManager();
    const created = manager.createRoom("Host", "socket-host");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const start = manager.startGame(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken
    );
    expect(start.ok).toBe(false);
  });

  it("sends only the viewer hand in public state", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode);
    expect(room?.game).toBeTruthy();

    const seatedIds = ([0, 1, 2, 3] as Seat[]).map((seat) => room!.seats[seat]!);
    for (const viewerId of seatedIds) {
      const publicState = getPublicStateForPlayer(room!, viewerId);
      const fullHand = room!.game!.state.handsByPlayerId[viewerId] ?? [];
      expect(publicState?.myHand.map((card) => card.id).sort()).toEqual(
        fullHand.map((card) => card.id).sort()
      );
    }
  });

  it("hides other players hands", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode)!;
    const viewerId = room.seats[0]!;
    const publicState = getPublicStateForPlayer(room, viewerId)!;

    for (const [playerId, hand] of Object.entries(room.game!.state.handsByPlayerId)) {
      if (playerId === viewerId) {
        continue;
      }
      for (const card of hand) {
        expect(publicState.myHand.some((mine) => mine.id === card.id)).toBe(false);
      }
    }
  });

  it("does not leak hidden trump to non-declarer", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode)!;

    completeBidding(manager, roomCode);
    const declarerId = room.game!.state.declarerPlayerId!;
    const declarerHand = room.game!.state.handsByPlayerId[declarerId] ?? [];
    const trumpSuit = SUITS.find((suit) => declarerHand.some((card) => card.suit === suit))!;
    manager.selectTrump(
      roomCode,
      declarerId,
      room.players.get(declarerId)!.sessionToken,
      trumpSuit,
      declarerHand.find((card) => card.suit === trumpSuit)!.id
    );

    const refreshed = manager.getRoom(roomCode)!;
    for (const [playerId] of refreshed.players) {
      const publicState = getPublicStateForPlayer(refreshed, playerId)!;
      if (playerId !== declarerId) {
        expect(publicState.trumpSuit).toBeNull();
      } else {
        expect(publicState.trumpSuit).toBe(trumpSuit);
      }
      assertPublicStateHasNoHiddenLeaks(publicState, playerId, refreshed.game!.state);
    }
  });

  it("rejects invalid bids", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode)!;
    const firstBidderSeat = room.game!.biddingState!.currentTurnSeat;
    const bidderId = room.seats[firstBidderSeat]!;
    const token = room.players.get(bidderId)!.sessionToken;

    const invalid = manager.placeBid(roomCode, bidderId, token, 10);
    expect(invalid.ok).toBe(false);
  });

  it("prevents passed players from bidding again", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode)!;

    const firstBidderSeat = room.game!.biddingState!.currentTurnSeat;
    const bidderId = room.seats[firstBidderSeat]!;
    const token = room.players.get(bidderId)!.sessionToken;
    manager.placeBid(roomCode, bidderId, token, 14);

    const nextSeat = room.game!.biddingState!.currentTurnSeat;
    const passerId = room.seats[nextSeat]!;
    const passerToken = room.players.get(passerId)!.sessionToken;
    manager.passBid(roomCode, passerId, passerToken);

    const rebid = manager.placeBid(roomCode, passerId, passerToken, 15);
    expect(rebid.ok).toBe(false);
  });

  it("enters thani declaration after trump when thani is enabled", () => {
    const manager = createSeededManager(0.42, { thaniEnabled: true });
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    const room = manager.getRoom(roomCode)!;
    const declarerId = room.game!.state.declarerPlayerId!;
    const declarerHand = room.game!.state.handsByPlayerId[declarerId] ?? [];
    const trumpSuit = SUITS.find((suit) => declarerHand.some((card) => card.suit === suit))!;
    const concealedCardId = declarerHand.find((card) => card.suit === trumpSuit)!.id;
    manager.selectTrump(
      roomCode,
      declarerId,
      room.players.get(declarerId)!.sessionToken,
      trumpSuit,
      concealedCardId
    );
    expect(manager.getRoom(roomCode)?.game?.state.phase).toBe("THANI_DECLARATION");
  });

  it("rejects non-declarer trump selection", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    const room = manager.getRoom(roomCode)!;
    const nonDeclarer = [...room.players.values()].find(
      (player) => player.id !== room.game!.state.declarerPlayerId
    )!;
    const result = manager.selectTrump(roomCode, nonDeclarer.id, nonDeclarer.sessionToken, "hearts");
    expect(result.ok).toBe(false);
  });

  it("rejects illegal card plays", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);

    const room = manager.getRoom(roomCode)!;
    const seat = room.game!.playState!.currentTurnSeat;
    const playerId = room.seats[seat]!;
    const token = room.players.get(playerId)!.sessionToken;
    const illegalCard = "not-a-real-card";
    const result = manager.playCard(roomCode, playerId, token, illegalCard);
    expect(result.ok).toBe(false);
  });

  it("rejects out-of-turn card plays", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);

    const room = manager.getRoom(roomCode)!;
    const currentSeat = room.game!.playState!.currentTurnSeat;
    const wrongSeat = ((currentSeat + 1) % 4) as Seat;
    const wrongPlayerId = room.seats[wrongSeat]!;
    const token = room.players.get(wrongPlayerId)!.sessionToken;
    const cardId = room.game!.playState!.hands[wrongSeat][0]?.id;
    const result = manager.playCard(roomCode, wrongPlayerId, token, cardId!);
    expect(result.ok).toBe(false);
  });

  it("completes a full round through server actions", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);
    playOutRound(manager, roomCode);

    const room = manager.getRoom(roomCode)!;
    expect(room.game?.state.phase).toBe("ROUND_SCORING");
    expect(room.game?.lastRoundResult).toBeTruthy();
  });

  it("scores round points totaling 28", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);
    playOutRound(manager, roomCode);

    const result = manager.getRoom(roomCode)?.game?.lastRoundResult;
    expect((result?.teamAPoints ?? 0) + (result?.teamBPoints ?? 0)).toBe(28);
  });

  it("restores player state on reconnect", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    manager.handleDisconnect("socket-host");

    const rejoin = manager.joinRoom(roomCode, "Host", "socket-host-new", {
      playerId: hostPlayer.id,
      sessionToken: hostPlayer.sessionToken,
    });
    expect(rejoin.ok).toBe(true);
    if (rejoin.ok) {
      expect(rejoin.events?.some((event) => event.type === "reconnect_success")).toBe(true);
      const publicState = getPublicStateForPlayer(rejoin.data.room, hostPlayer.id);
      expect(publicState?.myHand.length).toBeGreaterThan(0);
    }
  });

  it("preserves disconnected player seat", () => {
    const manager = createSeededManager();
    const { roomCode, hostPlayer } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    manager.handleDisconnect("socket-host");
    const room = manager.getRoom(roomCode)!;
    expect(room.seats[0]).toBe(hostPlayer.id);
    expect(room.players.get(hostPlayer.id)?.connected).toBe(false);
  });

  it("transfers host to earliest joined connected player when host leaves lobby", () => {
    const manager = createSeededManager();
    const { roomCode, players, hostPlayer } = setupFourPlayerRoom(manager);
    const secondPlayer = players[1];
    if (!secondPlayer?.result.ok) {
      throw new Error("missing second player");
    }

    manager.leaveRoom(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    const room = manager.getRoom(roomCode);
    expect(room?.hostPlayerId).toBe(secondPlayer.result.data.player.id);
    expect(room?.players.get(secondPlayer.result.data.player.id)?.isHost).toBe(true);
  });

  it("rematch preserves seats and returns players to lobby", () => {
    const manager = createSeededManager(0.42, { matchTargetScore: 1 });
    const { roomCode, hostPlayer, players } = setupFourPlayerRoom(manager);
    manager.startGame(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);
    playOutRound(manager, roomCode);

    const seatsBefore = { ...manager.getRoom(roomCode)!.seats };
    const rematch = manager.rematch(roomCode, hostPlayer.id, hostPlayer.sessionToken);
    expect(rematch.ok).toBe(true);

    const room = manager.getRoom(roomCode)!;
    expect(room.locked).toBe(false);
    expect(room.game).toBeNull();
    expect(room.seats).toEqual(seatsBefore);
    expect(room.players.size).toBe(4);
    for (const entry of players) {
      if (!entry.result.ok) {
        continue;
      }
      expect(room.players.has(entry.result.data.player.id)).toBe(true);
    }
  });

  it("rejects invalid session token", () => {
    const manager = createSeededManager();
    const created = manager.createRoom("Host", "socket-host");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    const result = manager.chooseSeat(
      created.data.roomCode,
      created.data.player.id,
      "bad-token",
      0
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Invalid session token");
    }
  });
});

function completeBidding(manager: RoomManager, roomCode: string): void {
  let safety = 0;
  while (safety < 40) {
    const room = manager.getRoom(roomCode);
    const bidding = room?.game?.biddingState;
    if (!bidding || isAuctionReadyForTrump(bidding)) {
      return;
    }
    const seat = bidding.currentTurnSeat;
    const playerId = room!.seats[seat]!;
    const token = room!.players.get(playerId)!.sessionToken;

    if (
      room!.game!.state.phase === "STAKE_MULTIPLIER" ||
      bidding.stakeMultiplierPhase === "defender" ||
      bidding.stakeMultiplierPhase === "bidder"
    ) {
      manager.passStakeMultiplier(roomCode, playerId, token);
      safety += 1;
      continue;
    }

    const actions = getLegalBidActions(bidding, seat);
    const action = actions.includes("PASS") ? "PASS" : actions[0];
    if (action === "PASS") {
      manager.passBid(roomCode, playerId, token);
    } else if (typeof action === "number") {
      manager.placeBid(roomCode, playerId, token, action);
    }
    safety += 1;
  }
}

function startPlay(manager: RoomManager, roomCode: string): void {
  const room = manager.getRoom(roomCode)!;
  const declarerId = room.game!.state.declarerPlayerId!;
  const declarerHand = room.game!.state.handsByPlayerId[declarerId] ?? [];
  const trumpSuit = SUITS.find((suit) => declarerHand.some((card) => card.suit === suit))!;
  const concealedCardId = declarerHand.find((card) => card.suit === trumpSuit)!.id;
  manager.selectTrump(
    roomCode,
    declarerId,
    room.players.get(declarerId)!.sessionToken,
    trumpSuit,
    concealedCardId
  );

  const afterTrump = manager.getRoom(roomCode)!;
  if (afterTrump.game?.state.phase === "THANI_DECLARATION") {
    manager.skipThaniAndPlay(
      roomCode,
      declarerId,
      afterTrump.players.get(declarerId)!.sessionToken
    );
  }
}

function playOutRound(manager: RoomManager, roomCode: string): void {
  let safety = 0;
  while (safety < 64) {
    const room = manager.getRoom(roomCode);
    const play = room?.game?.playState;
    if (!play || play.complete) {
      return;
    }
    const seat = play.currentTurnSeat;
    const playerId = room!.seats[seat]!;
    const token = room!.players.get(playerId)!.sessionToken;
    const cardId = getLegalPlayMoves(play, seat)[0];
    if (!cardId) {
      throw new Error("No legal play");
    }
    manager.playCard(roomCode, playerId, token, cardId);
    safety += 1;
  }
}
