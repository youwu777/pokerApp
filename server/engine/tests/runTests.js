/**
 * Test Runner for Poker Engine Tests
 */

import { runTests } from './PokerGame.multiwayAllin.test.js';

console.log('Starting Poker Engine Test Suite...\n');

runTests().then(results => {
    console.log(`\nTest execution completed.`);
    process.exit(results.failed > 0 ? 1 : 0);
}).catch(error => {
    console.error('Test execution failed with error:', error);
    process.exit(1);
});
