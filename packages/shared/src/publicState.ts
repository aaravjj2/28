import type { GameState, PublicCard, PublicGameState, Suit } from "./types";
import { SUITS } from "./cards";
import { computeLivePointTracker } from "./pointTracking";
import { getAdjustedBidTarget, getRuleProfile, getStakeLevel } from "./ruleProfiles";
import { canDeclarePair } from "./pair";

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
  const isDeclarer = state.declarerPlayerId === viewerPlayerId;
  const canSeeTrump =
    state.trumpRevealed ||
    isDeclarer ||
    state.phase === "ROUND_SCORING" ||
    state.phase === "MATCH_OVER";

  const profile = getRuleProfile(state.ruleProfileId ?? "standard_28");

  const handCountsByPlayerId = Object.fromEntries(
    state.players.map((player) => [
      player.id,
      (state.handsByPlayerId[player.id] ?? []).length +
        (isDeclarer && player.id === viewerPlayerId && state.concealedTrumpCardId ? 1 : 0),
    ])
  );

  const pairStatus = state.pairStatus ?? {
    bidderPairDeclared: false,
    defenderPairDeclared: false,
    adjustedBidTarget: state.currentBid ?? 0,
  };

  let pointTracker = state.pointTracker;
  if (
    !pointTracker &&
    state.biddingTeam &&
    state.currentBid !== null &&
    state.completedTricks.length > 0
  ) {
    pointTracker = computeLivePointTracker({
      completedTricks: state.completedTricks,
      biddingTeam: state.biddingTeam,
      bid: state.currentBid,
      profile,
      bidderPairDeclared: pairStatus.bidderPairDeclared,
      defenderPairDeclared: pairStatus.defenderPairDeclared,
      honoursStakeResolved: state.honoursStakeResolved,
      doubleMultiplier: state.stakeMultiplier,
    });
  }

  const viewerSeat = state.players.find((p) => p.id === viewerPlayerId)?.seat ?? null;
  let myConcealedTrumpCard: PublicCard | null | undefined;
  if (isDeclarer && state.concealedTrumpCardId && !state.trumpRevealed) {
    const concealed = viewerHand.find((c) => c.id === state.concealedTrumpCardId);
    if (!concealed) {
      // Card is set aside — expose from server state if stored in full state
      myConcealedTrumpCard = null;
    }
  }

  const stakeLevel =
    state.currentBid !== null ? getStakeLevel(state.currentBid, profile) : null;

  return {
    phase: state.phase,
    ruleProfileId: state.ruleProfileId ?? "standard_28",
    dealerSeat: state.dealerSeat,
    currentTurnSeat: state.currentTurnSeat,
    players: state.players.map((player) => ({
      id: player.id,
      displayName: player.displayName,
      seat: player.seat,
      connected: player.connected,
      isHost: player.isHost,
      team: player.team,
      isBot: player.isBot,
      botDifficulty: player.botDifficulty,
    })),
    myHand: viewerHand.map(toPublicCard),
    myConcealedTrumpCard,
    handCountsByPlayerId,
    bids: state.bids,
    currentBid: state.currentBid,
    highestBidderPlayerId: state.highestBidderPlayerId,
    passedPlayerIds: state.passedPlayerIds,
    declarerPlayerId: state.declarerPlayerId,
    biddingTeam: state.biddingTeam,
    trumpSuit: canSeeTrump ? state.trumpSuit : null,
    trumpRevealed: state.trumpRevealed,
    thaniDeclared: state.thaniDeclared ?? false,
    pairStatus,
    pointTracker,
    stakeLevel,
    stakeMultiplier: state.stakeMultiplier ?? 1,
    honoursStakeResolved: state.honoursStakeResolved,
    redealEligible: state.redealEligible ?? false,
    canRequestRedeal: state.redealEligible ?? false,
    canDouble: false,
    canRedouble: false,
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

  if (
    !isDeclarer &&
    fullState.concealedTrumpCardId &&
    !publicState.trumpRevealed &&
    publicState.myConcealedTrumpCard
  ) {
    throw new Error("Public state leaked concealed trump card to non-declarer");
  }

  if (
    !isDeclarer &&
    fullState.concealedTrumpCardId &&
    !publicState.trumpRevealed &&
    publicState.myHand.some((c) => c.id === fullState.concealedTrumpCardId)
  ) {
    throw new Error("Public state leaked concealed trump card in hand to non-declarer");
  }
}

export function buildPairStatus(params: {
  bid: number;
  profileId: GameState["ruleProfileId"];
  biddingTeam: "A" | "B";
  pairDeclarations: Array<{ team: "A" | "B" }>;
}): GameState["pairStatus"] {
  const profile = getRuleProfile(params.profileId ?? "standard_28");
  const bidderPairDeclared = params.pairDeclarations.some((d) => d.team === params.biddingTeam);
  const defenderPairDeclared = params.pairDeclarations.some((d) => d.team !== params.biddingTeam);
  const adjustedBidTarget = getAdjustedBidTarget(
    params.bid,
    profile,
    bidderPairDeclared,
    defenderPairDeclared
  );

  return {
    bidderPairDeclared,
    defenderPairDeclared,
    adjustedBidTarget,
  };
}

export function canViewerDeclarePair(
  state: GameState,
  viewerPlayerId: string
): boolean {
  if (!state.trumpRevealed || !state.trumpSuit || state.currentBid === null || !state.biddingTeam) {
    return false;
  }
  const viewer = state.players.find((p) => p.id === viewerPlayerId);
  if (!viewer) {
    return false;
  }
  const profile = getRuleProfile(state.ruleProfileId ?? "standard_28");
  const hand = state.handsByPlayerId[viewerPlayerId] ?? [];
  return canDeclarePair({
    hand,
    trumpSuit: state.trumpSuit,
    trumpRevealed: state.trumpRevealed,
    bid: state.currentBid,
    pairMinBidToDeclare: profile.pairMinBidToDeclare,
    team: viewer.team,
    biddingTeam: state.biddingTeam,
  });
}
