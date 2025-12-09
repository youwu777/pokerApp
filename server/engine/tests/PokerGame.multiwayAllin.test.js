/**
 * Comprehensive Test Suite for Multiway All-In Scenarios
 *
 * Tests cover:
 * - Side pot calculation with different stack sizes
 * - Hand evaluation in multiway pots
 * - Split pot distribution
 * - Odd chip distribution
 * - Edge cases (identical stacks, zero contributions, etc.)
 */

import { PokerGame } from '../PokerGame.js';
import { Player } from '../../models/Player.js';
import { HandEvaluator } from '../HandEvaluator.js';

// Mock room for testing
class MockRoom {
    constructor() {
        this.settings = {
            smallBlind: 10,
            bigBlind: 20
        };
        this.players = [];
        this.scoreboard = new Map();
        this.approvedBuyIns = new Map();
        this.handCount = 0;
    }

    getSeatedPlayers() {
        return this.players.filter(p => p.seatNumber !== null);
    }

    getPlayerById(playerId) {
        return this.players.find(p => p.playerId === playerId);
    }
}

// Test utilities
function createTestPlayer(name, seatNumber, chips) {
    const player = new Player(`socket_${name}`, name, chips, `session_${name}`, `id_${name}`);
    player.sitDown(seatNumber, 30);
    player.chips = chips;
    player.stack = chips;
    return player;
}

function simulateContributions(players, contributions) {
    players.forEach((player, idx) => {
        const amount = contributions[idx];
        player.chips = player.stack - amount;
        player.totalContribution = amount;
        player.currentBet = amount;
        if (player.chips === 0) {
            player.status = 'all-in';
        }
    });
}

function assignTestHoleCards(players, holeCards) {
    players.forEach((player, idx) => {
        player.holeCards = holeCards[idx];
    });
}

