export class RabbitHunt {
    /**
     * Check if rabbit hunt is available
     * @param {PokerGame} game
     * @returns {boolean}
     */
    static isAvailable(game) {
        if (!game.room.settings.allowRabbitHunt) return false;

        // Hand must be over and not all streets dealt
        return game.currentStreet === 'showdown' && game.communityCards.length < 5;
    }

    /**
     * Reveal remaining community cards
     * @param {PokerGame} game
     * @returns {Array} Remaining cards that would have been dealt
     */
    static reveal(game) {
        const remainingCards = [];
        const cardsNeeded = 5 - game.communityCards.length;

        // Create a copy of the deck to not affect game state
        const deckCopy = [...game.deck];

        for (let i = 0; i < cardsNeeded; i++) {
            if (deckCopy.length > 0) {
                deckCopy.pop(); // Burn card
                if (deckCopy.length > 0) {
                    remainingCards.push(deckCopy.pop());
                }
            }
        }

        return remainingCards;
    }

    /**
     * Get what the full board would have been
     * @param {PokerGame} game
     * @returns {Array} Complete 5-card board
     */
    static getCompleteBoard(game) {
        const revealed = this.reveal(game);
        return [...game.communityCards, ...revealed];
    }
}
