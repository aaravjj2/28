import type { Card, Seat, Suit, Team } from "./types";
import { partnerSeat, seatToTeam } from "./utils";

export function hasTrumpPair(hand: Card[], trumpSuit: Suit): boolean {
  const trumpCards = hand.filter((c) => c.suit === trumpSuit);
  const hasKing = trumpCards.some((c) => c.rank === "K");
  const hasQueen = trumpCards.some((c) => c.rank === "Q");
  return hasKing && hasQueen;
}

export function canDeclarePair(params: {
  hand: Card[];
  trumpSuit: Suit;
  trumpRevealed: boolean;
  bid: number;
  pairMinBidToDeclare: number;
  team: Team;
  biddingTeam: Team;
}): boolean {
  if (!params.trumpRevealed) {
    return false;
  }
  if (!hasTrumpPair(params.hand, params.trumpSuit)) {
    return false;
  }
  if (params.team === params.biddingTeam && params.bid < params.pairMinBidToDeclare) {
    return false;
  }
  return true;
}

export type PairDeclaration = {
  team: Team;
  declaredBySeat: Seat;
};

export function validatePairDeclaration(params: {
  hand: Card[];
  trumpSuit: Suit;
  trumpRevealed: boolean;
  bid: number;
  pairMinBidToDeclare: number;
  seat: Seat;
  biddingTeam: Team;
  existingDeclarations: PairDeclaration[];
}): { ok: true } | { ok: false; reason: string } {
  const team = seatToTeam(params.seat);
  if (params.existingDeclarations.some((d) => d.team === team)) {
    return { ok: false, reason: "Pair already declared for this team" };
  }

  if (!canDeclarePair({
    hand: params.hand,
    trumpSuit: params.trumpSuit,
    trumpRevealed: params.trumpRevealed,
    bid: params.bid,
    pairMinBidToDeclare: params.pairMinBidToDeclare,
    team,
    biddingTeam: params.biddingTeam,
  })) {
    return { ok: false, reason: "Not eligible to declare pair" };
  }

  return { ok: true };
}

export function getEligiblePairSeats(params: {
  hands: Record<Seat, Card[]>;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  bid: number;
  pairMinBidToDeclare: number;
  biddingTeam: Team;
  existingDeclarations: PairDeclaration[];
}): Seat[] {
  const seats: Seat[] = [];
  for (const seat of [0, 1, 2, 3] as Seat[]) {
    const validation = validatePairDeclaration({
      hand: params.hands[seat],
      trumpSuit: params.trumpSuit,
      trumpRevealed: params.trumpRevealed,
      bid: params.bid,
      pairMinBidToDeclare: params.pairMinBidToDeclare,
      seat,
      biddingTeam: params.biddingTeam,
      existingDeclarations: params.existingDeclarations,
    });
    if (validation.ok) {
      seats.push(seat);
    }
  }
  return seats;
}

export function partnerHasTrumpPair(
  hands: Record<Seat, Card[]>,
  seat: Seat,
  trumpSuit: Suit
): boolean {
  return hasTrumpPair(hands[partnerSeat(seat)], trumpSuit);
}
