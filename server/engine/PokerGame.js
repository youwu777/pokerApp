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
        // Rabbit hunt
        this.rabbitHuntCards = []; // Cards available for rabbit hunt
        this.rabbitHuntRevealed = false; // Whether rabbit hunt has been triggered
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

        // Process approved buy-ins before resetting players
        this.room.approvedBuyIns.forEach((amount, playerId) => {
            const player = this.players.find(p => p.playerId === playerId);
            if (player) {
                console.log(`[BUYIN] Adding $${amount} to ${player.nickname}'s stack (was ${player.stack}) and chips (was ${player.chips})`);
                player.stack += amount;
                player.buyin += amount; // Update total buy-in amount
                // If player is already seated, also update their chips (what's displayed/used in game)
                if (player.seatNumber !== null) {
                    player.chips += amount;
                    console.log(`[BUYIN] Updated ${player.nickname}'s chips to ${player.chips}`);
                }
                // Update scoreboard
                if (this.room.scoreboard.has(playerId)) {
                    const stats = this.room.scoreboard.get(playerId);
                    stats.buyin = player.buyin;
                    stats.stack = player.stack;
                }
            } else {
                // Player not in current hand (not seated), but still update their stack for when they sit
                const allPlayer = this.room.getPlayerById ? this.room.getPlayerById(playerId) : this.room.getPlayer(playerId);
                if (allPlayer) {
                    console.log(`[BUYIN] Adding $${amount} to ${allPlayer.nickname}'s stack (player not in current hand, was ${allPlayer.stack})`);
                    allPlayer.stack += amount;
                    allPlayer.buyin += amount;
                    // Update scoreboard
                    if (this.room.scoreboard.has(playerId)) {
                        const stats = this.room.scoreboard.get(playerId);
                        stats.buyin = allPlayer.buyin;
                        stats.stack = allPlayer.stack;
                    }
                }
            }
        });
        // Clear approved buy-ins after processing
        this.room.approvedBuyIns.clear();

        // Ensure chips are synced with stack for all seated players (after buy-ins processed)
        this.players.forEach(player => {
            if (player.seatNumber !== null) {
                // If chips don't match stack, sync them (buy-ins should have updated both, but safety check)
                if (player.chips !== player.stack) {
                    console.log(`[BUYIN] Syncing chips with stack for ${player.nickname}: chips=${player.chips}, stack=${player.stack}`);
                    player.chips = player.stack;
                }
            }
        });

        // Reset players for new hand
        this.players.forEach(p => p.resetForNewHand());

        // Recharge timebank: add 1/5 of max timebank each hand (capped at max)
        const maxTimebank = this.room.settings.timeBank;
        const rechargeAmount = Math.floor(maxTimebank / 5);
        this.players.forEach(p => {
            if (p.seatNumber !== null) { // Only recharge for seated players
                const newTimebank = Math.min(p.timeBank + rechargeAmount, maxTimebank);
                console.log(`[TIMEBANK-RECHARGE] ${p.nickname}: ${p.timeBank}s + ${rechargeAmount}s = ${newTimebank}s (max: ${maxTimebank}s)`);
                p.timeBank = newTimebank;
            }
        });

        // Add players to scoreboard if not already there (scoreboard is at Room level)
        this.players.forEach(player => {
            const key = player.playerId || player.sessionToken || player.socketId;
            if (!this.room.scoreboard.has(key)) {
                this.room.scoreboard.set(key, {
                    playerId: key,
                    sessionToken: player.sessionToken,
                    socketId: player.socketId,
                    nickname: player.nickname,
                    buyin: player.buyin,
                    stack: player.stack,
                    isActive: true,
                    isConnected: true
                });
            } else {
                // Update existing entry to mark as active
                const stats = this.room.scoreboard.get(key);
                stats.isActive = true;
                stats.isConnected = true;
                stats.stack = player.stack; // Update stack from current player
                stats.socketId = player.socketId;
                stats.sessionToken = player.sessionToken;
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

        // Reset rabbit hunt state
        this.rabbitHuntCards = [];
        this.rabbitHuntRevealed = false;

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

        // Check if fold ended the hand (only one player remaining)
        if (result.success && result.handEnded) {
            console.log('[DEBUG] Fold ended the hand, only one player remaining');
            // Collect bets from ALL players in the game (including folded ones) before ending hand
            // This ensures all bets from current and previous rounds are included
            let totalCollected = 0;
            for (const player of this.players) {
                if (player.currentBet > 0) {
                    const betAmount = player.currentBet;
                    totalCollected += betAmount;
                    player.currentBet = 0; // Reset after collecting
                    console.log(`[DEBUG] Collected ${betAmount} from ${player.nickname} (status: ${player.status})`);
                }
            }
            this.pot += totalCollected;
            console.log(`[DEBUG] Collected ${totalCollected} from all players, total pot: ${this.pot}`);
            
            const showdownResults = this.endHand();
            result.showdownResults = showdownResults;
            this.bettingRound = null;
            return result;
        }

        if (result.success && this.bettingRound && this.bettingRound.isComplete()) {
            console.log('[DEBUG] Betting round complete, advancing street...');
            const advanceResult = this.advanceStreet();
            if (advanceResult) {
                // Check if this is an all-in showdown with cards to reveal progressively
                if (advanceResult.cardsToReveal && advanceResult.allInShowdown) {
                    console.log('[DEBUG] All-in showdown, cards will be revealed progressively');
                    result.cardsToReveal = advanceResult.cardsToReveal;
                    result.allInShowdown = true;
                    // Don't end hand yet - wait for cards to be revealed
                    // The socket handler will manage the progressive reveal
                } else {
                    // Normal showdown results
                    console.log('[DEBUG] Showdown results from advanceStreet:', advanceResult);
                    result.showdownResults = advanceResult;
                    // Clear betting round when hand ends
                    this.bettingRound = null;
                }
            } else {
                console.log('[DEBUG] advanceStreet returned null, hand continues to next street');
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
            // Run out remaining streets - cards will be revealed progressively
            const cardsToReveal = this.runOutBoard();
            // Add all cards immediately for endHand calculation, but return special flag
            // The actual reveal will be handled by the socket handler
            return { cardsToReveal, allInShowdown: true };
        }
        
        // If only one player can act, skip to showdown (no point in betting with no one to bet against)
        if (playersCanAct.length === 1) {
            console.log(`[DEBUG] Only one player can act (${playersCanAct[0].nickname}), skipping to showdown`);
            // Run out remaining streets - cards will be revealed progressively
            const cardsToReveal = this.runOutBoard();
            // Add all cards immediately for endHand calculation, but return special flag
            return { cardsToReveal, allInShowdown: true };
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
     * Returns the cards that need to be revealed (for progressive reveal)
     * For all-in showdowns, cards are NOT added to communityCards immediately
     * They will be added progressively as they're revealed
     */
    runOutBoard() {
        const cardsToReveal = [];
        const cardsNeeded = 5 - this.communityCards.length;
        
        // Safety check: ensure we have enough cards in deck
        if (this.deck.length < cardsNeeded * 2) {
            console.error(`[ERROR] Not enough cards in deck! Need ${cardsNeeded * 2}, have ${this.deck.length}`);
            // Add cards immediately if deck is insufficient (fallback)
            while (this.communityCards.length < 5 && this.deck.length >= 2) {
                this.deck.pop(); // Burn card
                const card = this.deck.pop();
                if (card) {
                    this.communityCards.push(card);
                }
            }
            return []; // Return empty array - cards already added
        }
        
        // Pop cards but don't add to communityCards yet
        for (let i = 0; i < cardsNeeded; i++) {
            if (this.deck.length < 2) {
                console.error(`[ERROR] Deck ran out of cards during runOutBoard!`);
                break;
            }
            this.deck.pop(); // Burn card
            const card = this.deck.pop();
            if (card) {
                cardsToReveal.push(card);
            } else {
                console.error(`[ERROR] Popped undefined card from deck!`);
                break;
            }
        }
        
        return cardsToReveal;
    }
    
    /**
     * Add a card to community cards (used for progressive reveal)
     */
    addCommunityCard(card) {
        this.communityCards.push(card);
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
                    const key = player.playerId || player.sessionToken || player.socketId;
                    if (this.room.scoreboard.has(key)) {
                        const stats = this.room.scoreboard.get(key);
                        stats.stack = player.stack;
                    }
                    // Note: Players with 0 stack will be auto-standup before the next hand starts (in handlers.js)
                }
            });
            this.room.handCount++;
            this.bettingRound = null; // Clear betting round

            // Calculate rabbit hunt cards (if hand ended early)
            this.calculateRabbitHuntCards();

            return {
                winners: [activePlayers[0]],
                pot: this.pot,
                winningHand: null,
                showdown: false, // Flag to indicate no showdown occurred
                rabbitHunt: this.getRabbitHuntState()
            };
        }

        // Calculate side pots if needed
        this.calculateSidePots();

        // Handle Showdown Logic (Case 2, 3, 4)
        const results = this.handleShowdown(activePlayers);
        this.room.handCount++;
        this.bettingRound = null; // Clear betting round to prevent further actions

        // Calculate rabbit hunt cards (if hand ended early)
        this.calculateRabbitHuntCards();

        // Add rabbit hunt state to results
        results.rabbitHunt = this.getRabbitHuntState();

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
                const potAmount = Math.min(potSize, remainingPot);
                this.sidePots.push({
                    amount: potAmount,
                    eligiblePlayers: eligiblePlayers
                });

                // Fix: Decrement by actual amount added, not calculated potSize
                remainingPot -= potAmount;
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

        // Handle dead money (from folded players)
        // Any remaining pot that wasn't allocated to side pots should go to the first (main) pot
        const totalSidePots = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        const deadMoney = this.pot - totalSidePots;
        if (deadMoney > 0.01 && this.sidePots.length > 0) {
            console.log(`[SIDE-POT] Dead money from folded players: $${deadMoney.toFixed(2)} - adding to main pot`);
            this.sidePots[0].amount += deadMoney;
        }

        // Validation: Ensure side pots sum equals total pot (after adding dead money)
        const finalTotalSidePots = this.sidePots.reduce((sum, pot) => sum + pot.amount, 0);
        if (Math.abs(finalTotalSidePots - this.pot) > 0.01) {
            console.error(`[ERROR] Side pot calculation mismatch! Side pots total: ${finalTotalSidePots}, Actual pot: ${this.pot}`);
            console.error(`[ERROR] Side pots:`, this.sidePots.map(p => `${p.amount} (${p.eligiblePlayers.map(pl => pl.nickname).join(',')})`));
        }

        console.log(`[SIDE-POT] Created ${this.sidePots.length} pot(s):`,
            this.sidePots.map((p, idx) => `Pot ${idx + 1}: $${p.amount} (${p.eligiblePlayers.map(pl => pl.nickname).join(', ')})`).join(' | ')
        );
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
                holeCards: player.holeCards, // Always send cards so they remain visible until next hand
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
            // Validate that all eligible players have hole cards
            const invalidPlayers = sidePot.eligiblePlayers.filter(p => !p.holeCards || p.holeCards.length !== 2);
            if (invalidPlayers.length > 0) {
                console.error(`[ERROR] Players without valid hole cards:`, invalidPlayers.map(p => p.nickname));
                // Skip these players from the pot
                sidePot.eligiblePlayers = sidePot.eligiblePlayers.filter(p => p.holeCards && p.holeCards.length === 2);
            }

            const potPlayerHands = sidePot.eligiblePlayers.map(player => ({
                player,
                hand: HandEvaluator.evaluateHand(player.holeCards, this.communityCards)
            }));

            const winners = HandEvaluator.determineWinners(potPlayerHands);
            const sharePerWinner = Math.floor(sidePot.amount / winners.length);
            const remainder = sidePot.amount - (sharePerWinner * winners.length); // Handle rounding

            console.log(`[POT] Side pot: ${sidePot.amount}, Winners: ${winners.map(w => w.nickname).join(', ')}, Share: ${sharePerWinner}, Remainder: ${remainder}`);

            // Award chips to winners
            for (const winner of winners) {
                const chipsBefore = winner.chips;
                winner.chips += sharePerWinner;
                console.log(`[POT] ${winner.nickname}: ${chipsBefore} -> ${winner.chips} (+${sharePerWinner})`);
            }

            // Award odd chips to winner closest to left of button (standard poker rule)
            if (remainder > 0 && winners.length > 0) {
                // Find the dealer index in the full players list
                const dealerIdx = this.players.findIndex(p => p.seatNumber === this.lastDealerSeat);

                // Sort winners by their position relative to dealer (clockwise from dealer)
                const winnersWithPosition = winners.map(winner => {
                    const winnerIdx = this.players.indexOf(winner);
                    // Calculate distance from dealer (clockwise)
                    // Distance 0 = dealer, 1 = first player left of dealer, etc.
                    const distance = (winnerIdx - dealerIdx + this.players.length) % this.players.length;
                    return { winner, distance, winnerIdx };
                });

                // Sort by distance, but prefer distance > 0 (first player left of button, not button itself)
                // If all winners have distance 0 (shouldn't happen), take the first
                winnersWithPosition.sort((a, b) => {
                    // If one has distance 0 and other doesn't, prefer the non-zero
                    if (a.distance === 0 && b.distance !== 0) return 1;
                    if (a.distance !== 0 && b.distance === 0) return -1;
                    // Otherwise sort by distance ascending
                    return a.distance - b.distance;
                });

                const oddChipWinner = winnersWithPosition[0].winner;
                oddChipWinner.chips += remainder;
                console.log(`[POT] Odd chip(s) (+${remainder}) awarded to ${oddChipWinner.nickname} (closest to left of button, position ${winnersWithPosition[0].distance})`);
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
                const key = player.playerId || player.sessionToken || player.socketId;
                if (this.room.scoreboard.has(key)) {
                    const stats = this.room.scoreboard.get(key);
                    stats.stack = player.stack;
                }
                // Note: Players with 0 stack will be auto-standup before the next hand starts (in handlers.js)
            }
        });

        return {
            showdown: true,
            revealedHands: revealedHands,
            potResults: potResults,
            communityCards: this.communityCards
        };
    }

    /**
     * Calculate cards available for rabbit hunt
     * Should be called when hand ends before river
     */
    calculateRabbitHuntCards() {
        if (!this.room.settings.allowRabbitHunt) {
            this.rabbitHuntCards = [];
            return;
        }

        const cardsNeeded = 5 - this.communityCards.length;

        if (cardsNeeded <= 0) {
            // All community cards dealt, no rabbit hunt available
            this.rabbitHuntCards = [];
            return;
        }

        // Pop cards from deck (with burn cards)
        this.rabbitHuntCards = [];
        for (let i = 0; i < cardsNeeded; i++) {
            if (this.deck.length < 2) {
                console.error(`[RABBIT-HUNT] Not enough cards in deck!`);
                break;
            }
            this.deck.pop(); // Burn card
            const card = this.deck.pop();
            if (card) {
                this.rabbitHuntCards.push(card);
            }
        }

        console.log(`[RABBIT-HUNT] ${this.rabbitHuntCards.length} cards available for rabbit hunt`);
        this.rabbitHuntRevealed = false;
    }

    /**
     * Trigger rabbit hunt - reveal the undealt cards
     * Returns the revealed cards
     */
    triggerRabbitHunt() {
        if (!this.room.settings.allowRabbitHunt) {
            return { success: false, message: 'Rabbit hunt is disabled' };
        }

        // Ensure hand has ended and pot has been collected
        if (this.bettingRound !== null) {
            return { success: false, message: 'Hand is still in progress' };
        }

        if (this.rabbitHuntRevealed) {
            return { success: false, message: 'Rabbit hunt already revealed' };
        }

        if (this.rabbitHuntCards.length === 0) {
            return { success: false, message: 'No cards available for rabbit hunt' };
        }

        this.rabbitHuntRevealed = true;
        console.log(`[RABBIT-HUNT] Revealed ${this.rabbitHuntCards.length} cards:`, this.rabbitHuntCards);

        return {
            success: true,
            cards: this.rabbitHuntCards,
            communityCardsIfDealt: [...this.communityCards, ...this.rabbitHuntCards]
        };
    }

    /**
     * Get rabbit hunt state for client
     */
    getRabbitHuntState() {
        // Only make available if hand has ended (bettingRound is null)
        const isHandEnded = this.bettingRound === null;

        return {
            available: isHandEnded && this.rabbitHuntCards.length > 0 && !this.rabbitHuntRevealed,
            revealed: this.rabbitHuntRevealed,
            cardCount: this.rabbitHuntCards.length,
            cards: this.rabbitHuntRevealed ? this.rabbitHuntCards : null
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
            currentBet: this.bettingRound ? this.bettingRound.currentBet : 0,
            rabbitHunt: this.getRabbitHuntState()
        };
    }
}
