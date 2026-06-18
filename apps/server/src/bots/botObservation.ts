import {
  getLegalBidActions,
  SUITS,
  type Seat,
  type Suit,
} from "@twenty-eight/shared";
import { getPublicStateForPlayer, type Room } from "../roomManager";
import type { BotDifficulty, BotObservation } from "./botTypes";

export function buildBotObservation(
  room: Room,
  botPlayerId: string,
  difficulty: BotDifficulty
): BotObservation | null {
  const botPlayer = room.players.get(botPlayerId);
  if (!botPlayer?.isBot || botPlayer.seat === null) {
    return null;
  }

  const publicState = getPublicStateForPlayer(room, botPlayerId);
  if (!publicState) {
    return null;
  }

  const observation: BotObservation = {
    playerId: botPlayerId,
    seat: botPlayer.seat,
    difficulty,
    publicState,
  };

  if (room.game?.biddingState && publicState.phase === "BIDDING") {
    observation.legalBidActions = getLegalBidActions(room.game.biddingState, botPlayer.seat);
  }

  if (publicState.phase === "TRUMP_SELECTION" && publicState.declarerPlayerId === botPlayerId) {
    const hand = publicState.myHand;
    observation.legalTrumpSuits = SUITS.filter((suit) => hand.some((card) => card.suit === suit));
  }

  return observation;
}

export function assertBotObservationHasNoLeaks(
  observation: BotObservation,
  room: Room
): void {
  if (!room.game) {
    return;
  }

  const fullState = room.game.state;
  for (const [playerId, hand] of Object.entries(fullState.handsByPlayerId)) {
    if (playerId === observation.playerId) {
      continue;
    }
    for (const card of hand) {
      if (observation.publicState.myHand.some((mine) => mine.id === card.id)) {
        throw new Error(`Bot observation leaked card ${card.id} from player ${playerId}`);
      }
    }
  }

  if (
    observation.publicState.declarerPlayerId !== observation.playerId &&
    !observation.publicState.trumpRevealed &&
    observation.publicState.trumpSuit !== null
  ) {
    throw new Error("Bot observation leaked hidden trump to non-declarer");
  }

  if ("deck" in observation || "roundHands" in observation) {
    throw new Error("Bot observation must not include deck or roundHands");
  }
}
