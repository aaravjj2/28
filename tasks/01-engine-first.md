# Task 01 — Engine First

Build only the shared game engine. Do not build UI yet.

## Files to Create

- packages/shared/src/types.ts
- packages/shared/src/cards.ts
- packages/shared/src/deal.ts
- packages/shared/src/bidding.ts
- packages/shared/src/legalMoves.ts
- packages/shared/src/trickResolver.ts
- packages/shared/src/scoring.ts
- packages/shared/src/publicState.ts
- packages/shared/src/simulation.ts
- packages/shared/src/index.ts

## Requirements

- Use TypeScript strict types.
- Keep functions pure where possible.
- Do not use client-specific code.
- Make all game rules testable.

## Tests Required

- Deck has 32 cards.
- Deck has total 28 points.
- Card strength order is correct.
- Deal creates 4 hands of 8 cards.
- No duplicate cards after deal.
- Bidding rejects bad bids.
- Trump selection only by declarer.
- Legal move engine enforces follow suit.
- Trick resolver works with no trump.
- Trick resolver works with trump.
- Scoring totals 28.
- Random simulation passes 1,000 rounds.
