/**
 * Master Test Runner - Runs all poker engine tests
 */

import { runTests as runMultiwayTests } from './PokerGame.multiwayAllin.test.js';
import { runChipDistributionTests } from './PokerGame.chipDistribution.test.js';

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║          POKER ENGINE - COMPLETE TEST SUITE                   ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

async function runAllTests() {
    let totalPassed = 0;
    let totalFailed = 0;

    // Run multiway all-in tests
    console.log('\n═══ SUITE 1: Multiway All-In Pot Calculation ═══\n');
    const multiwayResults = await runMultiwayTests();
    totalPassed += multiwayResults.passed;
    totalFailed += multiwayResults.failed;

    // Run chip distribution tests
    console.log('\n\n═══ SUITE 2: Chip Distribution After Showdown ═══\n');
    const chipDistResults = await runChipDistributionTests();
    totalPassed += chipDistResults.passed;
    totalFailed += chipDistResults.failed;

    // Final summary
    console.log('\n\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║                    FINAL TEST SUMMARY                          ║');
    console.log('╚════════════════════════════════════════════════════════════════╝');
    console.log(`\n  Suite 1 (Pot Calculation):    ${multiwayResults.passed}/${multiwayResults.passed + multiwayResults.failed} passed`);
    console.log(`  Suite 2 (Chip Distribution):  ${chipDistResults.passed}/${chipDistResults.passed + chipDistResults.failed} passed`);
    console.log(`  ────────────────────────────────────────────`);
    console.log(`  TOTAL:                        ${totalPassed}/${totalPassed + totalFailed} passed\n`);

    if (totalFailed === 0) {
        console.log('  ✅ ALL TESTS PASSED!');
        console.log('  Multiway all-in logic is fully validated.\n');
    } else {
        console.log(`  ❌ ${totalFailed} test(s) failed.`);
        console.log('  Please review the failures above.\n');
    }

    return { totalPassed, totalFailed };
}

runAllTests().then(results => {
    process.exit(results.totalFailed > 0 ? 1 : 0);
});
