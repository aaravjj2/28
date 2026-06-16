# Security Model

This document describes how the Online 28 MVP protects game integrity and hidden information.

## 1. Server-authoritative architecture

All game state mutations happen on the server using `packages/shared` engine functions. Clients send **intents** only (`place_bid`, `play_card`, etc.). The server validates each intent and broadcasts updated per-player public state.

## 2. Client sends intents only

The web client must not import or run:

- `legalMoves`
- `trickResolver`
- `scoring`
- Deal/bid/play mutation helpers

The client renders `PublicGameState` and calls socket actions. It never decides trick winners, legal cards, or scores locally.

## 3. Per-player public state serialization

`serializePublicState()` in the shared package produces a viewer-specific `PublicGameState`. The server calls `getPublicStateForPlayer(room, playerId)` and emits `room_state_updated` separately to each connected socket.

The server must **never** emit the full internal `GameState` object to clients.

## 4. Hidden trump protection

Before trump is revealed:

- Non-declarers receive `trumpSuit: null` in public state
- Only the declarer sees their chosen trump in public state
- After reveal rules trigger, all players see the revealed trump

## 5. Other-hand protection

Each player receives:

- `myHand`: only their cards
- `handCountsByPlayerId`: counts for all players, never other players' card identities

## 6. Deck-order protection

The remaining deck order and future dealt cards are server-only fields (`RoomGame.deck`). They are not included in `PublicGameState`.

## 7. Session token reconnection

Each player receives a `sessionToken` at join/create. All gameplay socket actions validate `sessionTokensMatch(stored, provided)`. Reconnect uses `join_room` with `playerId` + `sessionToken` to restore seat and hand without creating a duplicate player.

## 8. Illegal move rejection

The server rejects:

- Out-of-turn bids and plays
- Invalid bid values
- Non-declarer trump selection
- Card plays not in `getLegalPlayMoves()`
- Actions with invalid or missing session tokens

Errors are returned via socket acks and `error` events.

## 9. Known limitations

| Limitation | Impact |
|------------|--------|
| No Redis / DB | Rooms lost on restart |
| No persistent audit log | Cannot replay disputed hands after crash |
| No collusion detection | Partners can communicate out of band |
| No production auth | Anyone with room code can join |
| In-memory Map | No multi-instance scaling without shared store |

## Regression prevention checklist

Before merging gameplay changes, verify:

- [ ] Frontend does **not** import private engine rule modules (`legalMoves`, `trickResolver`, `scoring`, mutation helpers).
- [ ] Server never emits full `GameState` on any socket event.
- [ ] All gameplay socket handlers validate session token via `validateRoomPlayer`.
- [ ] Public state is generated per viewer with `getPublicStateForPlayer`.
- [ ] Tests include no-hidden-hand leakage checks (`assertPublicStateHasNoHiddenLeaks` or equivalent).
- [ ] `hand_dealt` is notification-only (no hand payload).
- [ ] E2E plays cards only via server-enabled `.hand-card.legal` buttons.

## Timer display

`turnDeadlineAt` in public state is **visual only**. Turn expiry and auto-play/auto-pass remain server-side via `TurnTimerManager`.

## Room cleanup

Stale empty lobbies (15 minutes) and completed matches (2 hours) are deleted to limit memory growth. Active games with disconnected players are not deleted aggressively.
