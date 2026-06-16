import { MAX_BID, MIN_BID, type Suit } from "@twenty-eight/shared";

export const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "";

export const SUIT_LABELS: Record<Suit, string> = {
  hearts: "Hearts ♥",
  diamonds: "Diamonds ♦",
  clubs: "Clubs ♣",
  spades: "Spades ♠",
};

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export function getBidButtonValues(currentBid: number | null): number[] {
  const minimum = currentBid === null ? MIN_BID : currentBid + 1;
  const values: number[] = [];
  for (let bid = minimum; bid <= MAX_BID; bid += 1) {
    values.push(bid);
  }
  return values;
}

export function seatLabel(seat: number): string {
  return `Seat ${seat}`;
}

export function teamForSeat(seat: number): "A" | "B" {
  return seat === 0 || seat === 2 ? "A" : "B";
}
