import type { PublicCard } from "@twenty-eight/shared";
import { CardView } from "./CardView";

type PlayerHandProps = {
  hand: PublicCard[];
  legalCardIds?: string[];
  disabled?: boolean;
  onPlayCard: (cardId: string) => void;
  /** When set, only cards matching this suit are selectable (trump selection). */
  suitFilter?: PublicCard["suit"];
  onSelectCard?: (cardId: string) => void;
};

export function PlayerHand({
  hand,
  legalCardIds,
  disabled = false,
  onPlayCard,
  suitFilter,
  onSelectCard,
}: PlayerHandProps) {
  const visibleHand = suitFilter ? hand.filter((card) => card.suit === suitFilter) : hand;
  const count = visibleHand.length;
  const spread = count <= 1 ? 0 : Math.min(14, 52 / count);

  return (
    <div className="hand-fan" aria-label="Your hand">
      {visibleHand.map((card, index) => {
        const isLegal = legalCardIds ? legalCardIds.includes(card.id) : true;
        const isSelectable = suitFilter ? true : isLegal;
        const rotation = count <= 1 ? 0 : -spread / 2 + (index * spread) / Math.max(count - 1, 1);
        const offset = (index - (count - 1) / 2) * 10;

        return (
          <button
            key={card.id}
            type="button"
            className={`hand-card-btn ${isLegal && !suitFilter ? "legal" : ""} ${suitFilter ? "selectable" : ""}`}
            disabled={disabled || !isSelectable}
            style={{
              transform: `translateX(${offset}px) rotate(${rotation}deg)`,
              zIndex: index,
            }}
            onClick={() => {
              if (onSelectCard) {
                onSelectCard(card.id);
              } else {
                onPlayCard(card.id);
              }
            }}
            aria-label={`${card.rank} of ${card.suit}`}
          >
            <CardView card={card} size="lg" decorative />
          </button>
        );
      })}
    </div>
  );
}
