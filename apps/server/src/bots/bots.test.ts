import { describe, expect, it } from "vitest";
import {
  createBiddingState,
  getLegalBidActions,
  getLegalPlayMoves,
  isAuctionReadyForTrump,
  SUITS,
} from "@twenty-eight/shared";
import { getPublicStateForPlayer, RoomManager } from "../roomManager";
import { assertBotObservationHasNoLeaks, buildBotObservation } from "./botObservation";
import { BotManager } from "./botManager";
import { createRandomBot } from "./randomBot";

function seededManager(): RoomManager {
  let value = 0.42;
  return new RoomManager(
    () => {
      value = (value * 1664525 + 1013904223) % 4294967296;
      return value / 4294967296;
    },
    { matchTargetScore: 1 }
  );
}

function seatAllWithBots(manager: RoomManager, roomCode: string, hostId: string, hostToken: string) {
  for (const seat of [1, 2, 3] as const) {
    manager.addBot(roomCode, hostId, hostToken, seat, "random");
  }
}

describe("botObservation", () => {
  it("does not include other players hands", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }

    const { roomCode, player, sessionToken } = {
      roomCode: created.data.roomCode,
      player: created.data.player,
      sessionToken: created.data.player.sessionToken,
    };
    manager.chooseSeat(roomCode, player.id, sessionToken, 0);
    seatAllWithBots(manager, roomCode, player.id, sessionToken);
    manager.startGame(roomCode, player.id, sessionToken);

    const room = manager.getRoom(roomCode)!;
    const botId = room.seats[1]!;
    const observation = buildBotObservation(room, botId, "random");
    expect(observation).toBeTruthy();
    assertBotObservationHasNoLeaks(observation!, room);

    const fullHand = room.game!.state.handsByPlayerId[room.seats[0]!] ?? [];
    for (const card of fullHand) {
      expect(observation!.publicState.myHand.some((mine) => mine.id === card.id)).toBe(false);
    }
  });

  it("does not expose deck on observation", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const { roomCode, player, sessionToken } = {
      roomCode: created.data.roomCode,
      player: created.data.player,
      sessionToken: created.data.player.sessionToken,
    };
    manager.chooseSeat(roomCode, player.id, sessionToken, 0);
    seatAllWithBots(manager, roomCode, player.id, sessionToken);
    manager.startGame(roomCode, player.id, sessionToken);

    const room = manager.getRoom(roomCode)!;
    const observation = buildBotObservation(room, room.seats[1]!, "random");
    expect(observation).toBeTruthy();
    expect("deck" in observation!).toBe(false);
    expect(room.game!.deck.length).toBeGreaterThan(0);
  });

  it("hides trump from non-declarer bot before reveal", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const { roomCode, player, sessionToken } = {
      roomCode: created.data.roomCode,
      player: created.data.player,
      sessionToken: created.data.player.sessionToken,
    };
    manager.chooseSeat(roomCode, player.id, sessionToken, 0);
    seatAllWithBots(manager, roomCode, player.id, sessionToken);
    manager.startGame(roomCode, player.id, sessionToken);

    let room = manager.getRoom(roomCode)!;
    while (room.game?.biddingState && !isAuctionReadyForTrump(room.game.biddingState)) {
      const seat = room.game.biddingState.currentTurnSeat;
      const actorId = room.seats[seat]!;
      const token = room.players.get(actorId)!.sessionToken;
      if (
        room.game.state.phase === "STAKE_MULTIPLIER" ||
        room.game.biddingState.stakeMultiplierPhase === "defender" ||
        room.game.biddingState.stakeMultiplierPhase === "bidder"
      ) {
        manager.passStakeMultiplier(roomCode, actorId, token);
        room = manager.getRoom(roomCode)!;
        continue;
      }
      const actions = getLegalBidActions(room.game.biddingState, seat);
      const action = actions.includes("PASS") ? "PASS" : actions[0];
      if (action === "PASS") {
        manager.passBid(roomCode, actorId, token);
      } else if (typeof action === "number") {
        manager.placeBid(roomCode, actorId, token, action);
      }
      room = manager.getRoom(roomCode)!;
    }

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

    room = manager.getRoom(roomCode)!;
    for (const [playerId, roomPlayer] of room.players) {
      if (!roomPlayer.isBot) {
        continue;
      }
      const observation = buildBotObservation(room, playerId, "random")!;
      if (playerId !== declarerId) {
        expect(observation.publicState.trumpSuit).toBeNull();
      }
    }
  });
});

describe("randomBot", () => {
  it("chooses only legal bid actions", () => {
    const bidding = createBiddingState(0);
    const observation = {
      playerId: "bot",
      seat: 1 as const,
      difficulty: "random" as const,
      publicState: {
        phase: "BIDDING" as const,
        currentBid: null,
        legalCardIds: undefined,
      } as never,
      legalBidActions: getLegalBidActions(bidding, 1),
    };
    const action = createRandomBot(() => 0).decide(observation);
    expect(action.type === "bid" || action.type === "pass").toBe(true);
  });
});

