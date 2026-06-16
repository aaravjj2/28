# Task 02 — Multiplayer Server

Build the Socket.IO server only after Task 01 passes.

## Files to Create

- apps/server/src/index.ts
- apps/server/src/roomManager.ts
- apps/server/src/socketHandlers.ts
- apps/server/src/session.ts
- apps/server/src/timers.ts

## Events

Client to server:

- create_room
- join_room
- choose_seat
- start_game
- place_bid
- pass_bid
- select_trump
- play_card
- request_state_sync
- start_next_round
- rematch

Server to client:

- room_state_updated
- game_started
- bidding_updated
- trump_selected_hidden
- trump_revealed
- trick_updated
- trick_completed
- round_completed
- match_completed
- error
- reconnect_success

## Rules

- Validate every action server-side.
- Emit player-scoped PublicGameState.
- Never emit full GameState.
- Preserve seats during disconnect.
- Use session tokens for reconnect.
