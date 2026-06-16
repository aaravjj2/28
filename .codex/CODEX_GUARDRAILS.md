# Codex Guardrails

Use these guardrails when instructing the coding agent.

## Do First

- Build pure engine.
- Write tests.
- Run simulation.
- Prove hidden state serialization.

## Do Not Do First

- Animations.
- Themes.
- Accounts.
- Matchmaking.
- Bots.
- Payments.
- Ranking.
- Native mobile.

## Stop Conditions

Stop and fix immediately if:

- A client receives another player's hand.
- A client receives hidden trump before reveal.
- A round has total points other than 28.
- A player can play out of turn.
- A player can play a card not in hand.
- A player can violate follow-suit rules.
- A duplicate card appears.
- The state machine allows an action in the wrong phase.

## Coding Style

- TypeScript strict mode.
- Small pure functions.
- No implicit any.
- No mutable global game state inside shared engine.
- Deterministic tests.
- Separate internal GameState from PublicGameState.
