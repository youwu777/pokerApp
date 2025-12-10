export class RunItTwice {
    /**
     * Check if Run It Twice is applicable
     * @param {PokerGame} game
     * @returns {boolean}
     */
    static isApplicable(game) {
        if (!game.room.settings.allowRunItTwice) return false;

        // Must be all-in situation before river
        if (game.currentStreet === 'river' || game.currentStreet === 'showdown') {
            return false;
        }

        const activePlayers = game.players.filter(p => p.status !== 'folded');
        const allInPlayers = activePlayers.filter(p => p.status === 'all-in' || p.chips === 0);

        // Check if there are any players who can still act (have active status)
        const playersCanAct = activePlayers.filter(p => p.status === 'active');

        // Only applicable if:
        // 1. At least one player is all-in
        // 2. At least one other player is not folded
        // 3. NO players can still act (betting is complete)
        return allInPlayers.length > 0 && activePlayers.length > 1 && playersCanAct.length === 0;
    }

    /**
     * Get players involved in RIT decision
     * @param {PokerGame} game
     * @returns {Array} Players who can vote on RIT
     */
    static getInvolvedPlayers(game) {
        return game.players.filter(p => p.status !== 'folded');
    }

    /**
     * Run it twice - deal two separate boards
     * @param {PokerGame} game
     * @returns {Object} Results for both runs
     */
    static execute(game) {
        const remainingCards = 5 - game.communityCards.length;
        const currentBoard = [...game.communityCards];

        // Save current deck state
        const deckCopy = [...game.deck];

        // First run - deal remaining cards
        const board1 = [...currentBoard];
        for (let i = 0; i < remainingCards; i++) {
            game.deck.pop(); // Burn
            board1.push(game.deck.pop());
        }

        // Evaluate first run
        const result1 = this.evaluateRun(game, board1);

        // Reset deck for second run
        game.deck = [...deckCopy];

        // Second run - deal different remaining cards
        const board2 = [...currentBoard];
        for (let i = 0; i < remainingCards; i++) {
            game.deck.pop(); // Burn
            board2.push(game.deck.pop());
        }

        // Evaluate second run
        const result2 = this.evaluateRun(game, board2);

        // Award half pot to each run's winners
        const halfPot = Math.floor(game.pot / 2);

        for (const winner of result1.winners) {
            winner.chips += Math.floor(halfPot / result1.winners.length);
        }

        for (const winner of result2.winners) {
            winner.chips += Math.floor(halfPot / result2.winners.length);
        }

        return {
            board1,
            board2,
            result1,
            result2,
            potPerRun: halfPot
        };
    }

    /**
     * Evaluate a single run
     */
    static evaluateRun(game, board) {
        const { HandEvaluator } = require('./HandEvaluator.js');
        const activePlayers = game.players.filter(p => p.status !== 'folded');

        const playerHands = activePlayers.map(player => ({
            player,
            hand: HandEvaluator.evaluateHand(player.holeCards, board)
        }));

        const winners = HandEvaluator.determineWinners(playerHands);

        return {
            winners,
            winningHand: playerHands.find(ph => ph.player === winners[0])?.hand
        };
    }
}
