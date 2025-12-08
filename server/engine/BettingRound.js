export class BettingRound {
    constructor(players, smallBlind, bigBlind, initialBet = null) {
        this.players = players.filter(p => p.status !== 'folded');
        this.currentBet = initialBet !== null ? initialBet : bigBlind;
        this.minRaise = bigBlind;
        this.pot = 0;
        this.currentPlayerIndex = 0;
        this.actionCount = 0;
    }

    /**
     * Get the current player who needs to act
     */
    getCurrentPlayer() {
        return this.players[this.currentPlayerIndex];
    }

    /**
     * Process a player action
     * @param {Player} player
     * @param {string} action - fold, check, call, bet, raise, all-in
     * @param {number} amount - bet/raise amount
     * @returns {Object} Result with success, message, and updated state
     */
    processAction(player, action, amount = 0) {
        if (player !== this.getCurrentPlayer()) {
            return { success: false, message: 'Not your turn' };
        }

        const amountToCall = this.currentBet - player.currentBet;

        switch (action) {
            case 'fold':
                player.fold();
                break;

            case 'check':
                if (amountToCall > 0) {
                    return { success: false, message: 'Cannot check, must call or fold' };
                }
                player.lastAction = 'check';
                break;

            case 'call':
                if (amountToCall === 0) {
                    return { success: false, message: 'Nothing to call' };
                }
                const callAmount = player.bet(amountToCall);
                player.lastAction = callAmount < amountToCall ? 'all-in' : 'call';
                break;

            case 'bet':
                if (this.currentBet > 0) {
                    return { success: false, message: 'Cannot bet, must raise' };
                }
                if (amount < this.minRaise) {
                    return { success: false, message: `Minimum bet is ${this.minRaise}` };
                }
                const betAmount = player.bet(amount);
                this.currentBet = player.currentBet;
                this.minRaise = amount;
                
                // Reset hasActed for other active players so they can respond to the bet
                this.players.forEach(p => {
                    if (p !== player && p.status === 'active') {
                        p.hasActed = false;
                    }
                });
                
                player.lastAction = betAmount < amount ? 'all-in' : `bet ${amount}`;
                break;

            case 'raise':
                if (this.currentBet === 0) {
                    return { success: false, message: 'Cannot raise, must bet' };
                }
                const totalRaise = amountToCall + amount;
                if (amount < this.minRaise) {
                    return { success: false, message: `Minimum raise is ${this.minRaise}` };
                }
                const raiseAmount = player.bet(totalRaise);
                this.currentBet = player.currentBet;

                // Standard poker rule: min raise is at least the size of the previous raise
                // So if the previous raise was 50, the next min raise must also be at least 50
                this.minRaise = amount;
                
                // Reset hasActed for other active players so they can respond to the raise
                this.players.forEach(p => {
                    if (p !== player && p.status === 'active') {
                        p.hasActed = false;
                    }
                });

                player.lastAction = raiseAmount < totalRaise ? 'all-in' : `raise ${totalRaise}`;
                break;

            case 'all-in':
                const allInAmount = player.bet(player.chips);
                const betIncreased = player.currentBet > this.currentBet;
                if (betIncreased) {
                    const raiseDelta = player.currentBet - this.currentBet;
                    this.currentBet = player.currentBet;
                    // If all-in raise is valid (>= minRaise), update minRaise
                    // Standard poker rule: min raise equals the size of the previous raise
                    if (raiseDelta >= this.minRaise) {
                        this.minRaise = raiseDelta;
                    }
                    // Reset hasActed for other active players so they can respond to the raise
                    this.players.forEach(p => {
                        if (p !== player && p.status === 'active') {
                            p.hasActed = false;
                        }
                    });
                }
                player.lastAction = 'all-in';
                break;

            default:
                return { success: false, message: 'Invalid action' };
        }

        player.hasActed = true;
        this.actionCount++;
        this.moveToNextPlayer();

        return { success: true, action: player.lastAction };
    }

    /**
     * Move to next active player
     */
    moveToNextPlayer() {
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
        } while (this.players[this.currentPlayerIndex].status === 'folded' || 
                 this.players[this.currentPlayerIndex].status === 'all-in');
    }

    /**
     * Check if betting round is complete
     */
    isComplete() {
        const activePlayers = this.players.filter(p => p.status === 'active');
        const allInPlayers = this.players.filter(p => p.status === 'all-in');
        const foldedPlayers = this.players.filter(p => p.status === 'folded');

        // If no active players can act (all are all-in or folded), round is complete
        if (activePlayers.length === 0) {
            return true;
        }

        // If only one active player and all others are folded/all-in, check if they need to act
        // After an all-in, other players still need a chance to call or fold
        if (activePlayers.length === 1) {
            const lastActivePlayer = activePlayers[0];
            // If the last active player has already acted and matched the bet, round is complete
            // OR if they're all-in (shouldn't happen, but safety check)
            if (lastActivePlayer.status === 'all-in') {
                return true;
            }
            // If they haven't acted yet, they still need to act (call/fold/raise)
            if (!lastActivePlayer.hasActed) {
                return false;
            }
            // If they've acted, check if they matched the bet
            return lastActivePlayer.currentBet === this.currentBet || lastActivePlayer.chips === 0;
        }

        // Multiple active players: all must have acted and matched the current bet
        // All-in players don't need to act, they're already committed
        const allActed = activePlayers.every(p => p.hasActed);
        const allMatched = activePlayers.every(p => p.currentBet === this.currentBet || p.chips === 0);

        return allActed && allMatched;
    }

    /**
     * Collect all bets into the pot
     */
    collectBets() {
        for (const player of this.players) {
            this.pot += player.currentBet;
        }
        return this.pot;
    }

    toJSON() {
        return {
            currentBet: this.currentBet,
            minRaise: this.minRaise,
            pot: this.pot,
            currentPlayerIndex: this.currentPlayerIndex,
            actionCount: this.actionCount
        };
    }
}
