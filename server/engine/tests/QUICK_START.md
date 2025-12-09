# Quick Start - Running Multiway All-In Tests

## Run the tests

```bash
cd server && node engine/tests/runTests.js
```

## Expected Output

```
✓ All tests passed! Multiway all-in logic is working correctly.

TEST RESULTS: 10 PASSED, 0 FAILED
```

## What's Being Tested

- ✅ Side pot creation with different stack sizes
- ✅ Main pot and side pot eligibility
- ✅ Dead money handling (folded players)
- ✅ Split pots with multiple winners
- ✅ Odd chip distribution (by position)
- ✅ Hand evaluation in multiway pots
- ✅ Edge cases (minimal contributions, missing data)

## Key Fixes Applied

1. **Dead Money Handling** - Folded players' chips now properly added to main pot
2. **Odd Chip Distribution** - Follows standard poker rules (closest to left of button)
3. **Validation** - Ensures side pots always sum to total pot
4. **Hole Cards Check** - Validates players have cards before evaluation

## Example Test Scenario

```javascript
// 3-way all-in:
Alice:   $300 all-in
Bob:     $500 all-in
Charlie: $1000 all-in

Result:
- Main pot: $900 (Alice, Bob, Charlie eligible)
- Side pot 1: $400 (Bob, Charlie eligible)
- Side pot 2: $500 (Charlie eligible only)
```

## Debugging

If a test fails:
1. Check console output for `[SIDE-POT]` logs
2. Look for `[ERROR]` messages about pot mismatches
3. Review the specific test case that failed
4. Verify player contributions and pot amounts

## Documentation

- Full details: See `MULTIWAY_ALLIN_FIXES.md` in project root
- Test documentation: See `README.md` in this directory
