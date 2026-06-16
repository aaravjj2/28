import type { GameState, PublicCard, PublicGameState, Suit } from "./types";
import { SUITS } from "./cards";

function toPublicCard(card: { id: string; suit: Suit; rank: PublicCard["rank"]; points: number }): PublicCard {
  return {
    id: card.id,
    suit: card.suit,
    rank: card.rank,
    points: card.points,
  };
}

export function serializePublicState(
  state: GameState,
  viewerPlayerId: string
): PublicGameState {
  const viewerHand = state.handsByPlayerId[viewerPlayerId] ?? [];
  const canSeeTrump =
    state.trumpRevealed ||
    state.declarerPlayerId === viewerPlayerId ||
    state.phase === "ROUND_SCORING" ||
    state.phase === "MATCH_OVER";

  const handCountsByPlayerId = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      (state.handsByPlayerId[player.id] ?? []).length,
    ])
  );

  return {
    phase: state.phase,
    dealerSeat: state.dealerSeat,
    currentTurnSeat: state.currentTurnSeat,
    players: state.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      seat: player.seat,
      connected: player.connected,
      isHost: player.isHost,
      team: player.team,
    })),
    myHand: viewerHand.map(toPublicCard),
    handCountsByPlayerId,
    bids: state.bids,
    currentBid: state.currentBid,
    highestBidderPlayerId: state.highestBidderPlayerId,
    passedPlayerIds: state.passedPlayerIds,
    declarerPlayerId: state.declarerPlayerId,
    biddingTeam: state.biddingTeam,
    trumpSuit: canSeeTrump ? state.trumpSuit : null,
    trumpRevealed: state.trumpRevealed,
    currentTrick: state.currentTrick.map((play) => ({
      playerId: play.playerId,
      seat: play.seat,
      card: toPublicCard(play.card),
    })),
    completedTricks: state.completedTricks.map((trick) => ({
      trickNumber: trick.trickNumber,
      ledSuit: trick.ledSuit,
      playedCards: trick.playedCards.map((play) => ({
        playerId: play.playerId,
        seat: play.seat,
        card: toPublicCard(play.card),
      })),
      winnerPlayerId: trick.winnerPlayerId,
      winnerTeam: trick.winnerTeam,
      points: trick.points,
    })),
    roundNumber: state.roundNumber,
    matchScore: state.matchScore,
    targetScore: state.targetScore,
  };
}

export function validateTrumpSelection(
  declarerPlayerId: string,
  viewerPlayerId: string,
  trumpSuit: Suit
): { ok: true } | { ok: false; reason: string } {
  if (declarerPlayerId !== viewerPlayerId) {
    return { ok: false, reason: "Only the declarer can select trump" };
  }

  if (!SUITS.includes(trumpSuit)) {
    return { ok: false, reason: "Invalid trump suit" };
  }

  return { ok: true };
}

export function assertPublicStateHasNoHiddenLeaks(
  publicState: PublicGameState,
  viewerPlayerId: string,
  fullState: GameState
): void {
  const otherHands = Object.entries(fullState.handsByPlayerId).filter(
    ([playerId]) => playerId !== viewerPlayerId
  ) as Array<[string, GameState["handsByPlayerId"][string]]>;

  for (const [, hand] of otherHands) {
    for (const card of hand) {
      const leaked = publicState.myHand.some((viewerCard) => viewerCard.id === card.id);
      if (leaked) {
        throw new Error(`Public state leaked another player's card: ${card.id}`);
      }
    }
  }

  const isDeclarer = fullState.declarerPlayerId === viewerPlayerId;
  if (!isDeclarer && !publicState.trumpRevealed && publicState.trumpSuit !== null) {
    throw new Error("Public state leaked hidden trump suit to non-declarer");
  }
}
