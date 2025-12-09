# Poker Engine Test Suite

This directory contains comprehensive tests for the poker game engine, with a focus on multiway all-in scenarios.

## Running the Tests

### Option 1: Run the multiway all-in tests directly

```bash
node server/engine/tests/PokerGame.multiwayAllin.test.js
```

### Option 2: Run from the project root

```bash
node server/engine/tests/PokerGame.multiwayAllin.test.js
```

## Test Coverage

### PokerGame.multiwayAllin.test.js

Comprehensive test suite for multiway all-in scenarios:

1. **Test 1: Basic 3-way all-in with different stacks**
   - Tests side pot calculation with 3 players having progressively larger stacks
   - Validates main pot + 2 side pots creation

2. **Test 2: Two players with same stack, one with larger**
   - Tests handling of identical contributions
   - Validates main pot + 1 side pot creation

3. **Test 3: All players with identical stacks**
   - Tests scenario with no side pots needed
   - Validates single main pot creation

4. **Test 4: Four-way all-in with progressive stacks**
   - Tests complex scenario with 4 different stack sizes
   - Validates 4 pots with correct eligibility

5. **Test 5: One player folds, 3-way all-in remaining**
   - Tests that folded players' chips go to pot but they're not eligible
   - Validates pot distribution excludes folded players

6. **Test 6: Split pot scenario - Two winners with same hand**
   - Tests equal split when multiple players tie
   - Uses royal flush on board for guaranteed split

7. **Test 7: Split pot with odd chips**
   - Tests odd chip distribution rule
   - Validates odd chip goes to player closest to left of button

8. **Test 8: Edge case - Player with minimal contribution**
   - Tests handling of very small contributions (e.g., just blinds)
   - Validates pot calculation with extreme differences

9. **Test 9: Different winners for different pots**
   - Tests complex scenario where different players win different pots
   - Validates correct hand evaluation for each pot independently

10. **Test 10: Edge case - Player without hole cards**
    - Tests validation logic that filters out invalid players
    - Ensures robustness against data inconsistencies

## Expected Output

When all tests pass, you should see:

```
╔═══════════════════════════════════════════════════════════════╗
║   MULTIWAY ALL-IN TEST SUITE                                ║
╚═══════════════════════════════════════════════════════════════╝

▶ Test 1: Basic 3-way all-in with different stacks
✓ Should create 3 pots
✓ Main pot should be 900
✓ Main pot should have 3 eligible players
...

╔═══════════════════════════════════════════════════════════════╗
║   TEST RESULTS: 10 PASSED, 0 FAILED                           ║
╚═══════════════════════════════════════════════════════════════╝

✓ All tests passed! Multiway all-in logic is working correctly.
```

## What Was Fixed

Based on code review, the following improvements were made:

### 1. Fixed `remainingPot` Logic (PokerGame.js:619-620)
**Before:**
```javascript
remainingPot -= potSize; // Could go negative
```

**After:**
```javascript
const potAmount = Math.min(potSize, remainingPot);
remainingPot -= potAmount; // Always decrements by actual amount
```

### 2. Added Validation for Side Pot Calculations (PokerGame.js:633-642)
Added validation to ensure side pots sum equals total pot:
```javascript
const totalSidePots = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
if (Math.abs(totalSidePots - this.pot) > 0.01) {
    console.error(`[ERROR] Side pot calculation mismatch!`);
}
```

### 3. Fixed Odd Chip Distribution (PokerGame.js:804-823)
**Before:** Odd chips went to first winner in array

**After:** Odd chips go to winner closest to left of button (standard poker rule)
```javascript
// Sort winners by position relative to dealer
const winnersWithPosition = winners.map(winner => {
    const winnerIdx = this.players.indexOf(winner);
    const distance = (winnerIdx - dealerIdx + this.players.length) % this.players.length;
    return { winner, distance };
});
winnersWithPosition.sort((a, b) => a.distance - b.distance);
```

### 4. Added Hole Cards Validation (PokerGame.js:778-784)
Added validation to filter out players without valid hole cards:
```javascript
const invalidPlayers = sidePot.eligiblePlayers.filter(
    p => !p.holeCards || p.holeCards.length !== 2
);
if (invalidPlayers.length > 0) {
    console.error(`[ERROR] Players without valid hole cards:`, ...);
    sidePot.eligiblePlayers = sidePot.eligiblePlayers.filter(
        p => p.holeCards && p.holeCards.length === 2
    );
}
```

## Core Algorithm Verification

The side pot calculation algorithm was verified to be **correct**:

```javascript
for (let i = 0; i < sorted.length; i++) {
    const eligiblePlayers = sorted.slice(i); // Players from i onwards
    const previousContribution = i > 0 ? sorted[i - 1].totalContribution : 0;
    const contributionAtThisLevel = player.totalContribution - previousContribution;
    const potSize = contributionAtThisLevel * eligiblePlayers.length;
}
```

This correctly creates pots by:
1. Sorting players by total contribution (ascending)
2. For each contribution level, including all players who contributed at least that much
3. Calculating pot size as (contribution delta) × (eligible players)

**Example:** A=$50, B=$100, C=$100
- Pot 1: $50 × 3 = $150 (A, B, C)
- Pot 2: $50 × 2 = $100 (B, C only - A already all-in)

## Future Enhancements

Potential additional tests to add:
- Run-it-twice scenarios with side pots
- Insurance scenarios
- Disconnection during all-in
- Integration tests with full hand simulation
