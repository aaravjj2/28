# Online 28 Card Game — Codex Starter Pack

This pack is designed to be pasted into a new repo and used with OpenAI Codex, Cursor, or another coding agent.

Bottom line: build the deterministic game engine first. Do not build UI polish until engine tests and random simulations pass.

## Recommended Build Order

1. Implement shared card constants and types.
2. Implement deck generation, shuffle, and deal.
3. Implement bidding state machine.
4. Implement trump selection and hidden trump serialization.
5. Implement legal move validation.
6. Implement trick resolution.
7. Implement round scoring.
8. Implement public state serialization.
9. Add unit tests.
10. Add 1,000-round simulation test.
11. Build Socket.IO room server.
12. Build minimal Next.js frontend.
13. Add reconnection.
14. Add timers.
15. Add UI polish.

## Suggested Stack

- TypeScript everywhere.
- Node.js backend.
- Socket.IO for multiplayer transport.
- Next.js + React frontend.
- Shared package for rules/types.
- Vitest for unit and simulation tests.
- pnpm workspace.

## Critical Rule

The server must be authoritative. The client must never decide:

- Card ownership.
- Legal moves.
- Trick winner.
- Trump state.
- Score.
- Turn order.

## How to Use With Codex

1. Create a new empty repo.
2. Copy this pack into the repo root.
3. Open the repo in Codex/Cursor.
4. Paste `.codex/MASTER_IMPLEMENTATION_PROMPT.md` into the coding agent.
5. Tell it to complete `tasks/01-engine-first.md` before touching UI.
6. Run tests after every major step.

## Definition of Done for MVP

MVP is not done until:

- Four players can complete a full match online.
- Refresh/reconnect preserves seat and hand.
- Hidden state is not leaked.
- Every round totals exactly 28 card points.
- No duplicate card exists in a round.
- 1,000 automated random simulations pass.
