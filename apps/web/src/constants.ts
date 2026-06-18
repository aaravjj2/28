import {
  getRuleProfile,
  MAX_BID,
  MIN_BID,
  type RuleProfileId,
  type Suit,
} from "@twenty-eight/shared";

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

export type TablePosition = "bottom" | "left" | "top" | "right";

const TABLE_POSITIONS: TablePosition[] = ["bottom", "left", "top", "right"];

export function seatToTablePosition(mySeat: number, targetSeat: number): TablePosition {
  const offset = ((targetSeat - mySeat) % 4 + 4) % 4;
  return TABLE_POSITIONS[offset]!;
}

export function getBidButtonValues(
  currentBid: number | null,
  options?: { ruleProfileId?: RuleProfileId; minBid?: number; maxBid?: number }
): number[] {
  const profile = options?.ruleProfileId
    ? getRuleProfile(options.ruleProfileId)
    : null;
  const profileMin = options?.minBid ?? profile?.minBid ?? MIN_BID;
  const profileMax = options?.maxBid ?? profile?.maxBid ?? MAX_BID;
  const minimum = currentBid === null ? profileMin : currentBid + 1;
  const values: number[] = [];
  for (let bid = minimum; bid <= profileMax; bid += 1) {
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
