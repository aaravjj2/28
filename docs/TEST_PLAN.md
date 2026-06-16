# Test Plan

## Unit Tests

Required before server work:

- createDeck returns 32 unique cards.
- createDeck total points equal 28.
- rank strength order is J > 9 > A > 10 > K > Q > 8 > 7.
- deal distributes 8 cards to each player.
- no duplicate card appears after deal.
- minimum bid is 14.
- max bid is 28.
- equal/lower bid is rejected.
- pass means player is out.
- only declarer can select trump.
- legal move requires follow suit.
- void player can play off suit.
- void player can reveal trump by playing trump.
- no-trump trick resolves to highest led suit.
- trump trick resolves to highest trump.
- captured trick points are correct.
- final round points total 28.

## Simulation Test

Run 1,000 random legal full rounds.

Assert:

- 4 players.
- 32 unique cards.
- 8 tricks per round.
- 4 cards per trick.
- every player plays 8 cards.
- no duplicate played card.
- total captured points equal 28.
- scoring produces a valid winner.

## Multiplayer Integration Tests

- Create room.
- Join 4 players.
- Choose seats.
- Start game.
- Complete bidding.
- Select trump.
- Play all tricks.
- Score round.
- Reconnect one player.
- Reject invalid action.
- Reject hidden-state leak.
