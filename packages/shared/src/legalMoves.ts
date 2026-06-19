import type { Card, PlayedCard, Seat, Suit } from "./types";
import { cardBelongsToHand, removeCardFromHand } from "./utils";

export type PlayContext = {
  seat: Seat;
  declarerSeat: Seat;
  trumpSuit: Suit;
  trumpRevealed: boolean;
  concealedTrumpCard: Card | null;
  ledSuitIsConcealedTrump: boolean;
  mustLeadConcealedTrump: boolean;
  /** Thani / single-hand: no trump suit applies. */
  noTrump?: boolean;
};

export function hasLedSuit(hand: Card[], ledSuit: Suit): boolean {
  return hand.some((card) => card.suit === ledSuit);
}

export function getLedSuit(currentTrick: PlayedCard[]): Suit | null {
  const firstPlay = currentTrick[0];
  return firstPlay ? firstPlay.card.suit : null;
}

export function isVoidInLedSuit(hand: Card[], ledSuit: Suit): boolean {
  return !hasLedSuit(hand, ledSuit);
}

function isConcealedTrumpSuitCard(
  card: Card,
  ctx: PlayContext
): boolean {
  return !ctx.trumpRevealed && card.suit === ctx.trumpSuit;
}

function declarerMustAvoidLeadingTrump(
  hand: Card[],
  ctx: PlayContext
): Card[] {
  const nonTrumpLead = hand.filter((c) => !isConcealedTrumpSuitCard(c, ctx));
  if (nonTrumpLead.length > 0) {
    return nonTrumpLead;
  }
  return [...hand];
}

export function getLegalMoves(
  hand: Card[],
  currentTrick: PlayedCard[],
  ctx: PlayContext
): Card[] {
  const availableHand = [...hand];
  if (ctx.concealedTrumpCard && ctx.seat === ctx.declarerSeat && !ctx.trumpRevealed) {
    // Concealed card is set aside — not in active hand until reveal
  }

  if (availableHand.length === 0 && ctx.concealedTrumpCard && ctx.seat === ctx.declarerSeat) {
    return [ctx.concealedTrumpCard];
  }

  if (availableHand.length === 0) {
    return [];
  }

  if (ctx.noTrump) {
    const ledSuit = getLedSuit(currentTrick);
    if (ledSuit === null) {
      return [...availableHand];
    }
    if (hasLedSuit(availableHand, ledSuit)) {
      return availableHand.filter((card) => card.suit === ledSuit);
    }
    return [...availableHand];
  }

  const ledSuit = getLedSuit(currentTrick);
  if (ledSuit === null) {
    if (ctx.mustLeadConcealedTrump && ctx.concealedTrumpCard) {
      return [ctx.concealedTrumpCard];
    }
    if (ctx.seat === ctx.declarerSeat && !ctx.trumpRevealed) {
      return declarerMustAvoidLeadingTrump(availableHand, ctx);
    }
    return [...availableHand];
  }

  if (hasLedSuit(availableHand, ledSuit)) {
    return availableHand.filter((card) => card.suit === ledSuit);
  }

  // Void in led suit
  if (ctx.seat === ctx.declarerSeat && !ctx.trumpRevealed) {
    if (ledSuit === ctx.trumpSuit) {
      // Another player led concealed trump — cannot reveal on this trick
      const nonTrump = availableHand.filter((c) => c.suit !== ctx.trumpSuit);
      if (nonTrump.length > 0) {
        return nonTrump;
      }
      return [...availableHand];
    }
    // Void in non-trump led suit — may discard or reveal concealed trump
    const options = [...availableHand];
    if (ctx.concealedTrumpCard) {
      options.push(ctx.concealedTrumpCard);
    }
    return options;
  }

  return [...availableHand];
}

export function shouldRevealTrump(
  card: Card,
  handBeforePlay: Card[],
  ledSuit: Suit,
  trumpSuit: Suit,
  trumpRevealed: boolean,
  concealedTrumpCard: Card | null
): boolean {
  if (trumpRevealed) {
    return false;
  }

  if (concealedTrumpCard && card.id === concealedTrumpCard.id) {
    return isVoidInLedSuit(handBeforePlay, ledSuit) && ledSuit !== trumpSuit;
  }

  if (card.suit !== trumpSuit) {
    return false;
  }

  if (ledSuit === trumpSuit) {
    return false;
  }

  return isVoidInLedSuit(handBeforePlay, ledSuit);
}