describe("RoomManager bots", () => {
  it("allows host to add bot to empty seat", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const result = manager.addBot(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      1,
      "random"
    );
    expect(result.ok).toBe(true);
    expect(manager.getRoom(created.data.roomCode)?.seats[1]).toBeTruthy();
  });

  it("rejects non-host add bot", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const guest = manager.joinRoom(created.data.roomCode, "Guest", "socket-guest");
    if (!guest.ok) {
      return;
    }
    const result = manager.addBot(
      created.data.roomCode,
      guest.data.player.id,
      guest.data.player.sessionToken,
      1,
      "random"
    );
    expect(result.ok).toBe(false);
  });

  it("rejects add bot to occupied seat", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    manager.chooseSeat(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      1
    );
    const result = manager.addBot(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      1,
      "random"
    );
    expect(result.ok).toBe(false);
  });

  it("allows host to remove bot before start", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const added = manager.addBot(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      2,
      "heuristic"
    );
    if (!added.ok) {
      return;
    }
    const removed = manager.removeBot(
      created.data.roomCode,
      created.data.player.id,
      created.data.player.sessionToken,
      added.data!.playerId
    );
    expect(removed.ok).toBe(true);
    expect(manager.getRoom(created.data.roomCode)?.seats[2]).toBeNull();
  });

  it("human and three bots can complete a full round totaling 28 points", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const { roomCode, player, sessionToken } = {
      roomCode: created.data.roomCode,
      player: created.data.player,
      sessionToken: created.data.player.sessionToken,
    };
    manager.chooseSeat(roomCode, player.id, sessionToken, 0);
    seatAllWithBots(manager, roomCode, player.id, sessionToken);
    manager.startGame(roomCode, player.id, sessionToken);

    const botManager = new BotManager(manager);
    let safety = 0;
    while (safety < 200) {
      const room = manager.getRoom(roomCode);
      if (
        room?.game?.state.phase === "ROUND_SCORING" ||
        room?.game?.state.phase === "MATCH_OVER"
      ) {
        break;
      }

      const seat = room?.game?.state.currentTurnSeat;
      const actorId = seat !== null && seat !== undefined ? room?.seats[seat] : undefined;
      const actor = actorId ? room?.players.get(actorId) : undefined;

      if (actor?.isBot) {
        botManager.executeTurn(roomCode);
      } else if (actorId === player.id && room?.game?.state.phase === "BIDDING") {
        manager.passBid(roomCode, player.id, sessionToken);
      } else if (actorId === player.id && room?.game?.state.phase === "STAKE_MULTIPLIER") {
        manager.passStakeMultiplier(roomCode, player.id, sessionToken);
      } else if (actorId === player.id && room?.game?.playState && seat !== null && seat !== undefined) {
        const cardId = getLegalPlayMoves(room.game.playState, seat)[0];
        if (cardId) {
          manager.playCard(roomCode, player.id, sessionToken, cardId);
        }
      } else if (actorId === player.id && room?.game?.state.phase === "TRUMP_SELECTION") {
        const hand = room.game.state.handsByPlayerId[player.id] ?? [];
        const trumpSuit = SUITS.find((suit) => hand.some((card) => card.suit === suit))!;
        const concealedCardId = hand.find((card) => card.suit === trumpSuit)!.id;
        manager.selectTrump(roomCode, player.id, sessionToken, trumpSuit, concealedCardId);
      } else {
        break;
      }
      safety += 1;
    }

    const room = manager.getRoom(roomCode)!;
    expect(room.game?.lastRoundResult).toBeTruthy();
    expect(
      (room.game?.lastRoundResult?.teamAPoints ?? 0) + (room.game?.lastRoundResult?.teamBPoints ?? 0)
    ).toBe(28);
  });

  it("rejects illegal bot card plays through server validation", () => {
    const manager = seededManager();
    const created = manager.createRoom("Host", "socket-host");
    if (!created.ok) {
      return;
    }
    const { roomCode, player, sessionToken } = {
      roomCode: created.data.roomCode,
      player: created.data.player,
      sessionToken: created.data.player.sessionToken,
    };
    manager.chooseSeat(roomCode, player.id, sessionToken, 0);
    seatAllWithBots(manager, roomCode, player.id, sessionToken);
    manager.startGame(roomCode, player.id, sessionToken);

    const room = manager.getRoom(roomCode)!;
    const botId = room.seats[1]!;
    const bot = room.players.get(botId)!;
    const botManager = new BotManager(manager);
    const result = botManager.applyAction(roomCode, botId, bot.sessionToken, {
      type: "play_card",
      cardId: "not-a-real-card",
    });
    expect(result.ok).toBe(false);
  });
});
