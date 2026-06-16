import type { PublicCard } from "@twenty-eight/shared";
import { SUIT_SYMBOLS } from "../constants";

type CardViewProps = {
  card: PublicCard;
  className?: string;
};

export function CardView({ card, className = "" }: CardViewProps) {
  const isRed = card.suit === "hearts" || card.suit === "diamonds";
  return (
    <div className={`playing-card ${isRed ? "red" : ""} ${className}`}>
      <span>{card.rank}</span>
      <span aria-label={card.suit}>{SUIT_SYMBOLS[card.suit]}</span>
    </div>
  );
}
