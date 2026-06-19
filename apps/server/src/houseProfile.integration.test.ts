import { describe, expect, it } from "vitest";
import {
  getLegalBidActions,
  getLegalPlayMoves,
  isAuctionReadyForTrump,
  SUITS,
} from "@twenty-eight/shared";
import { RoomManager } from "./roomManager";

describe("house_28_16_start integration", () => {
  it("completes a full round with minimum bid 16", () => {
    const manager = new RoomManager(() => 0.42, {
      matchTargetScore: 1,
      ruleProfileId: "house_28_16_start",
      thaniEnabled: false,
    });

    const create = manager.createRoom("Host", "socket-host");
    expect(create.ok).toBe(true);
    if (!create.ok) {
      return;
    }

    const roomCode = create.data.roomCode;
    const hostId = create.data.player.id;
    const hostToken = create.data.player.sessionToken;

    for (const [name, socket] of [
      ["P1", "s1"],
      ["P2", "s2"],
      ["P3", "s3"],
    ] as const) {
      manager.joinRoom(roomCode, name, socket);
    }

    const room = manager.getRoom(roomCode)!;
    let seat = 0;
    for (const player of room.players.values()) {
      manager.chooseSeat(roomCode, player.id, player.sessionToken, seat as 0 | 1 | 2 | 3);
      seat += 1;
    }

    manager.startGame(roomCode, hostId, hostToken);

    const game = manager.getRoom(roomCode)!.game!;
    expect(game.state.ruleProfileId).toBe("house_28_16_start");
    const bidding = game.biddingState!;
    const openingActions = getLegalBidActions(bidding, bidding.currentTurnSeat);
    expect(openingActions[0]).toBe(16);

    completeBidding(manager, roomCode);
    startPlay(manager, roomCode);
    playOutRound(manager, roomCode);

    const afterRound = manager.getRoom(roomCode)!.game!;
    expect(["ROUND_SCORING", "MATCH_OVER"]).toContain(afterRound.state.phase);
    expect(afterRound.lastRoundResult).toBeTruthy();
    expect(
      (afterRound.lastRoundResult?.teamAPoints ?? 0) +
        (afterRound.lastRoundResult?.teamBPoints ?? 0)
    ).toBe(28);
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
