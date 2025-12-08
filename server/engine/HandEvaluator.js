import pkg from 'pokersolver';
const { Hand } = pkg;

export class HandEvaluator {
    /**
     * Evaluate a poker hand from hole cards and community cards
     * @param {Array} holeCards - Array of 2 card strings (e.g., ['Ah', 'Kd'])
     * @param {Array} communityCards - Array of 3-5 card strings
     * @returns {Object} Hand object from pokersolver
     */
    static evaluateHand(holeCards, communityCards) {
        const allCards = [...holeCards, ...communityCards];
        return Hand.solve(allCards);
    }

    /**
     * Determine winners from multiple hands
     * @param {Array} playerHands - Array of {player, hand} objects
     * @returns {Array} Array of winning players
     */
    static determineWinners(playerHands) {
        if (playerHands.length === 0) return [];
        if (playerHands.length === 1) return [playerHands[0].player];

        const hands = playerHands.map(ph => ph.hand);
        const winners = Hand.winners(hands);

        // Map winning hands back to players
        return playerHands
            .filter(ph => winners.includes(ph.hand))
            .map(ph => ph.player);
    }

    /**
     * Compare two hands
     * @returns {number} 1 if hand1 wins, -1 if hand2 wins, 0 if tie
     */
    static compareHands(hand1, hand2) {
        const winners = Hand.winners([hand1, hand2]);
        if (winners.length === 2) return 0; // Tie
        return winners[0] === hand1 ? 1 : -1;
    }
}
