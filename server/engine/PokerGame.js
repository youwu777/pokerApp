import { BettingRound } from './BettingRound.js';
import { HandEvaluator } from './HandEvaluator.js';

// Position mapping for 2-10 handed poker
const POSITION_MAP = {
    2: ["BTN/SB", "BB"],
    3: ["BTN", "SB", "BB"],
    4: ["BTN", "SB", "BB", "UTG"],
    5: ["BTN", "SB", "BB", "UTG", "HJ"],
    6: ["BTN", "SB", "BB", "UTG", "HJ", "CO"],
    7: ["BTN", "SB", "BB", "UTG", "UTG+1", "HJ", "CO"],
    8: ["BTN", "SB", "BB", "UTG", "UTG+1", "LJ", "HJ", "CO"],
    9: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "MP", "HJ", "CO"],
    10: ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "MP"]
};

// Visual Clockwise Order based on CSS positioning
// Standard 0-9 order, CSS handles the visual placement
const VISUAL_SEAT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export class PokerGame {
    constructor(room) {
        this.room = room;
        this.deck = [];
        this.communityCards = [];
        this.pot = 0;
        this.sidePots = [];
        this.dealerPosition = 0;
        this.lastDealerSeat = -1; // Track actual seat number of last dealer
        this.currentStreet = null; // preflop, flop, turn, river, showdown
        this.bettingRound = null;
        this.players = [];
        this.lastAggressor = null; // Track who made the last aggressive action (bet/raise)
        // Scoreboard is now stored at Room level, not Game level
    }

    /**
     * Assign standard poker positions to players
     */
    assignPositions() {
        const totalPlayers = this.players.length;
        if (totalPlayers < 2 || totalPlayers > 10) return;

        // Players are already sorted by VISUAL_SEAT_ORDER in startNewHand

        for (let i = 0; i < totalPlayers; i++) {
            // Calculate clockwise offset from dealer
            const offset = (i - this.dealerPosition + totalPlayers) % totalPlayers;
            const positionName = POSITION_MAP[totalPlayers][offset] || '';
            this.players[i].position = positionName;
        }
    }

    /**
     * Move dealer button to next active player clockwise
     */
    moveDealerButton() {
        if (this.players.length < 2) return;

        console.log(`[DEBUG] Moving dealer. Last seat: ${this.lastDealerSeat}`);
        console.log(`[DEBUG] Players: ${this.players.map(p => `${p.nickname}(${p.seatNumber})`).join(', ')}`);

        // Find index of last dealer's seat in the CURRENT sorted array
        // Use loose equality or Number() to handle potential string/number mismatch
        const lastDealerIndex = this.players.findIndex(p => p.seatNumber == this.lastDealerSeat);

        let nextDealerIndex;
        if (lastDealerIndex !== -1) {
            // Move to next player in the sorted array
            nextDealerIndex = (lastDealerIndex + 1) % this.players.length;
            console.log(`[DEBUG] Last dealer found at index ${lastDealerIndex}. Moving to index ${nextDealerIndex}`);
        } else {
            // Last dealer is gone, or first hand.
            console.log('[DEBUG] Last dealer not found or first hand. Finding next physical seat.');

            // Find the "next" seat physically using VISUAL_SEAT_ORDER
            const lastSeatOrderIndex = VISUAL_SEAT_ORDER.indexOf(Number(this.lastDealerSeat));

            // Find first player whose seat order index is greater
            nextDealerIndex = this.players.findIndex(p => VISUAL_SEAT_ORDER.indexOf(Number(p.seatNumber)) > lastSeatOrderIndex);

            if (nextDealerIndex === -1) {
                nextDealerIndex = 0; // Wrap around to first player
            }
            console.log(`[DEBUG] Next physical seat index: ${nextDealerIndex}`);
        }

        // Update dealer position index and track seat number
        this.dealerPosition = nextDealerIndex;
        this.lastDealerSeat = this.players[nextDealerIndex].seatNumber;

        console.log(`Dealer moved to ${this.players[nextDealerIndex].nickname} (Seat ${this.lastDealerSeat})`);
    }

    /**
     * Start a new hand
     */
    startNewHand() {
        // Get seated players and sort by VISUAL_SEAT_ORDER for correct clockwise action
        this.players = this.room.getSeatedPlayers().sort((a, b) => {
            const indexA = VISUAL_SEAT_ORDER.indexOf(Number(a.seatNumber));
            const indexB = VISUAL_SEAT_ORDER.indexOf(Number(b.seatNumber));
            return indexA - indexB;
        });

        console.log('--- STARTING NEW HAND ---');
        console.log('Sorted Players (Clockwise):', this.players.map(p => `${p.nickname} (Seat ${p.seatNumber})`).join(', '));

        if (this.players.length < 2) {
            throw new Error('Need at least 2 players to start');
        }

        // Reset players for new hand
        this.players.forEach(p => p.resetForNewHand());

        // Add players to scoreboard if not already there (scoreboard is at Room level)
        this.players.forEach(player => {
            if (!this.room.scoreboard.has(player.socketId)) {
                this.room.scoreboard.set(player.socketId, {
                    socketId: player.socketId,
                    nickname: player.nickname,
                    buyin: player.buyin,
                    stack: player.stack,
                    isActive: true
                });
            } else {
                // Update existing entry to mark as active
                const stats = this.room.scoreboard.get(player.socketId);
                stats.isActive = true;
                stats.stack = player.stack; // Update stack from current player
            }
        });

        // Initialize deck and shuffle
        this.deck = this.createDeck();
        this.shuffleDeck();

        this.communityCards = [];
        this.pot = 0;
        this.sidePots = [];
        this.pot = 0;
        this.sidePots = [];
        this.currentStreet = 'preflop';
        this.lastAggressor = null;

        // Move dealer button
        this.moveDealerButton();

        // Assign positions (BTN, SB, BB, etc.)
        this.assignPositions();

        // Post blinds
        this.postBlinds();

        // Deal hole cards
        this.dealHoleCards();

        // Start preflop betting
        this.bettingRound = new BettingRound(
            this.players,
            this.room.settings.smallBlind,
            this.room.settings.bigBlind
        );

        // First to act is left of big blind
        const bbPosition = (this.dealerPosition + 2) % this.players.length;
        this.bettingRound.currentPlayerIndex = (bbPosition + 1) % this.players.length;

        return this.toJSON();
    }

    /**
     * Create a standard 52-card deck
     */
    createDeck() {
        const suits = ['h', 'd', 'c', 's'];
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const deck = [];

        for (const suit of suits) {
            for (const rank of ranks) {
                deck.push(rank + suit);
            }
        }

        return deck;
    }

    /**
     * Shuffle the deck using Fisher-Yates algorithm
     */
    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    /**
     * Post small and big blinds
     */
    postBlinds() {
        const sbPosition = (this.dealerPosition + 1) % this.players.length;
        const bbPosition = (this.dealerPosition + 2) % this.players.length;

        const sbPlayer = this.players[sbPosition];
        const bbPlayer = this.players[bbPosition];

        sbPlayer.bet(this.room.settings.smallBlind);
        sbPlayer.lastAction = 'small blind';

        bbPlayer.bet(this.room.settings.bigBlind);
        bbPlayer.lastAction = 'big blind';
    }

    /**
     * Deal 2 hole cards to each player
     */
    dealHoleCards() {
        for (let i = 0; i < 2; i++) {
            for (const player of this.players) {
                if (player.status !== 'folded') {
                    player.holeCards.push(this.deck.pop());
                }
            }
        }
    }

    /**
     * Process player action
     */
    processAction(player, action, amount) {
        if (!this.bettingRound) {
            return { success: false, message: 'No active betting round' };
        }

        const result = this.bettingRound.processAction(player, action, amount);

        // Track last aggressor for showdown order
        if (result.success && (action === 'bet' || action === 'raise' || action === 'all-in')) {
            // Only count all-in as aggression if it's a bet or raise (not a call)
            // But processAction returns 'all-in' for any all-in. 
            // We can check if the bet amount increased the current bet.
            if (player.currentBet > this.bettingRound.currentBet || action === 'bet' || action === 'raise') {
                this.lastAggressor = player;
            }
        }

        if (result.success && this.bettingRound.isComplete()) {
            const showdownResults = this.advanceStreet();
            if (showdownResults) {
                console.log('[DEBUG] Showdown results:', showdownResults);
                result.showdownResults = showdownResults;
            }
        }

        return result;
    }

    /**
     * Advance to next street (flop, turn, river, showdown)
     * @returns {Object|null} Results if hand ended, null otherwise
     */
    advanceStreet() {
        console.log(`[DEBUG] advanceStreet called, currentStreet: ${this.currentStreet}`);

        // Collect bets from previous round
        this.pot += this.bettingRound.collectBets();

        // Log player statuses before reset
        console.log(`[DEBUG] Player statuses before reset:`, this.players.map(p => `${p.nickname}: ${p.status} (chips: ${p.chips})`).join(', '));

        // Reset players for new betting round
        this.players.forEach(p => {
            if (p.status !== 'folded' && p.status !== 'all-in') {
                p.resetForNewRound();
            }
        });

        // Ensure players with 0 chips are marked as all-in
        this.players.forEach(p => {
            if (p.status === 'active' && p.chips === 0) {
                console.log(`[DEBUG] Marking ${p.nickname} as all-in (0 chips)`);
                p.status = 'all-in';
            }
        });

        const activePlayers = this.players.filter(p => p.status !== 'folded');
        
        console.log(`[DEBUG] After reset - activePlayers: ${activePlayers.length}, all-in: ${this.players.filter(p => p.status === 'all-in').length}`);

        // Check if only one player remains
        if (activePlayers.length === 1) {
            return this.endHand();
        }

        // Check if all remaining players are all-in
        const playersCanAct = activePlayers.filter(p => p.status === 'active');
        if (playersCanAct.length === 0) {
            // Run out remaining streets
            this.runOutBoard();
            return this.endHand();
        }

        // Deal next street
        switch (this.currentStreet) {
            case 'preflop':
                this.dealFlop();
                this.currentStreet = 'flop';
                break;
            case 'flop':
                this.dealTurn();
                this.currentStreet = 'turn';
                break;
            case 'turn':
                this.dealRiver();
                this.currentStreet = 'river';
                break;
            case 'river':
                console.log('[DEBUG] River complete, ending hand');
                return this.endHand();
        }

        // playersCanAct already filtered above - only includes active (non-all-in) players
        
        // Start new betting round (only with players who can act)
        this.bettingRound = new BettingRound(
            playersCanAct,
            this.room.settings.smallBlind,
            this.room.settings.bigBlind,
            0 // Post-flop betting starts at 0
        );

        // Reset aggressor for new street (unless we want to track across streets? 
        // Standard rule: Showdown order is based on LAST street aggression. 
        // If river is checked through, it falls back to previous street? 
        // Usually "checked through" implies no aggression on that street, so we check previous?
        // Actually, standard rule: "If there was betting on the final betting round, the player who made the last aggressive action must show first. If there was no betting on the final betting round, the player who would be first to act in that round must show first."
        // So we should reset lastAggressor at start of each street to track strictly "final round" aggression.
        this.lastAggressor = null;

        // First to act is left of dealer
        // Find the first active player whose seat index is > dealerPosition
        // Since playersCanAct are sorted by seat order (inherited from this.players), 
        // we can just find the first one "after" the dealer.

        // Find dealer's seat index in the full player list
        const dealerSeatIndex = this.players.findIndex(p => p.seatNumber === this.lastDealerSeat);

        // Find the first active player who is "after" the dealer in the full list
        // Note: playersCanAct preserves the order from this.players (but excludes all-in players)
        let nextActivePlayer = playersCanAct.find(p => this.players.indexOf(p) > dealerSeatIndex);

        // If no one is "after" the dealer, wrap around to the first active player
        if (!nextActivePlayer) {
            nextActivePlayer = playersCanAct[0];
        }

        // Set currentPlayerIndex in the betting round (which only contains playersCanAct)
        this.bettingRound.currentPlayerIndex = playersCanAct.indexOf(nextActivePlayer);

        return null; // Hand continues
    }

    dealFlop() {
        this.deck.pop(); // Burn card
        this.communityCards.push(this.deck.pop());
        this.communityCards.push(this.deck.pop());
        this.communityCards.push(this.deck.pop());
    }

    dealTurn() {
        this.deck.pop(); // Burn card
        this.communityCards.push(this.deck.pop());
    }

    dealRiver() {
        this.deck.pop(); // Burn card
        this.communityCards.push(this.deck.pop());
    }

    /**
     * Run out remaining board cards when all players are all-in
     */
    runOutBoard() {
        while (this.communityCards.length < 5) {
            this.deck.pop(); // Burn card
            this.communityCards.push(this.deck.pop());
        }
    }

    /**
     * End hand and award pot
     */
    endHand() {
        this.currentStreet = 'showdown';

        const activePlayers = this.players.filter(p => p.status !== 'folded');

        // Case 1: Pot won before river with no showdown (everyone else folded)
        if (activePlayers.length === 1) {
            activePlayers[0].chips += this.pot;
            // Update stack for all players after hand ends
            this.players.forEach(player => {
                if (player.seatNumber !== null) {
                    player.stack = player.chips;
                    // Update scoreboard (at Room level)
                    if (this.room.scoreboard.has(player.socketId)) {
                        const stats = this.room.scoreboard.get(player.socketId);
                        stats.stack = player.stack;
                    }
                    // Auto-stand-up players with 0 stack
                    if (player.stack === 0) {
                        player.standUp();
                        console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                    }
                }
            });
            this.room.handCount++;
            this.bettingRound = null; // Clear betting round
            return {
                winners: [activePlayers[0]],
                pot: this.pot,
                winningHand: null,
                showdown: false // Flag to indicate no showdown occurred
            };
        }

        // Calculate side pots if needed
        this.calculateSidePots();

        // Handle Showdown Logic (Case 2, 3, 4)
        const results = this.handleShowdown(activePlayers);
        this.room.handCount++;
        this.bettingRound = null; // Clear betting round to prevent further actions

        return results;
    }

    /**
     * Calculate side pots for all-in situations
     */
    calculateSidePots() {
        const players = this.players.filter(p => p.status !== 'folded');

        // Sort players by total contribution (use totalContribution which tracks entire hand)
        const sorted = [...players].sort((a, b) => a.totalContribution - b.totalContribution);
        
        console.log(`[SIDE-POT] Calculating side pots. Total pot: ${this.pot}`);
        console.log(`[SIDE-POT] Player contributions:`, sorted.map(p => `${p.nickname}: ${p.totalContribution}`).join(', '));

        this.sidePots = [];
        let remainingPot = this.pot;

        for (let i = 0; i < sorted.length; i++) {
            const player = sorted[i];
            const eligiblePlayers = sorted.slice(i);

            if (eligiblePlayers.length === 0) break;

            // Calculate pot size based on this player's contribution level
            // Each eligible player contributes up to this player's total contribution
            const previousContribution = i > 0 ? sorted[i - 1].totalContribution : 0;
            const contributionAtThisLevel = player.totalContribution - previousContribution;
            const potSize = contributionAtThisLevel * eligiblePlayers.length;

            if (potSize > 0) {
                this.sidePots.push({
                    amount: Math.min(potSize, remainingPot),
                    eligiblePlayers: eligiblePlayers
                });

                remainingPot -= potSize;
            }
        }

        // If no side pots were created but there's still a pot (e.g., everyone checked),
        // create a main pot with all active players
        if (this.sidePots.length === 0 && this.pot > 0) {
            this.sidePots.push({
                amount: this.pot,
                eligiblePlayers: players
            });
        }
    }

    /**
     * Handle showdown logic: Reveal order, mucking, and awarding pots
     */
    handleShowdown(activePlayers) {
        // 1. Determine Start Player for reveal
        // If there was aggression on the river, start with last aggressor.
        // If river checked through (lastAggressor is null), start with first active player left of button (SB, BB, etc.)
        let startPlayerIndex = 0;

        if (this.lastAggressor && activePlayers.includes(this.lastAggressor)) {
            startPlayerIndex = activePlayers.indexOf(this.lastAggressor);
        } else {
            // Find first active player after dealer button
            // activePlayers are already sorted by VISUAL_SEAT_ORDER? No, this.players is sorted.
            // activePlayers is a filtered subset, preserving order.
            // But we need to find who is "next" after dealer in the circular list of active players.

            // Actually, this.players is sorted by VISUAL_SEAT_ORDER (clockwise).
            // So we just need to find the first active player whose index > dealerPosition
            // If none, wrap around to index 0.

            // Let's rely on the fact that this.players is sorted clockwise.
            // We need to find the active player closest to the left of the dealer.
            const dealerSeatIndex = this.players.findIndex(p => p.seatNumber === this.lastDealerSeat);

            // Re-sort activePlayers to ensure they are in clockwise order starting from dealer+1
            // But activePlayers is just a filter of this.players, so it's already in clockwise order relative to table start (seat 0 usually?)
            // No, this.players is sorted by VISUAL_SEAT_ORDER.

            // Let's find the index in activePlayers that corresponds to the "first to act" logic
            // Simple approach: Iterate activePlayers, find one "after" dealer.

            // Since this.players is sorted clockwise:
            // [P1, P2, P3(D), P4, P5]
            // Active: [P1, P3, P5]
            // Dealer is P3. Next active is P5.

            // Find index of dealer in this.players
            const dealerIdx = this.players.findIndex(p => p.seatNumber === this.lastDealerSeat);

            // Find first active player with index > dealerIdx
            const nextActive = activePlayers.find(p => this.players.indexOf(p) > dealerIdx);

            if (nextActive) {
                startPlayerIndex = activePlayers.indexOf(nextActive);
            } else {
                // Wrap around
                startPlayerIndex = 0;
            }
        }

        // 2. Create Reveal Order (Clockwise from Start Player)
        const revealOrder = [
            ...activePlayers.slice(startPlayerIndex),
            ...activePlayers.slice(0, startPlayerIndex)
        ];

        // 3. Evaluate all hands first to know who the absolute winners are
        const playerHands = activePlayers.map(player => ({
            player,
            hand: HandEvaluator.evaluateHand(player.holeCards, this.communityCards)
        }));

        // We need to handle side pots, but for the "Reveal" logic, we generally look at the MAIN pot winners (or best hand overall)
        // to decide who mucks.
        // However, a player might lose the main pot but win a side pot. They should probably show?
        // "As soon as you have revealed the actual winning hand (the strongest of all remaining players)"
        // This implies we care about the best hand among ALL active players.

        const globalWinners = HandEvaluator.determineWinners(playerHands);

        // Find the hand object for the first winner to get the rank
        const winnerHandObj = playerHands.find(ph => ph.player === globalWinners[0]);
        const bestHandRank = winnerHandObj ? winnerHandObj.hand.rank : 0;

        // 4. Process Reveal Order
        const revealedHands = [];
        let currentBestHand = null;

        for (const player of revealOrder) {
            const playerHandObj = playerHands.find(ph => ph.player === player);
            const hand = playerHandObj.hand;

            let shouldShow = false;
            let isMucked = false;

            // First player always shows (bettor or first to act)
            if (revealedHands.length === 0) {
                shouldShow = true;
                currentBestHand = hand;
            } else {
                // Subsequent players:
                // Show if they beat or tie the current best revealed hand
                // OR if they are one of the global winners (e.g. for side pots or split pots)

                // Check if this hand is better than or equal to currentBestHand
                const comparison = HandEvaluator.compareHands(hand, currentBestHand);

                if (comparison >= 0) {
                    // New best hand (or tie)
                    shouldShow = true;
                    currentBestHand = hand;
                } else {
                    // Worse hand -> Muck
                    // BUT: Check if they won a side pot? 
                    // If they won a side pot, they MUST show to claim it.
                    // For now, let's stick to the user's rule: "Stop revealing any later players."
                    // If they are a global winner, they definitely show.
                    if (globalWinners.includes(player)) {
                        shouldShow = true;
                    } else {
                        shouldShow = false;
                        isMucked = true;
                    }
                }
            }

            revealedHands.push({
                socketId: player.socketId,
                nickname: player.nickname,
                hand: shouldShow ? hand.descr : null,
                holeCards: shouldShow ? player.holeCards : null, // Only send cards if shown
                isMucked: isMucked,
                isWinner: globalWinners.includes(player),
                handRank: shouldShow ? hand.name : null
            });
        }

        // 5. Award Pots (Backend Logic)
        // We still need to distribute chips correctly regardless of visual mucking
        const potResults = [];
        console.log(`[POT] Total pot: ${this.pot}, Side pots: ${this.sidePots.length}`);
        for (const sidePot of this.sidePots) {
            const potPlayerHands = sidePot.eligiblePlayers.map(player => ({
                player,
                hand: HandEvaluator.evaluateHand(player.holeCards, this.communityCards)
            }));

            const winners = HandEvaluator.determineWinners(potPlayerHands);
            const sharePerWinner = Math.floor(sidePot.amount / winners.length);
            const remainder = sidePot.amount - (sharePerWinner * winners.length); // Handle rounding

            console.log(`[POT] Side pot: ${sidePot.amount}, Winners: ${winners.map(w => w.nickname).join(', ')}, Share: ${sharePerWinner}`);

            for (const winner of winners) {
                const chipsBefore = winner.chips;
                winner.chips += sharePerWinner;
                // Award remainder to first winner (standard poker rule)
                if (winner === winners[0] && remainder > 0) {
                    winner.chips += remainder;
                }
                console.log(`[POT] ${winner.nickname}: ${chipsBefore} -> ${winner.chips} (+${sharePerWinner + (winner === winners[0] ? remainder : 0)})`);
            }

            potResults.push({
                amount: sidePot.amount,
                winners: winners.map(w => w.socketId)
            });
        }

        // Update stack for all players after hand ends (chips have been distributed)
        this.players.forEach(player => {
            if (player.seatNumber !== null) {
                console.log(`[STACK] ${player.nickname}: chips=${player.chips}, updating stack from ${player.stack} to ${player.chips}, totalContribution=${player.totalContribution}`);
                player.stack = player.chips;
                // Update scoreboard (at Room level)
                if (this.room.scoreboard.has(player.socketId)) {
                    const stats = this.room.scoreboard.get(player.socketId);
                    stats.stack = player.stack;
                }
                // Auto-stand-up players with 0 stack
                if (player.stack === 0) {
                    player.standUp();
                    console.log(`[AUTO-STANDUP] ${player.nickname} forced to stand up (0 stack)`);
                }
            }
        });

        return {
            showdown: true,
            revealedHands: revealedHands,
            potResults: potResults,
            communityCards: this.communityCards
        };
    }

    toJSON() {
        return {
            pot: this.pot,
            communityCards: this.communityCards,
            dealerPosition: this.dealerPosition,
            currentStreet: this.currentStreet,
            bettingRound: this.bettingRound ? this.bettingRound.toJSON() : null,
            currentPlayer: this.bettingRound ? this.bettingRound.getCurrentPlayer()?.socketId : null,
            minRaise: this.bettingRound ? this.bettingRound.minRaise : 0,
            currentBet: this.bettingRound ? this.bettingRound.currentBet : 0
        };
    }
}