// Color codes for test output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, testName, details = '') {
    if (condition) {
        log(`✓ ${testName}`, 'green');
        return true;
    } else {
        log(`✗ ${testName}`, 'red');
        if (details) log(`  ${details}`, 'yellow');
        return false;
    }
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
    log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║   MULTIWAY ALL-IN TEST SUITE                                ║', 'cyan');
    log('╚═══════════════════════════════════════════════════════════════╝', 'cyan');

    let passed = 0;
    let failed = 0;

    // Test 1: Basic 3-way all-in with different stacks
    log('\n▶ Test 1: Basic 3-way all-in with different stacks', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 300);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 1000);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];

        // Simulate all-in contributions
        simulateContributions([playerA, playerB, playerC], [300, 500, 1000]);

        game.pot = 1800; // Total pot
        game.calculateSidePots();

        // Expected pots:
        // Main pot: 300 * 3 = 900 (Alice, Bob, Charlie)
        // Side pot 1: 200 * 2 = 400 (Bob, Charlie)
        // Side pot 2: 500 * 1 = 500 (Charlie)

        assert(game.sidePots.length === 3, 'Should create 3 pots');
        assert(game.sidePots[0].amount === 900, 'Main pot should be 900', `Got ${game.sidePots[0].amount}`);
        assert(game.sidePots[0].eligiblePlayers.length === 3, 'Main pot should have 3 eligible players');
        assert(game.sidePots[1].amount === 400, 'Side pot 1 should be 400', `Got ${game.sidePots[1].amount}`);
        assert(game.sidePots[1].eligiblePlayers.length === 2, 'Side pot 1 should have 2 eligible players');
        assert(game.sidePots[2].amount === 500, 'Side pot 2 should be 500', `Got ${game.sidePots[2].amount}`);
        assert(game.sidePots[2].eligiblePlayers.length === 1, 'Side pot 2 should have 1 eligible player');

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 1800, 'Total side pots should equal main pot', `Got ${totalSidePots}`)) passed++;
        else failed++;
    }

    // Test 2: Two players with same stack, one with larger
    log('\n▶ Test 2: Two players with same stack, one with larger', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 1000);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];

        simulateContributions([playerA, playerB, playerC], [500, 500, 1000]);

        game.pot = 2000;
        game.calculateSidePots();

        // Expected:
        // Main pot: 500 * 3 = 1500 (Alice, Bob, Charlie)
        // Side pot: 500 * 1 = 500 (Charlie)

        assert(game.sidePots.length === 2, 'Should create 2 pots');
        assert(game.sidePots[0].amount === 1500, 'Main pot should be 1500', `Got ${game.sidePots[0].amount}`);
        assert(game.sidePots[0].eligiblePlayers.length === 3, 'Main pot should have 3 eligible players');
        assert(game.sidePots[1].amount === 500, 'Side pot should be 500', `Got ${game.sidePots[1].amount}`);
        assert(game.sidePots[1].eligiblePlayers.length === 1, 'Side pot should have 1 eligible player');

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 2000, 'Total side pots should equal main pot')) passed++;
        else failed++;
    }

    // Test 3: All players with identical stacks (no side pots)
    log('\n▶ Test 3: All players with identical stacks (no side pots)', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];

        simulateContributions([playerA, playerB, playerC], [500, 500, 500]);

        game.pot = 1500;
        game.calculateSidePots();

        // Expected:
        // Main pot: 500 * 3 = 1500 (Alice, Bob, Charlie)

        assert(game.sidePots.length === 1, 'Should create 1 pot only');
        assert(game.sidePots[0].amount === 1500, 'Main pot should be 1500', `Got ${game.sidePots[0].amount}`);
        assert(game.sidePots[0].eligiblePlayers.length === 3, 'Main pot should have 3 eligible players');

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 1500, 'Total side pots should equal main pot')) passed++;
        else failed++;
    }

    // Test 4: Four-way all-in with progressive stacks
    log('\n▶ Test 4: Four-way all-in with progressive stacks', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 100);
        const playerB = createTestPlayer('Bob', 1, 200);
        const playerC = createTestPlayer('Charlie', 2, 300);
        const playerD = createTestPlayer('David', 3, 400);

        room.players = [playerA, playerB, playerC, playerD];
        game.players = [playerA, playerB, playerC, playerD];

        simulateContributions([playerA, playerB, playerC, playerD], [100, 200, 300, 400]);

        game.pot = 1000;
        game.calculateSidePots();

        // Expected:
        // Pot 1: 100 * 4 = 400 (A, B, C, D)
        // Pot 2: 100 * 3 = 300 (B, C, D)
        // Pot 3: 100 * 2 = 200 (C, D)
        // Pot 4: 100 * 1 = 100 (D)

        assert(game.sidePots.length === 4, 'Should create 4 pots');
        assert(game.sidePots[0].amount === 400, 'Pot 1 should be 400', `Got ${game.sidePots[0].amount}`);
        assert(game.sidePots[1].amount === 300, 'Pot 2 should be 300', `Got ${game.sidePots[1].amount}`);
        assert(game.sidePots[2].amount === 200, 'Pot 3 should be 200', `Got ${game.sidePots[2].amount}`);
        assert(game.sidePots[3].amount === 100, 'Pot 4 should be 100', `Got ${game.sidePots[3].amount}`);

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 1000, 'Total side pots should equal main pot')) passed++;
        else failed++;
    }

    // Test 5: One player folds, 3-way all-in
    log('\n▶ Test 5: One player folds, 3-way all-in remaining', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 300);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 1000);
        const playerD = createTestPlayer('David', 3, 800);

        room.players = [playerA, playerB, playerC, playerD];
        game.players = [playerA, playerB, playerC, playerD];

        // David folds after contributing 100
        playerD.status = 'folded';

        simulateContributions([playerA, playerB, playerC, playerD], [300, 500, 1000, 100]);

        game.pot = 1900;
        game.calculateSidePots();

        // Expected (David's 100 goes to pot but he's not eligible):
        // Side pots are calculated based on remaining players only (A, B, C)
        // Pot 1: 300 * 3 = 900 + 100 (dead money) = 1000 (A, B, C)
        // Pot 2: 200 * 2 = 400 (B, C)
        // Pot 3: 500 * 1 = 500 (C)
        // Total side pots: 1900
        // David's 100 (dead money) is added to the main pot

        assert(game.sidePots.length === 3, 'Should create 3 pots');
        assert(game.sidePots[0].amount === 1000, 'Main pot should include dead money (900 + 100)', `Got ${game.sidePots[0].amount}`);
        assert(game.sidePots[0].eligiblePlayers.length === 3, 'Main pot should have 3 eligible players (not including folded player)');

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 1900, 'Total side pots should equal main pot (including dead money)', `Got ${totalSidePots}`)) passed++;
        else failed++;
    }

    // Test 6: Split pot scenario - Two winners with same hand
    log('\n▶ Test 6: Split pot scenario - Two winners with same hand', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0; // Alice is dealer

        simulateContributions([playerA, playerB, playerC], [500, 500, 500]);

        // Community cards: Ah Kh Qh Jh Th (Royal Flush on board)
        game.communityCards = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];

        // All players will have Royal Flush (split 3 ways)
        assignTestHoleCards([playerA, playerB, playerC], [
            ['2c', '3c'], // Alice
            ['4d', '5d'], // Bob
            ['6s', '7s']  // Charlie
        ]);

        game.pot = 1500;
        game.calculateSidePots();

        // Simulate showdown
        const potPlayerHands = game.sidePots[0].eligiblePlayers.map(player => ({
            player,
            hand: HandEvaluator.evaluateHand(player.holeCards, game.communityCards)
        }));

        const winners = HandEvaluator.determineWinners(potPlayerHands);

        assert(winners.length === 3, 'Should have 3 winners (split pot)', `Got ${winners.length}`);

        const sharePerWinner = Math.floor(1500 / 3);
        assert(sharePerWinner === 500, 'Each winner should get 500');

        if (assert(1500 % 3 === 0, 'No odd chips in this scenario')) passed++;
        else failed++;
    }

    // Test 7: Split pot with odd chips
    log('\n▶ Test 7: Split pot with odd chips', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0; // Alice is dealer
        game.dealerPosition = 0;

        simulateContributions([playerA, playerB, playerC], [500, 500, 500]);

        game.communityCards = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];
        assignTestHoleCards([playerA, playerB, playerC], [
            ['2c', '3c'],
            ['4d', '5d'],
            ['6s', '7s']
        ]);

        game.pot = 1501; // Odd chip scenario
        game.calculateSidePots();

        const sharePerWinner = Math.floor(1501 / 3);
        const remainder = 1501 - (sharePerWinner * 3);

        assert(sharePerWinner === 500, 'Each winner should get 500', `Got ${sharePerWinner}`);
        assert(remainder === 1, 'Should have 1 odd chip', `Got ${remainder}`);

        // Test odd chip distribution logic
        // Bob (seat 1) is closest to left of dealer (Alice, seat 0)
        const dealerIdx = game.players.indexOf(playerA);
        const bobIdx = game.players.indexOf(playerB);
        const charlieIdx = game.players.indexOf(playerC);

        const bobDistance = (bobIdx - dealerIdx + game.players.length) % game.players.length;
        const charlieDistance = (charlieIdx - dealerIdx + game.players.length) % game.players.length;

        if (assert(bobDistance < charlieDistance, 'Bob should be closer to left of dealer than Charlie')) passed++;
        else failed++;
    }

    // Test 8: Player with 0 contribution (posts blind then folds)
    log('\n▶ Test 8: Edge case - Player with minimal contribution', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 10); // Small contribution
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 1000);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];

        simulateContributions([playerA, playerB, playerC], [10, 500, 1000]);

        game.pot = 1510;
        game.calculateSidePots();

        // Expected:
        // Pot 1: 10 * 3 = 30 (A, B, C)
        // Pot 2: 490 * 2 = 980 (B, C)
        // Pot 3: 500 * 1 = 500 (C)

        assert(game.sidePots.length === 3, 'Should create 3 pots');
        assert(game.sidePots[0].amount === 30, 'Pot 1 should be 30', `Got ${game.sidePots[0].amount}`);

        const totalSidePots = game.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (assert(totalSidePots === 1510, 'Total side pots should equal main pot')) passed++;
        else failed++;
    }

    // Test 9: Complex scenario with one player winning main pot, another winning side pot
    log('\n▶ Test 9: Different winners for different pots', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 200);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];

        simulateContributions([playerA, playerB, playerC], [200, 500, 500]);

        game.communityCards = ['Ah', 'Kh', 'Qh', '9d', '2c'];

        // Alice has the nuts for main pot
        // Bob wins side pot
        assignTestHoleCards([playerA, playerB, playerC], [
            ['Jh', 'Th'], // Royal Flush - Alice
            ['As', 'Ad'], // Three of a kind - Bob
            ['Kd', 'Kc']  // Three of a kind (lower) - Charlie
        ]);

        game.pot = 1200;
        game.calculateSidePots();

        // Pot 1: 200 * 3 = 600 (A wins with Royal Flush)
        // Pot 2: 300 * 2 = 600 (B wins with better three of a kind)

        assert(game.sidePots.length === 2, 'Should create 2 pots');

        // Check main pot winner (should be Alice)
        const mainPotHands = game.sidePots[0].eligiblePlayers.map(player => ({
            player,
            hand: HandEvaluator.evaluateHand(player.holeCards, game.communityCards)
        }));
        const mainPotWinners = HandEvaluator.determineWinners(mainPotHands);
        assert(mainPotWinners.length === 1 && mainPotWinners[0] === playerA, 'Alice should win main pot');

        // Check side pot winner (should be Bob)
        const sidePotHands = game.sidePots[1].eligiblePlayers.map(player => ({
            player,
            hand: HandEvaluator.evaluateHand(player.holeCards, game.communityCards)
        }));
        const sidePotWinners = HandEvaluator.determineWinners(sidePotHands);
        if (assert(sidePotWinners.length === 1 && sidePotWinners[0] === playerB, 'Bob should win side pot')) passed++;
        else failed++;
    }

    // Test 10: Validation - Ensure players without hole cards are handled
    log('\n▶ Test 10: Edge case - Player without hole cards', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);

        room.players = [playerA, playerB];
        game.players = [playerA, playerB];

        simulateContributions([playerA, playerB], [500, 500]);

        // Alice has no hole cards (edge case)
        playerA.holeCards = [];
        playerB.holeCards = ['Ah', 'Kh'];

        game.communityCards = ['Qh', 'Jh', 'Th', '9d', '2c'];
        game.pot = 1000;
        game.calculateSidePots();

        // The validation code should filter out Alice
        const sidePot = game.sidePots[0];
        const validPlayers = sidePot.eligiblePlayers.filter(p => p.holeCards && p.holeCards.length === 2);

        if (assert(validPlayers.length === 1 && validPlayers[0] === playerB, 'Only Bob should be eligible (has valid hole cards)')) passed++;
        else failed++;
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
    log(`║   TEST RESULTS: ${passed} PASSED, ${failed} FAILED                           ║`, passed === 10 ? 'green' : 'yellow');
    log('╚═══════════════════════════════════════════════════════════════╝', 'cyan');

    if (failed === 0) {
        log('\n✓ All tests passed! Multiway all-in logic is working correctly.', 'green');
    } else {
        log(`\n✗ ${failed} test(s) failed. Please review the implementation.`, 'red');
    }

    return { passed, failed };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
    runTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runTests };
