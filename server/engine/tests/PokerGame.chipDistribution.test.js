/**
 * Comprehensive Test Suite for Chip Distribution After Showdown
 *
 * Tests verify that chips are correctly distributed to players based on:
 * - Who wins which pot
 * - Split pots among tied winners
 * - Odd chip distribution
 * - Complex scenarios with different winners for different pots
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

function simulateAllIn(players, contributions, holeCards) {
    players.forEach((player, idx) => {
        const amount = contributions[idx];
        player.totalContribution = amount;
        player.currentBet = amount;
        player.chips = player.stack - amount;
        player.holeCards = holeCards[idx];
        if (player.chips === 0) {
            player.status = 'all-in';
        }
    });
}

// Color codes for test output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function assert(condition, testName, details = '') {
    if (condition) {
        log(`  ✓ ${testName}`, 'green');
        return true;
    } else {
        log(`  ✗ ${testName}`, 'red');
        if (details) log(`    ${details}`, 'yellow');
        return false;
    }
}

// ============================================================================
// CHIP DISTRIBUTION TEST SUITE
// ============================================================================

async function runChipDistributionTests() {
    log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
    log('║   CHIP DISTRIBUTION AFTER SHOWDOWN TEST SUITE              ║', 'cyan');
    log('╚═══════════════════════════════════════════════════════════════╝', 'cyan');

    let passed = 0;
    let failed = 0;

    // Test 1: Simple winner takes all
    log('\n▶ Test 1: Simple winner takes all (no side pots)', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', 'Kh', 'Qh', '9d', '2c'];

        // Alice has best hand, Bob second, Charlie worst
        simulateAllIn(
            [playerA, playerB, playerC],
            [500, 500, 500],
            [
                ['Jh', 'Th'], // Alice - Royal Flush
                ['As', 'Kd'], // Bob - Two pair
                ['7s', '8s']  // Charlie - High card
            ]
        );

        game.pot = 1500;
        game.calculateSidePots();

        // Simulate showdown
        const results = game.handleShowdown([playerA, playerB, playerC]);

        assert(playerA.chips === 1500, 'Alice should have 1500 chips', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should have 0 chips', `Got ${playerB.chips}`);
        assert(playerC.chips === 0, 'Charlie should have 0 chips', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1500, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 2: Different winners for main pot and side pot
    log('\n▶ Test 2: Player A wins main pot, Player C wins side pot', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 200);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', 'Kh', 'Qh', '9d', '2c'];

        // Alice has nuts but short stack, Charlie has second best, Bob has worst
        simulateAllIn(
            [playerA, playerB, playerC],
            [200, 500, 500],
            [
                ['Jh', 'Th'], // Alice - Royal Flush (short stack)
                ['7s', '8s'], // Bob - High card
                ['As', 'Kd']  // Charlie - Two pair
            ]
        );

        game.pot = 1200;
        game.calculateSidePots();

        log('  Before showdown:', 'magenta');
        log(`    Alice: ${playerA.chips} chips`, 'magenta');
        log(`    Bob: ${playerB.chips} chips`, 'magenta');
        log(`    Charlie: ${playerC.chips} chips`, 'magenta');

        const results = game.handleShowdown([playerA, playerB, playerC]);

        log('  After showdown:', 'magenta');
        log(`    Alice: ${playerA.chips} chips`, 'magenta');
        log(`    Bob: ${playerB.chips} chips`, 'magenta');
        log(`    Charlie: ${playerC.chips} chips`, 'magenta');

        // Expected:
        // Main pot: 200 * 3 = 600 -> Alice wins (Royal Flush)
        // Side pot: 300 * 2 = 600 -> Charlie wins (Two pair beats High card)
        assert(playerA.chips === 600, 'Alice should win main pot (600)', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should win nothing', `Got ${playerB.chips}`);
        assert(playerC.chips === 600, 'Charlie should win side pot (600)', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1200, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 3: Three-way split of main pot
    log('\n▶ Test 3: Three-way split pot (identical hands)', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', 'Kh', 'Qh', 'Jh', 'Th']; // Royal flush on board

        simulateAllIn(
            [playerA, playerB, playerC],
            [500, 500, 500],
            [
                ['2c', '3c'], // All players have same hand (board plays)
                ['4d', '5d'],
                ['6s', '7s']
            ]
        );

        game.pot = 1500;
        game.calculateSidePots();

        const results = game.handleShowdown([playerA, playerB, playerC]);

        // Each player should get 500
        assert(playerA.chips === 500, 'Alice should get 500', `Got ${playerA.chips}`);
        assert(playerB.chips === 500, 'Bob should get 500', `Got ${playerB.chips}`);
        assert(playerC.chips === 500, 'Charlie should get 500', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1500, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 4: Complex - A wins main, B wins side1, C wins side2
    log('\n▶ Test 4: Three different winners for three different pots', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 100);
        const playerB = createTestPlayer('Bob', 1, 300);
        const playerC = createTestPlayer('Charlie', 2, 600);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', '5h', '9d', '2c', '3s'];

        // Each player wins a different pot
        simulateAllIn(
            [playerA, playerB, playerC],
            [100, 300, 600],
            [
                ['As', 'Ad'], // Alice - Three aces (best for main pot)
                ['5s', '5d'], // Bob - Three fives
                ['9s', '9c']  // Charlie - Three nines (best for side pots)
            ]
        );

        game.pot = 1000;
        game.calculateSidePots();

        log('  Side pots created:', 'magenta');
        game.sidePots.forEach((pot, idx) => {
            log(`    Pot ${idx + 1}: $${pot.amount} (${pot.eligiblePlayers.map(p => p.nickname).join(', ')})`, 'magenta');
        });

        const results = game.handleShowdown([playerA, playerB, playerC]);

        log('  Final chip counts:', 'magenta');
        log(`    Alice: ${playerA.chips} chips`, 'magenta');
        log(`    Bob: ${playerB.chips} chips`, 'magenta');
        log(`    Charlie: ${playerC.chips} chips`, 'magenta');

        // Expected:
        // Main pot: 100 * 3 = 300 -> Alice wins (Three aces)
        // Side pot 1: 200 * 2 = 400 -> Charlie wins (Three nines > Three fives)
        // Side pot 2: 300 * 1 = 300 -> Charlie wins (only eligible)
        assert(playerA.chips === 300, 'Alice should win main pot only (300)', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should win nothing', `Got ${playerB.chips}`);
        assert(playerC.chips === 700, 'Charlie should win both side pots (400 + 300)', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1000, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 5: Split pot with odd chips (position matters)
    log('\n▶ Test 5: Split pot with odd chips - position-based distribution', 'blue');
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
        game.communityCards = ['Ah', 'Kh', 'Qh', 'Jh', 'Th'];

        simulateAllIn(
            [playerA, playerB, playerC],
            [500, 500, 500],
            [
                ['2c', '3c'],
                ['4d', '5d'],
                ['6s', '7s']
            ]
        );

        game.pot = 1502; // Creates 2 odd chips
        game.calculateSidePots();

        const results = game.handleShowdown([playerA, playerB, playerC]);

        // Split 1502 / 3 = 500 each, with 2 odd chips
        // Odd chips should go to Bob (closest to left of dealer)
        const sharePerWinner = Math.floor(1502 / 3);
        const remainder = 1502 % 3;

        assert(sharePerWinner === 500, 'Base share should be 500', `Got ${sharePerWinner}`);
        assert(remainder === 2, 'Should have 2 odd chips', `Got ${remainder}`);

        // Bob (seat 1) is closest to left of dealer (seat 0)
        assert(playerB.chips === 502, 'Bob should get odd chips (500 + 2)', `Got ${playerB.chips}`);
        assert(playerA.chips === 500, 'Alice should get base share (500)', `Got ${playerA.chips}`);
        assert(playerC.chips === 500, 'Charlie should get base share (500)', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1502, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 6: One player wins everything with best hand
    log('\n▶ Test 6: Best hand wins all pots', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 300);
        const playerB = createTestPlayer('Bob', 1, 300);
        const playerC = createTestPlayer('Charlie', 2, 600);

        room.players = [playerA, playerB, playerC];
        game.players = [playerA, playerB, playerC];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', 'Kh', 'Qh', '9d', '2c'];

        // Charlie has Royal Flush and wins all
        simulateAllIn(
            [playerA, playerB, playerC],
            [300, 300, 600],
            [
                ['As', '2d'], // Alice - Two pair (Aces and 2s)
                ['7c', '6s'], // Bob - High card
                ['Jh', 'Th']  // Charlie - Royal Flush (Ah Kh Qh Jh Th)
            ]
        );

        game.pot = 1200;
        game.calculateSidePots();

        const results = game.handleShowdown([playerA, playerB, playerC]);

        // Expected:
        // Main pot: 300 * 3 = 900 -> Charlie wins (Royal Flush)
        // Side pot: 300 * 1 = 300 -> Charlie wins (only eligible)
        assert(playerA.chips === 0, 'Alice should win nothing', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should win nothing', `Got ${playerB.chips}`);
        assert(playerC.chips === 1200, 'Charlie should win everything', `Got ${playerC.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChips === 1200, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // Test 7: Folded player - dead money distribution
    log('\n▶ Test 7: Dead money from folded player goes to winner', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 500);
        const playerB = createTestPlayer('Bob', 1, 500);
        const playerC = createTestPlayer('Charlie', 2, 500);
        const playerD = createTestPlayer('David', 3, 500); // Fixed: David starts with 500, contributes 100

        room.players = [playerA, playerB, playerC, playerD];
        game.players = [playerA, playerB, playerC, playerD];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', 'Kh', 'Qh', '9d', '2c'];

        // Simulate contributions first, then fold David
        simulateAllIn(
            [playerA, playerB, playerC, playerD],
            [500, 500, 500, 100],
            [
                ['Jh', 'Th'], // Alice - Royal Flush
                ['7s', '8s'], // Bob - High card
                ['6c', '5c'], // Charlie - High card
                ['2d', '3d']  // David - will fold
            ]
        );

        // David folds after contributing (should have 400 chips left)
        playerD.status = 'folded';

        game.pot = 1600; // Including David's 100
        game.calculateSidePots();

        const results = game.handleShowdown([playerA, playerB, playerC]); // David not included

        // Expected:
        // Main pot: 500 * 3 = 1500 + 100 (dead money) = 1600 -> Alice wins all
        // David should keep his remaining 400 chips
        assert(playerA.chips === 1600, 'Alice should win everything including dead money', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should win nothing', `Got ${playerB.chips}`);
        assert(playerC.chips === 0, 'Charlie should win nothing', `Got ${playerC.chips}`);
        assert(playerD.chips === 400, 'David should keep his remaining 400 chips', `Got ${playerD.chips}`);

        const totalChipsInPlay = playerA.chips + playerB.chips + playerC.chips;
        if (assert(totalChipsInPlay === 1600, 'Total chips in play should equal pot', `Got ${totalChipsInPlay}`)) passed++;
        else failed++;
    }

    // Test 8: Four-way with cascading wins
    log('\n▶ Test 8: Four-way all-in with different winners at each level', 'blue');
    {
        const room = new MockRoom();
        const game = new PokerGame(room);

        const playerA = createTestPlayer('Alice', 0, 100);
        const playerB = createTestPlayer('Bob', 1, 200);
        const playerC = createTestPlayer('Charlie', 2, 300);
        const playerD = createTestPlayer('David', 3, 400);

        room.players = [playerA, playerB, playerC, playerD];
        game.players = [playerA, playerB, playerC, playerD];
        game.lastDealerSeat = 0;
        game.communityCards = ['Ah', '7h', '3d', '9c', '2s'];

        // Hands ranked: David > Charlie > Bob > Alice
        simulateAllIn(
            [playerA, playerB, playerC, playerD],
            [100, 200, 300, 400],
            [
                ['As', '2c'], // Alice - Two pair (Aces and 2s)
                ['7s', '7d'], // Bob - Three of a kind (7s)
                ['9s', '9d'], // Charlie - Three of a kind (9s)
                ['Ac', 'Ad']  // David - Three of a kind (Aces) - BEST
            ]
        );

        game.pot = 1000;
        game.calculateSidePots();

        log('  Side pots:', 'magenta');
        game.sidePots.forEach((pot, idx) => {
            log(`    Pot ${idx + 1}: $${pot.amount} (${pot.eligiblePlayers.map(p => p.nickname).join(', ')})`, 'magenta');
        });

        const results = game.handleShowdown([playerA, playerB, playerC, playerD]);

        log('  Final chip counts:', 'magenta');
        log(`    Alice: ${playerA.chips}`, 'magenta');
        log(`    Bob: ${playerB.chips}`, 'magenta');
        log(`    Charlie: ${playerC.chips}`, 'magenta');
        log(`    David: ${playerD.chips}`, 'magenta');

        // Expected (David has best hand for all pots he's eligible for):
        // Pot 1: 100 * 4 = 400 (A,B,C,D) -> David wins
        // Pot 2: 100 * 3 = 300 (B,C,D) -> David wins
        // Pot 3: 100 * 2 = 200 (C,D) -> David wins
        // Pot 4: 100 * 1 = 100 (D) -> David wins
        assert(playerA.chips === 0, 'Alice should win nothing', `Got ${playerA.chips}`);
        assert(playerB.chips === 0, 'Bob should win nothing', `Got ${playerB.chips}`);
        assert(playerC.chips === 0, 'Charlie should win nothing', `Got ${playerC.chips}`);
        assert(playerD.chips === 1000, 'David should win everything', `Got ${playerD.chips}`);

        const totalChips = playerA.chips + playerB.chips + playerC.chips + playerD.chips;
        if (assert(totalChips === 1000, 'Total chips should equal pot', `Got ${totalChips}`)) passed++;
        else failed++;
    }

    // ========================================================================
    // SUMMARY
    // ========================================================================
    log('\n╔═══════════════════════════════════════════════════════════════╗', 'cyan');
    log(`║   TEST RESULTS: ${passed} PASSED, ${failed} FAILED                           ║`, passed === 8 ? 'green' : 'yellow');
    log('╚═══════════════════════════════════════════════════════════════╝', 'cyan');

    if (failed === 0) {
        log('\n✓ All chip distribution tests passed!', 'green');
        log('  Chips are correctly distributed to winners in all scenarios.', 'green');
    } else {
        log(`\n✗ ${failed} test(s) failed. Review chip distribution logic.`, 'red');
    }

    return { passed, failed };
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
    runChipDistributionTests().then(results => {
        process.exit(results.failed > 0 ? 1 : 0);
    });
}

export { runChipDistributionTests };
