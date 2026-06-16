# PRD: Online Multiplayer Indian Card Game 28

## Product Summary

Build an online multiplayer version of the Indian card game 28, a four-player partnership trick-taking game using a 32-card deck. The product supports real-time rooms, private invite codes, bidding, hidden trump, trick play, scoring, reconnection, and mobile browser play.

## Product Principle

Correctness beats UI. Build the engine first. UI cannot compensate for broken scoring, trump leaks, duplicate cards, or invalid move handling.

## Users

Primary users are Indian card game players who want to play 28 remotely with friends. Secondary users are casual card players familiar with 29-style trick games.

## MVP Features

- Real-time 4-player private rooms.
- Invite code and invite link.
- Fixed partnerships.
- 32-card deck.
- Bidding phase.
- Hidden trump selection.
- Trick play.
- Follow-suit validation.
- Trump reveal logic.
- Score tracking.
- Match target score.
- Reconnection.
- Turn timer.
- Basic chat/preset reactions.
- Rules screen.

## Out of Scope for MVP

- Real-money gambling.
- Public matchmaking.
- Rankings.
- Tournaments.
- Bot opponents.
- Native mobile apps.
- Payments.
- Complex animations.

## Rules

Deck: 7, 8, Q, K, 10, A, 9, J in each suit.

Suits: hearts, diamonds, clubs, spades.

Card strength high to low: J, 9, A, 10, K, Q, 8, 7.

Point values:

- J = 3
- 9 = 2
- A = 1
- 10 = 1
- K/Q/8/7 = 0

Total deck points = 28.

Players: 4.

Teams:

- Team A: seats 0 and 2.
- Team B: seats 1 and 3.

Deal:

- Deal 4 cards to each player.
- Bid.
- Winning bidder selects trump privately.
- Deal remaining 4 cards.

Bidding:

- Minimum bid: 14.
- Maximum bid: 28.
- Bid must exceed current bid.
- Pass means out.
- Last remaining highest bidder becomes declarer.

Trump:

- Declarer selects trump suit privately.
- Trump remains hidden until revealed.
- Hidden trump is revealed when a player who cannot follow suit chooses to play trump.

Trick play:

- Must follow led suit if possible.
- If void in led suit, player may play any card.
- Highest trump wins if trump is played.
- Otherwise highest led suit card wins.
- Trick winner leads next trick.

Scoring:

- Sum captured points by team.
- Bidding team must score at least bid.
- If bidding team succeeds, bidding team gains 1 match point.
- If bidding team fails, defending team gains 1 match point.
- Default match target: 6.

## Architecture

Use a server-authoritative model. The backend owns the canonical GameState. Clients receive only PublicGameState scoped to that player.

Recommended stack:

- Next.js + React + TypeScript frontend.
- Node.js + TypeScript backend.
- Socket.IO real-time layer.
- Shared TypeScript package for game rules.
- Vitest for tests.
- Redis for room state in production.
- PostgreSQL later for users and match history.

## Acceptance Criteria

- Four real players can complete a match.
- Refresh/reconnect preserves player seat and hand.
- Hidden information is not leaked.
- Every completed round totals exactly 28 card points.
- No duplicate card exists in a round.
- Illegal moves are rejected server-side.
- A match ends correctly at target score.
- Mobile browser layout is usable.
- 1,000 random simulation rounds pass.
