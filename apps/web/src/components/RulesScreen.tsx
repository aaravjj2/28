import { useGame } from "../context/GameContext";

export function RulesScreen() {
  const { setScreen } = useGame();

  return (
    <div className="page">
      <h1 className="title">Rules</h1>
      <div className="card-panel rules-content">
        <p>28 is a four-player partnership trick-taking card game played in India.</p>

        <h2>Deck</h2>
        <ul>
          <li>32 cards: 7, 8, Q, K, 10, A, 9, J in each suit.</li>
          <li>Card strength: J &gt; 9 &gt; A &gt; 10 &gt; K &gt; Q &gt; 8 &gt; 7.</li>
          <li>Point cards: J = 3, 9 = 2, A = 1, 10 = 1. Total deck points = 28.</li>
        </ul>

        <h2>Partnerships</h2>
        <ul>
          <li>Team A: Seat 0 and Seat 2.</li>
          <li>Team B: Seat 1 and Seat 3.</li>
        </ul>

        <h2>Bidding</h2>
        <ul>
          <li>Each player receives 4 cards, then bids from 14 to 28.</li>
          <li>Each bid must beat the current bid.</li>
          <li>Pass means you are out of the auction.</li>
          <li>The highest bidder becomes declarer.</li>
        </ul>

        <h2>Hidden trump</h2>
        <ul>
          <li>Declarer secretly chooses a trump suit.</li>
          <li>Trump stays hidden until revealed during play.</li>
          <li>Trump is revealed when a void player plays a trump-suit card.</li>
        </ul>

        <h2>Play</h2>
        <ul>
          <li>Remaining 4 cards are dealt for 8-card hands.</li>
          <li>Declarer leads the first trick.</li>
          <li>Follow suit when possible.</li>
          <li>If void, any card may be played.</li>
          <li>Highest trump wins if trump is in play; otherwise highest led suit wins.</li>
        </ul>

        <h2>Scoring</h2>
        <ul>
          <li>Captured card points are totaled per team each round.</li>
          <li>Bidding team must meet or exceed its bid to win the round point.</li>
          <li>Otherwise the defending team wins the round point.</li>
          <li>First team to reach the match target wins.</li>
        </ul>

        <button type="button" className="btn-secondary" onClick={() => setScreen("home")}>
          Back
        </button>
      </div>
    </div>
  );
}
