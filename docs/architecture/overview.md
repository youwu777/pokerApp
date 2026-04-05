# Poker Game Application Architecture

## Overview

This poker application follows a client-server architecture with a clear separation of concerns:

- **Client**: A React-based user interface that manages the lobby and poker room views
- **Server**: A Node.js poker engine that manages game state, betting logic, and hand evaluation
- **Communication**: WebSocket-based real-time messaging between client and server

The server is the source of truth for all game state, while the client renders the UI and captures user interactions.

## System Boundaries

### Client Layer (React)

The client application is structured around a routing system with a socket context provider:

**Entry Point: `App.jsx`**

The main `App` component renders a `SocketProvider` wrapper and defines the following routes:

- `/` — Main lobby view (`<Lobby />`)
- `/room/:roomId` — Poker room view for a specific room (`<PokerRoom />`)
- Catch-all routes redirect unknown paths back to the lobby

The application redirects incomplete or malformed room URLs (e.g., `/room` or `/room/`) back to the home route to ensure valid state.

### Server Layer (Node.js)

The server manages game logic, room state, and player actions through a modular engine architecture.

**Entry Point: `server/index.js`**

The main server module imports:
- `roomManager.js` — Manages room lifecycle and state
- `handlers.js` — Handles incoming WebSocket events

**Socket Handler Layer: `handlers.js`**

The `setupSocketHandlers(io, socket)` function configures all WebSocket event listeners and handlers. Key responsibilities include:

- **Scoreboard Management**: Functions like `upsertScoreboard()` and `migrateScoreboardKey()` maintain player statistics and connection state using a `Map` keyed by player identifier (playerId, sessionToken, or socketId)
- **Player Timer Management**: Functions `startPlayerTimer()` and `stopPlayerTimer()` manage betting action timeouts and auto-advance hands when timers expire. Timers are created via `Timer.start()` with a callback function executed when the timer expires
- **Action Routing**: Directs incoming player actions to the game engine for processing

## Core Game Engine

### PokerGame

The `PokerGame` class orchestrates the overall hand lifecycle, including:

**Hand Setup**
- `startNewHand()` — Processes seated players in order, processes approved buy-ins, and initializes the hand
- `assignPositions()` — Calculates player positions (button, small blind, big blind, etc.) based on dealer button and total player count
- `moveDealerButton()` — Advances the dealer button to the next active player, handling cases where the previous dealer has left the table
- `postBlinds()` — Posts small and big blinds from the appropriate positions

**Deck Operations**
- `createDeck()` — Builds a standard 52-card deck using rank and suit combinations
- `shuffleDeck()` — Randomizes deck order using Fisher-Yates shuffling
- `dealHoleCards()` — Distributes two private cards to each non-folded player

**Community Cards**
- `dealFlop()` — Reveals three community cards (with a burn card)
- `dealTurn()` — Reveals one additional community card (with a burn card)
- `dealRiver()` — Reveals the final community card (with a burn card)
- `addCommunityCard(card)` — Adds a single community card to the board
- `runOutBoard()` — Calculates remaining community cards needed for hand completion without adding them to the board (used for special situations)

**Betting and Action**
- `processAction(player, action, amount)` — Routes player actions (fold, check, call, bet, raise, all-in) to the betting round and tracks the last aggressor
- `advanceStreet()` — Collects bets from the current round, resets player betting state for the next street, and checks for hand completion

**Hand Resolution**
- `endHand()` — Awards the pot to the winner(s), updates player stacks, and calculates rabbit hunt cards if applicable
- `calculateSidePots()` — Computes side pot structure when players are all-in at different contribution levels
- `handleShowdown(activePlayers)` — Manages the showdown reveal order based on last aggressor or dealer position
- `calculateRabbitHuntCards()` — Determines and stores cards that would have appeared if the hand continued

### BettingRound

The `BettingRound` class manages action within a single betting round:

**Action Processing**
- `processAction(player, action, amount)` — Validates that the player is the current actor and processes the action (fold, check, call, bet, raise, all-in); returns success status and detects if a fold ends the hand
- `getCurrentPlayer()` — Returns the player whose turn it is to act, automatically skipping players who are all-in or folded
- `moveToNextPlayer()` — Advances action to the next eligible player in circular order, skipping folded and all-in players

**State Checks**
- `isComplete()` — Determines if the current betting round is finished by checking:
  - If no active players remain
  - If all remaining active players have acted and matched the current bet
  - Special cases like only one player remaining or all remaining players being all-in

**Pot Collection**
- `collectBets()` — Totals all current bets from players and returns the amount collected
- `toJSON()` — Serializes the betting round state (current bet, minimum raise, pot, current player index, action count)

### HandEvaluator

The `HandEvaluator` class provides hand comparison and winner determination:

- `evaluateHand(holeCards, communityCards)` — Uses the Hand library to evaluate a five-card best hand from hole cards and community cards
- `determineWinners(playerHands)` — Identifies all winning hands when multiple players reach showdown
- `compareHands(hand1, hand2)` — Compares two hands and returns the result (1 for hand1 win, -1 for hand2 win, 0 for tie)

### Timer

The `Timer` utility class manages time-based callbacks:

- `Timer.start(delayMs, callback)` — Creates and starts a timer that executes the provided callback after the specified delay in milliseconds; returns a Timer instance that can be stopped or checked
- `stop()` — Cancels the timer and prevents the callback from executing
- `isRunning()` — Returns whether the timer is currently active

## Communication Pattern

WebSocket handlers in `handlers.js` bridge client requests and server-side game logic:

1. **Client sends action**: Player submits fold, check, call, bet, raise, or all-in via WebSocket event
2. **Server receives and validates**: `setupSocketHandlers()` receives the event and extracts player and action details
3. **Game engine processes**: Action is routed to `PokerGame.processAction()` → `BettingRound.processAction()`
4. **Timer management**: `startPlayerTimer()` and `stopPlayerTimer()` manage action timeouts using `Timer.start()` with a callback; when timers expire, the next action is automatically processed
5. **Server emits updates**: Room state is broadcast to all connected clients, triggering UI updates

## Key Design Decisions

### Betting Round Completion Logic

The `isComplete()` method uses a multi-condition check: it returns true when no active players can act (all are all-in or folded), or when all active players have acted and matched the current bet. This handles edge cases like heads-up play and all-in situations.

### Side Pot Calculation

`calculateSidePots()` handles multi-way all-in scenarios by:
1. Sorting players by total contribution across the entire hand
2. Creating separate pots at each contribution level
3. Marking eligible players for each pot based on their contribution relative to the pot level

### Scoreboard Key Migration

When a player transitions from anonymous (sessionToken-based) to authenticated (playerId-based), `migrateScoreboardKey()` preserves stats by moving the scoreboard entry from the old key to the new key while preserving all existing data.

### Rabbit Hunt Cards

The `calculateRabbitHuntCards()` method computes rabbit hunt cards only if the hand ended early (before all five community cards were dealt). These cards are calculated but not added to the board during normal play—they are revealed separately if requested.

### Timer Management

Action timers are implemented using the `Timer` utility, which provides a clean abstraction for managing time-based callbacks. Each timer instance can be independently stopped, allowing for flexible management of multiple concurrent timers (e.g., one per player action).

## Module Dependencies

See source code for full details on:
- Room management and persistence
- Player object structure and chip tracking
- Timer implementation and callback patterns
- Run It Twice and other optional hand features
- Specific WebSocket event names and message schemas