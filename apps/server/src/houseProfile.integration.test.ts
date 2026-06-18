import { describe, expect, it } from "vitest";
import { getLegalBidActions, isAuctionReadyForTrump } from "@twenty-eight/shared";
import { RoomManager } from "./roomManager";

describe("house_28_16_start integration", () => {
  it("runs a full round with minimum bid 16", () => {
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

    let safety = 0;
    while (safety < 20) {
      const liveGame = manager.getRoom(roomCode)!.game!;
      const current = liveGame.biddingState;
      if (!current || isAuctionReadyForTrump(current)) {
        break;
      }
      const turnSeat = current.currentTurnSeat;
      const playerId = manager.getRoom(roomCode)!.seats[turnSeat]!;
      const token = manager.getRoom(roomCode)!.players.get(playerId)!.sessionToken;
      if (
        liveGame.state.phase === "STAKE_MULTIPLIER" ||
        current.stakeMultiplierPhase === "defender" ||
        current.stakeMultiplierPhase === "bidder"
      ) {
        manager.passStakeMultiplier(roomCode, playerId, token);
        safety += 1;
        continue;
      }
      const actions = getLegalBidActions(current, turnSeat);
      if (actions.includes("PASS")) {
        manager.passBid(roomCode, playerId, token);
      } else if (typeof actions[0] === "number") {
        manager.placeBid(roomCode, playerId, token, actions[0]!);
      }
      safety += 1;
    }

    const afterBid = manager.getRoom(roomCode)!.game!;
    expect(
      isAuctionReadyForTrump(afterBid.biddingState!) ||
        afterBid.playState !== null ||
        afterBid.state.phase === "TRUMP_SELECTION"
    ).toBe(true);
  });
});
