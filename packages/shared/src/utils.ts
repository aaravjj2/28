import type { Card, Seat, Team } from "./types";
import { PLAYER_COUNT } from "./types";

export function seatToTeam(seat: Seat): Team {
  return seat === 0 || seat === 2 ? "A" : "B";
}

export function nextSeatCounterClockwise(seat: Seat): Seat {
  return ((seat + 1) % PLAYER_COUNT) as Seat;
}

export function firstBidderSeat(dealerSeat: Seat): Seat {
  return nextSeatCounterClockwise(dealerSeat);
}

export function allSeats(): Seat[] {
  return [0, 1, 2, 3];
}

export function partnerSeat(seat: Seat): Seat {
  return ((seat + 2) % PLAYER_COUNT) as Seat;
}

export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  const index = hand.findIndex((card) => card.id === cardId);
  if (index === -1) {
    throw new Error(`Card ${cardId} not found in hand`);
  }
  return [...hand.slice(0, index), ...hand.slice(index + 1)];
}

export function cardBelongsToHand(hand: Card[], cardId: string): boolean {
  return hand.some((card) => card.id === cardId);
}
