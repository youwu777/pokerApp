export class Player {
    constructor(socketId, nickname, buyinAmount = 1000) {
        this.socketId = socketId;
        this.nickname = nickname;
        this.buyin = buyinAmount; // Original buyin amount (never changes)
        this.stack = buyinAmount; // Persistent stack that stays with player in room
        this.seatNumber = null; // null = not seated, 0-9 = seat position
        this.chips = 0;
        this.currentBet = 0;
        this.totalContribution = 0; // Track total chips contributed this hand (for side pot calculation)
        this.holeCards = [];
        this.status = 'waiting'; // waiting, active, folded, all-in
        this.timeBank = 0; // Will be set from room settings when seated
        this.hasActed = false;
        this.lastAction = null; // fold, check, call, bet, raise, all-in
        this.position = null; // BTN, SB, BB, UTG, etc.
        this.standUpNextHand = false;
    }

    sitDown(seatNumber, timeBank) {
        this.seatNumber = seatNumber;
        this.chips = this.stack; // Restore chips from persistent stack
        this.timeBank = timeBank;
        this.status = 'active';
        this.standUpNextHand = false;
    }

    standUp() {
        this.stack = this.chips; // Save current chips to persistent stack
        this.seatNumber = null;
        this.chips = 0;
        this.status = 'waiting';
        this.holeCards = [];
        this.currentBet = 0;
        this.standUpNextHand = false;
    }

    bet(amount) {
        const actualBet = Math.min(amount, this.chips);
        this.chips -= actualBet;
        this.currentBet += actualBet;
        this.totalContribution += actualBet; // Track total contribution for the hand

        if (this.chips === 0) {
            this.status = 'all-in';
        }

        return actualBet;
    }

    fold() {
        this.status = 'folded';
        this.lastAction = 'fold';
        this.hasActed = true;
    }

    resetForNewHand() {
        this.currentBet = 0;
        this.totalContribution = 0; // Reset total contribution for new hand
        this.holeCards = [];
        this.hasActed = false;
        this.lastAction = null;

        // Always reset to active for a new hand (all-in status only applies to current hand)
        // If player has 0 chips, they should have been stood up already
        if (this.status !== 'folded') {
            this.status = 'active';
        }
    }

    resetForNewRound() {
        // Don't reset totalContribution - it tracks the entire hand
        this.currentBet = 0; // Reset current street bet
        this.hasActed = false;
    }

    toJSON() {
        return {
            socketId: this.socketId,
            nickname: this.nickname,
            buyin: this.buyin,
            stack: this.stack,
            seatNumber: this.seatNumber,
            chips: this.chips,
            currentBet: this.currentBet,
            status: this.status,
            timeBank: this.timeBank,
            lastAction: this.lastAction,
            position: this.position,
            standUpNextHand: this.standUpNextHand,
            // Don't include hole cards in public JSON
        };
    }
}
