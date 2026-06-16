# Codex Master Implementation Prompt

Build a production-quality online multiplayer web version of the Indian card game 28 using TypeScript.

Use a server-authoritative architecture. Start by implementing the shared pure game engine before building UI.

## Core Requirements

Implement:

1. 32-card deck.
2. Four players.
3. Fixed partnerships: seats 0 + 2 vs seats 1 + 3.
4. Initial 4-card deal.
5. Bidding from 14 to 28.
6. Pass means out.
7. Winning bidder selects hidden trump suit.
8. Remaining 4-card deal.
9. Trick play with follow-suit enforcement.
10. Hidden trump reveal when a void player chooses trump.
11. Trick winner resolution.
12. Round scoring: total points must equal 28.
13. Match score to target score, default 6.
14. Public state serialization that hides hands and hidden trump.
15. Socket.IO multiplayer rooms.
16. Minimal responsive React UI.
17. Reconnection with session tokens.
18. Turn timer.
19. Unit tests and random simulation tests.

## Hard Constraints

- Do not expose full GameState to clients.
- Do not expose other players' hands.
- Do not expose hidden trump suit to non-declarers.
- Do not trust client actions.
- Validate every socket event server-side.
- Keep the game engine pure and testable.
- Do not build animations before engine tests pass.
- Do not add real-money gambling, betting, or prize mechanics.

## First Milestone

Only create the shared engine first:

- packages/shared/src/types.ts
- packages/shared/src/cards.ts
- packages/shared/src/deal.ts
- packages/shared/src/bidding.ts
- packages/shared/src/legalMoves.ts
- packages/shared/src/trickResolver.ts
- packages/shared/src/scoring.ts
- packages/shared/src/publicState.ts
- packages/shared/src/simulation.ts
- packages/shared/src/*.test.ts

Run all tests. The simulation must run 1,000 full random legal rounds and assert:

- No duplicate cards.
- Every player receives 8 cards.
- Every player plays 8 cards.
- There are exactly 8 tricks.
- Total captured points equal 28.
- Round scoring succeeds.

Only after this passes, build server and frontend.
