# Security and Anti-Cheat Requirements

## Main Threats

1. Client tries to play a card not in hand.
2. Client tries to play out of turn.
3. Client tries to violate follow-suit rules.
4. Client inspects payloads to see hidden trump.
5. Client inspects payloads to see other players' hands.
6. Client sends duplicate bid/play events.
7. Client reconnects as another player.

## Required Controls

- Server-authoritative GameState.
- PublicGameState per player.
- Session token per player/seat.
- Validate every event.
- Rate-limit socket events.
- Do not trust client legalCardIds.
- Log rejected actions.
- Never send deck order.
- Never send hidden trump to non-declarers.
- Never send other players' hands.

## Hidden State Rule

There must be one function responsible for public serialization:

getPublicStateForPlayer(gameState, playerId)

All outbound game state must pass through it.
