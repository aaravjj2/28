import type { CSSProperties } from "react";
import type { PublicCard } from "@twenty-eight/shared";
import { SUIT_SYMBOLS } from "../constants";

type CardViewProps = {
  card: PublicCard;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Set when the card is wrapped by an interactive element that already has a label. */
  decorative?: boolean;
};

function isRedSuit(suit: PublicCard["suit"]): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function CardBack({
  className = "",
  size = "md",
  style,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
}) {
  return (
    <div
      className={`playing-card card-back size-${size} ${className}`}
      aria-label="Face-down card"
      style={style}
    />
  );
}

export function CardView({ card, className = "", size = "md", decorative = false }: CardViewProps) {
  const isRed = isRedSuit(card.suit);
  const suitSymbol = SUIT_SYMBOLS[card.suit];

  return (
    <div
      className={`playing-card size-${size} ${isRed ? "red" : "black"} ${className}`}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `${card.rank} of ${card.suit}`}
    >
      <div className="card-corner top-left">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
      <div className="card-center" aria-hidden="true">
        {suitSymbol}
      </div>
      <div className="card-corner bottom-right">
        <span className="card-rank">{card.rank}</span>
        <span className="card-suit">{suitSymbol}</span>
      </div>
    </div>
  );
}
