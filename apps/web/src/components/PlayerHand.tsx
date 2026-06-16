import type { PublicCard } from "@twenty-eight/shared";
import { SUIT_SYMBOLS } from "../constants";

type PlayerHandProps = {
  hand: PublicCard[];
  legalCardIds?: string[];
  disabled?: boolean;
  onPlayCard: (cardId: string) => void;
};

export function PlayerHand({ hand, legalCardIds, disabled = false, onPlayCard }: PlayerHandProps) {
  return (
    <div className="hand-row" aria-label="Your hand">
      {hand.map((card) => {
        const isLegal = legalCardIds ? legalCardIds.includes(card.id) : true;
        const isRed = card.suit === "hearts" || card.suit === "diamonds";
        return (
          <button
            key={card.id}
            type="button"
            className={`hand-card ${isRed ? "red" : ""} ${isLegal ? "legal" : ""}`}
            disabled={disabled || !isLegal}
            onClick={() => onPlayCard(card.id)}
            aria-label={`${card.rank} of ${card.suit}`}
          >
            <span>{card.rank}</span>
            <span>{SUIT_SYMBOLS[card.suit]}</span>
          </button>
        );
      })}
    </div>
  );
}
