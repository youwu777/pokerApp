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
        const player = this.players[this.currentPlayerIndex];
        // Safety check: if current player is all-in or folded, skip to next
        if (player && (player.status === 'all-in' || player.status === 'folded')) {
            this.moveToNextPlayer();
            return this.players[this.currentPlayerIndex];
        }
        return player;
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

        // Calculate amount to call
        const rawAmountToCall = this.currentBet - player.currentBet;
        // For call action, cap at player's available chips (they can only call what they have)
        // For check validation, use raw amount (if there's a bet to call, they can't check)
        const amountToCall = Math.min(rawAmountToCall, player.chips);

        switch (action) {
            case 'fold':
                player.fold();
                // Check if only one active player remains after fold
                const remainingActivePlayers = this.players.filter(p => p.status === 'active');
                if (remainingActivePlayers.length === 1) {
                    // Only one player left, round is complete - hand should end immediately
                    console.log(`[BETTING] Player ${player.nickname} folded, only one active player remaining - hand ends`);
                    player.hasActed = true; // Mark as acted so isComplete() returns true
                    // Don't move to next player - hand is over
                    return { success: true, action: 'fold', handEnded: true };
                }
                // Normal fold - continue with normal flow
                break;

            case 'check':
                // Use raw amount for check validation - if there's any amount to call, can't check
                if (rawAmountToCall > 0) {
                    return { success: false, message: 'Cannot check, must call or fold' };
                }
                player.lastAction = 'check';
                break;

            case 'call':
                if (amountToCall === 0) {
                    return { success: false, message: 'Nothing to call' };
                }
                // Player can only call up to their available chips
                // If amountToCall > player.chips, they'll go all-in
                const chipsBeforeCall = player.chips;
                const callAmount = player.bet(amountToCall);
                // Check if player went all-in (ran out of chips or couldn't call the full amount)
                const wentAllIn = player.chips === 0 || callAmount < rawAmountToCall;
                player.lastAction = wentAllIn ? 'all-in' : 'call';
                console.log(`[CALL] ${player.nickname} called ${callAmount} (had ${chipsBeforeCall}, now ${player.chips}, status: ${player.status})`);
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
        const initialIndex = this.currentPlayerIndex;
        let attempts = 0;
        do {
            this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
            attempts++;
            // Safety check to prevent infinite loop
            if (attempts > this.players.length) {
                console.error(`[ERROR] Infinite loop in moveToNextPlayer. Current index: ${this.currentPlayerIndex}, Players:`, 
                    this.players.map(p => `${p.nickname}(${p.status})`));
                break;
            }
        } while (this.players[this.currentPlayerIndex].status === 'folded' || 
                 this.players[this.currentPlayerIndex].status === 'all-in');
        
        console.log(`[BETTING] Moved to next player: ${this.players[this.currentPlayerIndex].nickname} (index: ${this.currentPlayerIndex})`);
    }

    /**
     * Check if betting round is complete
     */
    isComplete() {
        const activePlayers = this.players.filter(p => p.status === 'active');
        const allInPlayers = this.players.filter(p => p.status === 'all-in');
        const foldedPlayers = this.players.filter(p => p.status === 'folded');

        console.log(`[BETTING] isComplete check: active=${activePlayers.length}, allIn=${allInPlayers.length}, folded=${foldedPlayers.length}`);
        console.log(`[BETTING] currentBet=${this.currentBet}, active players:`, activePlayers.map(p => `${p.nickname}(bet=${p.currentBet}, acted=${p.hasActed})`));

        // If no active players can act (all are all-in or folded), round is complete
        if (activePlayers.length === 0) {
            console.log(`[BETTING] Complete: No active players`);
            return true;
        }

        // If only one active player and all others are folded/all-in
        if (activePlayers.length === 1) {
            const lastActivePlayer = activePlayers[0];
            // If the last active player is all-in (shouldn't happen, but safety check)
            if (lastActivePlayer.status === 'all-in') {
                console.log(`[BETTING] Complete: Last player is all-in`);
                return true;
            }
            
            // If they haven't acted yet, they still need to act (call/fold the all-in)
            if (!lastActivePlayer.hasActed) {
                console.log(`[BETTING] Not complete: Last active player hasn't acted yet (needs to call/fold all-in)`);
                return false;
            }
            
            // After they've acted (called or folded), check if round is complete
            // If all other players are all-in and this player has acted, round is complete
            if (allInPlayers.length > 0) {
                console.log(`[BETTING] Complete: Last active player acted, all others all-in - going to showdown`);
                return true;
            }
            
            // If there are folded players but no all-in players, check if they matched the bet
            const matched = lastActivePlayer.currentBet === this.currentBet || lastActivePlayer.chips === 0;
            console.log(`[BETTING] Last player acted, matched=${matched} (currentBet=${this.currentBet}, playerBet=${lastActivePlayer.currentBet}, chips=${lastActivePlayer.chips})`);
            return matched;
        }

        // Multiple active players: all must have acted and matched the current bet
        // All-in players don't need to act, they're already committed
        const allActed = activePlayers.every(p => p.hasActed);
        const allMatched = activePlayers.every(p => p.currentBet === this.currentBet || p.chips === 0);
        
        console.log(`[BETTING] Multiple active players: allActed=${allActed}, allMatched=${allMatched}`);

        return allActed && allMatched;
    }

    /**
     * Collect all bets into the pot
     */
    collectBets() {
        let totalCollected = 0;
        for (const player of this.players) {
            totalCollected += player.currentBet;
            // Note: currentBet will be reset in resetForNewRound for active players
            // All-in players keep their currentBet but it's already counted in totalContribution
        }
        return totalCollected; // Return the amount collected, not the pot (pot is managed by PokerGame)
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
