import type { Seat } from "@twenty-eight/shared";
import { buildBotObservation } from "./botObservation";
import { heuristicBot } from "./heuristicBot";
import { randomBot } from "./randomBot";
import type { BotAction, BotDifficulty, BotStrategy } from "./botTypes";
import type { RoomActionResult, RoomManager } from "../roomManager";

function strategyFor(difficulty: BotDifficulty): BotStrategy {
  return difficulty === "heuristic" ? heuristicBot : randomBot;
}

export class BotManager {
  constructor(private readonly roomManager: RoomManager) {}

  executeTurn(roomCode: string): RoomActionResult | null {
    const room = this.roomManager.getRoom(roomCode);
    if (!room?.game) {
      return null;
    }

    const phase = room.game.state.phase;
    if (phase === "STAKE_MULTIPLIER") {
      const currentSeat = room.game.state.currentTurnSeat;
      if (currentSeat === null) {
        return null;
      }
      const playerId = room.seats[currentSeat];
      const player = playerId ? room.players.get(playerId) : undefined;
      if (player?.isBot) {
        const publicState = buildBotObservation(room, playerId!, player.botDifficulty!)?.publicState;
        if (publicState?.canDouble) {
          return this.roomManager.doubleBid(roomCode, playerId!, player.sessionToken);
        }
        if (publicState?.canRedouble) {
          return this.roomManager.redoubleBid(roomCode, playerId!, player.sessionToken);
        }
        return this.roomManager.passStakeMultiplier(roomCode, playerId!, player.sessionToken);
      }
      return null;
    }

    if (phase === "THANI_DECLARATION") {
      const declarerId = room.game.state.declarerPlayerId;
      if (!declarerId) {
        return null;
      }
      const player = room.players.get(declarerId);
      if (player?.isBot) {
        return this.roomManager.skipThaniAndPlay(roomCode, declarerId, player.sessionToken);
      }
      return null;
    }

    const currentSeat = room.game.state.currentTurnSeat;
    if (currentSeat === null) {
      return null;
    }

    const playerId = room.seats[currentSeat];
    if (!playerId) {
      return null;
    }

    const player = room.players.get(playerId);
    if (!player?.isBot || !player.botDifficulty) {
      return null;
    }

    const observation = buildBotObservation(room, playerId, player.botDifficulty);
    if (!observation) {
      return null;
    }

    const action = strategyFor(player.botDifficulty).decide(observation);
    return this.applyAction(roomCode, playerId, player.sessionToken, action);
  }

  applyAction(
    roomCode: string,
    playerId: string,
    sessionToken: string,
    action: BotAction
  ): RoomActionResult {
    switch (action.type) {
      case "bid":
        return this.roomManager.placeBid(roomCode, playerId, sessionToken, action.value);
      case "pass":
        return this.roomManager.passBid(roomCode, playerId, sessionToken);
      case "select_trump":
        return this.roomManager.selectTrump(
          roomCode,
          playerId,
          sessionToken,
          action.suit,
          action.concealedCardId
        );
      case "play_card":
        return this.roomManager.playCard(roomCode, playerId, sessionToken, action.cardId);
      default:
        return { ok: false, error: "Unknown bot action" };
    }
  }

  getCurrentBotSeat(roomCode: string): Seat | null {
    const room = this.roomManager.getRoom(roomCode);
    if (!room?.game) {
      return null;
    }

    const phase = room.game.state.phase;
    if (phase !== "BIDDING" && phase !== "STAKE_MULTIPLIER" && phase !== "TRUMP_SELECTION" && phase !== "PLAYING_TRICKS" && phase !== "THANI_DECLARATION") {
      return null;
    }

    const currentSeat = room.game.state.currentTurnSeat;
    if (currentSeat === null) {
      return null;
    }

    const playerId = room.seats[currentSeat];
    const player = playerId ? room.players.get(playerId) : undefined;
    return player?.isBot ? currentSeat : null;
  }
}