export type PlayValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validatePlay(
  hand: Card[],
  currentTrick: PlayedCard[],
  cardId: string,
  ctx: PlayContext
): PlayValidationResult {
  const playingConcealed =
    ctx.concealedTrumpCard?.id === cardId && ctx.seat === ctx.declarerSeat;
  const effectiveHand = playingConcealed ? hand : hand;

  if (!playingConcealed && !cardBelongsToHand(effectiveHand, cardId)) {
    return { ok: false, reason: "Card is not in player's hand" };
  }

  if (playingConcealed && ctx.concealedTrumpCard?.id !== cardId) {
    return { ok: false, reason: "Card is not in player's hand" };
  }

  const card = playingConcealed
    ? ctx.concealedTrumpCard!
    : hand.find((candidate) => candidate.id === cardId);
  if (!card) {
    return { ok: false, reason: "Card is not in player's hand" };
  }

  const legalMoves = getLegalMoves(hand, currentTrick, ctx);
  const legalIds = new Set(legalMoves.map((m) => m.id));
  if (!legalIds.has(cardId)) {
    return { ok: false, reason: "Must follow suit when possible" };
  }

  return { ok: true };
}

export function applyPlay(
  hand: Card[],
  currentTrick: PlayedCard[],
  seat: Seat,
  playerId: string,
  cardId: string,
  ctx: PlayContext
): {
  hand: Card[];
  concealedTrumpCard: Card | null;
  currentTrick: PlayedCard[];
  trumpRevealed: boolean;
} {
  const validation = validatePlay(hand, currentTrick, cardId, ctx);
  if (!validation.ok) {
    throw new Error(validation.reason);
  }

  const playingConcealed =
    ctx.concealedTrumpCard?.id === cardId && seat === ctx.declarerSeat;
  const card = playingConcealed
    ? ctx.concealedTrumpCard!
    : hand.find((candidate) => candidate.id === cardId);
  if (!card) {
    throw new Error("Card is not in player's hand");
  }

  const ledSuit = getLedSuit(currentTrick) ?? card.suit;
  const nextTrumpRevealed = ctx.noTrump
    ? false
    : ctx.trumpRevealed ||
      shouldRevealTrump(
        card,
        hand,
        ledSuit,
        ctx.trumpSuit,
        ctx.trumpRevealed,
        ctx.concealedTrumpCard
      );

  let nextHand = hand;
  let nextConcealed = ctx.concealedTrumpCard;

  if (playingConcealed) {
    nextConcealed = null;
  } else {
    nextHand = removeCardFromHand(hand, cardId);
  }

  return {
    hand: nextHand,
    concealedTrumpCard: nextConcealed,
    currentTrick: [
      ...currentTrick,
      {
        playerId,
        seat,
        card,
      },
    ],
    trumpRevealed: nextTrumpRevealed,
  };
}

/** Legacy wrapper for tests using old signature. */
export function getLegalMovesLegacy(
  hand: Card[],
  currentTrick: PlayedCard[],
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
  seat: Seat = 0,
  declarerSeat: Seat = 0,
  concealedTrumpCard: Card | null = null
): Card[] {
  if (!trumpSuit) {
    return hand.length === 0 ? [] : [...hand];
  }
  return getLegalMoves(hand, currentTrick, {
    seat,
    declarerSeat,
    trumpSuit,
    trumpRevealed,
    concealedTrumpCard,
    ledSuitIsConcealedTrump: false,
    mustLeadConcealedTrump: false,
  });
}

export function validatePlayLegacy(
  hand: Card[],
  currentTrick: PlayedCard[],
  cardId: string,
  trumpSuit: Suit | null,
  trumpRevealed: boolean,
  seat: Seat = 0,
  declarerSeat: Seat = 0,
  concealedTrumpCard: Card | null = null
): PlayValidationResult {
  if (!trumpSuit) {
    if (!cardBelongsToHand(hand, cardId)) {
      return { ok: false, reason: "Card is not in player's hand" };
    }
    return { ok: true };
  }
  return validatePlay(hand, currentTrick, cardId, {
    seat,
    declarerSeat,
    trumpSuit,
    trumpRevealed,
    concealedTrumpCard,
    ledSuitIsConcealedTrump: false,
    mustLeadConcealedTrump: false,
  });
}
