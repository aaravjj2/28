import type { RoundHands, Seat } from "./types";
import { firstBidderSeat } from "./utils";

export const MAX_REDEALS = 3;

export function firstBidderHasNoPointCards(hands: RoundHands, dealerSeat: Seat): boolean {
  const seat = firstBidderSeat(dealerSeat);
  const cards = hands[seat];
  return cards.length > 0 && cards.every((card) => card.points === 0);
}

export function shouldOfferFirstBidderRedeal(
  hands: RoundHands,
  dealerSeat: Seat,
  redealCount: number
): boolean {
  if (redealCount >= MAX_REDEALS) {
    return false;
  }
  return firstBidderHasNoPointCards(hands, dealerSeat);
}

export function allActiveBiddersPassed(state: {
  activeSeats: Seat[];
  currentBid: number | null;
}): boolean {
  return state.activeSeats.length === 0 && state.currentBid === null;
}
